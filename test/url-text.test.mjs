import assert from "node:assert/strict";
import test from "node:test";
import { extractHttpUrls, mergeDecodedValues } from "../src/url-text.js";

test("extracts literal HTTP(S) URL text locally and trims surrounding prose punctuation", () => {
  const urls = extractHttpUrls("案内: https://example.com/path. 次は http://example.test/docs?q=1)。");
  assert.deepEqual(urls, ["https://example.com/path", "http://example.test/docs?q=1"]);
});

test("does not turn plain text or script-like values into detected URLs", () => {
  assert.deepEqual(extractHttpUrls("javascript:alert(1) example.com ftp://example.test"), []);
});

test("deduplicates URL text that was also found in a QR code", () => {
  assert.deepEqual(
    mergeDecodedValues([{ data: "https://example.com/one", location: { topLeftCorner: { x: 0, y: 0 } } }], [{ data: "https://example.com/one" }, { data: "https://example.com/two" }]).map((result) => result.data),
    ["https://example.com/one", "https://example.com/two"]
  );
});

test("deduplicates a QR URL and equivalent DOM text despite a trailing slash normalization", () => {
  assert.deepEqual(
    mergeDecodedValues([{ data: "https://example.com" }], [{ data: "https://example.com/" }]).map((result) => result.data),
    ["https://example.com"]
  );
});
