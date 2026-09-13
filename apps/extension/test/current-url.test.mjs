import assert from "node:assert/strict";
import test from "node:test";
import { currentWebUrlFromTab } from "../src/current-url.js";

test("returns the active normal Web URL as a stable QR payload", () => {
  assert.equal(
    currentWebUrlFromTab({ url: "https://example.com/article?ref=qr#section" }),
    "https://example.com/article?ref=qr#section"
  );
});

test("rejects browser, extension, missing, and unsafe current-tab URLs", () => {
  assert.equal(currentWebUrlFromTab({ url: "chrome://extensions" }), null);
  assert.equal(currentWebUrlFromTab({ url: "chrome-extension://example/popup.html" }), null);
  assert.equal(currentWebUrlFromTab({ url: "javascript:alert(1)" }), null);
  assert.equal(currentWebUrlFromTab({}), null);
});
