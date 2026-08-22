const key = "qr-scan-web-receiver";
const state = { credential: loadCredential(), socket: null, poll: null, events: new Map() };
const $ = (selector) => document.querySelector(selector);

document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
$("#start-pairing").addEventListener("click", startPairing);
$("#restart-pairing").addEventListener("click", startPairing);
$("#confirm-web").addEventListener("click", () => confirmPair("web"));
$("#notification-button").addEventListener("click", requestNotifications);
$("#disconnect-web").addEventListener("click", revokePair);

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
  } catch (error) { setPairStatus(error.message, true); }
}

async function resumePairing() {
  renderPairing();
  await refreshPairing();
}

async function refreshPairing() {
  if (!state.credential) return;
  try {
    const detail = await api(`/api/v1/pairs/${state.credential.code}/status`, { headers: authHeaders() });
    state.credential = { ...state.credential, ...detail };
    if (detail.status === "paired") {
      localStorage.setItem(key, JSON.stringify(state.credential));
      sessionStorage.removeItem(key);
      renderInbox();
      await loadEvents();
      openSocket();
      return;
    }
    if (detail.status === "expired") return renderUnpaired("連携コードの有効期限が切れました。もう一度作成してください。");
    if (detail.status === "revoked") return renderUnpaired("この連携は解除されました。もう一度連携してください。");
    renderPairing();
    state.poll = window.setTimeout(refreshPairing, 1800);
  } catch (error) { setPairStatus(error.message, true); }
}

async function confirmPair(role) {
  try {
    const response = await api(`/api/v1/pairs/${state.credential.code}/confirm`, { method: "POST", body: { role, token: state.credential.token } });
    setPairStatus(response.status === "paired" ? "連携が完了しました。" : "スマホ側の確認を待っています。");
    $("#confirm-web").disabled = true;
    await refreshPairing();
  } catch (error) { setPairStatus(error.message, true); }
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
    if (data.type === "handoff") { addEvent(data.event); notify(data.event); }
    if (data.type === "claimed") { setPairStatus(`${data.mobileLabel} がコードを入力しました。確認フレーズを見比べてください。`); $("#confirm-web").disabled = false; }
    if (data.type === "paired") { refreshPairing(); }
    if (data.type === "revoked") renderUnpaired(`${data.by} が連携を解除しました。`);
  });
  socket.addEventListener("close", () => { state.socket = null; if (state.credential?.status === "paired") window.setTimeout(openSocket, 2000); });
}

function closeConnection() { if (state.poll) window.clearTimeout(state.poll); state.poll = null; state.socket?.close(); state.socket = null; }

function renderUnpaired(message = "") {
  closeConnection();
  state.credential = null;
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
  $("#unpaired-panel").hidden = false;
  $("#pairing-panel").hidden = true;
  $("#inbox-panel").hidden = true;
  if (message) $("#inbox-description").textContent = message;
}

function renderPairing() {
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
  $("#connection-state").textContent = "スマホと接続済み";
  $("#device-details").textContent = `${state.credential.peerLabel ?? "スマホ"} と連携済みです。新しい受信はこのブラウザに届きます。`;
}

function addEvent(event) {
  if (state.events.has(event.id)) return;
  state.events.set(event.id, event);
  const fragment = $("#event-template").content.cloneNode(true);
  const item = fragment.querySelector(".event");
  fragment.querySelector(".event-host").textContent = event.host ?? "テキスト・バーコード";
  fragment.querySelector(".event-value").textContent = event.data;
  fragment.querySelector(".event-time").textContent = new Date(event.createdAt).toLocaleString("ja-JP");
  const open = fragment.querySelector(".open-event");
  if (event.host) open.addEventListener("click", () => window.open(event.data, "_blank", "noopener,noreferrer")); else open.remove();
  fragment.querySelector(".copy-event").addEventListener("click", async () => { await navigator.clipboard.writeText(event.data); });
  $("#event-list").prepend(fragment);
  $("#empty-inbox").hidden = state.events.size !== 0;
}

async function requestNotifications() {
  if (!("Notification" in window)) return;
  const permission = await Notification.requestPermission();
  $("#notification-button").textContent = permission === "granted" ? "通知は許可済み" : "通知を許可";
}

async function revokePair() {
  if (!state.credential || state.credential.status !== "paired") return renderUnpaired("解除する連携はありません。");
  try {
    await api(`/api/v1/pairs/${state.credential.code}/revoke`, { method: "POST", body: {} });
    renderUnpaired("このPCとの連携を解除しました。");
  } catch (error) { setPairStatus(error.message, true); }
}

function notify(event) { if (Notification.permission === "granted") new Notification("QR Scan に届きました", { body: event.host ?? "新しい読み取り結果" }); }
function setPairStatus(message, isError = false) { const target = $("#pair-status"); target.textContent = message; target.style.color = isError ? "#b42318" : ""; }
function authHeaders() { return { "X-QR-Role": "web" }; }
function loadCredential() { try { return JSON.parse(localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? "null"); } catch { localStorage.removeItem(key); sessionStorage.removeItem(key); return null; } }
function browserLabel() { return navigator.userAgent.includes("Mac") ? "Mac のブラウザ" : "このブラウザ"; }
async function api(path, options = {}) { const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers ?? {}) }, body: options.body ? JSON.stringify(options.body) : undefined }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiMessage(data.error)); return data; }
function apiMessage(code) { return ({ rate_limited: "試行回数が多すぎます。少し待ってから試してください。", expired: "連携コードの有効期限が切れました。", unauthorized: "連携情報を確認できませんでした。", already_claimed: "このコードは別のスマホで入力済みです。" })[code] ?? "通信に失敗しました。"; }
