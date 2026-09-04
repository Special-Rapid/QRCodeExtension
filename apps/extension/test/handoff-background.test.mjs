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
  const alarms = [];
  const messageEvent = event();
  return {
    values, notifications, tabs, alarms, messageEvent,
    chrome: {
      runtime: { id: "abcdefghijklmnopabcdefghijklmnop", onInstalled: event(), onStartup: event(), onMessage: messageEvent, getURL: (path) => `chrome-extension://test/${path}` },
      alarms: { onAlarm: event(), create(name, options) { alarms.push({ name, options }); }, async clear(name) { alarms.push({ clear: name }); return true; } },
      storage: { local: { async get(key) { return { [key]: values[key] }; }, async set(next) { Object.assign(values, next); }, async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; } } },
      notifications: { onClicked: event(), async create(id, options) { const existing = notifications.findIndex((notification) => notification.id === id); if (existing >= 0) notifications[existing] = { id, options }; else notifications.push({ id, options }); } },
      tabs: { async create(tab) { tabs.push(tab); } }
    }
  };
}

function reply(status, body) { return { ok: status >= 200 && status < 300, status, async json() { return body; } }; }

async function importBackground(environment, suffix, workerScope) {
  const previous = { chrome: globalThis.chrome, fetch: globalThis.fetch, self: globalThis.self };
  globalThis.chrome = environment.chrome;
  globalThis.fetch = environment.fetch;
  if (workerScope) globalThis.self = workerScope; else delete globalThis.self;
  await import(new URL(`../src/handoff-background.js?background-test=${suffix}`, import.meta.url));
  return previous;
}

function restoreBackground(previous) {
  Object.assign(globalThis, previous);
  if (previous.self === undefined) delete globalThis.self;
}

async function send(environment, message) { return new Promise((resolve) => environment.messageEvent.emit(message, {}, resolve)); }

test("claims a one-time website link as a private connector and opens a received explicit or scheme-less web URL from its notification", async () => {
  const environment = createChrome();
  const replies = [reply(200, { publicKey: "AQID" }), reply(201, { connector: { id: "connector-1", token: "connector-secret", code: "AB2CDE3F" } }), reply(200, { status: "active" }), reply(200, { events: [{ id: "event-1", data: "example.com/from-phone" }] })];
  environment.fetch = async () => replies.shift();
  const previousRegistration = globalThis.registration;
  const previousWebSocket = globalThis.WebSocket;
  let subscriptionOptions;
  globalThis.registration = { pushManager: { async getSubscription() { return null; }, async subscribe(options) { subscriptionOptions = options; return { toJSON() { return { endpoint: "https://push.example.test/connector", keys: { p256dh: "key", auth: "auth" } }; } }; } } };
  globalThis.WebSocket = class { static OPEN = 1; readyState = 1; constructor() {} addEventListener() {} send() {} close() {} };
  const previous = await importBackground(environment, "connector");
  try {
    const response = await send(environment, { type: "connector.claim", token: "one-time", extensionId: environment.chrome.runtime.id });
    assert.equal(response.ok, true);
    assert.deepEqual(response.state.connector, { id: "connector-1", code: "AB2CDE3F" });
    assert.equal(environment.values["qr-scan-connector"].token, "connector-secret");
    assert.equal(subscriptionOptions.userVisibleOnly, true);

    environment.chrome.notifications.onClicked.emit("qr-scan-handoff:event-1");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(environment.tabs[0].url, "https://example.com/from-phone");
  } finally {
    restoreBackground(previous);
    globalThis.registration = previousRegistration;
    globalThis.WebSocket = previousWebSocket;
  }
});

