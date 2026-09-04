const BARE_WEB_URL = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z](?:[a-z\d-]{0,61}[a-z\d])?(?::\d{1,5})?(?:\/[^\s<>"'`]*)?$/iu;

export function toSafeHttpUrl(value) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate) return null;
  const explicitHttp = /^https?:\/\//iu.test(candidate);
  if (!explicitHttp && !BARE_WEB_URL.test(candidate)) return null;
  try {
    const url = new URL(explicitHttp ? candidate : `https://${candidate}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch { return null; }
}
