import * as SecureStore from 'expo-secure-store';

const MOBILE_IDENTITY_KEY = 'qr-scan-handoff-credential';
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

export type MobileIdentity = {
  receiverId: string;
  token: string;
  label: string;
};

export type PairedPcDevice = {
  id: string;
  label: string;
  createdAt: number;
};

type ApiError = Error & { code?: string };

export async function claimPair(code: string, label: string, identity?: MobileIdentity | null): Promise<PairCredential> {
  return request(`/api/v1/pairs/${encodeURIComponent(code)}/claim`, {
    method: 'POST',
    body: { label, mobileReceiverId: identity?.receiverId, mobileToken: identity?.token },
  });
}

export async function confirmPair(credential: PairCredential) {
  const response = await request(`/api/v1/pairs/${encodeURIComponent(credential.code)}/confirm`, {
    method: 'POST',
    body: { role: 'mobile', token: credential.token },
  });
  if (response.status === 'paired') await saveMobileIdentity({ receiverId: credential.receiverId, token: credential.token, label: 'このスマホ' });
  return response as { status: PairCredential['status']; phrase: string; peerConfirmed: boolean };
}

export async function getPairStatus(credential: PairCredential) {
  const response = await request(`/api/v1/pairs/${encodeURIComponent(credential.code)}/status`, {
    headers: { Authorization: `Bearer ${credential.token}`, 'X-QR-Role': 'mobile' },
  });
  const updated = { ...credential, ...response, role: 'mobile' as const };
  if (updated.status === 'paired') await saveMobileIdentity({ receiverId: updated.receiverId, token: updated.token, label: 'このスマホ' });
  return updated as PairCredential & { peerLabel: string | null; peerConfirmed: boolean; selfConfirmed: boolean };
}

export async function sendHandoff(data: string) {
  const identity = await loadMobileIdentity();
  if (!identity) throw apiError('not_paired');
  try {
    return await request('/api/v1/handoffs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${identity.token}` },
      body: { data },
    });
  } catch (error) {
    if (error instanceof Error && (error as ApiError).code === 'unauthorized') await clearMobileIdentity();
    throw error;
  }
}

export async function getMobileDevices(identity: MobileIdentity) {
  return request('/api/v1/mobile/devices', {
    headers: { Authorization: `Bearer ${identity.token}` },
  }) as Promise<{ deviceCount: number; devices: PairedPcDevice[] }>;
}

export async function revokePair(credential: PairCredential) {
  await request(`/api/v1/pairs/${encodeURIComponent(credential.code)}/revoke`, {
    method: 'POST',
    body: { role: 'mobile', token: credential.token },
  });
}

export function loadMobileIdentity() {
  return SecureStore.getItemAsync(MOBILE_IDENTITY_KEY).then(async (value) => {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as Partial<MobileIdentity>;
      if (typeof parsed.receiverId === 'string' && typeof parsed.token === 'string') return { receiverId: parsed.receiverId, token: parsed.token, label: typeof parsed.label === 'string' ? parsed.label : 'このスマホ' };
      throw new Error('invalid_identity');
    } catch {
      await SecureStore.deleteItemAsync(MOBILE_IDENTITY_KEY);
      return null;
    }
  });
}

export function clearMobileIdentity() {
  return SecureStore.deleteItemAsync(MOBILE_IDENTITY_KEY);
}

async function saveMobileIdentity(identity: MobileIdentity) {
  await SecureStore.setItemAsync(MOBILE_IDENTITY_KEY, JSON.stringify(identity));
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
