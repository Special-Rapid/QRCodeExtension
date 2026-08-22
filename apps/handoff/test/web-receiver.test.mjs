import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("web receiver markup", () => {
  it("contains every direct id selector used by the pairing renderer", async () => {
    const [html, app] = await Promise.all([
      SELF.fetch("https://qr.test/").then((response) => response.text()),
      SELF.fetch("https://qr.test/app.js").then((response) => response.text())
    ]);
    for (const selector of ["#unpaired-panel", "#pairing-panel", "#inbox-panel", "#pair-code", "#pair-phrase", "#pair-expiry", "#pair-status", "#confirm-web"]) {
      expect(app).toContain(selector);
      expect(html).toContain(`id="${selector.slice(1)}"`);
    }
  });
});
