import assert from "node:assert/strict";
import test from "node:test";

// 外部Response/worker/Chromeの完全実装ではなく、この固定テストの代替環境を表す。
interface ConnectorFixture { id: string; token: string; code: string }
interface AckFixture { connectorId: string; code: string; eventId: string; expiresAt: number }
interface StoredFixtures {
  [key: string]: unknown;
  "qr-scan-connector"?: ConnectorFixture;
  "qr-scan-pending-acks"?: AckFixture[];
}
interface HttpFixture { ok: boolean; status: number; json(): Promise<unknown> }
interface ResponseFixture { ok?: boolean; state?: { connector?: { id: string; code: string } } }
interface PushFixture {
  data: { json(): { type: string; eventId: string } };
  waitUntil(promise: Promise<unknown>): void;
}
interface WorkerFixture { addEventListener(type: string, listener: (event: PushFixture) => void): void }
type ChromeEnvironment = ReturnType<typeof createChrome> & { fetch?: (url?: unknown) => Promise<HttpFixture | undefined> };
interface BackgroundGlobals {
  chrome?: unknown;
  fetch?: unknown;
  self?: unknown;
  registration?: unknown;
  WebSocket?: unknown;
}

function event<Args extends unknown[] = []>() {
  const listeners: ((...args: Args) => void)[] = [];
  return { addListener(listener: (...args: Args) => void) { listeners.push(listener); }, emit(...args: Args) { for (const listener of listeners) listener(...args); } };
}

function createChrome() {
  const values: StoredFixtures = {};
  const notifications: { id: string; options: unknown }[] = [];
  const tabs: { url: string }[] = [];
  const alarms: { name?: string; options?: unknown; clear?: string }[] = [];
  const messageEvent = event<[unknown, Record<string, never>, (response: ResponseFixture) => void]>();
  return {
    values, notifications, tabs, alarms, messageEvent,
    chrome: {
      runtime: { id: "abcdefghijklmnopabcdefghijklmnop", onInstalled: event(), onStartup: event(), onMessage: messageEvent, getURL: (path: string) => `chrome-extension://test/${path}` },
      alarms: { onAlarm: event<[unknown]>(), create(name: string, options: unknown) { alarms.push({ name, options }); }, async clear(name: string) { alarms.push({ clear: name }); return true; } },
      storage: { local: { async get(key: string) { return { [key]: values[key] }; }, async set(next: Record<string, unknown>) { Object.assign(values, next); }, async remove(keys: string | string[]) { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; } } },
      notifications: { onClicked: event<[string]>(), async create(id: string, options: unknown) { const existing = notifications.findIndex((notification) => notification.id === id); if (existing >= 0) notifications[existing] = { id, options }; else notifications.push({ id, options }); } },
      tabs: { async create(tab: { url: string }) { tabs.push(tab); } }
    }
  };
}

function reply(status: number, body: unknown): HttpFixture { return { ok: status >= 200 && status < 300, status, async json() { return body; } }; }

async function importBackground(environment: ChromeEnvironment, suffix: string, workerScope?: WorkerFixture) {
  const previous = { chrome: (globalThis as unknown as BackgroundGlobals).chrome, fetch: (globalThis as unknown as BackgroundGlobals).fetch, self: (globalThis as unknown as BackgroundGlobals).self };
  (globalThis as unknown as BackgroundGlobals).chrome = environment.chrome;
  (globalThis as unknown as BackgroundGlobals).fetch = environment.fetch;
  if (workerScope) (globalThis as unknown as BackgroundGlobals).self = workerScope; else delete (globalThis as unknown as BackgroundGlobals).self;
  await import(new URL(`../src/handoff-background.js?background-test=${suffix}`, import.meta.url) as unknown as string);
  return previous;
}

function restoreBackground(previous: Awaited<ReturnType<typeof importBackground>>) {
  Object.assign(globalThis, previous);
  if (previous.self === undefined) delete (globalThis as unknown as BackgroundGlobals).self;
}

async function send(environment: ChromeEnvironment, message: unknown) { return new Promise<ResponseFixture>((resolve) => environment.messageEvent.emit(message, {}, resolve)); }

