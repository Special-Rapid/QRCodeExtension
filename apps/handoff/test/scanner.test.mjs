import { describe, it, expect, vi } from 'vitest';
import QRCode from '../../../node_modules/qrcode/lib/index.js';
import { decodeImageData, toSafeHttpUrl } from '../public/scan-decoder.js';
import { createScanner } from '../public/scanner.js';

function harness(media, decodeImage = async () => [], decodeFrame = () => []) {
  const nodes = new Map();
  function node() { return { dataset: {}, hidden: false, disabled: false, value: '', files: [], handlers: {}, children: [], textContent: '', addEventListener(type, fn) { this.handlers[type] = fn; }, append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; }, readyState: 2, videoWidth: 100, videoHeight: 100, getContext() { return { drawImage() {}, getImageData() { return {}; } }; }, async play() {}, }; }
  const document = { hidden: false, handlers: {}, getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }, createElement: node, addEventListener(type, fn) { this.handlers[type] = fn; } };
  vi.stubGlobal('document', document); vi.stubGlobal('window', { isSecureContext: true, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } });
  const scanner = createScanner({ t: (key) => key, media, decodeImage, decodeFrame });
  return { scanner, document, nodes, click: (id) => nodes.get(id).handlers.click() };
}

describe('Web QR reader', () => {
  it('decodes a generated QR without a native BarcodeDetector and excludes unsafe open actions', async () => {
    const { modules } = QRCode.create('https://example.com/synthetic');
    const width = (modules.size + 8) * 6; const data = new Uint8ClampedArray(width * width * 4).fill(255);
    for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
      const row = Math.floor(y / 6) - 4, col = Math.floor(x / 6) - 4;
      if (row >= 0 && col >= 0 && row < modules.size && col < modules.size && modules.get(row, col)) data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
    }
    const values = decodeImageData({ data, width, height: width });
    expect(values.map((value) => value.data)).toEqual(['https://example.com/synthetic']);
    expect(toSafeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(toSafeHttpUrl('data:text/html,<script>')).toBeNull();
  });
  it('blocks duplicate permission requests and releases late media after navigation', async () => {
    let resolve; const stop = vi.fn(); const getUserMedia = vi.fn(() => new Promise((done) => { resolve = done; }));
    const { scanner, click, nodes } = harness({ getUserMedia });
    const pending = click('scan-start'); await click('scan-start');
    expect(getUserMedia).toHaveBeenCalledTimes(1); expect(nodes.get('scan-status').textContent).toBe('scanPending');
    scanner.stop(); resolve({ getTracks: () => [{ stop }] }); await pending;
    expect(stop).toHaveBeenCalledTimes(1); expect(nodes.get('scan-video').hidden).toBe(true);
    expect(nodes.get('scan-start').disabled).toBe(false);
  });
  it('decodes a camera frame, releases tracks and allows a second read without duplicate results', async () => {
    const stop = vi.fn(); const ctx = harness({ getUserMedia: async () => ({ getTracks: () => [{ stop }] }) }, async () => [], () => [{ data: 'synthetic' }, { data: 'synthetic' }]);
    await ctx.click('scan-start'); expect(ctx.scanner.results()).toEqual(['synthetic']); expect(stop).toHaveBeenCalledTimes(1);
    await ctx.click('scan-start'); expect(ctx.scanner.results()).toEqual(['synthetic']); expect(stop).toHaveBeenCalledTimes(2); expect(ctx.nodes.get('scan-status').textContent).toBe('scanFound');
  });
  it('releases active media when the page becomes hidden or exits', async () => {
    const stop = vi.fn(); const ctx = harness({ getUserMedia: async () => ({ getTracks: () => [{ stop }] }) });
    await ctx.click('scan-start'); ctx.document.hidden = true; ctx.document.handlers.visibilitychange(); expect(stop).toHaveBeenCalledTimes(1);
    ctx.document.hidden = false; await ctx.click('scan-start'); window.handlers.pagehide(); expect(stop).toHaveBeenCalledTimes(2);
  });
  it('offers actionable denial and unavailable states', async () => {
    let ctx = harness({ getUserMedia: async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }); } });
    await ctx.click('scan-start'); expect(ctx.nodes.get('scan-status').textContent).toBe('scanDenied'); expect(ctx.nodes.get('scan-image').disabled).toBe(false);
    ctx = harness({}); await ctx.click('scan-start'); expect(ctx.nodes.get('scan-status').textContent).toBe('scanUnavailable');
  });
  it('suppresses duplicate image results, never opens automatically and ignores canceled decoding', async () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:synthetic', revokeObjectURL: vi.fn() });
    let resolve; const ctx = harness({}, () => new Promise((done) => { resolve = done; }));
    ctx.nodes.get('scan-image').files = [{ size: 10 }];
    const pending = ctx.nodes.get('scan-image').handlers.change(); ctx.scanner.stop(); resolve([{ data: 'secret' }]); await pending;
    expect(ctx.scanner.results()).toEqual([]);
    const ctx2 = harness({}, async () => [{ data: 'text' }, { data: 'text' }]); ctx2.nodes.get('scan-image').files = [{ size: 10 }];
    await ctx2.nodes.get('scan-image').handlers.change(); expect(ctx2.scanner.results()).toEqual(['text']);
    expect(ctx2.nodes.get('scan-results').children).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
