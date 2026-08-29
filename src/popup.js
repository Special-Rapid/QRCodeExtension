import { decodeImageSource } from "./qr-decoder.js";
import { extractHttpUrls, mergeDecodedValues } from "./url-text.js";

const scanPageButton = document.querySelector("#scan-page");
const scanButtonContent = document.querySelector(".button-content");
const scanLoading = document.querySelector("#scan-loading");
const fileInput = document.querySelector("#image-file");
const status = document.querySelector("#status");
const results = document.querySelector("#results");
const resultList = document.querySelector("#result-list");

scanPageButton.addEventListener("click", scanVisiblePage);
fileInput.addEventListener("change", scanSelectedImage);
scanVisiblePage();

async function scanVisiblePage() {
  setBusy(true, "このページのQRコードとURL文字列を解析しています…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("active_tab_missing");
    const [screenshot, pageText] = await Promise.all([
      chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }),
      readPageText(tab.id).catch(() => "")
    ]);
    const qrResults = await decodeImageSource(screenshot);
    const textResults = extractHttpUrls(pageText).map((data) => ({ data }));
    showDecoded(mergeDecodedValues(qrResults, textResults));
  } catch (error) {
    showError(captureErrorMessage(error));
  } finally {
    setBusy(false);
  }
}

async function scanSelectedImage(event) {
  const [file] = event.target.files;
  if (!file) return;

  setBusy(true, "選択した画像を解析しています…");
  try {
    const source = await readFile(file);
    showDecoded(await decodeImageSource(source));
  } catch (error) {
    showError(error instanceof Error ? error.message : "画像を解析できませんでした。別の画像を試してください。");
  } finally {
    event.target.value = "";
    setBusy(false);
  }
}

function setBusy(isBusy, message = "") {
  scanPageButton.disabled = isBusy;
  scanPageButton.setAttribute("aria-busy", String(isBusy));
  fileInput.disabled = isBusy;
  scanButtonContent.hidden = isBusy;
  scanLoading.hidden = !isBusy;
  if (message) setStatus(message);
}

function showDecoded(decoded) {
  if (decoded.length === 0) {
    results.hidden = true;
    setStatus("QRコードまたはURL文字列が見つかりませんでした。ページ内の文字列を確認するか、画像を選択してください。", "error");
    return;
  }

  resultList.replaceChildren(...decoded.map(createResultItem));
  results.hidden = false;
  setStatus(`${decoded.length}件のQRコード・URL文字列を読み取りました。データはこの端末から送信されません。`, "success");
}

function createResultItem(result) {
  const item = document.createElement("li");
  item.className = "result-item";
  const value = document.createElement("code");
  value.className = "result-value";
  value.textContent = result.data;
  const actions = document.createElement("div");
  actions.className = "result-actions";

  if (isHttpUrl(result.data)) {
    const open = document.createElement("button");
    open.className = "result-action";
    open.type = "button";
    open.textContent = "開く";
    open.addEventListener("click", () => chrome.tabs.create({ url: result.data }));
    actions.append(open);
  }

  const copy = document.createElement("button");
  copy.className = "result-action";
  copy.type = "button";
  copy.textContent = "コピー";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(result.data);
      setStatus("読み取り結果をコピーしました。", "success");
    } catch {
      setStatus("コピーできませんでした。結果を選択してコピーしてください。", "error");
    }
  });
  actions.append(copy);
  item.append(value, actions);
  return item;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function readPageText(tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => `${globalThis.getSelection?.()?.toString() ?? ""}\n${document.body?.innerText ?? ""}`.slice(0, 200_000)
  });
  return typeof injection?.result === "string" ? injection.result : "";
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("画像ファイルを読み込めませんでした。"));
    reader.readAsDataURL(file);
  });
}

function setStatus(message, tone = "") {
  status.textContent = message;
  status.dataset.tone = tone;
}

function showError(message) {
  results.hidden = true;
  setStatus(message, "error");
}

function captureErrorMessage(error) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Cannot access")) return "このページはChromeの保護ページのため解析できません。通常のWebページで試してください。";
  return "ページを読み取れませんでした。ページを開いたまま、もう一度試してください。";
}