test("claims a one-time website link as a private connector and opens a received explicit or scheme-less web URL from its notification", async () => {
  const environment = createChrome() as ChromeEnvironment;
  const replies = [reply(200, { publicKey: "AQID" }), reply(201, { connector: { id: "connector-1", token: "connector-secret", code: "AB2CDE3F" } }), reply(200, { status: "active" }), reply(200, { events: [{ id: "event-1", data: "example.com/from-phone" }] })];
  environment.fetch = async () => replies.shift();
  const previousRegistration = (globalThis as unknown as BackgroundGlobals).registration;
  const previousWebSocket = (globalThis as unknown as BackgroundGlobals).WebSocket;
  let subscriptionOptions: { userVisibleOnly: boolean } | undefined;
  (globalThis as unknown as BackgroundGlobals).registration = { pushManager: { async getSubscription() { return null; }, async subscribe(options: { userVisibleOnly: boolean }) { subscriptionOptions = options; return { toJSON() { return { endpoint: "https://push.example.test/connector", keys: { p256dh: "key", auth: "auth" } }; } }; } } };
  (globalThis as unknown as BackgroundGlobals).WebSocket = class { static OPEN = 1; readyState = 1; constructor() {} addEventListener() {} send() {} close() {} };
  const previous = await importBackground(environment, "connector");
  try {
    const response = await send(environment, { type: "connector.claim", token: "one-time", extensionId: environment.chrome.runtime.id });
    assert.equal(response.ok, true);
    assert.deepEqual(response.state!.connector, { id: "connector-1", code: "AB2CDE3F" });
    assert.equal(environment.values["qr-scan-connector"]!.token, "connector-secret");
    assert.equal(subscriptionOptions!.userVisibleOnly, true);

    environment.chrome.notifications.onClicked.emit("qr-scan-handoff:event-1");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(environment.tabs[0].url, "https://example.com/from-phone");
  } finally {
    restoreBackground(previous);
    (globalThis as unknown as BackgroundGlobals).registration = previousRegistration;
    (globalThis as unknown as BackgroundGlobals).WebSocket = previousWebSocket;
  }
});

test("opens the web inbox for text, script URLs, or a missing event", async () => {
  const environment = createChrome() as ChromeEnvironment;
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
  const environment = createChrome() as ChromeEnvironment;
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "expired-secret", code: "AB2CDE3F" };
  environment.fetch = async () => reply(401, { error: "unauthorized" });
  const previousWebSocket = (globalThis as unknown as BackgroundGlobals).WebSocket;
  let socketAttempts = 0;
  (globalThis as unknown as BackgroundGlobals).WebSocket = class {
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
    (globalThis as unknown as BackgroundGlobals).WebSocket = previousWebSocket;
  }
});

test("deduplicates a redelivered extension Push by event id", async () => {
  const environment = createChrome() as ChromeEnvironment;
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "connector-secret", code: "AB2CDE3F" };
  const requests: string[] = [];
  environment.fetch = async (url) => { requests.push(String(url)); return reply(200, { status: "acknowledged" }); };
  const push = event<[PushFixture]>();
  const workerScope = { addEventListener(type: string, listener: (event: PushFixture) => void) { if (type === "push") push.addListener(listener); } };
  const previousWebSocket = (globalThis as unknown as BackgroundGlobals).WebSocket;
  (globalThis as unknown as BackgroundGlobals).WebSocket = class { static OPEN = 1; readyState = 1; addEventListener() {} send() {} close() {} };
  const previous = await importBackground(environment, "push-dedupe", workerScope);
  try {
    const deliver = async () => {
      let completed: Promise<unknown> | undefined;
      push.emit({ data: { json() { return { type: "handoff", eventId: "event-1" }; } }, waitUntil(promise: Promise<unknown>) { completed = promise; } });
      await completed;
    };
    await deliver();
    await deliver();

    assert.equal(environment.notifications.length, 1);
    assert.equal(environment.notifications[0].id, "qr-scan-handoff:event-1");
    assert.equal(requests.filter((url) => url.includes("/ack?connector=connector-1")).length, 2);
  } finally {
    restoreBackground(previous);
    (globalThis as unknown as BackgroundGlobals).WebSocket = previousWebSocket;
  }
});

