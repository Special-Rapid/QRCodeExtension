import { toSafeHttpUrl } from "./safe-url.js";

const MAX_TEXT_LENGTH = 200_000;
const MAX_URLS = 20;
// A bare domain must have a real dot-delimited hostname.  The prefix capture prevents
// matching the domain part of an email address or a non-HTTP scheme such as ftp://.
const URL_CANDIDATE = /(?:^|[\s([{"'`])((?:https?:\/\/)?(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z](?:[a-z\d-]{0,61}[a-z\d])?(?::\d{1,5})?(?:\/[^\s<>"'`]*)?)/gimu;

export function extractHttpUrls(text) {
  if (typeof text !== "string") return [];
  const urls = [];
  const seen = new Set();
  for (const match of text.slice(0, MAX_TEXT_LENGTH).matchAll(URL_CANDIDATE)) {
    const value = normalizeCandidate(match[1]);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    urls.push(value);
    if (urls.length === MAX_URLS) break;
  }
  return urls;
}

export function mergeDecodedValues(...groups) {
  const values = new Map();
  for (const group of groups) {
    for (const result of group) {
      const key = result?.data ? canonicalValue(result.data) : "";
      if (key && !values.has(key)) values.set(key, result);
    }
  }
  return [...values.values()];
}

function normalizeCandidate(candidate) {
  let value = candidate.replace(/[.,!?;:。]+$/u, "");
  while (value.endsWith(")") && count(value, "(") < count(value, ")")) value = value.slice(0, -1);
  while (value.endsWith("]") && count(value, "[") < count(value, "]")) value = value.slice(0, -1);
  try {
    return toSafeHttpUrl(value)?.toString() ?? null;
  } catch { return null; }
}

function canonicalValue(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : value;
  } catch { return value; }
}

function count(value, character) { return [...value].filter((item) => item === character).length; }
