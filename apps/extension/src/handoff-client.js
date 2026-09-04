import { toSafeHttpUrl } from "./safe-url.js";

export const HANDOFF_ORIGIN = "https://qr.snkisk.com";

export async function handoffApi(path, { method = "GET", body, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(`${HANDOFF_ORIGIN}${path}`, {
      method,
      credentials: "omit",
      headers: { accept: "application/json", "content-type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw handoffError("network");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw handoffError(typeof data.error === "string" ? data.error : "request_failed");
  return data;
}

export function isSafeOpenUrl(value) {
  return toSafeHttpUrl(value);
}

export function handoffError(code) {
  const message = {
    network: "PC連携サービスへ接続できません。ネットワークと設定を確認してください。",
    expired: "連携コードの有効期限が切れました。もう一度作成してください。",
    already_claimed: "このコードは別のスマホで入力済みです。",
    unauthorized: "連携情報を確認できませんでした。もう一度連携してください。",
    not_paired: "先にスマホと連携してください。"
  }[code] ?? "PC連携を完了できませんでした。";
  return Object.assign(new Error(message), { code });
}
