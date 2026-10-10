import QRCode from "qrcode/lib/browser.js";
import { currentWebUrlFromTab } from "./current-url.ts";
import { decodeImageSource, type DecodedQr } from "./qr-decoder.ts";
import { toSafeHttpUrl } from "./safe-url.ts";

type Theme = "system" | "light" | "dark";
type Language = "ja" | "en";
type Preferences = { theme: Theme; language: Language };
type CopyKey = keyof typeof COPY.ja;
type StatusTone = "" | "success" | "error";
type Substitutions = Record<string, string | number>;

const PREFERENCES_KEY = "popup_preferences";
const DEFAULT_PREFERENCES: Preferences = { theme: "system", language: systemLanguage() };
const QR_CANVAS_COLORS = { dark: "#071b41", light: "#ffffff" };

const COPY = {
  ja: {
    preferencesHeading: "表示設定", themeLabel: "外観", themeSystem: "システム", themeLight: "ライト", themeDark: "ダーク", languageLabel: "言語", languageJa: "日本語", languageEn: "English",
    currentUrlHeading: "このページのQRコード", currentUrlQrLabel: "このページのURLを表すQRコード", currentUrlActionsLabel: "QRコード画像を保存", qrTooLarge: "QRコードの容量を超えました。", qrUnavailable: "QRコードを作れませんでした。", currentUrlLoading: "現在のページURLをQRコードにしています…", copyUrl: "URLをコピー", downloadSvg: "SVGで保存", downloadPng: "PNGで保存",
    scanHeading: "QRコードを読み取る", scanIntro: "画面に表示中、または画像ファイル内のQRコードをこの端末内だけで解析します。", scanAgain: "もう一度スキャン", scanLoading: "ページをスキャンしています", selectImage: "画像を選択", scanInitial: "ページを開いたまま「このページをスキャン」を押してください。", resultsHeading: "読み取り結果", localOnly: "カメラ不使用・すべてローカル処理",
    currentUrlReady: "別の端末で読み取って、このページを開けます。", currentUrlUnsupported: "このページはQRコードにできません。通常のWebページで開いてください。", currentUrlError: "現在のページURLを取得できませんでした。ページを開いたまま、もう一度ポップアップを開いてください。", currentUrlTooLarge: "このURLはQRコードの容量を超えています。URLをコピーして共有してください。", currentUrlQrError: "QRコードを作れませんでした。URLをコピーして共有してください。", currentUrlCopied: "URLをコピーしました。", currentUrlCopyError: "コピーできませんでした。URLを選択してコピーしてください。", currentUrlSvgSaved: "SVGを保存しました。", currentUrlPngSaved: "高解像度PNGを保存しました。", currentUrlDownloadError: "画像を保存できませんでした。もう一度試してください。",
    scanPageBusy: "このページのQRコードを解析しています…", scanImageBusy: "選択した画像を解析しています…", scanEmpty: "QRコードが見つかりませんでした。表示範囲を確認するか、画像を選択してください。", scanResults: "{count}件のQRコードを読み取りました。データはこの端末から送信されません。", imageReadError: "画像を解析できませんでした。別の画像を試してください。", resultOpen: "開く", resultCopy: "コピー", resultCopied: "読み取り結果をコピーしました。", resultCopyError: "コピーできませんでした。結果を選択してコピーしてください。", protectedCapture: "このページはChromeの保護ページのため解析できません。通常のWebページで試してください。", captureError: "ページを読み取れませんでした。ページを開いたまま、もう一度試してください。"
  },
  en: {
    preferencesHeading: "Display", themeLabel: "Theme", themeSystem: "System", themeLight: "Light", themeDark: "Dark", languageLabel: "Language", languageJa: "日本語", languageEn: "English",
    currentUrlHeading: "QR code for this page", currentUrlQrLabel: "QR code containing this page URL", currentUrlActionsLabel: "Save QR code image", qrTooLarge: "This URL is too large for a QR code.", qrUnavailable: "Could not create the QR code.", currentUrlLoading: "Creating a QR code for this page…", copyUrl: "Copy URL", downloadSvg: "Save SVG", downloadPng: "Save PNG",
    scanHeading: "Read QR codes", scanIntro: "Analyze QR codes visible on this page or in an image, entirely on this device.", scanAgain: "Scan again", scanLoading: "Scanning this page", selectImage: "Choose image", scanInitial: "Keep this page open, then select Scan this page.", resultsHeading: "Scan results", localOnly: "No camera · processed entirely on this device",
    currentUrlReady: "Scan with another device to open this page.", currentUrlUnsupported: "This page cannot be made into a QR code. Open a regular web page instead.", currentUrlError: "Could not get this page URL. Keep the page open and open the popup again.", currentUrlTooLarge: "This URL is too large for a QR code. Copy it to share instead.", currentUrlQrError: "Could not create the QR code. Copy the URL to share instead.", currentUrlCopied: "URL copied.", currentUrlCopyError: "Could not copy. Select the URL and copy it manually.", currentUrlSvgSaved: "SVG saved.", currentUrlPngSaved: "High-resolution PNG saved.", currentUrlDownloadError: "Could not save the image. Try again.",
    scanPageBusy: "Scanning QR codes on this page…", scanImageBusy: "Scanning the selected image…", scanEmpty: "No QR code was found. Check the visible area or choose an image.", scanResults: "Read {count} QR code(s). No data leaves this device.", imageReadError: "Could not scan this image. Try another image.", resultOpen: "Open", resultCopy: "Copy", resultCopied: "Scan result copied.", resultCopyError: "Could not copy. Select the result and copy it manually.", protectedCapture: "Chrome protects this page, so it cannot be scanned. Try a regular web page.", captureError: "Could not scan this page. Keep it open and try again."
  }
};

