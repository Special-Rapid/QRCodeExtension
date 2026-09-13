import assert from "node:assert/strict";
import test from "node:test";

function createNode() {
  return {
    attributes: new Map(),
    listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    async trigger(type, event = { target: this }) { return this.listeners.get(type)?.(event); },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    dataset: {},
    disabled: false,
    hidden: false,
    textContent: "",
    value: ""
  };
}

function createCanvasNode() {
  return {
    ...createNode(),
    width: 216,
    height: 216,
    getContext: () => ({
      clearRect() {},
      fillRect() {},
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData() {}
    })
  };
}

function createEnvironment({ captureVisibleTab, activeTab = { id: 71, windowId: 17 }, queryActiveTab = async () => [activeTab], preferences = {}, systemDark = false, systemLanguage = "ja-JP", storageGet = async () => ({ popup_preferences: preferences }) }) {
  const scanPageButton = createNode();
  const scanButtonContent = createNode();
  const scanLoading = createNode();
  const fileInput = createNode();
  const status = createNode();
  const results = createNode();
  const resultList = { ...createNode(), replaceChildren() {} };
  const currentUrlQrFrame = createNode();
  const currentUrlQr = createCanvasNode();
  const currentUrlLoading = createNode();
  const currentUrlUnavailable = createNode();
  const currentUrlValue = createNode();
  const currentUrlStatus = createNode();
  const copyCurrentUrlButton = createNode();
  const themeSystem = { ...createNode(), dataset: { preference: "theme", value: "system" } };
  const themeLight = { ...createNode(), dataset: { preference: "theme", value: "light" } };
  const themeDark = { ...createNode(), dataset: { preference: "theme", value: "dark" } };
  const languageJa = { ...createNode(), dataset: { preference: "language", value: "ja" } };
  const languageEn = { ...createNode(), dataset: { preference: "language", value: "en" } };
  const preferenceButtons = [themeSystem, themeLight, themeDark, languageJa, languageEn];
  const themeColorMeta = createNode();
  const elements = new Map([
    ["#scan-page", scanPageButton],
    [".button-content", scanButtonContent],
    ["#scan-loading", scanLoading],
    ["#image-file", fileInput],
    ["#status", status],
    ["#results", results],
    ["#result-list", resultList],
    ["#current-url-qr-frame", currentUrlQrFrame],
    ["#current-url-qr", currentUrlQr],
    ["#current-url-loading", currentUrlLoading],
    ["#current-url-unavailable", currentUrlUnavailable],
    ["#current-url-value", currentUrlValue],
    ["#current-url-status", currentUrlStatus],
    ["#copy-current-url", copyCurrentUrlButton]
  ]);

  return {
    elements: {
      scanPageButton,
      scanButtonContent,
      scanLoading,
      fileInput,
      status,
      results,
      currentUrlQrFrame,
      currentUrlQr,
      currentUrlLoading,
      currentUrlUnavailable,
      currentUrlValue,
      currentUrlStatus,
      copyCurrentUrlButton,
      themeSystem,
      themeLight,
      themeDark,
      languageJa,
      languageEn
    },
    chrome: {
      tabs: {
        query: queryActiveTab,
        captureVisibleTab
      },
      storage: { local: { get: storageGet, async set(next) { Object.assign(preferences, next.popup_preferences); } } }
    },
    document: {
      documentElement: { lang: "ja", dataset: {}, style: {} },
      querySelector: (selector) => selector === 'meta[name="theme-color"]' ? themeColorMeta : elements.get(selector),
      querySelectorAll: (selector) => selector === "[data-preference]" ? preferenceButtons : [],
      createElement: (tag) => {
        if (tag !== "canvas") return createNode();
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage() {},
            getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })
          })
        };
      }
    },
    navigator: { language: systemLanguage, languages: [systemLanguage], clipboard: { async writeText() {} } },
    matchMedia: () => ({ matches: systemDark, addEventListener() {} })
  };
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out while waiting for popup state");
}

async function importPopup(environment, suffix) {
  const previous = { chrome: globalThis.chrome, document: globalThis.document, Image: globalThis.Image, matchMedia: globalThis.matchMedia, navigatorDescriptor: Object.getOwnPropertyDescriptor(globalThis, "navigator") };
  globalThis.chrome = environment.chrome;
  globalThis.document = environment.document;
  globalThis.matchMedia = environment.matchMedia;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: environment.navigator });
  globalThis.Image = class {
    naturalWidth = 1;
    naturalHeight = 1;

    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onload());
    }
  };

  try {
    await import(new URL(`../src/popup.js?popup-test=${suffix}`, import.meta.url));
    return previous;
  } catch (error) {
    Object.assign(globalThis, previous);
    throw error;
  }
}

