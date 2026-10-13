// 属性の投影は既存guardの読取りだけを表し、外部message/応答の検証済みschemaではない。
interface BridgeMessageProjection { source?: unknown; type?: unknown; extensionId?: unknown; token?: unknown }
interface ClaimResponseProjection { ok?: unknown; error?: unknown }
declare const chrome: { runtime: {
  id: string;
  sendMessage(message: { type: "connector.claim"; token: string; extensionId: string }): Promise<unknown>;
} };

const source = "qr-scan-extension";

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== location.origin || !event.data || (event.data as BridgeMessageProjection).source !== "qr-scan-web") return;
  if ((event.data as BridgeMessageProjection).type === "page-ready") announce();
  if ((event.data as BridgeMessageProjection).type === "connector-link" && (event.data as BridgeMessageProjection).extensionId === chrome.runtime.id && typeof (event.data as BridgeMessageProjection).token === "string") {
    chrome.runtime.sendMessage({ type: "connector.claim", token: (event.data as { token: string }).token, extensionId: chrome.runtime.id })
      .then((response) => reportClaim((response as ClaimResponseProjection | null | undefined)?.ok === true, (response as ClaimResponseProjection | null | undefined)?.error))
      .catch(() => reportClaim(false, "request_failed"));
  }
});

announce();

function announce() {
  window.postMessage({ source, type: "ready", extensionId: chrome.runtime.id }, location.origin);
}

function reportClaim(ok: boolean, error: unknown) {
  window.postMessage({ source, type: "connector-result", ok, error: typeof error === "string" ? error : "request_failed" }, location.origin);
}
