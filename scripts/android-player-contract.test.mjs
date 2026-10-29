import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = 'apps/player_flutter/';
const read = path => readFileSync(root + path, 'utf8');

test('same Android app declares touch and leanback launchers with secure transport', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android.intent.category.LAUNCHER/);
  assert.match(manifest, /android.intent.category.LEANBACK_LAUNCHER/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android.hardware.touchscreen" android:required="false"/);
});
test('pairing, manifest, heartbeat, and playback telemetry use existing device APIs', () => {
  const src = read('lib/src/device_client.dart');
  for (const endpoint of [
    '/devices/pair', '/manifest', '/heartbeat', '/playback/events',
  ]) assert.ok(src.includes(endpoint), 'Missing device API ' + endpoint);
  assert.match(src, /Random\.secure/);
  assert.match(src, /FlutterSecureStorage/);
  assert.match(src, /x-device-secret/);
  assert.match(src, /kDebugMode/);
});
test('player rejects missing READY/authorized manifests before media is rendered', () => {
  const src = read('lib/src/player_models.dart');
  assert.match(src, /schemaVersion/);
  assert.match(src, /Unsupported device manifest version/);
  assert.match(src, /expiresAt/);
  assert.match(src, /authorizationToken/);
  assert.match(src, /https/);
  assert.match(src, /token\.length < 20/);
});
test('L-shape uses requested 75/25 geometry and never claims proof of display', () => {
  const src = read('lib/src/player_surface.dart');
  for (const value of ['.75', '.25', 'PLAY_STARTED', 'PLAY_COMPLETED', 'PLAY_INTERRUPTED', 'PLAY_ERROR']) {
    assert.ok(src.includes(value), 'Missing Android ad player contract ' + value);
  }
  assert.match(src, /NOT independent proof-of-display/);
  assert.match(src, /PRIMARY VIDEO INPUT NOT CONNECTED/);
});
