export type CandidateBounds = { x: number; y: number; width: number; height: number };

export type ScanCandidate = {
  id: string;
  data: string;
  type: 'barcode' | 'ocr';
  barcodeType?: string;
  url: string | null;
  bounds: CandidateBounds | null;
};

export type RawBarcodeCandidate = {
  data: string;
  type: string;
  bounds?: { origin?: { x?: number; y?: number }; size?: { width?: number; height?: number } };
};

export type RawOcrBlock = { text: string; x: number; y: number; width: number; height: number };

const bareWebUrl = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z](?:[a-z\d-]{0,61}[a-z\d])?(?::\d{1,5})?(?:\/[^\s<>"'`]*)?$/iu;
const urlCandidate = /(?:^|[\s([{"'`])((?:https?:\/\/)?(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z](?:[a-z\d-]{0,61}[a-z\d])?(?::\d{1,5})?(?:\/[^\s<>"'`]*)?)/gimu;

export function toHttpUrl(value: string) {
  const candidate = value.trim();
  const explicitHttp = /^https?:\/\//iu.test(candidate);
  if (!explicitHttp && !bareWebUrl.test(candidate)) return null;
  try {
    const url = new URL(explicitHttp ? candidate : `https://${candidate}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

export function collectBarcodeCandidates(scans: RawBarcodeCandidate[]): ScanCandidate[] {
  return dedupeCandidates(scans.filter((scan) => typeof scan.data === 'string' && scan.data.trim()).map((scan, index) => ({
    id: `barcode-${index}`,
    data: scan.data.trim(),
    type: 'barcode' as const,
    barcodeType: scan.type,
    url: toHttpUrl(scan.data)?.toString() ?? null,
    bounds: barcodeBounds(scan.bounds),
  })));
}

export function collectOcrUrlCandidates(blocks: RawOcrBlock[]): ScanCandidate[] {
  const candidates: ScanCandidate[] = [];
  for (const [blockIndex, block] of blocks.entries()) {
    if (!block || typeof block.text !== 'string') continue;
    for (const [candidateIndex, match] of [...block.text.matchAll(urlCandidate)].entries()) {
      const url = toHttpUrl(trimTerminalPunctuation(match[1] ?? ''));
      if (!url) continue;
      candidates.push({
        id: `ocr-${blockIndex}-${candidateIndex}`,
        data: url.toString(),
        type: 'ocr',
        url: url.toString(),
        bounds: finiteBounds(block),
      });
    }
  }
  return dedupeCandidates(candidates);
}

export function dedupeCandidates(candidates: ScanCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.url ?? candidate.data;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((candidate, index) => ({ ...candidate, id: `${candidate.type}-${index + 1}` }));
}

export function candidateSignature(candidates: ScanCandidate[]) {
  return candidates
    .map((candidate) => candidate.url ?? candidate.data)
    .filter(Boolean)
    .sort()
    .join('\u001f');
}

function barcodeBounds(bounds: RawBarcodeCandidate['bounds']): CandidateBounds | null {
  const origin = bounds?.origin;
  const size = bounds?.size;
  return finiteBounds({ x: origin?.x, y: origin?.y, width: size?.width, height: size?.height });
}

function finiteBounds(value: Partial<CandidateBounds>): CandidateBounds | null {
  const { x, y, width, height } = value;
  return [x, y, width, height].every((item) => typeof item === 'number' && Number.isFinite(item) && item >= 0)
    ? { x: x!, y: y!, width: width!, height: height! }
    : null;
}

function trimTerminalPunctuation(value: string) {
  let trimmed = value.replace(/[.,!?;:。]+$/u, '');
  while (trimmed.endsWith(')') && count(trimmed, '(') < count(trimmed, ')')) trimmed = trimmed.slice(0, -1);
  while (trimmed.endsWith(']') && count(trimmed, '[') < count(trimmed, ']')) trimmed = trimmed.slice(0, -1);
  return trimmed;
}

function count(value: string, character: string) {
  return [...value].filter((item) => item === character).length;
}
