import { notificationPermissionState } from "/notification-state.js";

const key = "qr-scan-web-receiver";
const state = { credential: loadCredential(), socket: null, poll: null, events: new Map(), extensionId: null, connector: null };
const $ = (selector) => document.querySelector(selector);

document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
$("#start-pairing").addEventListener("click", startPairing);
$("#restart-pairing").addEventListener("click", startPairing);
$("#confirm-web").addEventListener("click", () => confirmPair("web"));
$("#notification-button").addEventListener("click", requestNotifications);
$("#disconnect-web").addEventListener("click", revokePair);
$("#connect-extension").addEventListener("click", connectExtension);
$("#disconnect-extension").addEventListener("click", disconnectExtension);
window.addEventListener("message", receiveExtensionBridge);
window.postMessage({ source: "qr-scan-web", type: "page-ready" }, location.origin);

if (state.credential) resumePairing(); else renderUnpaired();

function showView(name) {
  document.querySelectorAll(".view").forEach((view) => { view.hidden = view.id !== `${name}-view`; });
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
}

async function startPairing() {
  closeConnection();
  try {
    const pair = await api("/api/v1/pairs", { method: "POST", body: { label: browserLabel() } });
    state.credential = { ...pair, role: "web" };
    sessionStorage.setItem(key, JSON.stringify(state.credential));
    renderPairing();
    await refreshPairing();
  } catch (error) { setPairStatus(messageFor(error), true); }
}

async function resumePairing() { renderPairing(); await refreshPairing(); }

async function refreshPairing() {
  if (!state.credential) return;
  try {
    const detail = await api(`/api/v1/pairs/${state.credential.code}/status`, { headers: authHeaders() });
    state.credential = { ...state.credential, ...detail };
    if (detail.status === "paired") {
      localStorage.setItem(key, JSON.stringify(state.credential));
      sessionStorage.removeItem(key);
      renderInbox();
      await Promise.all([loadEvents(), syncConnector(), refreshWebPushStatus()]);
      openSocket();
      return;
    }
    if (detail.status === "expired") return renderUnpaired("連携コードの有効期限が切れました。もう一度作成してください。");
    if (detail.status === "revoked") return renderUnpaired("この連携は解除されました。もう一度連携してください。");
    renderPairing();
    state.poll = window.setTimeout(refreshPairing, 1800);
  } catch (error) { setPairStatus(messageFor(error), true); }
}

async function confirmPair(role) {
  if (!state.credential) return;
  try {
    const response = await api(`/api/v1/pairs/${state.credential.code}/confirm`, { method: "POST", body: { role, token: state.credential.token } });
    setPairStatus(response.status === "paired" ? "連携が完了しました。" : "スマホ側の確認を待っています。");
    $("#confirm-web").disabled = true;
    await refreshPairing();
  } catch (error) { setPairStatus(messageFor(error), true); }
}

async function loadEvents() {
  if (!state.credential) return;
  const data = await api(`/api/v1/pairs/${state.credential.code}/events?receiver=${encodeURIComponent(state.credential.receiverId)}`, { headers: authHeaders() });
  data.events.forEach(addEvent);
}

