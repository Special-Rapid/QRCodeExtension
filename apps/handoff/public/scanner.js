import { decodeImageData, decodeImageSource, toSafeHttpUrl } from './scan-decoder.js';

// A generation cancels permission, image and frame work after stop/navigation.
export function createScanner({ t, media = navigator.mediaDevices, decodeFrame = decodeImageData, decodeImage = decodeImageSource } = {}) {
  const get = (id) => document.getElementById(id);
  const video = get('scan-video');
  let stream = null, generation = 0, timer = null, phase = '', busy = false;
  let results = [];
  function status(key) { phase = key; get('scan-status').textContent = t(key); }
  function stop(announce = true) {
    generation++; clearTimeout(timer); timer = null;
    stream?.getTracks().forEach((track) => track.stop()); stream = null;
    video.srcObject = null; video.hidden = true; busy = false;
    get('scan-start').disabled = false; get('scan-stop').hidden = true;
    get('scan-image').disabled = false;
    if (announce && phase) status('scanStopped');
  }
  function renderResults() {
    get('scan-results').replaceChildren();
    for (const data of results) {
      const item = document.createElement('li'); item.className = 'event';
      const main = document.createElement('div'); main.className = 'event-main';
      const value = document.createElement('code'); value.className = 'event-value'; value.textContent = data;
      const actions = document.createElement('div'); actions.className = 'event-actions';
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'quiet-button'; copy.textContent = t('copy'); copy.dataset.i18n = 'copy';
      copy.addEventListener('click', async () => {
        if (copy.disabled) return; copy.disabled = true; copy.dataset.i18n = 'scanCopyPending'; copy.textContent = t('scanCopyPending'); status('scanCopyPending');
        try { await navigator.clipboard.writeText(data); copy.dataset.i18n = 'copied'; copy.textContent = t('copied'); status('copied'); } catch { copy.dataset.i18n = 'copy'; copy.textContent = t('copy'); status('scanCopyFailed'); }
        finally { copy.disabled = false; }
      });
      actions.append(copy);
      const url = toSafeHttpUrl(data);
      if (url) {
        const host = document.createElement('strong'); host.textContent = url.host; main.append(host);
        const open = document.createElement('button'); open.type = 'button'; open.className = 'primary-button'; open.textContent = t('open'); open.dataset.i18n = 'open';
        open.addEventListener('click', () => window.open(url.href, '_blank', 'noopener,noreferrer')); actions.append(open);
      }
      main.append(value); item.append(main, actions); get('scan-results').append(item);
    }
  }
  function found(values) {
    results = [...new Set(values.map((value) => value.data).filter((data) => typeof data === 'string' && data.length && data.length <= 4096))];
    renderResults(); status(results.length ? 'scanFound' : 'scanEmpty');
  }
  async function start() {
    if (busy) return;
    stop(false); const current = generation; busy = true;
    get('scan-start').disabled = true; get('scan-stop').hidden = false; get('scan-image').disabled = true;
    status('scanPending');
    try {
      if (!media?.getUserMedia || !window.isSecureContext) throw new Error('unavailable');
      const acquired = await media.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (current !== generation) { acquired.getTracks().forEach((track) => track.stop()); return; }
      stream = acquired; video.srcObject = stream; video.hidden = false; await video.play();
      if (current !== generation) return;
      status('scanReading');
      const canvas = document.createElement('canvas'); const context = canvas.getContext('2d', { willReadFrequently: true });
      function frame() {
        if (current !== generation) return;
        try {
          if (video.readyState >= 2 && video.videoWidth) {
            const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const values = decodeFrame(context.getImageData(0, 0, canvas.width, canvas.height));
            if (values.length) { stop(false); found(values); return; }
          }
          timer = setTimeout(frame, 250);
        } catch { stop(false); status('scanFailure'); }
      }
      frame();
    } catch (error) {
      if (current !== generation) return;
      stop(false); status(['NotAllowedError', 'SecurityError'].includes(error.name) ? 'scanDenied' : 'scanUnavailable');
    }
  }
  async function image() {
    const file = get('scan-image').files?.[0]; if (!file) return;
    stop(false); const current = generation;
    if (file.size > 20 * 1024 * 1024) { status('scanImageSize'); return; }
    busy = true; get('scan-image').disabled = true; get('scan-start').disabled = true; get('scan-stop').hidden = false;
    status('scanImagePending'); const source = URL.createObjectURL(file);
    try { const values = await decodeImage(source); if (current === generation) { stop(false); found(values); } }
    catch { if (current === generation) { stop(false); status('scanFailure'); } }
    finally { URL.revokeObjectURL(source); get('scan-image').value = ''; }
  }
  get('scan-start').addEventListener('click', start);
  get('scan-stop').addEventListener('click', () => stop());
  get('scan-image').addEventListener('change', image);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', () => stop());
  return { stop, refresh() { if (phase) status(phase); }, results: () => [...results] };
}
