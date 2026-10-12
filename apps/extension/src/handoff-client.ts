import { toSafeHttpUrl } from "./safe-url.ts";

export const HANDOFF_ORIGIN = "https://qr.snkisk.com";

interface HandoffRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function handoffApi(path: string, { method = "GET", body, headers = {} }: HandoffRequestOptions = {}): Promise<unknown> {
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
  const data: unknown = await response.json().catch(() => ({}));
  // JSON全体は検証済みobjectへ昇格しない。従来のerror属性読取とtypeof判定だけを型投影する。
  // null応答の既存失敗も保持し、runtime validationやエラー処理を追加しない。
  if (!response.ok) throw handoffError(typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "request_failed");
  return data;
}

export function isSafeOpenUrl(value: unknown) {
  return toSafeHttpUrl(value);
}

export function handoffError(code: string) {
  const message = ({
    network: "PC連携サービスへ接続できません。ネットワークと設定を確認してください。",
    expired: "連携コードの有効期限が切れました。もう一度作成してください。",
    already_claimed: "このコードは別のスマホで入力済みです。",
    unauthorized: "連携情報を確認できませんでした。もう一度連携してください。",
    not_paired: "先にスマホと連携してください。"
  } as Partial<Record<string, string>>)[code] ?? "PC連携を完了できませんでした。";
  return Object.assign(new Error(message), { code });
}