function openSocket() {
  if (!state.credential || state.socket) return;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${location.host}/api/v1/pairs/${state.credential.code}/ws`);
  state.socket = socket;
  socket.addEventListener("message", (message) => {
    const data = JSON.parse(message.data);
    if (data.type === "handoff" && addEvent(data.event)) showForegroundNotification(data.event);
    if (data.type === "claimed") { setPairStatus(`${data.mobileLabel} がコードを入力しました。確認フレーズを見比べてください。`); $("#confirm-web").disabled = false; }
    if (data.type === "paired") void refreshPairing();
    if (data.type === "revoked") renderUnpaired(`${data.by} が連携を解除しました。`);
  });
  socket.addEventListener("close", () => { state.socket = null; if (state.credential?.status === "paired") window.setTimeout(openSocket, 2000); });
}

function closeConnection() { if (state.poll) window.clearTimeout(state.poll); state.poll = null; state.socket?.close(); state.socket = null; }

function renderUnpaired(message = "") {
  closeConnection();
  state.credential = null;
  state.connector = null;
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
  $("#unpaired-panel").hidden = false;
  $("#pairing-panel").hidden = true;
  $("#inbox-panel").hidden = true;
  $("#connector-panel").hidden = true;
  renderDeviceSummary();
  if (message) $("#inbox-description").textContent = message;
}

function renderPairing() {
  if (!state.credential) return;
  $("#unpaired-panel").hidden = true;
  $("#pairing-panel").hidden = false;
  $("#inbox-panel").hidden = true;
  $("#pair-code").textContent = state.credential.code;
  $("#pair-phrase").textContent = state.credential.phrase;
  $("#pair-expiry").textContent = `有効期限: ${new Date(state.credential.expiresAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
  const claimed = Boolean(state.credential.peerLabel);
  $("#confirm-web").disabled = !claimed || Boolean(state.credential.selfConfirmed);
  setPairStatus(claimed ? `${state.credential.peerLabel} が入力しました。確認フレーズを見比べてから確認してください。` : "スマホアプリでコードを入力してください。");
}

function renderInbox() {
  $("#unpaired-panel").hidden = true;
  $("#pairing-panel").hidden = true;
  $("#inbox-panel").hidden = false;
  $("#connector-panel").hidden = false;
  renderDeviceSummary();
  renderConnector();
}

function renderDeviceSummary() {
  if (!state.credential || state.credential.status !== "paired") {
    $("#connection-state").textContent = "未接続";
    $("#device-count").textContent = "0台";
    $("#device-details").textContent = "連携すると、ここにスマホの名前が表示されます。";
    return;
  }
  const mobile = state.credential?.peerLabel ?? "スマホ";
  const connectorCount = state.connector ? 1 : 0;
  const count = 1 + connectorCount;
  $("#connection-state").textContent = `接続中 ${count}台`;
  $("#device-count").textContent = `${count}台`;
  $("#device-details").textContent = connectorCount ? `${mobile} と連携済みです。Chrome拡張もこのPCの高速通知用に接続されています。` : `${mobile} と連携済みです。通知と受信箱はこのページでまとめて管理します。`;
}

function renderConnector() {
  renderDeviceSummary();
  const connect = $("#connect-extension");
  const disconnect = $("#disconnect-extension");
  if (state.connector) {
    $("#connector-description").textContent = "Chrome拡張が高速通知コネクタとして接続済みです。通知を押すと、この受信箱を開きます。";
    connect.hidden = true;
    disconnect.hidden = false;
    return;
  }
  if (state.extensionId) {
    $("#connector-description").textContent = "Chrome拡張を検出しました。接続すると、追加の連携コードなしで高速通知を使えます。";
    connect.hidden = false;
  } else {
    $("#connector-description").textContent = "Chrome拡張を入れると、このPCへの高速通知に使えます。受信箱は増えません。";
    connect.hidden = true;
  }
  disconnect.hidden = true;
}

function addEvent(event) {
  if (state.events.has(event.id)) return false;
  state.events.set(event.id, event);
  const fragment = $("#event-template").content.cloneNode(true);
  fragment.querySelector(".event-host").textContent = event.host ?? "テキスト・バーコード";
  fragment.querySelector(".event-value").textContent = event.data;
  fragment.querySelector(".event-time").textContent = new Date(event.createdAt).toLocaleString("ja-JP");
  const open = fragment.querySelector(".open-event");
  if (event.host) open.addEventListener("click", () => window.open(event.data, "_blank", "noopener,noreferrer")); else open.remove();
  fragment.querySelector(".copy-event").addEventListener("click", async () => { await navigator.clipboard.writeText(event.data); });
  $("#event-list").prepend(fragment);
  $("#empty-inbox").hidden = state.events.size !== 0;
  return true;
}

function showForegroundNotification(event) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification("QR Scan", { body: "スマホから新しい読み取り結果が届きました。", tag: `qr-scan-handoff:${event.id}`, renotify: false });
  } catch { /* The inbox update remains the primary visible fallback. */ }
}

async function requestNotifications() {
  if (!state.credential) return setNotificationStatus("先にスマホと連携してください。", true);
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setNotificationStatus("このブラウザはWeb通知に対応していません。", true);
  const button = $("#notification-button");
  button.disabled = true;
  setNotificationStatus("通知を準備しています…");
  try {
    const permission = await Notification.requestPermission();
    const permissionState = notificationPermissionState(permission);
    if (!permissionState.continueSetup) return setNotificationStatus(permissionState.message, permissionState.isError);
    const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
    const { publicKey } = await api("/api/v1/vapid-public-key");
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(publicKey) });
    await api(`/api/v1/pairs/${state.credential.code}/push-subscriptions`, { method: "POST", body: { subscription: subscription.toJSON() } });
    button.textContent = "Web通知は有効です";
    setNotificationStatus("このブラウザに届くようになりました。");
  } catch (error) { setNotificationStatus(messageFor(error), true); } finally { button.disabled = false; }
}

