import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { OcrRecognition } from './QrScanOcr.types';

declare class QrScanOcrModule extends NativeModule<{}> {
  recognizeUrlText(uri: string): Promise<OcrRecognition>;
}

const nativeModule = requireOptionalNativeModule<QrScanOcrModule>('QrScanOcr');

export function isOcrAvailable() {
  return nativeModule !== null;
}

export async function recognizeUrlText(uri: string) {
  if (!nativeModule) {
    const error = Object.assign(new Error('この機能には更新版のQR Scanアプリが必要です。'), { code: 'ocr_unavailable' });
    throw error;
  }
  return nativeModule.recognizeUrlText(uri);
}
