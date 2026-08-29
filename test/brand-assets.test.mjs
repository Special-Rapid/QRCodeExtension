import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PNG } from "pngjs";
import { generate } from "../scripts/generate-brand-assets.mjs";

test("all raster icons are current derivations of the canonical SVG", async () => {
  await generate({ check: true });
});

test("web receiver uses the canonical icon for both favicon and visible brand", async () => {
  const html = await readFile("apps/handoff/public/index.html", "utf8");
  assert.match(html, /rel="icon"[^>]+href="\/icon-128\.png"/u);
  assert.match(html, /class="brand-mark"[^>]+src="\/icon-128\.png"/u);
});

test("the iOS Icon Composer asset references the SVG derivative instead of a separate mark", async () => {
  const icon = await readFile("apps/mobile/assets/expo.icon/icon.json", "utf8");
  assert.match(icon, /"image-name"\s*:\s*"qr-scan-icon\.svg"/u);
});

test("extension icon retains the canonical blue and white QR mark pixels", async () => {
  const png = PNG.sync.read(await readFile("src/icon-128.png"));
  const pixel = (x, y) => [...png.data.slice((y * png.width + x) * 4, (y * png.width + x + 1) * 4)];
  assert.deepEqual(pixel(0, 0), [20, 99, 243, 255]);
  assert.deepEqual(pixel(18, 18), [255, 255, 255, 255]);
  assert.deepEqual(pixel(26, 26), [20, 99, 243, 255]);
});
