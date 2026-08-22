import assert from "node:assert/strict";
import test from "node:test";

function event() {
  const listeners = [];
  return { addListener(listener) { listeners.push(listener); }, emit(...args) { for (const listener of listeners) listener(...args); } };
}

function createChrome() {
  const values = {};
  const notifications = [];
  const tabs = [];
  const messageEvent = event();
  return {
    values, notifications, tabs, messageEvent,
    chrome: {
      runtime: { onInstalled: event(), onStartup: event(), onMessage: messageEvent, getURL: (path) => `chrome-extension://test/${path}` },
      alarms: { onAlarm: event(), create() {} },
      storage: { local: {
        async get(keys) { if (typeof keys === "string") return { [keys]: values[keys] }; return Object.fromEntries(keys.map((key) => [key, values[key]])); },
        async set(next) { Object.assign(values, next); },
        async remove(keys) { for (const key of keys) delete values[key]; }
      } },
      notifications: { onClicked: event(), async create(id, options) { notifications.push({ id, options }); } },
      tabs: { async create(tab) { tabs.push(tab); } }
    }
  };
}

function reply(status, body) { return { ok: status >= 200 && status < 300, status, async json() { return body; } }; }

async function importBackground(environment, suffix) {
  const previous = { chrome: globalThis.chrome, fetch: globalThis.fetch };
  globalThis.chrome = environment.chrome;
  globalThis.fetch = environment.fetch;
  await import(new URL(`../src/handoff-background.js?background-test=${suffix}`, import.meta.url));
  return previous;
}

async function send(environment, message) {
  return new Promise((resolve) => environment.messageEvent.emit(message, {}, resolve));
}

test("pairs an extension receiver, stores its token privately, and opens the inbox rather than a payload from a notification", async () => {
  const environment = createChrome();
  const replies = [
    reply(200, { code: "AB2CDE3F", receiverId: "web-1", token: "extension-secret", phrase: "あお・そら", expiresAt: 12345 }),
    reply(200, { status: "paired" }),
    reply(200, { status: "paired", receiverId: "web-1", phrase: "あお・そら", expiresAt: 12345, selfConfirmed: true, peerConfirmed: true, peerLabel: "Phone" }),
    reply(200, { events: [{ id: "event-1", data: "https://example.com/from-phone", host: "example.com", createdAt: Date.now(), expiresAt: Date.now() + 60_000 }] })
  ];
  environment.fetch = async () => replies.shift();
  const previous = await importBackground(environment, "pair");
  try {
    const created = await send(environment, { type: "handoff.create", label: "Test Chrome" });
    assert.equal(created.ok, true);
    assert.equal(created.state.credential.token, undefined);
    assert.equal(environment.values["handoff-extension-credential"].token, "extension-secret");

    const confirmed = await send(environment, { type: "handoff.confirm" });
    assert.equal(confirmed.state.credential.status, "paired");
    assert.equal(confirmed.state.events[0].data, "https://example.com/from-phone");
    assert.equal(environment.notifications[0].id, "handoff:event-1");
    assert.equal(environment.notifications[0].options.iconUrl, "chrome-extension://test/icon-128.png");

    environment.chrome.notifications.onClicked.emit("handoff:event-1");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(environment.tabs[0].url, "chrome-extension://test/options.html#event=event-1");
  } finally {
    Object.assign(globalThis, previous);
  }
});

test("clears a revoked extension credential instead of retaining a stale paired state", async () => {
  const environment = createChrome();
  environment.values["handoff-extension-credential"] = { code: "AB2CDE3F", receiverId: "web-1", token: "extension-secret", role: "web", status: "paired" };
  environment.fetch = async () => reply(200, { status: "revoked", receiverId: "web-1", peerLabel: "Phone" });
  const previous = await importBackground(environment, "revoked");
  try {
    const response = await send(environment, { type: "handoff.status" });
    assert.equal(response.state.credential, null);
    assert.equal(environment.values["handoff-extension-credential"], undefined);
  } finally {
    Object.assign(globalThis, previous);
  }
});
