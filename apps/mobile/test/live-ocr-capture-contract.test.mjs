import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('live OCR capture is visually quiet and exposes recoverable guidance in both locales', async () => {
  const [scanner, strings] = await Promise.all([
    read('../src/app/index.tsx'),
    read('../src/lib/strings.ts'),
  ]);

  assert.match(scanner, /animateShutter=\{false\}/);
  assert.match(scanner, /liveOcrUnstableMatches/);
  assert.match(scanner, /liveOcrFailures/);
  assert.match(scanner, /t\.candidateTextSteady/);
  assert.match(scanner, /t\.candidateTextRetry/);
  assert.match(strings, /candidateTextSteady: 'URLを読み取り中です/);
  assert.match(strings, /candidateTextRetry: 'URL文字列を確認できません/);
  assert.match(strings, /candidateTextSteady: 'Reading the URL/);
  assert.match(strings, /candidateTextRetry: 'Could not read the URL text/);
});

test('PC link default guidance follows the selected language after a preference change', async () => {
  const pair = await read('../src/app/pair.tsx');
  assert.match(pair, /useState\(''\)/);
  assert.match(pair, /message \|\| t\.pairDefaultMessage/);
});

test('scanner candidate controls retain non-overlapping 44pt targets', async () => {
  const [scanner, theme] = await Promise.all([
    read('../src/app/index.tsx'),
    read('../src/lib/theme.ts'),
  ]);

  assert.match(scanner, /style=\{styles\.zoomPreset\}/);
  assert.match(scanner, /style=\{\[styles\.candidateMarker/);
  assert.match(scanner, /style=\{styles\.scanAgain\}/);
  assert.match(theme, /zoomPreset: \{ width: 44, minHeight: 44/);
  assert.match(theme, /candidateMarker: \{[^\n]*width: 44, height: 44/);
  assert.match(theme, /scanAgain: \{ minHeight: 44/);
  assert.match(theme, /candidateNavButton: \{ minHeight: 44/);
  assert.match(theme, /openAction: \{ flex: 1, minHeight: 44/);
  assert.match(theme, /copyAction: \{ flex: 1, minHeight: 44/);
  assert.match(theme, /pairAction: \{ flex: 1, minHeight: 44/);
});
