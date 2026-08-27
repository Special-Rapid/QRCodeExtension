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

  it("ships a closed-tab Push service worker and one web-owned Chrome connector setting", async () => {
    const [html, app, serviceWorker] = await Promise.all([
      SELF.fetch("https://qr.test/").then((response) => response.text()),
      SELF.fetch("https://qr.test/app.js").then((response) => response.text()),
      SELF.fetch("https://qr.test/service-worker.js").then((response) => response.text())
    ]);
    for (const selector of ["#notification-button", "#connector-panel", "#connect-extension", "#disconnect-extension"]) {
      expect(app).toContain(selector);
      expect(html).toContain(`id="${selector.slice(1)}"`);
    }
    expect(serviceWorker).toContain('addEventListener("push"');
    expect(serviceWorker).toContain('addEventListener("notificationclick"');
    expect(serviceWorker).not.toContain("event.data.text");
  });

  it("uses the handoff event id to replace, not re-alert, a redelivered web Push", async () => {
    const serviceWorker = await SELF.fetch("https://qr.test/service-worker.js").then((response) => response.text());
    const handlers = new Map();
    const notifications = new Map();
    const scope = {
      addEventListener(type, handler) { handlers.set(type, handler); },
      registration: { async showNotification(title, options) { notifications.set(options.tag, { title, options }); } },
      location: { origin: "https://qr.test" },
      clients: { async matchAll() { return []; }, async openWindow() {} }
    };
    new Function("self", serviceWorker)(scope);
    const deliver = async () => {
      let completed;
      handlers.get("push")({ data: { json() { return { type: "handoff", eventId: "event-1" }; } }, waitUntil(promise) { completed = promise; } });
      await completed;
    };
    await deliver();
    await deliver();

    expect(notifications.size).toBe(1);
    expect(notifications.get("qr-scan-handoff:event-1")?.options.renotify).toBe(false);
  });
});
