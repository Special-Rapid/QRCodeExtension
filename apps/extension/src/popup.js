import QRCode from "qrcode/lib/browser.js";
import { currentWebUrlFromTab } from "./current-url.js";
import { decodeImageSource } from "./qr-decoder.js";
import { toSafeHttpUrl } from "./safe-url.js";

const PREFERENCES_KEY = "popup_preferences";
const DEFAULT_PREFERENCES = { theme: "system", language: systemLanguage() };
const QR_CANVAS_COLORS = { dark: "#071b41", light: "#ffffff" };

const COPY = {
  ja: {
    preferencesHeading: "表示設定", themeLabel: "外観", themeSystem: "システム", themeLight: "ライト", themeDark: "ダーク", languageLabel: "言語", languageJa: "日本語", languageEn: "English",
    currentUrlHeading: "このページのQRコード", currentUrlQrLabel: "このページのURLを表すQRコード", qrTooLarge: "QRコードの容量を超えました。", qrUnavailable: "QRコードを作れませんでした。", currentUrlLoading: "現在のページURLをQRコードにしています…", copyUrl: "URLをコピー",
    scanHeading: "QRコードを読み取る", scanIntro: "画面に表示中、または画像ファイル内のQRコードをこの端末内だけで解析します。", scanAgain: "もう一度スキャン", scanLoading: "ページをスキャンしています", selectImage: "画像を選択", scanInitial: "ページを開いたまま「このページをスキャン」を押してください。", resultsHeading: "読み取り結果", localOnly: "カメラ不使用・すべてローカル処理",
    currentUrlReady: "別の端末で読み取って、このページを開けます。", currentUrlUnsupported: "このページはQRコードにできません。通常のWebページで開いてください。", currentUrlError: "現在のページURLを取得できませんでした。ページを開いたまま、もう一度ポップアップを開いてください。", currentUrlTooLarge: "このURLはQRコードの容量を超えています。URLをコピーして共有してください。", currentUrlQrError: "QRコードを作れませんでした。URLをコピーして共有してください。", currentUrlCopied: "URLをコピーしました。", currentUrlCopyError: "コピーできませんでした。URLを選択してコピーしてください。",
    scanPageBusy: "このページのQRコードを解析しています…", scanImageBusy: "選択した画像を解析しています…", scanEmpty: "QRコードが見つかりませんでした。表示範囲を確認するか、画像を選択してください。", scanResults: "{count}件のQRコードを読み取りました。データはこの端末から送信されません。", imageReadError: "画像を解析できませんでした。別の画像を試してください。", resultOpen: "開く", resultCopy: "コピー", resultCopied: "読み取り結果をコピーしました。", resultCopyError: "コピーできませんでした。結果を選択してコピーしてください。", protectedCapture: "このページはChromeの保護ページのため解析できません。通常のWebページで試してください。", captureError: "ページを読み取れませんでした。ページを開いたまま、もう一度試してください。"
  },
  en: {
    preferencesHeading: "Display", themeLabel: "Theme", themeSystem: "System", themeLight: "Light", themeDark: "Dark", languageLabel: "Language", languageJa: "日本語", languageEn: "English",
    currentUrlHeading: "QR code for this page", currentUrlQrLabel: "QR code containing this page URL", qrTooLarge: "This URL is too large for a QR code.", qrUnavailable: "Could not create the QR code.", currentUrlLoading: "Creating a QR code for this page…", copyUrl: "Copy URL",
    scanHeading: "Read QR codes", scanIntro: "Analyze QR codes visible on this page or in an image, entirely on this device.", scanAgain: "Scan again", scanLoading: "Scanning this page", selectImage: "Choose image", scanInitial: "Keep this page open, then select Scan this page.", resultsHeading: "Scan results", localOnly: "No camera · processed entirely on this device",
    currentUrlReady: "Scan with another device to open this page.", currentUrlUnsupported: "This page cannot be made into a QR code. Open a regular web page instead.", currentUrlError: "Could not get this page URL. Keep the page open and open the popup again.", currentUrlTooLarge: "This URL is too large for a QR code. Copy it to share instead.", currentUrlQrError: "Could not create the QR code. Copy the URL to share instead.", currentUrlCopied: "URL copied.", currentUrlCopyError: "Could not copy. Select the URL and copy it manually.",
    scanPageBusy: "Scanning QR codes on this page…", scanImageBusy: "Scanning the selected image…", scanEmpty: "No QR code was found. Check the visible area or choose an image.", scanResults: "Read {count} QR code(s). No data leaves this device.", imageReadError: "Could not scan this image. Try another image.", resultOpen: "Open", resultCopy: "Copy", resultCopied: "Scan result copied.", resultCopyError: "Could not copy. Select the result and copy it manually.", protectedCapture: "Chrome protects this page, so it cannot be scanned. Try a regular web page.", captureError: "Could not scan this page. Keep it open and try again."
  }
};

const scanPageButton = document.querySelector("#scan-page");
const scanButtonContent = document.querySelector(".button-content");
const scanLoading = document.querySelector("#scan-loading");
const fileInput = document.querySelector("#image-file");
const status = document.querySelector("#status");
const results = document.querySelector("#results");
const resultList = document.querySelector("#result-list");
const currentUrlQrFrame = document.querySelector("#current-url-qr-frame");
const currentUrlQr = document.querySelector("#current-url-qr");
const currentUrlLoading = document.querySelector("#current-url-loading");
const currentUrlUnavailable = document.querySelector("#current-url-unavailable");
const currentUrlValue = document.querySelector("#current-url-value");
const currentUrlStatus = document.querySelector("#current-url-status");
const copyCurrentUrlButton = document.querySelector("#copy-current-url");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const preferenceButtons = [...document.querySelectorAll("[data-preference]")];
const systemTheme = globalThis.matchMedia?.("(prefers-color-scheme: dark)") ?? null;

