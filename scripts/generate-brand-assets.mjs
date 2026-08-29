import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "assets/brand/qr-scan-icon.svg");
const targets = [
  { file: "apps/mobile/assets/expo.icon/Assets/qr-scan-icon.svg", kind: "svg" },
  { file: "src/icon-128.png", size: 128, layers: "full" },
  { file: "apps/handoff/public/icon-128.png", size: 128, layers: "full" },
  { file: "apps/mobile/assets/images/icon.png", size: 1024, layers: "full" },
  { file: "apps/mobile/assets/images/favicon.png", size: 48, layers: "full" },
  { file: "apps/mobile/assets/images/splash-icon.png", size: 228, layers: "full" },
  { file: "apps/mobile/assets/images/android-icon-background.png", size: 512, layers: "background" },
  { file: "apps/mobile/assets/images/android-icon-foreground.png", size: 512, layers: "foreground" },
  { file: "apps/mobile/assets/images/android-icon-monochrome.png", size: 432, layers: "foreground" },
];

function attributes(sourceText) {
  return Object.fromEntries([...sourceText.matchAll(/([\w-]+)="([^"]*)"/gu)].map(([, key, value]) => [key, value]));
}

export function parseIcon(svg) {
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/u);
  if (!viewBox || viewBox[1] !== viewBox[2]) throw new Error("Brand SVG must use a square 0 0 viewBox.");
  const layers = { background: [], foreground: [], cutout: [] };
  for (const match of svg.matchAll(/<rect\s+([^>]+?)\/?>(?:<\/rect>)?/gu)) {
    const attribute = attributes(match[1]);
    if (!(attribute["data-layer"] in layers)) continue;
    const rectangle = ["x", "y", "width", "height"].map((key) => Number(attribute[key]));
    if (rectangle.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Brand SVG contains an invalid rectangle.");
    layers[attribute["data-layer"]].push({ x: rectangle[0], y: rectangle[1], width: rectangle[2], height: rectangle[3], fill: attribute.fill });
  }
  if (layers.background.length !== 1 || layers.foreground.length === 0) throw new Error("Brand SVG must have one background and foreground rectangles.");
  return { size: Number(viewBox[1]), layers };
}

function color(fill) {
  const parsed = /^#([\da-f]{6})$/iu.exec(fill ?? "");
  if (!parsed) throw new Error(`Unsupported brand color: ${fill}`);
  return [0, 2, 4].map((offset) => Number.parseInt(parsed[1].slice(offset, offset + 2), 16));
}

function paint(png, rectangle, scale, rgba) {
  const startX = Math.round(rectangle.x * scale);
  const startY = Math.round(rectangle.y * scale);
  const endX = Math.round((rectangle.x + rectangle.width) * scale);
  const endY = Math.round((rectangle.y + rectangle.height) * scale);
  for (let y = startY; y < endY; y += 1) for (let x = startX; x < endX; x += 1) {
    const index = (y * png.width + x) * 4;
    png.data[index] = rgba[0];
    png.data[index + 1] = rgba[1];
    png.data[index + 2] = rgba[2];
    png.data[index + 3] = rgba[3];
  }
}

export function renderIcon(icon, target) {
  const png = new PNG({ width: target.size, height: target.size });
  const scale = target.size / icon.size;
  if (target.layers === "full" || target.layers === "background") {
    for (const rectangle of icon.layers.background) paint(png, rectangle, scale, [...color(rectangle.fill), 255]);
  }
  if (target.layers === "full" || target.layers === "foreground") {
    for (const rectangle of icon.layers.foreground) paint(png, rectangle, scale, [...color(rectangle.fill), 255]);
    for (const rectangle of icon.layers.cutout) paint(png, rectangle, scale, target.layers === "full" ? [...color(rectangle.fill), 255] : [0, 0, 0, 0]);
  }
  return PNG.sync.write(png);
}

export async function generate({ check = false } = {}) {
  const svg = await readFile(source, "utf8");
  const icon = parseIcon(svg);
  const mismatches = [];
  for (const target of targets) {
    const expected = target.kind === "svg" ? Buffer.from(svg) : renderIcon(icon, target);
    const destination = path.join(root, target.file);
    if (check) {
      let currentBuffer;
      try { currentBuffer = await readFile(destination); } catch { mismatches.push(target.file); continue; }
      if (target.kind === "svg") {
        if (!currentBuffer.equals(expected)) mismatches.push(target.file);
        continue;
      }
      const current = PNG.sync.read(currentBuffer);
      const rendered = PNG.sync.read(expected);
      if (current.width !== rendered.width || current.height !== rendered.height || !current.data.equals(rendered.data)) mismatches.push(target.file);
    } else await writeFile(destination, expected);
  }
  if (mismatches.length) throw new Error(`Brand PNG assets are stale: ${mismatches.join(", ")}. Run npm run generate:brand-assets.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await generate({ check: process.argv.includes("--check") });
