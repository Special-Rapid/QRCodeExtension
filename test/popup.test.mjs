import assert from "node:assert/strict";
import test from "node:test";

function createNode() {
  return {
    addEventListener() {},
    setAttribute() {},
    dataset: {},
    disabled: false,
    hidden: false,
    textContent: "",
    value: ""
  };
}

function createEnvironment({ captureVisibleTab }) {
  const scanPageButton = createNode();
  const scanButtonContent = createNode();
  const scanLoading = createNode();
  const fileInput = createNode();
  const status = createNode();
  const results = createNode();
  const resultList = { ...createNode(), replaceChildren() {} };
  const elements = new Map([
    ["#scan-page", scanPageButton],
    [".button-content", scanButtonContent],
    ["#scan-loading", scanLoading],
    ["#image-file", fileInput],
    ["#status", status],
    ["#results", results],
    ["#result-list", resultList]
  ]);

  return {
    elements: { scanPageButton, scanButtonContent, scanLoading, fileInput, status, results },
    chrome: {
      tabs: {
        query: async () => [{ id: 71, windowId: 17 }],
        captureVisibleTab
      }
    },
    document: {
      querySelector: (selector) => elements.get(selector),
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
    }
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
  const previous = { chrome: globalThis.chrome, document: globalThis.document, Image: globalThis.Image };
  globalThis.chrome = environment.chrome;
  globalThis.document = environment.document;
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
  Object.assign(globalThis, previous);
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
