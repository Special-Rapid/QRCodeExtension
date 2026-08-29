import assert from "node:assert/strict";
import test from "node:test";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import { decodeImageData } from "../src/qr-decoder.js";
import { toSafeHttpUrl } from "../src/safe-url.js";

async function rasterize(value) {
  const dataUrl = await QRCode.toDataURL(value, { errorCorrectionLevel: "H", margin: 2, width: 300 });
  const png = PNG.sync.read(Buffer.from(dataUrl.split(",")[1], "base64"));
  return png;
}

test("decodes a generated QR code without camera input", async () => {
  const expected = "https://example.com/camera-free";
  const png = await rasterize(expected);
  const results = decodeImageData({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
  assert.deepEqual(results.map((result) => result.data), [expected]);
});

test("decodes arbitrary QR text for copy-only results", async () => {
  const expected = "WIFI:T:WPA;S:example;P:secret;;";
  const png = await rasterize(expected);
  const results = decodeImageData({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
  assert.deepEqual(results.map((result) => result.data), [expected]);
});

test("finds multiple QR codes by masking each detected code before the next pass", async () => {
  const values = ["https://example.com/one", "https://example.com/two"];
  const codes = await Promise.all(values.map(rasterize));
  const image = new PNG({ width: codes[0].width * 2, height: codes[0].height, fill: true });
  image.data.fill(255);
  PNG.bitblt(codes[0], image, 0, 0, codes[0].width, codes[0].height, 0, 0);
  PNG.bitblt(codes[1], image, 0, 0, codes[1].width, codes[1].height, codes[0].width, 0);

  const results = decodeImageData({ data: new Uint8ClampedArray(image.data), width: image.width, height: image.height });
  assert.deepEqual(new Set(results.map((result) => result.data)), new Set(values));
});

test("finds QR codes in every quadrant when a full-image pass cannot isolate them", async () => {
  const values = ["https://example.com/one", "https://example.com/two", "https://example.com/three", "https://example.com/four"];
  const codes = await Promise.all(values.map(rasterize));
  const image = new PNG({ width: codes[0].width * 2, height: codes[0].height * 2, fill: true });
  image.data.fill(255);
  for (const [index, code] of codes.entries()) {
    PNG.bitblt(code, image, 0, 0, code.width, code.height, (index % 2) * code.width, Math.floor(index / 2) * code.height);
  }

  const results = decodeImageData({ data: new Uint8ClampedArray(image.data), width: image.width, height: image.height });
  assert.deepEqual(new Set(results.map((result) => result.data)), new Set(values));
});

test("returns null for an image with no QR code", () => {
  const data = new Uint8ClampedArray(80 * 80 * 4).fill(255);
  assert.deepEqual(decodeImageData({ data, width: 80, height: 80 }), []);
});

test("normalizes safe scheme-less web URLs but never opens non-web payloads", () => {
  assert.equal(toSafeHttpUrl("https://example.com")?.toString(), "https://example.com/");
  assert.equal(toSafeHttpUrl("example.com/path")?.toString(), "https://example.com/path");
  assert.equal(toSafeHttpUrl("hello@example.com"), null);
  assert.equal(toSafeHttpUrl("javascript:alert(1)"), null);
  assert.equal(toSafeHttpUrl("not a url"), null);
});
