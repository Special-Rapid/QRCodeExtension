import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('iOS image sharing and Android one-frame screen capture route only a short-lived token', async () => {
  const [appConfig, manifest, tile, activity, extension, route, colors, nightColors, strings, japaneseStrings] = await Promise.all([
    read('../app.json'),
    read('../android/app/src/main/AndroidManifest.xml'),
    read('../android/app/src/main/java/com/snkisk/qrscan/ScanTileService.kt'),
    read('../modules/qr-scan-ocr/android/src/main/java/expo/modules/qrscanocr/ScreenCaptureActivity.kt'),
    read('../ios/QRScanShare/Info.plist'),
    read('../src/app/share-image.tsx'),
    read('../modules/qr-scan-ocr/android/src/main/res/values/quick_settings_colors.xml'),
    read('../modules/qr-scan-ocr/android/src/main/res/values-night/quick_settings_colors.xml'),
    read('../modules/qr-scan-ocr/android/src/main/res/values/quick_settings_strings.xml'),
    read('../modules/qr-scan-ocr/android/src/main/res/values-ja/quick_settings_strings.xml'),
  ]);
  assert.match(appConfig, /android\.permission\.FOREGROUND_SERVICE_MEDIA_PROJECTION/);
  assert.match(manifest, /FOREGROUND_SERVICE_MEDIA_PROJECTION/);
  assert.doesNotMatch(manifest, /android\.intent\.action\.SEND/);
  assert.match(tile, /ScreenCaptureActivity/);
  assert.match(activity, /createScreenCaptureIntent/);
  assert.match(activity, /showReadingState/);
  assert.match(activity, /quick_settings_reading_title/);
  assert.match(activity, /quick_settings_reading_background/);
  assert.match(colors, /quick_settings_reading_background/);
  assert.match(nightColors, /quick_settings_reading_background/);
  assert.match(strings, /name="quick_settings_reading_title">Reading this screen/);
  assert.match(strings, /name="quick_settings_reading_body">Looking for QR codes and URL text on this device/);
  assert.match(japaneseStrings, /name="quick_settings_reading_title">画面を読み取り中/);
  assert.match(japaneseStrings, /name="quick_settings_reading_body">この端末内でQRコードとURL文字列を探しています/);
  assert.match(extension, /NSExtensionActivationSupportsImageWithMaxCount/);
  assert.match(extension, /com\.apple\.share-services/);
  assert.match(route, /params\.shareToken = token/);
  assert.doesNotMatch(activity, /\?data=/);
});

test('shared-image recognition remains local, covers QR/barcodes and URL text, then removes the temporary copy', async () => {
  const [scanner, nativeModule, androidStore, androidOcr, iosModule] = await Promise.all([
    read('../src/app/index.tsx'),
    read('../modules/qr-scan-ocr/src/QrScanOcrModule.ts'),
    read('../modules/qr-scan-ocr/android/src/main/java/expo/modules/qrscanocr/ScreenCaptureStore.kt'),
    read('../modules/qr-scan-ocr/android/src/main/java/expo/modules/qrscanocr/QrScanOcrModule.kt'),
    read('../modules/qr-scan-ocr/ios/QrScanOcrModule.swift'),
  ]);
  assert.match(scanner, /recognizeSharedImage/);
  assert.match(scanner, /collectBarcodeCandidates\(recognition\.barcodes\)/);
  assert.match(scanner, /collectOcrUrlCandidates\(recognition\.blocks\)/);
  assert.match(scanner, /deleteSharedImage\(token\)/);
  assert.match(scanner, /<Image source=\{\{ uri: sharedImageUri \}\} resizeMode="contain"/);
  assert.match(scanner, /sharedImageUri \? 'contain' : 'cover'/);
  assert.match(scanner, /shareToken \|\| captureError \|\| imageUri/);
  assert.match(scanner, /selectedImageUri/);
  assert.match(scanner, /imageUri\.startsWith\('file:\/\/'\)/);
  assert.match(scanner, /hasSharedImage = \(typeof shareToken/);
  assert.match(scanner, /imageInputPending/);
  assert.match(scanner, /consumedImageInput\.current = null/);
  assert.match(scanner, /setSharedImageState\('idle'\)/);
  assert.doesNotMatch(scanner, /startScreenCapture/);
  assert.match(nativeModule, /consumeSharedImage/);
  assert.match(androidStore, /context\.cacheDir/);
  assert.match(androidStore, /cleanupExpired\(directory\)/);
  assert.match(androidOcr, /if \(textTask\.isSuccessful\) textTask\.result else null/);
  assert.match(androidOcr, /if \(barcodeTask\.isSuccessful\) barcodeTask\.result else null/);
  assert.match(androidOcr, /SHARED_IMAGE_RECOGNITION_FAILED/);
  assert.match(iosModule, /VNDetectBarcodesRequest/);
  assert.match(iosModule, /containerURL\(forSecurityApplicationGroupIdentifier/);
  assert.match(iosModule, /cleanupExpiredSharedImages/);
});

test('iOS image selection keeps processing local and enters the existing scanner candidate flow', async () => {
  const [route, settings, config, info] = await Promise.all([
    read('../src/app/image-scan.tsx'),
    read('../src/app/settings.tsx'),
    read('../app.json'),
    read('../ios/QRScan/Info.plist'),
  ]);
  assert.match(route, /launchImageLibraryAsync/);
  assert.match(route, /mediaTypes: \['images'\]/);
  assert.match(route, /params: \{ imageUri: uri \}/);
  assert.match(route, /uri\?\.startsWith\('file:\/\/'\)/);
  assert.match(settings, /router\.push\('\/image-scan' as never\)/);
  assert.match(config, /expo-image-picker/);
  assert.match(info, /NSPhotoLibraryUsageDescription/);
});
