import * as SecureStore from 'expo-secure-store';

const CREDENTIAL_KEY = 'qr-scan-handoff-credential';
const HANDOFF_ORIGIN = process.env.EXPO_PUBLIC_HANDOFF_ORIGIN ?? 'https://qr.snkisk.com';

export type PairCredential = {
  code: string;
  receiverId: string;
  token: string;
  role: 'mobile';
  phrase: string;
  expiresAt: number;
  status?: 'pending' | 'paired' | 'expired' | 'revoked';
};

type ApiError = Error & { code?: string };

export async function claimPair(code: string, label: string): Promise<PairCredential> {
  return request(`/api/v1/pairs/${encodeURIComponent(code)}/claim`, { method: 'POST', body: { label } });
}

export async function confirmPair(credential: PairCredential) {
  const response = await request(`/api/v1/pairs/${encodeURIComponent(credential.code)}/confirm`, {
    method: 'POST',
    body: { role: 'mobile', token: credential.token },
  });
  if (response.status === 'paired') await saveCredential({ ...credential, status: 'paired' });
  return response as { status: PairCredential['status']; phrase: string; peerConfirmed: boolean };
}

export async function getPairStatus(credential: PairCredential) {
  const response = await request(`/api/v1/pairs/${encodeURIComponent(credential.code)}/status`, {
    headers: { Authorization: `Bearer ${credential.token}`, 'X-QR-Role': 'mobile' },
  });
  const updated = { ...credential, ...response, role: 'mobile' as const };
  if (updated.status === 'paired') await saveCredential(updated);
  if (updated.status === 'revoked' || updated.status === 'expired') await clearCredential();
  return updated as PairCredential & { peerLabel: string | null; peerConfirmed: boolean; selfConfirmed: boolean };
}

export async function sendHandoff(data: string) {
  const credential = await loadCredential();
  if (!credential) throw apiError('not_paired');
  try {
    return await request('/api/v1/handoffs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential.token}` },
      body: { receiverId: credential.receiverId, data },
    });
  } catch (error) {
    if (error instanceof Error && ['unauthorized', 'not_paired'].includes((error as ApiError).code ?? '')) await clearCredential();
    throw error;
  }
}

export async function revokePair(credential: PairCredential) {
  await request(`/api/v1/pairs/${encodeURIComponent(credential.code)}/revoke`, {
    method: 'POST',
    body: { role: 'mobile', token: credential.token },
  });
  await clearCredential();
}

export function loadCredential() {
  return SecureStore.getItemAsync(CREDENTIAL_KEY).then(async (value) => {
    if (!value) return null;
    try { return JSON.parse(value) as PairCredential; } catch {
      await SecureStore.deleteItemAsync(CREDENTIAL_KEY);
      return null;
    }
  });
}

export function clearCredential() {
  return SecureStore.deleteItemAsync(CREDENTIAL_KEY);
}

async function saveCredential(credential: PairCredential) {
  await SecureStore.setItemAsync(CREDENTIAL_KEY, JSON.stringify(credential));
}

async function request(path: string, options: { method?: string; headers?: Record<string, string>; body?: object } = {}) {
  let response: Response;
  try {
    response = await fetch(`${HANDOFF_ORIGIN}${path}`, {
      method: options.method ?? 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw apiError('network');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw apiError(typeof data.error === 'string' ? data.error : 'request_failed');
  return data;
}

function apiError(code: string): ApiError {
  const message = ({
    network: 'PC連携サービスへ接続できません。ネットワークと設定を確認してください。',
    expired: '連携コードの有効期限が切れました。PCで新しいコードを表示してください。',
    already_claimed: 'このコードは別のスマホで入力済みです。',
    unauthorized: '連携情報を確認できませんでした。もう一度連携してください。',
    not_paired: '先にPCと連携してください。',
  } as Record<string, string>)[code] ?? 'PC連携を完了できませんでした。';
  return Object.assign(new Error(message), { code });
}
