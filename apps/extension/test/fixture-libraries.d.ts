// テストfixtureが使用する固定library APIだけを宣言する。
declare module "qrcode" {
  const QRCode: {
    toDataURL(value: string, options: { errorCorrectionLevel: "H"; margin: number; width: number }): Promise<string>;
  };
  export default QRCode;
}

declare module "pngjs" {
  interface PixelImage {
    width: number;
    height: number;
    data: Buffer;
  }

  export class PNG {
    constructor(options: { width: number; height: number; fill: boolean });
    width: number;
    height: number;
    data: Buffer | null;
    static sync: { read(buffer: Buffer): PixelImage };
    static bitblt(source: PixelImage, destination: PNG, sourceX: number, sourceY: number, width: number, height: number, destinationX: number, destinationY: number): void;
  }
}
