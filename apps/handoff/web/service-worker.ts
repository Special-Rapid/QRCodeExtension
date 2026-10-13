// 型はこのscriptが使うAPI面だけを表す。外部JSONの値は検証済みschemaにしない。
interface WorkerEvents {
  push: { data?: { json(): unknown } | null; waitUntil(promise: Promise<unknown>): void };
  sync: { tag: string; waitUntil(promise: Promise<unknown>): void };
  message: { data: unknown; waitUntil(promise: Promise<unknown>): void };
  activate: { waitUntil(promise: Promise<unknown>): void };
  notificationclick: { notification: { data: unknown; close(): void }; waitUntil(promise: Promise<unknown>): void };
}
interface WorkerScope {
  addEventListener<K extends keyof WorkerEvents>(type: K, listener: (event: WorkerEvents[K]) => void): void;
  location: { origin: string };
  registration: {
    showNotification(title: string, options: { body: string; tag: string; renotify: boolean; data: { inbox: string; code: string; eventId: string } }): Promise<void>;
    sync?: { register(tag: string): Promise<void> };
  };
  clients: Pick<Clients, "matchAll" | "openWindow">;
}
// 未検証のpropertyへの既存アクセスだけを投影する。実行時のboxing/例外は保持する。
type PushFields = { eventId?: unknown; code?: unknown } | null | undefined;
type AckFields = { eventId?: unknown; code?: unknown } | null | undefined;
type NotificationFields = { inbox?: unknown; code?: unknown; eventId?: unknown } | null | undefined;

const ACK_CACHE = "qr-scan-pending-acks-v1";

(self as unknown as WorkerScope).addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data: PushFields = null;
    try { data = (event.data?.json() ?? null) as PushFields; } catch { data = null; }
    const eventId = typeof data?.eventId === "string" && data.eventId ? data.eventId : crypto.randomUUID();
    const code = typeof data?.code === "string" ? data.code : "";
    await (self as unknown as WorkerScope).registration.showNotification("QR Scan に届きました", {
      body: "新しい読み取り結果があります。",
      tag: `qr-scan-handoff:${eventId}`,
      renotify: false,
      // The URL is deliberately not included in Push data. It is resolved only after a
      // notification click, through the authenticated same-origin event endpoint.
      data: { inbox: "/", code, eventId }
    });
    if (code && eventId) await queueAndDrainAck(code, eventId);
  })());
});

(self as unknown as WorkerScope).addEventListener("sync", (event) => {
  if (event.tag === "qr-scan-handoff-ack") event.waitUntil(drainAcks());
});

(self as unknown as WorkerScope).addEventListener("message", (event) => {
  if ((event.data as { type?: unknown } | null | undefined)?.type === "retry-handoff-acks") event.waitUntil(drainAcks());
});

(self as unknown as WorkerScope).addEventListener("activate", (event) => { event.waitUntil(drainAcks()); });

async function queueAndDrainAck(code: string, eventId: string) {
  const cache = await caches.open(ACK_CACHE);
  const key = new Request(new URL(`/__qr-scan-ack/${encodeURIComponent(code)}/${encodeURIComponent(eventId)}`, (self as unknown as WorkerScope).location.origin));
  await cache.put(key, new Response(JSON.stringify({ code, eventId })));
  try { await (self as unknown as WorkerScope).registration.sync?.register("qr-scan-handoff-ack"); } catch { /* Opening the inbox retries persisted ACKs. */ }
  await drainAcks();
}

async function drainAcks() {
  const cache = await caches.open(ACK_CACHE);
  for (const key of await cache.keys()) {
    const record = await cache.match(key).then((response): Promise<unknown> | undefined => response?.json()).catch(() => null) as AckFields;
    if (!record?.code || !record?.eventId) { await cache.delete(key); continue; }
    try {
      const response = await fetch(`/api/v1/pairs/${encodeURIComponent(record.code as Parameters<typeof encodeURIComponent>[0])}/ack`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: record.eventId })
      });
      if (response.ok) await cache.delete(key);
    } catch { /* Keep the event-id-only ACK record for Sync or the next inbox open. */ }
  }
}

(self as unknown as WorkerScope).addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = await notificationTarget(event.notification.data);
    const windows = await (self as unknown as WorkerScope).clients.matchAll({ type: "window", includeUncontrolled: true });
    if (target.direct) return (self as unknown as WorkerScope).clients.openWindow(target.href);
    const existing = windows.find((client) => client.url.startsWith((self as unknown as WorkerScope).location.origin));
    if (existing) return existing.focus();
    return (self as unknown as WorkerScope).clients.openWindow(target.href);
  })());
});

async function notificationTarget(data: unknown): Promise<{ href: string; direct: boolean }> {
  const inbox = new URL(((data as NotificationFields)?.inbox ?? "/") as string, (self as unknown as WorkerScope).location.origin).href;
  const code = typeof (data as NotificationFields)?.code === "string" ? (data as { code: string }).code : "";
  const eventId = typeof (data as NotificationFields)?.eventId === "string" ? (data as { eventId: string }).eventId : "";
  if (!/^[A-Z0-9-]{4,32}$/i.test(code) || !eventId) return { href: inbox, direct: false };
  try {
    const response = await fetch(`/api/v1/pairs/${encodeURIComponent(code)}/events?event=${encodeURIComponent(eventId)}`, { credentials: "same-origin" });
    if (!response.ok) return { href: inbox, direct: false };
    const body = await response.json() as { events?: unknown } | null | undefined;
    const event: unknown = Array.isArray(body?.events) ? body.events.find((item: unknown) => (item as { id?: unknown } | null | undefined)?.id === eventId) : null;
    const target = typeof (event as { openUrl?: unknown } | null | undefined)?.openUrl === "string" ? new URL((event as { openUrl: string }).openUrl) : null;
    if (!target || !["http:", "https:"].includes(target.protocol)) return { href: inbox, direct: false };
    return { href: target.href, direct: true };
  } catch {
    return { href: inbox, direct: false };
  }
}