test("clears persisted ACK retry work when the connector is revoked", async () => {
  const environment = createChrome() as ChromeEnvironment;
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
  const environment = createChrome() as ChromeEnvironment;
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "revoked-secret", code: "AB2CDE3F" };
  environment.fetch = async () => reply(401, { error: "unauthorized" });
  const push = event<[PushFixture]>();
  const workerScope = { addEventListener(type: string, listener: (event: PushFixture) => void) { if (type === "push") push.addListener(listener); } };
  const previous = await importBackground(environment, "first-ack-revoked", workerScope);
  try {
    let completed: Promise<unknown> | undefined;
    push.emit({ data: { json() { return { type: "handoff", eventId: "event-1" }; } }, waitUntil(promise: Promise<unknown>) { completed = promise; } });
    await completed;
    assert.equal(environment.values["qr-scan-connector"], undefined);
    assert.equal(environment.values["qr-scan-pending-acks"], undefined);
    assert.ok(environment.alarms.some((alarm) => alarm.clear === "qr-scan-ack-retry"));
  } finally {
    restoreBackground(previous);
  }
});

test("retains every concurrently failed ACK for retry", async () => {
  const environment = createChrome() as ChromeEnvironment;
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "retry-secret", code: "AB2CDE3F" };
  environment.fetch = async () => reply(503, { error: "request_failed" });
  const push = event<[PushFixture]>();
  const workerScope = { addEventListener(type: string, listener: (event: PushFixture) => void) { if (type === "push") push.addListener(listener); } };
  const previous = await importBackground(environment, "concurrent-ack-queue", workerScope);
  try {
    const completions: Promise<unknown>[] = [];
    for (const eventId of ["event-1", "event-2"]) {
      push.emit({ data: { json() { return { type: "handoff", eventId }; } }, waitUntil(promise: Promise<unknown>) { completions.push(promise); } });
    }
    await Promise.all(completions);
    assert.deepEqual(environment.values["qr-scan-pending-acks"]!.map((item) => item.eventId).sort(), ["event-1", "event-2"]);
  } finally {
    restoreBackground(previous);
  }
});

test("does not recreate retry state when a concurrent ACK revokes the connector", async () => {
  const environment = createChrome() as ChromeEnvironment;
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "revoked-secret", code: "AB2CDE3F" };
  let resolveSecondAck!: (response: HttpFixture) => void;
  let calls = 0;
  environment.fetch = async () => {
    calls += 1;
    if (calls === 1) return reply(401, { error: "unauthorized" });
    return new Promise<HttpFixture>((resolve) => { resolveSecondAck = resolve; });
  };
  const push = event<[PushFixture]>();
  const workerScope = { addEventListener(type: string, listener: (event: PushFixture) => void) { if (type === "push") push.addListener(listener); } };
  const previous = await importBackground(environment, "concurrent-revoked-ack", workerScope);
  try {
    const completions: Promise<unknown>[] = [];
    for (const eventId of ["event-1", "event-2"]) {
      push.emit({ data: { json() { return { type: "handoff", eventId }; } }, waitUntil(promise: Promise<unknown>) { completions.push(promise); } });
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
  const environment = createChrome() as ChromeEnvironment;
  environment.values["qr-scan-connector"] = { id: "connector-1", token: "revoked-secret", code: "AB2CDE3F" };
  let resolveSecondAck!: (response: HttpFixture) => void;
  let calls = 0;
  environment.fetch = async () => {
    calls += 1;
    if (calls === 1) return reply(401, { error: "unauthorized" });
    return new Promise<HttpFixture>((resolve) => { resolveSecondAck = resolve; });
  };
  const push = event<[PushFixture]>();
  const workerScope = { addEventListener(type: string, listener: (event: PushFixture) => void) { if (type === "push") push.addListener(listener); } };
  const previous = await importBackground(environment, "concurrent-revoked-success", workerScope);
  try {
    const completions: Promise<unknown>[] = [];
    for (const eventId of ["event-1", "event-2"]) {
      push.emit({ data: { json() { return { type: "handoff", eventId }; } }, waitUntil(promise: Promise<unknown>) { completions.push(promise); } });
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
