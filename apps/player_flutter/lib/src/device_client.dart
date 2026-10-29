import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'player_models.dart';

class DeviceCredentials {
  final Uri apiBase;
  final String screenId;
  final String secret;
  const DeviceCredentials(this.apiBase, this.screenId, this.secret);
}

class DeviceApiException implements Exception {
  final String reason;
  const DeviceApiException(this.reason);
  @override
  String toString() => reason;
}

/// The device secret is stored in Android Keystore-backed secure storage.
class DeviceClient {
  final FlutterSecureStorage secureStorage;
  final http.Client httpClient;
  DeviceClient({FlutterSecureStorage? storage, http.Client? client})
      : secureStorage = storage ?? const FlutterSecureStorage(),
        httpClient = client ?? http.Client();

  static Uri parseBase(String raw) {
    final uri = Uri.tryParse(raw.trim());
    if (uri == null || !uri.hasAuthority || uri.userInfo.isNotEmpty ||
        uri.hasQuery || uri.hasFragment ||
        !(uri.scheme == 'https' ||
          (kDebugMode && uri.scheme == 'http' &&
           {'localhost', '127.0.0.1', '10.0.2.2'}.contains(uri.host)))) {
      throw const FormatException('Use a trusted HTTPS server URL (localhost HTTP only in debug).');
    }
    return uri.replace(path: '/api/v1', query: null, fragment: null);
  }

  Uri _url(DeviceCredentials c, String endpoint) =>
      c.apiBase.replace(path: '${c.apiBase.path}$endpoint');

  Future<DeviceCredentials?> restore() async {
    final base = await secureStorage.read(key: 'player_api');
    final screen = await secureStorage.read(key: 'player_screen');
    final secret = await secureStorage.read(key: 'player_secret');
    if (base == null || screen == null || secret == null || secret.length < 20) return null;
    try { return DeviceCredentials(parseBase(base), screen, secret); }
    on FormatException { return null; }
  }

  Future<DeviceCredentials> pair(String server, String code, String platform) async {
    final base = parseBase(server);
    final random = Random.secure();
    final secret = base64Url.encode(List<int>.generate(32, (_) => random.nextInt(256)));
    final response = await httpClient.post(
      base.replace(path: '${base.path}/devices/pair'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'code': code.trim().toUpperCase(),
        'deviceSecret': secret,
        'platform': platform,
        'playerVersion': '0.1.0',
      }),
    ).timeout(const Duration(seconds: 12));
    if (response.statusCode != 201) throw const DeviceApiException('Pairing refused or expired. Request a new code.');
    final payload = jsonDecode(response.body);
    if (payload is! Map<String,dynamic> ||
        payload['success'] != true || payload['screenId'] is! String) {
      throw const DeviceApiException('Invalid device pairing response.');
    }
    final credentials = DeviceCredentials(base, payload['screenId'] as String, secret);
    // Persist a complete credential set before offering playout.
    await secureStorage.write(key: 'player_api', value: server.trim());
    await secureStorage.write(key: 'player_screen', value: credentials.screenId);
    await secureStorage.write(key: 'player_secret', value: credentials.secret);
    return credentials;
  }

  Future<AdManifest> manifest(DeviceCredentials c) async {
    final response = await httpClient.get(
      _url(c, '/devices/${Uri.encodeComponent(c.screenId)}/manifest'),
      headers: {'x-device-secret': c.secret},
    ).timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) throw const DeviceApiException('Authorized manifest unavailable.');
    return AdManifest.fromJson(jsonDecode(response.body), DateTime.now().toUtc(),
      allowDebugHttp: kDebugMode);
  }

  Future<void> heartbeat(DeviceCredentials c, String platform, {String? playerError}) async {
    final response = await httpClient.post(
      _url(c, '/devices/${Uri.encodeComponent(c.screenId)}/heartbeat'),
      headers: {'Content-Type': 'application/json', 'x-device-secret': c.secret},
      body: jsonEncode({
        'platform': platform, 'playerVersion': '0.1.0',
        'syncStatus': playerError == null ? 'SYNCED' : 'ERROR',
        'capabilities': {'androidPhone': true, 'androidTv': true, 'manifestVersion': 1,
          'supports': ['FULLSCREEN', 'L_BAND'], 'mode': 'DEVELOPMENT'},
        if (playerError != null) 'playerError': playerError.substring(0, min(200, playerError.length)),
      }),
    ).timeout(const Duration(seconds: 12));
    if (response.statusCode != 201) throw const DeviceApiException('Heartbeat rejected by server.');
  }

  /// Device-reported telemetry only; never independent proof or reward eligibility.
  Future<bool> reportEvent(DeviceCredentials c, AdEntry entry, String eventType, {
    required String eventId, DateTime? startedAt, DateTime? completedAt,
    int? durationMs,
  }) async {
    if (entry.authorizationExpiresAt.isBefore(DateTime.now().toUtc())) return false;
    final payload = {
      'eventId': eventId, 'eventType': eventType, 'assetId': entry.assetId,
      if (entry.campaignId != null) 'campaignId': entry.campaignId,
      if (entry.playlistId != null) 'playlistId': entry.playlistId,
      'authorizationId': entry.authorizationId,
      'authorizationToken': entry.authorizationToken,
      if (startedAt != null) 'startedAt': startedAt.toUtc().toIso8601String(),
      if (completedAt != null) 'completedAt': completedAt.toUtc().toIso8601String(),
      if (durationMs != null) 'durationMs': durationMs,
      if (entry.expectedDurationMs != null) 'expectedDurationMs': entry.expectedDurationMs,
      'clientReportedAt': DateTime.now().toUtc().toIso8601String(),
    };
    final response = await httpClient.post(
      _url(c, '/devices/${Uri.encodeComponent(c.screenId)}/playback/events'),
      headers: {'Content-Type': 'application/json', 'x-device-secret': c.secret},
      body: jsonEncode({'events': [payload]}),
    ).timeout(const Duration(seconds: 15));
    if (response.statusCode != 201) return false;
    final json = jsonDecode(response.body);
    return json is Map<String,dynamic> && json['accepted'] == 1;
  }

  Future<void> clear() async {
    await secureStorage.delete(key: 'player_secret');
    await secureStorage.delete(key: 'player_screen');
    await secureStorage.delete(key: 'player_api');
  }

  void close() => httpClient.close();
}
