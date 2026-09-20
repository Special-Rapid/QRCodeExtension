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
    for (const selector of ["#notification-button", "#notification-status", "#device-count", "#device-details", "#connector-panel", "#connect-extension", "#disconnect-extension"]) {
      expect(app).toContain(selector);
      expect(html).toContain(`id="${selector.slice(1)}"`);
    }
    expect(serviceWorker).toContain('addEventListener("push"');
    expect(serviceWorker).toContain('addEventListener("notificationclick"');
    expect(serviceWorker).not.toContain("event.data.text");
    expect(serviceWorker).toContain('events?event=${encodeURIComponent(eventId)}');
    expect(serviceWorker).toContain('credentials: "same-origin"');
    expect(serviceWorker).toContain('["http:", "https:"]');
    expect(app).toContain('import { notificationPermissionState } from "/notification-state.js"');
    expect(app).toContain('setNotificationStatusKey(permissionState.statusKey, permissionState.isError)');
    expect(app).toContain('push_unavailable: t("pushUnavailable")');
    expect(app).toContain('showForegroundNotification');
    expect(app).toContain('スマホから新しい読み取り結果が届きました。');
    expect(app).not.toContain('body: event.data');
    expect(app).toContain('連携中のスマホ:');
    expect(app).toContain('acknowledgeEvent');
  });

  it("uses the handoff event id to replace, not re-alert, a redelivered web Push", async () => {
    const serviceWorker = await SELF.fetch("https://qr.test/service-worker.js").then((response) => response.text());
    const handlers = new Map();
    const notifications = new Map();
    const entries = new Map();
    const previousCaches = globalThis.caches;
    const previousFetch = globalThis.fetch;
    globalThis.caches = { async open() { return {
      async put(key, value) { entries.set(key.url, value); },
      async keys() { return [...entries.keys()].map((url) => new Request(url)); },
      async match(key) { return entries.get(key.url); },
      async delete(key) { return entries.delete(key.url); }
    }; } };
    globalThis.fetch = async () => ({ ok: true });
    const scope = {
      addEventListener(type, handler) { handlers.set(type, handler); },
      registration: { async showNotification(title, options) { notifications.set(options.tag, { title, options }); }, sync: { async register() {} } },
      location: { origin: "https://qr.test" },
      clients: { async matchAll() { return []; }, async openWindow() {} }
    };
    try {
      new Function("self", serviceWorker)(scope);
      const deliver = async () => {
        let completed;
        handlers.get("push")({ data: { json() { return { type: "handoff", eventId: "event-1", code: "AB2CDE3F" }; } }, waitUntil(promise) { completed = promise; } });
        await completed;
      };
      await deliver();
      await deliver();

      expect(notifications.size).toBe(1);
      expect(notifications.get("qr-scan-handoff:event-1")?.options.renotify).toBe(false);
      expect(entries.size).toBe(0);
    } finally {
      globalThis.caches = previousCaches;
      globalThis.fetch = previousFetch;
    }
  });

  it("resolves an authenticated Push event at click time and opens only its HTTP(S) URL", async () => {
    const serviceWorker = await SELF.fetch("https://qr.test/service-worker.js").then((response) => response.text());
    const handlers = new Map();
    const opened = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      expect(String(input)).toContain("/api/v1/pairs/AB2CDE3F/events?event=event-1");
      return { ok: true, async json() { return { events: [{ id: "event-1", openUrl: "https://example.com/direct" }] }; } };
    };
    const scope = {
      addEventListener(type, handler) { handlers.set(type, handler); },
      location: { origin: "https://qr.test" },
      clients: { async matchAll() { return []; }, async openWindow(url) { opened.push(url); } }
    };
    try {
      new Function("self", serviceWorker)(scope);
      let completed;
      handlers.get("notificationclick")({
        notification: { data: { inbox: "/", code: "AB2CDE3F", eventId: "event-1" }, close() {} },
        waitUntil(promise) { completed = promise; }
      });
      await completed;
      expect(opened).toEqual(["https://example.com/direct"]);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