let preferences = { ...DEFAULT_PREFERENCES };
let currentUrlStatusKey = "currentUrlLoading";
let currentUrlStatusTone = "";
let currentUrlUnavailableKey = "qrTooLarge";
let scanStatusKey = "scanInitial";
let scanStatusTone = "";
let scanStatusValues = {};
let decodedResults = null;

scanPageButton.addEventListener("click", scanVisiblePage);
fileInput.addEventListener("change", scanSelectedImage);
copyCurrentUrlButton.addEventListener("click", copyCurrentUrl);
preferenceButtons.forEach((button) => button.addEventListener("click", () => updatePreference(button.dataset.preference, button.dataset.value)));
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

function normalizePreferences(value) {
  return {
    theme: ["system", "light", "dark"].includes(value?.theme) ? value.theme : DEFAULT_PREFERENCES.theme,
    language: ["ja", "en"].includes(value?.language) ? value.language : DEFAULT_PREFERENCES.language
  };
}

function systemLanguage() {
  const locales = globalThis.navigator?.languages?.length ? globalThis.navigator.languages : [globalThis.navigator?.language];
  for (const locale of locales) {
    const normalized = typeof locale === "string" ? locale.toLowerCase() : "";
    if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
    if (normalized === "en" || normalized.startsWith("en-")) return "en";
  }
  return "ja";
}

async function updatePreference(key, value) {
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
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel)); });
  preferenceButtons.forEach((button) => button.setAttribute("aria-pressed", String(preferences[button.dataset.preference] === button.dataset.value)));
  renderCurrentUrlStatus();
  renderCurrentUrlUnavailable();
  renderScanStatus();
  if (decodedResults) renderDecodedResults(decodedResults);
}

function resolvedTheme() {
  return preferences.theme === "system" ? (systemTheme?.matches ? "dark" : "light") : preferences.theme;
}

function t(key, values = {}) {
  return COPY[preferences.language][key].replaceAll(/\{(\w+)\}/gu, (_, name) => String(values[name] ?? ""));
}

async function initializeCurrentUrlQr() {
  setCurrentUrlState("loading");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = currentWebUrlFromTab(tab);
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
  } catch {
    setCurrentUrlState("error");
  }
}

function showCurrentUrlQrUnavailable(currentUrl, error) {
  currentUrlQrFrame.dataset.state = "too-large";
  currentUrlQr.hidden = true;
  currentUrlLoading.hidden = true;
  currentUrlUnavailable.hidden = false;
  currentUrlValue.textContent = currentUrl;
  currentUrlValue.hidden = false;
  copyCurrentUrlButton.disabled = false;
  currentUrlUnavailableKey = isQrCapacityError(error) ? "qrTooLarge" : "qrUnavailable";
  renderCurrentUrlUnavailable();
  setCurrentUrlStatus(currentUrlUnavailableKey === "qrTooLarge" ? "currentUrlTooLarge" : "currentUrlQrError", "error");
}

function isQrCapacityError(error) {
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

function setCurrentUrlState(state) {
  currentUrlQrFrame.dataset.state = state;
  currentUrlQr.hidden = true;
  currentUrlLoading.hidden = state !== "loading";
  currentUrlUnavailable.hidden = true;
  currentUrlValue.hidden = true;
  currentUrlValue.textContent = "";
  copyCurrentUrlButton.disabled = true;
  setCurrentUrlStatus(state === "unsupported" ? "currentUrlUnsupported" : state === "error" ? "currentUrlError" : "currentUrlLoading", state === "error" ? "error" : "");
}

function setCurrentUrlStatus(key, tone = "") {
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

async function scanSelectedImage(event) {
  const [file] = event.target.files;
  if (!file) return;
  setBusy(true, "scanImageBusy");
  try {
    showDecoded(await decodeImageSource(await readFile(file)));
  } catch {
    showError("imageReadError");
  } finally {
    event.target.value = "";
    setBusy(false);
  }
}

function setBusy(isBusy, messageKey = "") {
  scanPageButton.disabled = isBusy;
  scanPageButton.setAttribute("aria-busy", String(isBusy));
  fileInput.disabled = isBusy;
  scanButtonContent.hidden = isBusy;
  scanLoading.hidden = !isBusy;
  if (messageKey) setStatus(messageKey);
}

function showDecoded(decoded) {
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

function renderDecodedResults(decoded) {
  resultList.replaceChildren(...decoded.map(createResultItem));
}

function createResultItem(result) {
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

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("image_read_failed"));
    reader.readAsDataURL(file);
  });
}

function setStatus(key, tone = "", values = {}) {
  scanStatusKey = key;
  scanStatusTone = tone;
  scanStatusValues = values;
  renderScanStatus();
}

function renderScanStatus() {
  status.textContent = t(scanStatusKey, scanStatusValues);
  status.dataset.tone = scanStatusTone;
}

function showError(key) {
  decodedResults = null;
  results.hidden = true;
  setStatus(key, "error");
}

function captureErrorMessage(error) {
  const message = error instanceof Error ? error.message : "";
  return message.includes("Cannot access") ? "protectedCapture" : "captureError";
}
