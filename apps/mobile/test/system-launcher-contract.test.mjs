import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Android Tile opens only the private scanner deep link without overlay permission', async () => {
  const [manifest, service] = await Promise.all([
    read('../android/app/src/main/AndroidManifest.xml'),
    read('../android/app/src/main/java/com/snkisk/qrscan/ScanTileService.kt'),
  ]);
  assert.match(manifest, /android\.permission\.BIND_QUICK_SETTINGS_TILE/);
  assert.doesNotMatch(manifest, /SYSTEM_ALERT_WINDOW/);
  assert.match(service, /qrscan:\/\/scan\?entry=quick-settings/);
  assert.match(service, /setPackage\(packageName\)/);
  assert.match(service, /PendingIntent\.FLAG_IMMUTABLE/);
});

test('iOS Control and router target the scanner without carrying scan data', async () => {
  const [intent, route] = await Promise.all([
    read('../ios/QRScanControls/QRScanIntent.swift'),
    read('../src/app/scan.tsx'),
  ]);
  assert.match(intent, /qrscan:\/\/scan\?entry=control-center/);
  assert.doesNotMatch(intent, /token|data|credential/i);
  assert.match(route, /<Redirect href=\{\{ pathname: '\/'/);
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
