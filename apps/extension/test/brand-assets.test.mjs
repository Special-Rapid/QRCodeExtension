import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { PNG } from "pngjs";
import { generate, parseIcon, renderIcon } from "../../../tooling/generate-brand-assets.mjs";

test("all raster icons are current derivations of the canonical SVG", async () => {
  await generate({ check: true });
});

test("web receiver serves the published canonical icon from CDN without a bundled copy", async () => {
  const html = await readFile("../handoff/public/index.html", "utf8");
  const expectedUrl = "https://images.snkisk.com/QRCodeExtension/5da0d8c6-eee4-47a8-9ddb-00dbc048703a.png";
  assert.equal(html.match(/rel="icon"[^>]+href="([^"]+)"/u)?.[1], expectedUrl);
  assert.equal(html.match(/class="brand-mark"[^>]+src="([^"]+)"/u)?.[1], expectedUrl);
  const source = await readFile("../../assets/brand/qr-scan-icon.svg", "utf8");
  const publishedIcon = renderIcon(parseIcon(source), { size: 128, layers: "full" });
  assert.equal(createHash("sha256").update(publishedIcon).digest("hex"), "0464e92908c9edd747791d116ea548ed515d6b446a068d8b784ad9ce96015aad", "Brand changes require publishing a new handoff icon and updating its CDN references.");
  await assert.rejects(access("../handoff/public/icon-128.png"), { code: "ENOENT" });
});

test("the iOS Icon Composer asset references the SVG derivative instead of a separate mark", async () => {
  const icon = await readFile("../mobile/assets/expo.icon/icon.json", "utf8");
  assert.match(icon, /"image-name"\s*:\s*"qr-scan-icon\.svg"/u);
});

test("extension icon retains the canonical blue and white QR mark pixels", async () => {
  const png = PNG.sync.read(await readFile("src/icon-128.png"));
  const pixel = (x, y) => [...png.data.slice((y * png.width + x) * 4, (y * png.width + x + 1) * 4)];
  assert.deepEqual(pixel(0, 0), [20, 99, 243, 255]);
  assert.deepEqual(pixel(18, 18), [255, 255, 255, 255]);
  assert.deepEqual(pixel(26, 26), [20, 99, 243, 255]);
});
