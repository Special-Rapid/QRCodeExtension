import type { OcrRecognition } from './QrScanOcr.types';

export function isOcrAvailable() {
  return false;
}

export async function recognizeUrlText(_uri: string): Promise<OcrRecognition> {
  return { blocks: [], width: 0, height: 0 };
}