const scanPageButton = document.querySelector<HTMLButtonElement>("#scan-page")!;
const scanButtonContent = document.querySelector<HTMLElement>(".button-content")!;
const scanLoading = document.querySelector<HTMLElement>("#scan-loading")!;
const fileInput = document.querySelector<HTMLInputElement>("#image-file")!;
const status = document.querySelector<HTMLElement>("#status")!;
const results = document.querySelector<HTMLElement>("#results")!;
const resultList = document.querySelector<HTMLOListElement>("#result-list")!;
const currentUrlQrFrame = document.querySelector<HTMLElement>("#current-url-qr-frame")!;
const currentUrlQr = document.querySelector<HTMLCanvasElement>("#current-url-qr")!;
const currentUrlLoading = document.querySelector<HTMLElement>("#current-url-loading")!;
const currentUrlUnavailable = document.querySelector<HTMLElement>("#current-url-unavailable")!;
const currentUrlValue = document.querySelector<HTMLElement>("#current-url-value")!;
const currentUrlStatus = document.querySelector<HTMLElement>("#current-url-status")!;
const copyCurrentUrlButton = document.querySelector<HTMLButtonElement>("#copy-current-url")!;
const downloadCurrentUrlSvgButton = document.querySelector<HTMLButtonElement>("#download-current-url-svg")!;
const downloadCurrentUrlPngButton = document.querySelector<HTMLButtonElement>("#download-current-url-png")!;
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const preferenceButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-preference]")];
const systemTheme = globalThis.matchMedia?.("(prefers-color-scheme: dark)") ?? null;

let preferences: Preferences = { ...DEFAULT_PREFERENCES };
let currentUrlStatusKey: CopyKey = "currentUrlLoading";
let currentUrlStatusTone: StatusTone = "";
let currentUrlUnavailableKey: CopyKey = "qrTooLarge";
let currentUrl: string | null = null;
let scanStatusKey: CopyKey = "scanInitial";
let scanStatusTone: StatusTone = "";
let scanStatusValues: Substitutions = {};
let decodedResults: DecodedQr[] | null = null;

scanPageButton.addEventListener("click", scanVisiblePage);
fileInput.addEventListener("change", scanSelectedImage);
copyCurrentUrlButton.addEventListener("click", copyCurrentUrl);
downloadCurrentUrlSvgButton.addEventListener("click", () => downloadCurrentUrlQr("svg"));
downloadCurrentUrlPngButton.addEventListener("click", () => downloadCurrentUrlQr("png"));
preferenceButtons.forEach((button) => button.addEventListener("click", () => updatePreference(button.dataset.preference!, button.dataset.value)));
systemTheme?.addEventListener?.("change", () => {
  if (preferences.theme === "system") applyPreferences();
});
void initializePopup();

async function initializePopup() {
  preferences = await loadPreferences();
  applyPreferences();
  initializeCurrentUrlQr();
  scanVisiblePage();
}

