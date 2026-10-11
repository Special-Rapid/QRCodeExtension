// 未移行のgeneratorに対して既存回帰テストが使うexportの範囲を宣言する。
// 実装sourceの型移行・入力のruntime検証は親Issue15の後続対象。
interface IconRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string | undefined;
}
interface ParsedIcon {
  size: number;
  layers: Record<"background" | "foreground" | "cutout", IconRectangle[]>;
}
export function parseIcon(svg: string): ParsedIcon;
export function renderIcon(icon: ParsedIcon, target: { size: number; layers: "full" | "background" | "foreground" }): Buffer;
export function generate(options?: { check?: boolean }): Promise<void>;
