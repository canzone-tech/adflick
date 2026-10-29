import 'package:flutter_test/flutter_test.dart';
import 'package:adflick_player/src/player_models.dart';

void main() {
  final now = DateTime.utc(2026, 10, 29, 12);
  Map<String, dynamic> entry({String url = 'https://cdn.example.test/ad.png', String token = 'abcdefghijklmnopqrstuvwxyz1234567890'}) => {
    'campaignId': 'campaign1',
    'asset': {'id':'asset1', 'title':'Test-only ad', 'mimeType':'image/png',
      'durationMs':15000, 'mediaUrl':url},
    'authorization': {'id':'grant1', 'token':token, 'expiresAt':'2026-10-29T12:03:00Z'}
  };
  Map<String,dynamic> manifest(List<dynamic> entries) => {
    'schemaVersion':1, 'expiresAt':'2026-10-29T12:05:00Z',
    'refreshAfterSeconds':60, 'entries':entries,
  };

  test('accepts bounded HTTPS creative with live server authorization', () {
    final result = AdManifest.fromJson(manifest([entry()]), now);
    expect(result.entries, hasLength(1));
    expect(result.entries.single.expectedDurationMs, 15000);
    expect(result.entries.single.authorizationId, 'grant1');
  });
  test('rejects plain HTTP and expired/short-lived grants', () {
    expect(AdManifest.fromJson(manifest([entry(url:'http://cdn.example.test/ad.png')]),now).entries, isEmpty);
    expect(AdManifest.fromJson(manifest([entry(token:'short')]),now).entries,isEmpty);
    expect(AdManifest.fromJson(manifest([entry()]),DateTime.utc(2026,10,29,12,4)).entries,isEmpty);
  });
  test('rejects unsupported manifest versions and expired manifests', () {
    expect(() => AdManifest.fromJson({...manifest([]), 'schemaVersion':2}, now),throwsFormatException);
    expect(() => AdManifest.fromJson(manifest([]),DateTime.utc(2026,10,29,12,6)),throwsFormatException);
  });
  test('does not accept unknown media types or unbound asset grants', () {
    final unsupported = entry();
    (unsupported['asset'] as Map<String,dynamic>)['mimeType'] = 'text/html';
    expect(AdManifest.fromJson(manifest([unsupported]),now).entries,isEmpty);
    final noCampaign = entry()..remove('campaignId');
    expect(AdManifest.fromJson(manifest([noCampaign]),now).entries,isEmpty);
  });
}
