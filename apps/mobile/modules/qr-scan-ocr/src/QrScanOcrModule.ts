import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { OcrRecognition, SharedImageRecognition } from './QrScanOcr.types';

declare class QrScanOcrModule extends NativeModule<{}> {
  recognizeUrlText(uri: string): Promise<OcrRecognition>;
  recognizeSharedImage(uri: string): Promise<SharedImageRecognition>;
  consumeSharedImage(token: string): Promise<string>;
  deleteSharedImage(token: string): Promise<boolean>;
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

export async function recognizeSharedImage(uri: string) {
  if (!nativeModule) throw unavailableError();
  return nativeModule.recognizeSharedImage(uri);
}

export async function consumeSharedImage(token: string) {
  if (!nativeModule) throw unavailableError();
  return nativeModule.consumeSharedImage(token);
}

export async function deleteSharedImage(token: string) {
  if (!nativeModule) return false;
  return nativeModule.deleteSharedImage(token);
}

function unavailableError() {
  return Object.assign(new Error('この機能には更新版のQR Scanアプリが必要です。'), { code: 'ocr_unavailable' });
}