function restoreEnvironment(previous) {
  Object.assign(globalThis, { chrome: previous.chrome, document: previous.document, Image: previous.Image, matchMedia: previous.matchMedia });
  if (previous.navigatorDescriptor) Object.defineProperty(globalThis, "navigator", previous.navigatorDescriptor);
  else delete globalThis.navigator;
}

async function withClipboard(writeText, action) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText } }
  });
  try {
    await action();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else delete globalThis.navigator;
  }
}

test("automatically captures the active tab and replaces the loader when decoding completes", async () => {
  let capturedWindowId;
  let finishCapture;
  const environment = createEnvironment({
    captureVisibleTab: async (windowId) => {
      capturedWindowId = windowId;
      return new Promise((resolve) => { finishCapture = resolve; });
    }
  });
  const previous = await importPopup(environment, "success");

  try {
    assert.equal(environment.elements.scanPageButton.disabled, true);
    assert.equal(environment.elements.scanButtonContent.hidden, true);
    assert.equal(environment.elements.scanLoading.hidden, false);
    finishCapture("data:image/png;base64,AA==");
    await waitFor(() => environment.elements.scanPageButton.disabled === false);
    assert.equal(capturedWindowId, 17);
    assert.equal(environment.elements.scanButtonContent.hidden, false);
    assert.equal(environment.elements.scanLoading.hidden, true);
    assert.match(environment.elements.status.textContent, /QRコードが見つかりませんでした/);
  } finally {
    restoreEnvironment(previous);
  }
});

test("reports a protected-page capture failure after automatic scanning", async () => {
  const environment = createEnvironment({
    captureVisibleTab: async () => {
      throw new Error("Cannot access contents of url");
    }
  });
  const previous = await importPopup(environment, "protected-page");

  try {
    await waitFor(() => environment.elements.scanPageButton.disabled === false);
    assert.equal(environment.elements.scanLoading.hidden, true);
    assert.match(environment.elements.status.textContent, /Chromeの保護ページ/);
  } finally {
    restoreEnvironment(previous);
  }
});

test("renders the current normal Web URL as a QR code without changing page scanning", async () => {
  const environment = createEnvironment({
    activeTab: { id: 71, windowId: 17, url: "https://example.com/current-page" },
    captureVisibleTab: async () => "data:image/png;base64,AA=="
  });
  const previous = await importPopup(environment, "current-url-ready");

  try {
    await waitFor(() => environment.elements.currentUrlQr.hidden === false);
    assert.equal(environment.elements.currentUrlValue.textContent, "https://example.com/current-page");
    assert.equal(environment.elements.copyCurrentUrlButton.disabled, false);
    assert.equal(environment.elements.currentUrlQrFrame.dataset.state, "ready");
    assert.match(environment.elements.currentUrlStatus.textContent, /別の端末/);
  } finally {
    restoreEnvironment(previous);
  }
});

test("makes browser-internal pages unavailable for current URL QR generation", async () => {
  const environment = createEnvironment({
    activeTab: { id: 71, windowId: 17, url: "chrome://extensions" },
    captureVisibleTab: async () => "data:image/png;base64,AA=="
  });
  const previous = await importPopup(environment, "current-url-unsupported");

  try {
    await waitFor(() => environment.elements.currentUrlQrFrame.dataset.state === "unsupported");
    assert.equal(environment.elements.currentUrlQr.hidden, true);
    assert.equal(environment.elements.copyCurrentUrlButton.disabled, true);
    assert.match(environment.elements.currentUrlStatus.textContent, /通常のWebページ/);
  } finally {
    restoreEnvironment(previous);
  }
});

test("explains how to recover when the current tab cannot be read", async () => {
  const environment = createEnvironment({
    captureVisibleTab: async () => "data:image/png;base64,AA==",
    queryActiveTab: async () => { throw new Error("tab_query_failed"); }
  });
  const previous = await importPopup(environment, "current-url-error");

  try {
    await waitFor(() => environment.elements.currentUrlQrFrame.dataset.state === "error");
    assert.equal(environment.elements.currentUrlQr.hidden, true);
    assert.equal(environment.elements.copyCurrentUrlButton.disabled, true);
    assert.match(environment.elements.currentUrlStatus.textContent, /もう一度ポップアップを開いて/);
  } finally {
    restoreEnvironment(previous);
  }
});