async function loadPreferences() {
  try {
    return normalizePreferences((await chrome.storage.local.get(PREFERENCES_KEY))[PREFERENCES_KEY]);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function normalizePreferences(value: unknown): Preferences {
  // 型の投影はoptional property access用。membership判定後だけTheme/Languageへ絞る。
  return {
    theme: ["system", "light", "dark"].includes((value as { theme?: unknown } | null | undefined)?.theme as string) ? (value as { theme: Theme }).theme : DEFAULT_PREFERENCES.theme,
    language: ["ja", "en"].includes((value as { language?: unknown } | null | undefined)?.language as string) ? (value as { language: Language }).language : DEFAULT_PREFERENCES.language
  };
}

function systemLanguage(): Language {
  const locales = globalThis.navigator?.languages?.length ? globalThis.navigator.languages : [globalThis.navigator?.language];
  for (const locale of locales) {
    const normalized = typeof locale === "string" ? locale.toLowerCase() : "";
    if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
    if (normalized === "en" || normalized.startsWith("en-")) return "en";
  }
  return "ja";
}

async function updatePreference(key: string, value: unknown) {
  preferences = normalizePreferences({ ...preferences, [key]: value });
  applyPreferences();
  try {
    await chrome.storage.local.set({ [PREFERENCES_KEY]: preferences });
  } catch {
    // The selected display remains active for this popup even if persistence is unavailable.
  }
}

function applyPreferences() {
  const root = document.documentElement;
  root.lang = preferences.language;
  root.dataset.theme = preferences.theme;
  root.style.colorScheme = preferences.theme === "system" ? "light dark" : preferences.theme;
  themeColorMeta?.setAttribute("content", resolvedTheme() === "dark" ? "#0d1628" : "#f7faff");
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n as CopyKey); });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel as CopyKey)); });
  preferenceButtons.forEach((button) => button.setAttribute("aria-pressed", String(preferences[button.dataset.preference as keyof Preferences] === button.dataset.value)));
  renderCurrentUrlStatus();
  renderCurrentUrlUnavailable();
  renderScanStatus();
  if (decodedResults) renderDecodedResults(decodedResults);
}

function resolvedTheme() {
  return preferences.theme === "system" ? (systemTheme?.matches ? "dark" : "light") : preferences.theme;
}

function t(key: CopyKey, values: Substitutions = {}) {
  return COPY[preferences.language][key].replaceAll(/\{(\w+)\}/gu, (_: string, name: string) => String(values[name] ?? ""));
}

async function initializeCurrentUrlQr() {
  setCurrentUrlState("loading");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentUrl = currentWebUrlFromTab(tab);
    if (!currentUrl) return setCurrentUrlState("unsupported");
    try {
      await QRCode.toCanvas(currentUrlQr, currentUrl, { errorCorrectionLevel: "M", margin: 2, width: 216, color: QR_CANVAS_COLORS });
    } catch (error) {
      showCurrentUrlQrUnavailable(currentUrl, error);
      return;
    }
    currentUrlValue.textContent = currentUrl;
    currentUrlValue.hidden = false;
    currentUrlQr.hidden = false;
    currentUrlLoading.hidden = true;
    currentUrlQrFrame.dataset.state = "ready";
    setCurrentUrlStatus("currentUrlReady", "success");
    copyCurrentUrlButton.disabled = false;
    setCurrentUrlExportEnabled(true);
  } catch {
    setCurrentUrlState("error");
  }
}

function showCurrentUrlQrUnavailable(currentUrl: string, error: unknown) {
  currentUrlQrFrame.dataset.state = "too-large";
  currentUrlQr.hidden = true;
  currentUrlLoading.hidden = true;
  currentUrlUnavailable.hidden = false;
  currentUrlValue.textContent = currentUrl;
  currentUrlValue.hidden = false;
  copyCurrentUrlButton.disabled = false;
  setCurrentUrlExportEnabled(false);
  currentUrlUnavailableKey = isQrCapacityError(error) ? "qrTooLarge" : "qrUnavailable";
  renderCurrentUrlUnavailable();
  setCurrentUrlStatus(currentUrlUnavailableKey === "qrTooLarge" ? "currentUrlTooLarge" : "currentUrlQrError", "error");
}

function isQrCapacityError(error: unknown) {
  return error instanceof Error && /too (?:big|large)|capacity|overflow/iu.test(error.message);
}

async function copyCurrentUrl() {
  const currentUrl = currentUrlValue.textContent;
  if (!currentUrl) return;
  copyCurrentUrlButton.disabled = true;
  try {
    await navigator.clipboard.writeText(currentUrl);
    setCurrentUrlStatus("currentUrlCopied", "success");
  } catch {
    setCurrentUrlStatus("currentUrlCopyError", "error");
  } finally {
    copyCurrentUrlButton.disabled = false;
  }
}

function setCurrentUrlExportEnabled(enabled: boolean) {
  downloadCurrentUrlSvgButton.disabled = !enabled;
  downloadCurrentUrlPngButton.disabled = !enabled;
}

async function downloadCurrentUrlQr(format: "svg" | "png") {
  if (!currentUrl) return;
  const button = format === "svg" ? downloadCurrentUrlSvgButton : downloadCurrentUrlPngButton;
  button.disabled = true;
  try {
    const blob = format === "svg" ? await createSvgQr(currentUrl) : await createPngQr(currentUrl);
    downloadBlob(blob, `qr-scan-current-url.${format}`);
    setCurrentUrlStatus(format === "svg" ? "currentUrlSvgSaved" : "currentUrlPngSaved", "success");
  } catch {
    setCurrentUrlStatus("currentUrlDownloadError", "error");
  } finally {
    if (currentUrlQrFrame.dataset.state === "ready") button.disabled = false;
  }
}

