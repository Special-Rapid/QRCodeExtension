const source = "qr-scan-extension";

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin || !event.data || event.data.source !== "qr-scan-web") return;
  if (event.data.type === "page-ready") announce();
  if (event.data.type === "connector-link" && event.data.extensionId === chrome.runtime.id && typeof event.data.token === "string") {
    chrome.runtime.sendMessage({ type: "connector.claim", token: event.data.token, extensionId: chrome.runtime.id }).catch(() => {});
  }
});

function announce() {
  window.postMessage({ source, type: "ready", extensionId: chrome.runtime.id }, location.origin);
}
