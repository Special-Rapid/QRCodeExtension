import { strict as assert } from 'node:assert';
import test from 'node:test';
import { candidateSignature, collectBarcodeCandidates, collectOcrUrlCandidates, toHttpUrl } from './scan-candidates.ts';

test('normalizes safe scheme-less URL candidates and rejects unsafe values', () => {
  assert.equal(toHttpUrl('example.com/path')?.toString(), 'https://example.com/path');
  assert.equal(toHttpUrl('javascript:alert(1)'), null);
  assert.equal(toHttpUrl('hello@example.com'), null);
});

test('deduplicates barcode candidates by their normalized handoff payload', () => {
  const candidates = collectBarcodeCandidates([
    { data: 'https://example.com', type: 'qr' },
    { data: 'https://example.com/', type: 'qr' },
    { data: 'plain text', type: 'code128' },
  ]);
  assert.deepEqual(candidates.map((candidate) => candidate.data), ['https://example.com', 'plain text']);
  assert.equal(candidates[0].id, 'barcode-1');
});

test('extracts only safe URL text candidates from OCR blocks and retains fixed bounds', () => {
  const candidates = collectOcrUrlCandidates([
    { text: '案内 example.com/path。 mail hello@example.com ftp://unsafe.example', x: 20, y: 40, width: 200, height: 36 },
  ]);
  assert.deepEqual(candidates.map((candidate) => candidate.data), ['https://example.com/path']);
  assert.deepEqual(candidates[0].bounds, { x: 20, y: 40, width: 200, height: 36 });
});

test('uses the normalized URL set as an order-independent live OCR stability signature', () => {
  const first = collectOcrUrlCandidates([
    { text: 'first.example second.example', x: 0, y: 0, width: 200, height: 20 },
  ]);
  const second = collectOcrUrlCandidates([
    { text: 'second.example first.example', x: 10, y: 10, width: 200, height: 20 },
  ]);
  assert.equal(candidateSignature(first), candidateSignature(second));
});