test("keeps an oversized Web URL available to copy when it cannot fit in a QR code", async () => {
  const oversizedUrl = `https://example.com/?q=${"x".repeat(2500)}`;
  const environment = createEnvironment({
    activeTab: { id: 71, windowId: 17, url: oversizedUrl },
    captureVisibleTab: async () => "data:image/png;base64,AA=="
  });
  const previous = await importPopup(environment, "current-url-too-large");

  try {
    await waitFor(() => environment.elements.currentUrlQrFrame.dataset.state === "too-large");
    assert.equal(environment.elements.currentUrlQr.hidden, true);
    assert.equal(environment.elements.currentUrlUnavailable.hidden, false);
    assert.equal(environment.elements.currentUrlValue.textContent, oversizedUrl);
    assert.equal(environment.elements.copyCurrentUrlButton.disabled, false);
    assert.match(environment.elements.currentUrlStatus.textContent, /容量を超え/);
  } finally {
    restoreEnvironment(previous);
  }
});

test("copies the generated current URL and preserves it when copying fails", async () => {
  const environment = createEnvironment({
    activeTab: { id: 71, windowId: 17, url: "https://example.com/current-page" },
    captureVisibleTab: async () => "data:image/png;base64,AA=="
  });
  const previous = await importPopup(environment, "current-url-copy");

  try {
    await waitFor(() => environment.elements.currentUrlQr.hidden === false);
    let copiedValue = "";
    await withClipboard(async (value) => { copiedValue = value; }, async () => {
      await environment.elements.copyCurrentUrlButton.trigger("click");
    });
    assert.equal(copiedValue, "https://example.com/current-page");
    assert.match(environment.elements.currentUrlStatus.textContent, /コピーしました/);

    await withClipboard(async () => { throw new Error("clipboard_denied"); }, async () => {
      await environment.elements.copyCurrentUrlButton.trigger("click");
    });
    assert.equal(environment.elements.currentUrlValue.textContent, "https://example.com/current-page");
    assert.match(environment.elements.currentUrlStatus.textContent, /選択してコピー/);
  } finally {
    restoreEnvironment(previous);
  }
});

test("loads, applies, and persists the popup theme and language preferences", async () => {
  const preferences = { theme: "dark", language: "en" };
  const environment = createEnvironment({
    preferences,
    activeTab: { id: 71, windowId: 17, url: "https://example.com/current-page" },
    captureVisibleTab: async () => "data:image/png;base64,AA=="
  });
  const previous = await importPopup(environment, "popup-preferences");

  try {
    await waitFor(() => environment.document.documentElement.lang === "en");
    assert.equal(environment.document.documentElement.dataset.theme, "dark");
    assert.equal(environment.elements.themeDark.attributes.get("aria-pressed"), "true");
    await environment.elements.languageJa.trigger("click");
    assert.equal(environment.document.documentElement.lang, "ja");
    assert.deepEqual(preferences, { theme: "dark", language: "ja" });
    await environment.elements.themeSystem.trigger("click");
    assert.equal(environment.document.documentElement.dataset.theme, "system");
    assert.equal(environment.elements.themeSystem.attributes.get("aria-pressed"), "true");
  } finally {
    restoreEnvironment(previous);
  }
});

test("continues with system Japanese preferences when local storage cannot be read", async () => {
  const environment = createEnvironment({
    storageGet: async () => { throw new Error("storage_unavailable"); },
    activeTab: { id: 71, windowId: 17, url: "https://example.com/current-page" },
    captureVisibleTab: async () => "data:image/png;base64,AA=="
  });
  const previous = await importPopup(environment, "popup-preferences-storage-error");

  try {
    await waitFor(() => environment.elements.currentUrlQr.hidden === false);
    assert.equal(environment.document.documentElement.lang, "ja");
    assert.equal(environment.document.documentElement.dataset.theme, "system");
  } finally {
    restoreEnvironment(previous);
  }
});

test("uses the supported OS language when no saved language preference exists", async () => {
  const environment = createEnvironment({
    systemLanguage: "en-US",
    preferences: {},
    activeTab: { id: 71, windowId: 17, url: "https://example.com/current-page" },
    captureVisibleTab: async () => "data:image/png;base64,AA=="
  });
  const previous = await importPopup(environment, "popup-preferences-system-language");

  try {
    await waitFor(() => environment.document.documentElement.lang === "en");
    assert.equal(environment.elements.languageEn.attributes.get("aria-pressed"), "true");
  } finally {
    restoreEnvironment(previous);
  }
});
