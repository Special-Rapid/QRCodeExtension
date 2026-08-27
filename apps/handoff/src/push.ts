import * as webpush from "web-push";

export type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type VapidConfig = {
  publicKey?: string;
  privateKey?: string;
  subject?: string;
};

export type PushResult = { sent: true } | { sent: false; expired?: boolean };
export type DeliveryChannel = PushSubscriptionRecord & { kind: "web_push" | "extension_push" };
type PushClient = Pick<typeof webpush, "sendNotification">;

export function canSendPush(config: VapidConfig) {
  return Boolean(config.publicKey && config.privateKey && config.subject);
}

export function handoffDeliveryRoute(webSockets: { web: number; connector: number }) {
  if (webSockets.web > 0) return "web" as const;
  if (webSockets.connector > 0) return "connector" as const;
  return "push" as const;
}

export async function deliverHandoffPush(channels: DeliveryChannel[], send: (channel: DeliveryChannel) => Promise<PushResult>, revoke: (channel: DeliveryChannel) => Promise<void>) {
  for (const channel of channels) {
    const result = await send(channel);
    if (result.sent) return true;
    if (result.expired) await revoke(channel);
  }
  return false;
}

export function createHandoffPushSender(client: PushClient = webpush) {
  return async (subscription: PushSubscriptionRecord, config: VapidConfig, eventId: string): Promise<PushResult> => {
    if (!canSendPush(config)) return { sent: false };
    try {
      await client.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({ type: "handoff", eventId }),
        {
          TTL: 60,
          urgency: "high",
          vapidDetails: { subject: config.subject!, publicKey: config.publicKey!, privateKey: config.privateKey! }
        }
      );
      return { sent: true };
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? (error as { statusCode?: unknown }).statusCode : undefined;
      return { sent: false, expired: statusCode === 404 || statusCode === 410 };
    }
  };
}

export const sendHandoffPush = createHandoffPushSender();
