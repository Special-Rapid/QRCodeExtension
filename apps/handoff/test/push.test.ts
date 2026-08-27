import { describe, expect, it } from "vitest";
import { createHandoffPushSender, deliverHandoffPush, handoffDeliveryRoute, type DeliveryChannel } from "../src/push";

const config = { publicKey: "public", privateKey: "private", subject: "mailto:qr@example.test" };
const extension: DeliveryChannel = { id: "extension", endpoint: "https://push.example.test/extension", p256dh: "p256dh", auth: "auth", kind: "extension_push" };
const web: DeliveryChannel = { id: "web", endpoint: "https://push.example.test/web", p256dh: "p256dh", auth: "auth", kind: "web_push" };

describe("handoff delivery", () => {
  it("routes a handoff to the web socket, then connector socket, before Push", () => {
    expect(handoffDeliveryRoute({ web: 1, connector: 1 })).toBe("web");
    expect(handoffDeliveryRoute({ web: 0, connector: 1 })).toBe("connector");
    expect(handoffDeliveryRoute({ web: 0, connector: 0 })).toBe("push");
  });

  it("sends a minimal Push body with high urgency and VAPID details", async () => {
    const calls: unknown[][] = [];
    const send = createHandoffPushSender({ async sendNotification(...args: unknown[]) { calls.push(args); } } as never);
    await expect(send(extension, config, "event-1")).resolves.toEqual({ sent: true });
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toBe(JSON.stringify({ type: "handoff", eventId: "event-1" }));
    expect(calls[0][2]).toMatchObject({ TTL: 60, urgency: "high", vapidDetails: config });
  });

  it("marks an HTTP 410 Push subscription as expired", async () => {
    const send = createHandoffPushSender({ async sendNotification() { throw { statusCode: 410 }; } } as never);
    await expect(send(extension, config, "event-1")).resolves.toEqual({ sent: false, expired: true });
  });

  it("revokes an expired preferred subscription and falls back to the next channel", async () => {
    const sent: string[] = [];
    const revoked: string[] = [];
    const result = await deliverHandoffPush(
      [extension, web],
      async (channel) => {
        sent.push(channel.id);
        return channel.id === "extension" ? { sent: false, expired: true } : { sent: true };
      },
      async (channel) => { revoked.push(channel.id); }
    );
    expect(result).toBe(true);
    expect(sent).toEqual(["extension", "web"]);
    expect(revoked).toEqual(["extension"]);
  });
});
