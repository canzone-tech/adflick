/// Strict parser for the NestJS /api/v1/devices/:id/manifest v1 contract.
/// Neither a signed URL nor a grant is proof that an ad was actually displayed.
class AdEntry {
  final String assetId;
  final String mimeType;
  final Uri mediaUrl;
  final String authorizationId;
  final String authorizationToken;
  final DateTime authorizationExpiresAt;
  final int? expectedDurationMs;
  final String? campaignId;
  final String? playlistId;
  final String title;

  AdEntry._(this.assetId, this.mimeType, this.mediaUrl, this.authorizationId,
      this.authorizationToken, this.authorizationExpiresAt, this.expectedDurationMs,
      this.campaignId, this.playlistId, this.title);

  static AdEntry? fromJson(Object? value, DateTime now, {bool allowDebugHttp = false}) {
    if (value is! Map<String, dynamic>) return null;
    final asset = value['asset'];
    final auth = value['authorization'];
    if (asset is! Map<String, dynamic> || auth is! Map<String, dynamic>) return null;
    final id = asset['id'], mime = asset['mimeType'], rawUrl = asset['mediaUrl'];
    final authorizationId = auth['id'], token = auth['token'];
    if (id is! String || id.isEmpty || mime is! String ||
        authorizationId is! String || authorizationId.isEmpty ||
        token is! String || token.length < 20 || rawUrl is! String) return null;
    if (!{'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'}.contains(mime)) return null;
    final url = Uri.tryParse(rawUrl);
    final secure = url?.scheme == 'https';
    final local = allowDebugHttp && url?.scheme == 'http' &&
        {'127.0.0.1', 'localhost', '10.0.2.2'}.contains(url?.host);
    if (url == null || !url.hasAuthority || !(secure || local)) return null;
    final expiry = DateTime.tryParse(auth['expiresAt'] is String ? auth['expiresAt'] as String : '');
    if (expiry == null || !expiry.isAfter(now)) return null;
    final duration = asset['durationMs'];
    final durationMs = duration is int && duration > 0 && duration <= 86400000 ? duration : null;
    if (value['campaignId'] is! String && value['playlistId'] is! String) return null;
    return AdEntry._(id, mime, url, authorizationId, token, expiry,
        durationMs, value['campaignId'] as String?, value['playlistId'] as String?,
        asset['title'] is String ? asset['title'] as String : 'Advertisement');
  }
}

class AdManifest {
  final DateTime expiresAt;
  final int refreshAfterSeconds;
  final List<AdEntry> entries;
  AdManifest(this.expiresAt, this.refreshAfterSeconds, this.entries);

  factory AdManifest.fromJson(Object? source, DateTime now, {bool allowDebugHttp = false}) {
    if (source is! Map<String, dynamic> || source['schemaVersion'] != 1) {
      throw const FormatException('Unsupported device manifest version');
    }
    final expiresAt = DateTime.tryParse(source['expiresAt'] is String ? source['expiresAt'] as String : '');
    if (expiresAt == null || !expiresAt.isAfter(now)) throw const FormatException('Manifest is expired');
    final rawEntries = source['entries'];
    if (rawEntries is! List) throw const FormatException('Manifest entries missing');
    final entries = rawEntries
        .map((entry) => AdEntry.fromJson(entry, now, allowDebugHttp: allowDebugHttp))
        .whereType<AdEntry>()
        .where((entry) => entry.authorizationExpiresAt.isBefore(expiresAt) ||
            entry.authorizationExpiresAt.isAtSameMomentAs(expiresAt))
        .toList(growable: false);
    final refresh = source['refreshAfterSeconds'];
    return AdManifest(expiresAt, refresh is int ? refresh.clamp(15, 60) : 60, entries);
  }
}
