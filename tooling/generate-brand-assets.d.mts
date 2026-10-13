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
type RasterSpec = {
    size: number;
    layers: "full" | "background" | "foreground";
};
export declare function parseIcon(svg: string): ParsedIcon;
export declare function renderIcon(icon: ParsedIcon, target: RasterSpec): Buffer<ArrayBufferLike>;
export declare function renderAndroidTileIcon(icon: ParsedIcon): Buffer<ArrayBuffer>;
export declare function generate({ check }?: {
    check?: boolean;
}): Promise<void>;
export {};
