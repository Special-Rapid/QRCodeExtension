export const PAIR_CODE_LENGTH = 8;
export const PAIR_TTL_MS = 5 * 60 * 1000;
export const HANDOFF_TTL_MS = 10 * 60 * 1000;
export const MAX_PAYLOAD_LENGTH = 4096;

const PAIR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const WORDS = ["あお", "あさ", "いと", "うみ", "えき", "おと", "かぜ", "かわ", "きいろ", "くも", "こえ", "さくら", "しろ", "そら", "つき", "てら", "なみ", "にじ", "はな", "ひかり", "ふね", "ほし", "まど", "みち", "もり", "やま", "ゆき", "よる", "りんご", "わた"];
const BARE_WEB_URL = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z](?:[a-z\d-]{0,61}[a-z\d])?(?::\d{1,5})?(?:\/[^\s<>"'`]*)?$/iu;

export type ReceiverRole = "web" | "mobile";

export function normalizePairCode(value: string) {
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return new RegExp(`^[${PAIR_ALPHABET}]{${PAIR_CODE_LENGTH}}$`).test(code) ? code : null;
}

export function createPairCode(random = crypto.getRandomValues(new Uint8Array(PAIR_CODE_LENGTH))) {
  return Array.from(random, (value) => PAIR_ALPHABET[value % PAIR_ALPHABET.length]).join("");
}

export function createConfirmationPhrase(random = crypto.getRandomValues(new Uint8Array(2))) {
  return `${WORDS[random[0] % WORDS.length]}・${WORDS[random[1] % WORDS.length]}`;
}

export function createOpaqueToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function isSafeOpenUrl(value: string) {
  const candidate = value.trim();
  const explicitHttp = /^https?:\/\//iu.test(candidate);
  if (!explicitHttp && !BARE_WEB_URL.test(candidate)) return null;
  try {
    const url = new URL(explicitHttp ? candidate : `https://${candidate}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function validatePayload(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_PAYLOAD_LENGTH ? value : null;
}

export function validateLabel(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const label = value.trim().replace(/\s+/g, " ");
  return label.length > 0 && label.length <= 48 ? label : fallback;
}

export async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