async function refreshWebPushStatus() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    $("#notification-button").hidden = true;
    return setNotificationStatus("このブラウザはWeb通知に対応していません。", true);
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    const enabled = subscription && Notification.permission === "granted";
    $("#notification-button").textContent = enabled ? "Web通知は有効です" : "Web通知を有効にする";
    setNotificationStatus(enabled ? "このブラウザに届くようになりました。" : "");
  } catch { setNotificationStatus("通知の状態を確認できませんでした。ページを再読み込みしてください。", true); }
}

function receiveExtensionBridge(event) {
  if (event.source !== window || event.origin !== location.origin || !event.data || event.data.source !== "qr-scan-extension" || event.data.type !== "ready") return;
  if (!/^[a-p]{32}$/.test(event.data.extensionId ?? "")) return;
  state.extensionId = event.data.extensionId;
  renderConnector();
}

async function syncConnector() {
  if (!state.credential) return;
  const data = await api(`/api/v1/pairs/${state.credential.code}/connector-status`);
  state.connector = data.connector;
  renderConnector();
}

async function connectExtension() {
  if (!state.credential || !state.extensionId) return;
  try {
    const link = await api(`/api/v1/pairs/${state.credential.code}/connector-link`, { method: "POST", body: { extensionId: state.extensionId } });
    window.postMessage({ source: "qr-scan-web", type: "connector-link", token: link.token, extensionId: state.extensionId }, location.origin);
    $("#connector-description").textContent = "Chrome拡張を接続しています…";
    window.setTimeout(() => { void syncConnector(); }, 1000);
  } catch (error) { setPairStatus(messageFor(error), true); }
}

async function disconnectExtension() {
  if (!state.credential || !state.connector?.extensionId) return;
  try {
    await api(`/api/v1/pairs/${state.credential.code}/connector-disconnect`, { method: "POST", body: { extensionId: state.connector.extensionId } });
    state.connector = null;
    renderConnector();
  } catch (error) { setPairStatus(messageFor(error), true); }
}

async function revokePair() {
  if (!state.credential || state.credential.status !== "paired") return renderUnpaired("解除する連携はありません。");
  try {
    await api(`/api/v1/pairs/${state.credential.code}/revoke`, { method: "POST", body: {} });
    renderUnpaired("このPCとの連携を解除しました。");
  } catch (error) { setPairStatus(messageFor(error), true); }
}

function setPairStatus(message, isError = false) { const target = $("#pair-status"); target.textContent = message; target.style.color = isError ? "#b42318" : ""; }
function setNotificationStatus(message, isError = false) { const target = $("#notification-status"); target.textContent = message; target.classList.toggle("is-error", isError); }
function authHeaders() { return { "X-QR-Role": "web" }; }
function loadCredential() { try { return JSON.parse(localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? "null"); } catch { localStorage.removeItem(key); sessionStorage.removeItem(key); return null; } }
function browserLabel() { return navigator.userAgent.includes("Mac") ? "Mac のブラウザ" : "このブラウザ"; }
function base64UrlToUint8Array(value) { const padded = value + "=".repeat((4 - value.length % 4) % 4); const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
async function api(path, options = {}) { const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers ?? {}) }, body: options.body ? JSON.stringify(options.body) : undefined }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiMessage(data.error)); return data; }
function apiMessage(code) { return ({ rate_limited: "試行回数が多すぎます。少し待ってから試してください。", expired: "連携コードの有効期限が切れました。", unauthorized: "連携情報を確認できませんでした。", already_claimed: "このコードは別のスマホで入力済みです。", push_unavailable: "Web通知はまだ準備中です。管理者が通知設定を完了した後、もう一度試してください。", invalid_subscription: "このブラウザでは通知を登録できませんでした。", link_expired: "Chrome拡張の接続時間が切れました。もう一度試してください。" })[code] ?? "通信に失敗しました。"; }
function messageFor(error) { return error instanceof Error ? error.message : "通信に失敗しました。"; }
