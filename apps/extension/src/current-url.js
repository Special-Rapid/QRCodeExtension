import { toSafeHttpUrl } from "./safe-url.js";

export function currentWebUrlFromTab(tab) {
  if (typeof tab?.url !== "string") return null;
  return toSafeHttpUrl(tab.url)?.toString() ?? null;
}