test("opens the web inbox for text, script URLs, or a missing event", async () => {
  const environment = createChrome();
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "connector-secret", code: "AB2CDE3F" };
  const replies = [
    reply(200, { events: [{ id: "event-text", data: "ただの文字列" }] }),
    reply(200, { events: [{ id: "event-script", data: "javascript:alert(1)" }] }),
    reply(200, { events: [] })
  ];
  environment.fetch = async () => replies.shift();
  const previous = await importBackground(environment, "safe-fallback");
  try {
    for (const id of ["event-text", "event-script", "event-missing"]) {
      environment.chrome.notifications.onClicked.emit(`qr-scan-handoff:${id}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.deepEqual(environment.tabs.map((tab) => tab.url), ["https://qr.snkisk.com/", "https://qr.snkisk.com/", "https://qr.snkisk.com/"]);
  } finally {
    restoreBackground(previous);
  }
});

test("removes a revoked stored connector before opening another socket", async () => {
  const environment = createChrome();
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "expired-secret", code: "AB2CDE3F" };
  environment.fetch = async () => reply(401, { error: "unauthorized" });
  const previousWebSocket = globalThis.WebSocket;
  let socketAttempts = 0;
  globalThis.WebSocket = class {
    static OPEN = 1;
    constructor() { socketAttempts += 1; }
    addEventListener() {}
  };
  const previous = await importBackground(environment, "revoked");
  try {
    environment.chrome.runtime.onStartup.emit();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(environment.values["qr-scan-connector"], undefined);
    assert.equal(socketAttempts, 0);
  } finally {
    restoreBackground(previous);
    globalThis.WebSocket = previousWebSocket;
  }
});

test("deduplicates a redelivered extension Push by event id", async () => {
  const environment = createChrome();
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "connector-secret", code: "AB2CDE3F" };
  const requests = [];
  environment.fetch = async (url) => { requests.push(String(url)); return reply(200, { status: "acknowledged" }); };
  const push = event();
  const workerScope = { addEventListener(type, listener) { if (type === "push") push.addListener(listener); } };
  const previousWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = class { static OPEN = 1; readyState = 1; addEventListener() {} send() {} close() {} };
  const previous = await importBackground(environment, "push-dedupe", workerScope);
  try {
    const deliver = async () => {
      let completed;
      push.emit({ data: { json() { return { type: "handoff", eventId: "event-1" }; } }, waitUntil(promise) { completed = promise; } });
      await completed;
    };
    await deliver();
    await deliver();

    assert.equal(environment.notifications.length, 1);
    assert.equal(environment.notifications[0].id, "qr-scan-handoff:event-1");
    assert.equal(requests.filter((url) => url.includes("/ack?connector=connector-1")).length, 2);
  } finally {
    restoreBackground(previous);
    globalThis.WebSocket = previousWebSocket;
  }
});

test("clears persisted ACK retry work when the connector is revoked", async () => {
  const environment = createChrome();
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "revoked-secret", code: "AB2CDE3F" };
  environment.values["qr-scan-pending-acks"] = [{ connectorId: "connector-1", code: "AB2CDE3F", eventId: "event-1", expiresAt: Date.now() + 60_000 }];
  environment.fetch = async () => reply(401, { error: "unauthorized" });
  const previous = await importBackground(environment, "clear-revoked-ack");
  try {
    environment.chrome.runtime.onStartup.emit();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(environment.values["qr-scan-connector"], undefined);
    assert.equal(environment.values["qr-scan-pending-acks"], undefined);
    assert.ok(environment.alarms.some((alarm) => alarm.clear === "qr-scan-ack-retry"));
  } finally {
    restoreBackground(previous);
  }
});

test("clears the connector immediately when the first ACK is rejected", async () => {
  const environment = createChrome();
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "revoked-secret", code: "AB2CDE3F" };
  environment.fetch = async () => reply(401, { error: "unauthorized" });
  const push = event();
  const workerScope = { addEventListener(type, listener) { if (type === "push") push.addListener(listener); } };
  const previous = await importBackground(environment, "first-ack-revoked", workerScope);
  try {
    let completed;
    push.emit({ data: { json() { return { type: "handoff", eventId: "event-1" }; } }, waitUntil(promise) { completed = promise; } });
    await completed;
    assert.equal(environment.values["qr-scan-connector"], undefined);
    assert.equal(environment.values["qr-scan-pending-acks"], undefined);
    assert.ok(environment.alarms.some((alarm) => alarm.clear === "qr-scan-ack-retry"));
  } finally {
    restoreBackground(previous);
  }
});

test("retains every concurrently failed ACK for retry", async () => {
  const environment = createChrome();
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "retry-secret", code: "AB2CDE3F" };
  environment.fetch = async () => reply(503, { error: "request_failed" });
  const push = event();
  const workerScope = { addEventListener(type, listener) { if (type === "push") push.addListener(listener); } };
  const previous = await importBackground(environment, "concurrent-ack-queue", workerScope);
  try {
    const completions = [];
    for (const eventId of ["event-1", "event-2"]) {
      push.emit({ data: { json() { return { type: "handoff", eventId }; } }, waitUntil(promise) { completions.push(promise); } });
    }
    await Promise.all(completions);
    assert.deepEqual(environment.values["qr-scan-pending-acks"].map((item) => item.eventId).sort(), ["event-1", "event-2"]);
  } finally {
    restoreBackground(previous);
  }
});

test("does not recreate retry state when a concurrent ACK revokes the connector", async () => {
  const environment = createChrome();
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "revoked-secret", code: "AB2CDE3F" };
  let resolveSecondAck;
  let calls = 0;
  environment.fetch = async () => {
    calls += 1;
    if (calls === 1) return reply(401, { error: "unauthorized" });
    return new Promise((resolve) => { resolveSecondAck = resolve; });
  };
  const push = event();
  const workerScope = { addEventListener(type, listener) { if (type === "push") push.addListener(listener); } };
  const previous = await importBackground(environment, "concurrent-revoked-ack", workerScope);
  try {
    const completions = [];
    for (const eventId of ["event-1", "event-2"]) {
      push.emit({ data: { json() { return { type: "handoff", eventId }; } }, waitUntil(promise) { completions.push(promise); } });
    }
    for (let attempt = 0; attempt < 20 && (calls < 2 || environment.values["qr-scan-connector"] !== undefined); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(calls, 2);
    assert.equal(environment.values["qr-scan-connector"], undefined);
    resolveSecondAck(reply(503, { error: "request_failed" }));
    await Promise.all(completions);

    assert.equal(environment.values["qr-scan-pending-acks"], undefined);
    assert.ok(environment.alarms.some((alarm) => alarm.clear === "qr-scan-ack-retry"));
  } finally {
    restoreBackground(previous);
  }
});

test("does not recreate an empty retry key when a concurrent ACK succeeds after revocation", async () => {
  const environment = createChrome();
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "revoked-secret", code: "AB2CDE3F" };
  let resolveSecondAck;
  let calls = 0;
  environment.fetch = async () => {
    calls += 1;
    if (calls === 1) return reply(401, { error: "unauthorized" });
    return new Promise((resolve) => { resolveSecondAck = resolve; });
  };
  const push = event();
  const workerScope = { addEventListener(type, listener) { if (type === "push") push.addListener(listener); } };
  const previous = await importBackground(environment, "concurrent-revoked-success", workerScope);
  try {
    const completions = [];
    for (const eventId of ["event-1", "event-2"]) {
      push.emit({ data: { json() { return { type: "handoff", eventId }; } }, waitUntil(promise) { completions.push(promise); } });
    }
    for (let attempt = 0; attempt < 20 && (calls < 2 || environment.values["qr-scan-connector"] !== undefined); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(calls, 2);
    assert.equal(environment.values["qr-scan-connector"], undefined);
    resolveSecondAck(reply(200, { status: "acknowledged" }));
    await Promise.all(completions);

    assert.equal(environment.values["qr-scan-pending-acks"], undefined);
    assert.ok(environment.alarms.some((alarm) => alarm.clear === "qr-scan-ack-retry"));
  } finally {
    restoreBackground(previous);
  }
});
