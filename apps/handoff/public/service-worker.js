const ACK_CACHE = "qr-scan-pending-acks-v1";

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data = null;
    try { data = event.data?.json() ?? null; } catch { data = null; }
    const eventId = typeof data?.eventId === "string" && data.eventId ? data.eventId : crypto.randomUUID();
    const code = typeof data?.code === "string" ? data.code : "";
    await self.registration.showNotification("QR Scan に届きました", {
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

self.addEventListener("sync", (event) => {
  if (event.tag === "qr-scan-handoff-ack") event.waitUntil(drainAcks());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "retry-handoff-acks") event.waitUntil(drainAcks());
});

self.addEventListener("activate", (event) => { event.waitUntil(drainAcks()); });

async function queueAndDrainAck(code, eventId) {
  const cache = await caches.open(ACK_CACHE);
  const key = new Request(new URL(`/__qr-scan-ack/${encodeURIComponent(code)}/${encodeURIComponent(eventId)}`, self.location.origin));
  await cache.put(key, new Response(JSON.stringify({ code, eventId })));
  try { await self.registration.sync?.register("qr-scan-handoff-ack"); } catch { /* Opening the inbox retries persisted ACKs. */ }
  await drainAcks();
}

async function drainAcks() {
  const cache = await caches.open(ACK_CACHE);
  for (const key of await cache.keys()) {
    const record = await cache.match(key).then((response) => response?.json()).catch(() => null);
    if (!record?.code || !record?.eventId) { await cache.delete(key); continue; }
    try {
      const response = await fetch(`/api/v1/pairs/${encodeURIComponent(record.code)}/ack`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: record.eventId })
      });
      if (response.ok) await cache.delete(key);
    } catch { /* Keep the event-id-only ACK record for Sync or the next inbox open. */ }
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = await notificationTarget(event.notification.data);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (target.direct) return self.clients.openWindow(target.href);
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) return existing.focus();
    return self.clients.openWindow(target.href);
  })());
});

async function notificationTarget(data) {
  const inbox = new URL(data?.inbox ?? "/", self.location.origin).href;
  const code = typeof data?.code === "string" ? data.code : "";
  const eventId = typeof data?.eventId === "string" ? data.eventId : "";
  if (!/^[A-Z0-9-]{4,32}$/i.test(code) || !eventId) return { href: inbox, direct: false };
  try {
    const response = await fetch(`/api/v1/pairs/${encodeURIComponent(code)}/events?event=${encodeURIComponent(eventId)}`, { credentials: "same-origin" });
    if (!response.ok) return { href: inbox, direct: false };
    const body = await response.json();
    const event = Array.isArray(body?.events) ? body.events.find((item) => item?.id === eventId) : null;
    const target = typeof event?.openUrl === "string" ? new URL(event.openUrl) : null;
    if (!target || !["http:", "https:"].includes(target.protocol)) return { href: inbox, direct: false };
    return { href: target.href, direct: true };
  } catch {
    return { href: inbox, direct: false };
  }
}
