import { toSafeHttpUrl } from "./safe-url.ts";

export function currentWebUrlFromTab(tab: { url?: unknown } | null | undefined): string | null {
  if (typeof tab?.url !== "string") return null;
  return toSafeHttpUrl(tab.url)?.toString() ?? null;
}
