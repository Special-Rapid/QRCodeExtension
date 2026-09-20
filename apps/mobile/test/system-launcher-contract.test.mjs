import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Android Tile starts one-time screen capture without overlay permission', async () => {
  const [manifest, service] = await Promise.all([
    read('../android/app/src/main/AndroidManifest.xml'),
    read('../android/app/src/main/java/com/snkisk/qrscan/ScanTileService.kt'),
  ]);
  assert.match(manifest, /android\.permission\.BIND_QUICK_SETTINGS_TILE/);
  assert.doesNotMatch(manifest, /SYSTEM_ALERT_WINDOW/);
  assert.match(manifest, /FOREGROUND_SERVICE_MEDIA_PROJECTION/);
  assert.doesNotMatch(manifest, /android\.intent\.action\.SEND/);
  assert.match(service, /ScreenCaptureActivity/);
  assert.match(service, /PendingIntent\.FLAG_IMMUTABLE/);
});

test('iOS Control opens the local image selection screen without carrying scan data', async () => {
  const [intent, route, imageRoute] = await Promise.all([
    read('../ios/QRScanControls/QRScanIntent.swift'),
    read('../src/app/scan.tsx'),
    read('../src/app/image-scan.tsx'),
  ]);
  assert.match(intent, /qrscan:\/\/image-scan\?entry=control-center/);
  assert.doesNotMatch(intent, /token|data|credential/i);
  assert.match(route, /<Redirect href=\{\{ pathname: '\/'/);
  assert.match(imageRoute, /launchImageLibraryAsync/);
});

test('theme and language preferences expose System, Light, Dark, Japanese, and English resources', async () => {
  const [preferences, strings, settings] = await Promise.all([
    read('../src/lib/preferences.tsx'),
    read('../src/lib/strings.ts'),
    read('../src/app/settings.tsx'),
  ]);
  assert.match(preferences, /fallbackLocale: ResolvedLocale = 'ja'/);
  assert.match(preferences, /resolveSystemLocale/);
  assert.match(strings, /ja: \{/);
  assert.match(strings, /en: \{/);
  assert.match(settings, /\['system', 'light', 'dark'\]/);
  assert.match(settings, /\['system', 'ja', 'en'\]/);
});

test('scanner PC link stays an explicit one-line pairing action with an accessible target', async () => {
  const [scanner, strings, theme] = await Promise.all([
    read('../src/app/index.tsx'),
    read('../src/lib/strings.ts'),
    read('../src/lib/theme.ts'),
  ]);
  assert.match(scanner, /router\.push\('\/pair'\)/);
  assert.match(scanner, /numberOfLines=\{1\}/);
  assert.match(scanner, /\{t\.pcLinkSettings\}/);
  assert.match(strings, /pcLinkSettings: 'PC連携'/);
  assert.match(strings, /pcLinkSettings: 'PC link'/);
  assert.match(theme, /topAction: \{ width: 44, height: 44/);
  assert.match(theme, /topActionLink: \{ width: 80, paddingHorizontal: 10 \}/);
});
