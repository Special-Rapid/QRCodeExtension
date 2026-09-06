import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('iOS image sharing and Android one-frame screen capture route only a short-lived token', async () => {
  const [appConfig, manifest, tile, activity, extension, route] = await Promise.all([
    read('../app.json'),
    read('../android/app/src/main/AndroidManifest.xml'),
    read('../android/app/src/main/java/com/snkisk/qrscan/ScanTileService.kt'),
    read('../modules/qr-scan-ocr/android/src/main/java/expo/modules/qrscanocr/ScreenCaptureActivity.kt'),
    read('../ios/QRScanShare/Info.plist'),
    read('../src/app/share-image.tsx'),
  ]);
  assert.match(appConfig, /android\.permission\.FOREGROUND_SERVICE_MEDIA_PROJECTION/);
  assert.match(manifest, /FOREGROUND_SERVICE_MEDIA_PROJECTION/);
  assert.doesNotMatch(manifest, /android\.intent\.action\.SEND/);
  assert.match(tile, /ScreenCaptureActivity/);
  assert.match(activity, /createScreenCaptureIntent/);
  assert.match(activity, /Stay transparent until the first frame/);
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
  assert.match(scanner, /shareToken \|\| captureError/);
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