async function createSvgQr(value: string) {
  const svg = await QRCode.toString(value, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: QR_CANVAS_COLORS });
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

async function createPngQr(value: string) {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, value, { errorCorrectionLevel: "M", margin: 2, width: 2048, color: QR_CANVAS_COLORS });
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("png_encode_failed")), "image/png"));
  return blob;
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

function setCurrentUrlState(state: "loading" | "unsupported" | "error") {
  currentUrl = null;
  currentUrlQrFrame.dataset.state = state;
  currentUrlQr.hidden = true;
  currentUrlLoading.hidden = state !== "loading";
  currentUrlUnavailable.hidden = true;
  currentUrlValue.hidden = true;
  currentUrlValue.textContent = "";
  copyCurrentUrlButton.disabled = true;
  setCurrentUrlExportEnabled(false);
  setCurrentUrlStatus(state === "unsupported" ? "currentUrlUnsupported" : state === "error" ? "currentUrlError" : "currentUrlLoading", state === "error" ? "error" : "");
}

function setCurrentUrlStatus(key: CopyKey, tone: StatusTone = "") {
  currentUrlStatusKey = key;
  currentUrlStatusTone = tone;
  renderCurrentUrlStatus();
}

function renderCurrentUrlStatus() {
  currentUrlStatus.textContent = t(currentUrlStatusKey);
  currentUrlStatus.dataset.tone = currentUrlStatusTone;
}

function renderCurrentUrlUnavailable() {
  currentUrlUnavailable.textContent = t(currentUrlUnavailableKey);
}

async function scanVisiblePage() {
  setBusy(true, "scanPageBusy");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof tab?.windowId !== "number") throw new Error("active_tab_missing");
    showDecoded(await decodeImageSource(await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" })));
  } catch (error) {
    showError(captureErrorMessage(error));
  } finally {
    setBusy(false);
  }
}

async function scanSelectedImage(event: Event) {
  const [file] = (event.target as HTMLInputElement).files!;
  if (!file) return;
  setBusy(true, "scanImageBusy");
  try {
    showDecoded(await decodeImageSource(await readFile(file)));
  } catch {
    showError("imageReadError");
  } finally {
    (event.target as HTMLInputElement).value = "";
    setBusy(false);
  }
}

function setBusy(isBusy: boolean, messageKey: CopyKey | "" = "") {
  scanPageButton.disabled = isBusy;
  scanPageButton.setAttribute("aria-busy", String(isBusy));
  fileInput.disabled = isBusy;
  scanButtonContent.hidden = isBusy;
  scanLoading.hidden = !isBusy;
  if (messageKey) setStatus(messageKey);
}

function showDecoded(decoded: DecodedQr[]) {
  decodedResults = decoded;
  if (decoded.length === 0) {
    results.hidden = true;
    setStatus("scanEmpty", "error");
    return;
  }
  renderDecodedResults(decoded);
  results.hidden = false;
  setStatus("scanResults", "success", { count: decoded.length });
}

function renderDecodedResults(decoded: DecodedQr[]) {
  resultList.replaceChildren(...decoded.map(createResultItem));
}

function createResultItem(result: DecodedQr) {
  const item = document.createElement("li");
  item.className = "result-item";
  const value = document.createElement("code");
  value.className = "result-value";
  value.textContent = result.data;
  const actions = document.createElement("div");
  actions.className = "result-actions";
  const openUrl = toSafeHttpUrl(result.data);
  if (openUrl) {
    const open = document.createElement("button");
    open.className = "result-action";
    open.type = "button";
    open.textContent = t("resultOpen");
    open.addEventListener("click", () => chrome.tabs.create({ url: openUrl.toString() }));
    actions.append(open);
  }
  const copy = document.createElement("button");
  copy.className = "result-action";
  copy.type = "button";
  copy.textContent = t("resultCopy");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(result.data);
      setStatus("resultCopied", "success");
    } catch {
      setStatus("resultCopyError", "error");
    }
  });
  actions.append(copy);
  item.append(value, actions);
  return item;
}

function readFile(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("image_read_failed"));
    reader.readAsDataURL(file);
  });
}

function setStatus(key: CopyKey, tone: StatusTone = "", values: Substitutions = {}) {
  scanStatusKey = key;
  scanStatusTone = tone;
  scanStatusValues = values;
  renderScanStatus();
}

function renderScanStatus() {
  status.textContent = t(scanStatusKey, scanStatusValues);
  status.dataset.tone = scanStatusTone;
}

function showError(key: CopyKey) {
  decodedResults = null;
  results.hidden = true;
  setStatus(key, "error");
}

function captureErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message.includes("Cannot access") ? "protectedCapture" : "captureError";
}
