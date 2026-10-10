// qrcode/lib/browser.jsのうちpopupが使うPromise版のみ。libraryのruntime検証を代替しない。
declare module "qrcode/lib/browser.js" {
  interface RenderOptions {
    errorCorrectionLevel: "L" | "M" | "Q" | "H";
    margin: number;
    width?: number;
    color: { dark: string; light: string };
  }
  const QRCode: {
    toCanvas(canvas: HTMLCanvasElement, text: string, options: RenderOptions): Promise<HTMLCanvasElement>;
    toString(text: string, options: RenderOptions & { type: "svg" }): Promise<string>;
  };
  export default QRCode;
}
