import jsQR, { type QRCode } from "jsqr";

export type ImagePixels = Pick<ImageData, "data" | "width" | "height">;
type Point = { x: number; y: number };
type Region = { x: number; y: number; width: number; height: number };
export interface DecodedQr {
  data: string;
  location: Record<string, Point>;
}

const MAX_DIMENSION = 2048;
const MAX_RESULTS = 20;

export function decodeImageData(imageData: ImagePixels): DecodedQr[] {
  const results: DecodedQr[] = [];

  for (const region of scanRegions(imageData.width, imageData.height)) {
    if (results.length >= MAX_RESULTS) break;

    const working = copyRegion(imageData, region);
    for (let count = results.length; count < MAX_RESULTS; count += 1) {
      const code = jsQR(working, region.width, region.height, { inversionAttempts: "attemptBoth" });
      if (!code) break;

      if (!results.some((result) => result.data === code.data)) {
        results.push({ data: code.data, location: translateLocation(code.location, region) });
      }
      coverDetectedCode(working, region.width, region.height, code.location);
    }
  }

  return results;
}

export async function decodeImageSource(source: string): Promise<DecodedQr[]> {
  const image = await loadImage(source);
  const maximumScale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const results: DecodedQr[] = [];

  for (const multiplier of [1, 0.75, 0.5]) {
    const scale = maximumScale * multiplier;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    // 新規canvasの2D contextを使う既存前提を保持し、null時のruntimeも変更しない。
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(image, 0, 0, width, height);

    for (const result of decodeImageData(context.getImageData(0, 0, width, height))) {
      if (results.length >= MAX_RESULTS) return results;
      if (!results.some((existing) => existing.data === result.data)) results.push(result);
    }
  }

  return results;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を読み込めませんでした。PNG・JPEG・WebP・GIFを選択してください。"));
    image.src = source;
  });
}

function scanRegions(width: number, height: number): Region[] {
  const halfWidth = Math.ceil(width / 2);
  const halfHeight = Math.ceil(height / 2);
  return [
    { x: 0, y: 0, width, height },
    { x: 0, y: 0, width: halfWidth, height },
    { x: width - halfWidth, y: 0, width: halfWidth, height },
    { x: 0, y: 0, width, height: halfHeight },
    { x: 0, y: height - halfHeight, width, height: halfHeight },
    { x: 0, y: 0, width: halfWidth, height: halfHeight },
    { x: width - halfWidth, y: 0, width: halfWidth, height: halfHeight },
    { x: 0, y: height - halfHeight, width: halfWidth, height: halfHeight },
    { x: width - halfWidth, y: height - halfHeight, width: halfWidth, height: halfHeight }
  ];
}

function copyRegion(imageData: ImagePixels, region: Region): Uint8ClampedArray {
  const data = new Uint8ClampedArray(region.width * region.height * 4);
  for (let row = 0; row < region.height; row += 1) {
    const sourceStart = ((region.y + row) * imageData.width + region.x) * 4;
    const destinationStart = row * region.width * 4;
    data.set(imageData.data.subarray(sourceStart, sourceStart + region.width * 4), destinationStart);
  }
  return data;
}

function translateLocation(location: Readonly<Record<string, Point>>, region: Region): Record<string, Point> {
  return Object.fromEntries(Object.entries(location).map(([key, point]) => [key, { x: point.x + region.x, y: point.y + region.y }]));
}

function coverDetectedCode(data: Uint8ClampedArray, width: number, height: number, location: QRCode["location"]): void {
  const points = [location.topLeftCorner, location.topRightCorner, location.bottomLeftCorner, location.bottomRightCorner];
  const padding = 8;
  const left = Math.max(0, Math.floor(Math.min(...points.map((point) => point.x)) - padding));
  const right = Math.min(width, Math.ceil(Math.max(...points.map((point) => point.x)) + padding));
  const top = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y)) - padding));
  const bottom = Math.min(height, Math.ceil(Math.max(...points.map((point) => point.y)) + padding));

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = 255;
    }
  }
}
