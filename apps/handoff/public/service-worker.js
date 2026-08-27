self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data = null;
    try { data = event.data?.json() ?? null; } catch { data = null; }
    const eventId = typeof data?.eventId === "string" && data.eventId ? data.eventId : crypto.randomUUID();
    await self.registration.showNotification("QR Scan に届きました", {
      body: "新しい読み取り結果があります。",
      tag: `qr-scan-handoff:${eventId}`,
      renotify: false,
      data: { inbox: "/" }
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.inbox ?? "/", self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  })());
});
