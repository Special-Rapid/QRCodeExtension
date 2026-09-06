import { notificationPermissionState } from "/notification-state.js";

const key = "qr-scan-web-receiver";
const preferencesKey = "qr-scan-web-receiver-preferences";
const messages = {
  ja: {
    navInbox: "受信箱", navDevices: "デバイス", navSettings: "設定", navMenu: "メインメニュー", railNote: "スマホで読み取った内容を、このPCで安全に開けます。", progressLabel: "セットアップの進行状況", notificationForeground: "スマホから新しい読み取り結果が届きました。",
    setupEyebrow: "PCを準備する", setupTitle: "このPCをセットアップ", setupBody: "スマホで読み取ったリンクや文字列を、このPCで受け取れます。", setupCardKicker: "最初のステップ", setupCardTitle: "スマホを連携する", setupCardBody: "PCに表示するコードをスマホアプリへ入力し、両方の画面で確認します。", setupStart: "スマホを連携する", stepPrepare: "PCを準備", stepCode: "コード入力", stepConfirm: "両方で確認", stepReady: "受信開始",
    pairCodeEyebrow: "スマホで入力するコード", pairCodeKicker: "スマホで入力してください", pairCodeTitle: "スマホアプリを開いてコードを入力", pairCodeBody: "入力後、この画面に確認フレーズが表示されます。", pairPhraseLabel: "確認フレーズ", pairConfirm: "このPCで確認する", pairRestart: "別のコードを作る", pairWaiting: "スマホアプリでコードを入力してください。", pairClaimed: "がコードを入力しました。確認フレーズを見比べてから確認してください。", pairComplete: "連携が完了しました。", pairExpired: "連携コードの有効期限が切れました。もう一度作成してください。", pairRevoked: "この連携は解除されました。もう一度連携してください。", pairExpiry: "残り {{time}}",
    inboxEyebrow: "PC連携", inboxTitle: "受信箱", inboxBody: "スマホから届いた内容を、ここで確認して開けます。", notificationEnable: "Web通知を有効にする", notificationEnabled: "Web通知は有効です", notificationReady: "このブラウザに届くようになりました。", notificationPreparing: "通知を準備しています…", notificationNeedPair: "先にスマホと連携してください。", notificationUnsupported: "このブラウザはWeb通知に対応していません。", notificationDenied: "通知は許可されませんでした。ブラウザ設定から許可できます。", notificationUnknown: "通知の状態を確認できませんでした。ページを再読み込みしてください。", pushUnavailable: "Web通知はまだ準備中です。管理者が通知設定を完了した後、もう一度試してください。", recentTitle: "最近の受信", connectionChecking: "接続を確認中", connectionNone: "未接続", connectionActive: "接続中 {{count}}台", emptyKicker: "準備完了", emptyTitle: "まだ受信はありません", emptyBody: "スマホでQRコード、バーコード、URL文字列を読み取るとここに届きます。", eventUrl: "リンク", eventText: "文字列", copy: "コピー", copied: "コピーしました", open: "開く",
    devicesEyebrow: "連携先", devicesTitle: "デバイス", devicesBody: "このPCに接続している端末と高速通知を管理します。", thisPcLabel: "このPC", thisBrowser: "このブラウザ", connectedDevices: "接続中のデバイス", noDevices: "連携すると、ここにスマホの名前が表示されます。", mobileConnected: "連携中のスマホ: {{mobile}}。通知と受信箱はこのページでまとめて管理します。", mobileConnector: "連携中のスマホ: {{mobile}}。Chrome拡張もこのPCの高速通知用に接続されています。", fastNotificationKicker: "Chrome拡張", fastNotificationTitle: "高速通知", connectorNone: "Chrome拡張を入れると、このPCへの高速通知に使えます。受信箱は増えません。", connectorFound: "Chrome拡張を検出しました。接続すると、追加の連携コードなしで高速通知を使えます。", connectorConnected: "Chrome拡張が高速通知コネクタとして接続済みです。通知を押すと、URLは直接開き、文字列はこの受信箱を開きます。", connectorConnecting: "Chrome拡張を接続しています…", connectorConnect: "Chrome拡張を接続", connectorDisconnect: "Chrome拡張を解除",
    settingsEyebrow: "このブラウザ", settingsTitle: "設定", settingsBody: "表示と言語の設定はこの端末だけに保存されます。", appearanceTitle: "外観", appearanceBody: "画面の明るさを選べます。", themeSystem: "システム", themeLight: "ライト", themeDark: "ダーク", languageTitle: "言語", languageBody: "表示する言語を選べます。", notificationTitle: "通知", notificationBody: "Webを閉じていても、スマホからの受信を通知できます。", privacyTitle: "連携とプライバシー", privacyBody: "リンクは自動で開きません。受信内容は未読のまま10分で消えます。", disconnectPc: "このPCとの連携を解除", revokeNone: "解除する連携はありません。", revokeDone: "このPCとの連携を解除しました。", revokeConfirm: "このPCとスマホの連携を解除しますか？",
    genericError: "通信に失敗しました。", rateLimited: "試行回数が多すぎます。少し待ってから試してください。", expired: "連携コードの有効期限が切れました。", unauthorized: "連携情報を確認できませんでした。", alreadyClaimed: "このコードは別のスマホで入力済みです。", invalidSubscription: "このブラウザでは通知を登録できませんでした。", linkExpired: "Chrome拡張の接続時間が切れました。もう一度試してください。", connectorFailure: "Chrome拡張を接続できませんでした。拡張を再読み込みしてから、もう一度接続してください。"
  },
  en: {
    navInbox: "Inbox", navDevices: "Devices", navSettings: "Settings", navMenu: "Main menu", railNote: "Open content scanned on your phone safely on this PC.", progressLabel: "Setup progress", notificationForeground: "A new scan result arrived from your phone.",
    setupEyebrow: "Prepare this PC", setupTitle: "Set up this PC", setupBody: "Receive links and text scanned on your phone here.", setupCardKicker: "First step", setupCardTitle: "Link your phone", setupCardBody: "Enter the code shown here in the phone app, then confirm it on both screens.", setupStart: "Link your phone", stepPrepare: "Prepare PC", stepCode: "Enter code", stepConfirm: "Confirm both", stepReady: "Start receiving",
    pairCodeEyebrow: "Enter this code on your phone", pairCodeKicker: "Use the phone app", pairCodeTitle: "Open the app and enter the code", pairCodeBody: "A confirmation phrase appears here after the code is entered.", pairPhraseLabel: "Confirmation phrase", pairConfirm: "Confirm on this PC", pairRestart: "Create another code", pairWaiting: "Enter the code in the phone app.", pairClaimed: " entered the code. Compare the confirmation phrase before confirming.", pairComplete: "Linking is complete.", pairExpired: "The link code expired. Create a new one.", pairRevoked: "This link was removed. Link again.", pairExpiry: "{{time}} remaining",
    inboxEyebrow: "PC link", inboxTitle: "Inbox", inboxBody: "Review and open content delivered from your phone.", notificationEnable: "Enable web notifications", notificationEnabled: "Web notifications enabled", notificationReady: "This browser can now receive notifications.", notificationPreparing: "Preparing notifications…", notificationNeedPair: "Link a phone first.", notificationUnsupported: "This browser does not support web notifications.", notificationDenied: "Notifications were not allowed. You can allow them in your browser settings.", notificationUnknown: "Could not check notification status. Reload this page.", pushUnavailable: "Web notifications are not ready yet. Ask the administrator to finish notification setup, then try again.", recentTitle: "Recent deliveries", connectionChecking: "Checking connection", connectionNone: "Not connected", connectionActive: "{{count}} connected", emptyKicker: "Ready", emptyTitle: "Nothing received yet", emptyBody: "QR codes, barcodes, and URL text scanned on the phone arrive here.", eventUrl: "Link", eventText: "Text", copy: "Copy", copied: "Copied", open: "Open",
    devicesEyebrow: "Connections", devicesTitle: "Devices", devicesBody: "Manage devices linked to this PC and fast notifications.", thisPcLabel: "This PC", thisBrowser: "This browser", connectedDevices: "Connected devices", noDevices: "A linked phone will appear here.", mobileConnected: "Linked phone: {{mobile}}. Manage notifications and the inbox on this page.", mobileConnector: "Linked phone: {{mobile}}. Chrome extension fast notifications are also connected.", fastNotificationKicker: "Chrome extension", fastNotificationTitle: "Fast notifications", connectorNone: "Install the Chrome extension to use fast notifications on this PC. It does not create another inbox.", connectorFound: "Chrome extension found. Connect it to use fast notifications without another link code.", connectorConnected: "The Chrome extension is connected for fast notifications. URLs open directly; text opens this inbox.", connectorConnecting: "Connecting the Chrome extension…", connectorConnect: "Connect Chrome extension", connectorDisconnect: "Disconnect Chrome extension",
    settingsEyebrow: "This browser", settingsTitle: "Settings", settingsBody: "Appearance and language are saved only in this browser.", appearanceTitle: "Appearance", appearanceBody: "Choose how the interface looks.", themeSystem: "System", themeLight: "Light", themeDark: "Dark", languageTitle: "Language", languageBody: "Choose the interface language.", notificationTitle: "Notifications", notificationBody: "Get notified even when this web page is closed.", privacyTitle: "Link and privacy", privacyBody: "Links never open automatically. Unread content expires after ten minutes.", disconnectPc: "Disconnect this PC", revokeNone: "There is no link to remove.", revokeDone: "This PC was disconnected.", revokeConfirm: "Disconnect this PC and phone?",
    genericError: "Could not connect.", rateLimited: "Too many attempts. Wait a moment and try again.", expired: "The link code expired.", unauthorized: "Could not verify link information.", alreadyClaimed: "Another phone has already entered this code.", invalidSubscription: "Could not register notifications in this browser.", linkExpired: "The Chrome extension connection expired. Connect it again.", connectorFailure: "Could not connect the Chrome extension. Reload the extension and try again."
  }
};

const state = {
  credential: loadCredential(), socket: null, poll: null, events: new Map(), extensionId: null, connector: null, connectorError: "", pendingAcks: new Map(),
  preferences: loadPreferences(), activeView: "inbox", notification: { enabled: false, statusKey: "", status: "", isError: false, supported: true }
};
const $ = (selector) => document.querySelector(selector);
const interpolate = (value, fields = {}) => value.replace(/{{(\w+)}}/g, (_, field) => String(fields[field] ?? ""));
const t = (name, fields) => interpolate(messages[state.preferences.locale][name] ?? name, fields);

document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
$("#start-pairing").addEventListener("click", startPairing);
$("#restart-pairing").addEventListener("click", startPairing);
$("#confirm-web").addEventListener("click", () => confirmPair("web"));
$("#notification-button").addEventListener("click", requestNotifications);
$("#settings-notification-button").addEventListener("click", requestNotifications);
$("#disconnect-web").addEventListener("click", revokePair);
$("#connect-extension").addEventListener("click", connectExtension);
$("#disconnect-extension").addEventListener("click", disconnectExtension);
document.querySelectorAll("[data-theme-choice]").forEach((button) => button.addEventListener("click", () => updatePreferences({ theme: button.dataset.themeChoice })));
document.querySelectorAll("[data-locale-choice]").forEach((button) => button.addEventListener("click", () => updatePreferences({ locale: button.dataset.localeChoice })));
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (state.preferences.theme === "system") applyPreferences(); });
window.addEventListener("message", receiveExtensionBridge);
window.postMessage({ source: "qr-scan-web", type: "page-ready" }, location.origin);

applyPreferences();
if (state.credential) resumePairing(); else renderUnpaired();

function showView(name) {
  state.activeView = name;
  document.querySelectorAll(".view").forEach((view) => { view.hidden = view.id !== `${name}-view`; });
  document.querySelectorAll(".nav-item").forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
}

function applyPreferences() {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = state.preferences.theme === "system" ? (systemDark ? "dark" : "light") : state.preferences.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = state.preferences.locale;
  document.querySelector('meta[name="color-scheme"]').content = theme;
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.i18nAria)); });
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const selected = button.dataset.themeChoice === state.preferences.theme;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelectorAll("[data-locale-choice]").forEach((button) => {
    const selected = button.dataset.localeChoice === state.preferences.locale;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $("#this-pc-name").textContent = t("thisBrowser");
  if (state.credential?.status === "paired") { renderInbox(); renderConnector(); } else if (state.credential) renderPairing(); else renderUnpaired();
  renderNotificationControls();
  state.events.forEach((event) => refreshEventCopy(event));
}

function updatePreferences(next) {
  state.preferences = { ...state.preferences, ...next };
  localStorage.setItem(preferencesKey, JSON.stringify(state.preferences));
  applyPreferences();
}

async function startPairing() {
  closeConnection();
  try {
    const pair = await api("/api/v1/pairs", { method: "POST", body: { label: browserLabel() } });
    state.credential = { ...pair, role: "web" };
    sessionStorage.setItem(key, JSON.stringify(state.credential));
    renderPairing();
    await refreshPairing();
  } catch (error) { renderUnpaired(messageFor(error), true); }
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
    if (detail.status === "expired") return renderUnpaired(t("pairExpired"), true);
    if (detail.status === "revoked") return renderUnpaired(t("pairRevoked"), true);
    renderPairing();
    state.poll = window.setTimeout(refreshPairing, 1800);
  } catch (error) { setPairStatus(messageFor(error), true); }
}

async function confirmPair(role) {
  if (!state.credential) return;
  try {
    const response = await api(`/api/v1/pairs/${state.credential.code}/confirm`, { method: "POST", body: { role, token: state.credential.token } });
    setPairStatus(response.status === "paired" ? t("pairComplete") : t("pairWaiting"));
    $("#confirm-web").disabled = true;
    await refreshPairing();
  } catch (error) { setPairStatus(messageFor(error), true); }
}

async function loadEvents() {
  if (!state.credential) return;
  const data = await api(`/api/v1/pairs/${state.credential.code}/events?receiver=${encodeURIComponent(state.credential.receiverId)}`, { headers: authHeaders() });
  await Promise.all(data.events.map(async (event) => { addEvent(event); await acknowledgeEvent(event.id, event.expiresAt); }));
}

function openSocket() {
  if (!state.credential || state.socket) return;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${location.host}/api/v1/pairs/${state.credential.code}/ws`);
  state.socket = socket;
  socket.addEventListener("message", (message) => {
    const data = JSON.parse(message.data);
    if (data.type === "handoff") void receiveHandoff(data.event);
    if (data.type === "claimed") {
      state.credential = { ...state.credential, peerLabel: data.mobileLabel };
      renderPairing();
      setPairStatus(`${data.mobileLabel}${t("pairClaimed")}`);
      $("#confirm-web").disabled = false;
    }
    if (data.type === "paired") void refreshPairing();
    if (data.type === "revoked") renderUnpaired(`${data.by} ${t("pairRevoked")}`, true);
  });
  socket.addEventListener("open", () => { void loadEvents(); });
  socket.addEventListener("close", () => { state.socket = null; if (state.credential?.status === "paired") window.setTimeout(openSocket, 2000); });
}

function closeConnection() { if (state.poll) window.clearTimeout(state.poll); state.poll = null; state.socket?.close(); state.socket = null; }

function renderUnpaired(message = "", isError = false) {
  closeConnection();
  state.credential = null;
  state.connector = null;
  for (const pending of state.pendingAcks.values()) window.clearTimeout(pending.timer);
  state.pendingAcks.clear();
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
  state.notification = { enabled: false, statusKey: "", status: "", isError: false, supported: true };
  $("#unpaired-panel").hidden = false;
  $("#pairing-panel").hidden = true;
  $("#inbox-panel").hidden = true;
  $("#connector-panel").hidden = true;
  $("#inbox-description").textContent = message || t("setupBody");
  $("#inbox-description").classList.toggle("is-error", isError);
  renderDeviceSummary();
  renderNotificationControls();
}

function renderPairing() {
  if (!state.credential) return;
  $("#unpaired-panel").hidden = true;
  $("#pairing-panel").hidden = false;
  $("#inbox-panel").hidden = true;
  $("#pair-code").textContent = formatPairCode(state.credential.code);
  $("#pair-phrase").textContent = state.credential.phrase;
  $("#pair-expiry").textContent = t("pairExpiry", { time: remainingTime(state.credential.expiresAt) });
  const claimed = Boolean(state.credential.peerLabel);
  $("#confirmation-panel").hidden = !claimed;
  $("#pair-progress-step").textContent = claimed ? "3" : "2";
  $("#pairing-eyebrow").textContent = claimed ? t("pairPhraseLabel") : t("pairCodeEyebrow");
  $("#pairing-card-kicker").textContent = claimed ? t("pairPhraseLabel") : t("pairCodeKicker");
  $("#pairing-title").textContent = claimed ? t("pairPhraseLabel") : t("pairCodeTitle");
  $("#pairing-instruction").textContent = claimed ? `${state.credential.peerLabel}${t("pairClaimed")}` : t("pairCodeBody");
  $("#confirm-web").hidden = !claimed;
  $("#confirm-web").disabled = !claimed || Boolean(state.credential.selfConfirmed);
  $("#restart-pairing").hidden = claimed;
  setPairStatus(claimed ? `${state.credential.peerLabel}${t("pairClaimed")}` : t("pairWaiting"));
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
  const paired = state.credential?.status === "paired";
  if (!paired) {
    $("#connection-state").textContent = t("connectionNone");
    $("#connection-state-detail").textContent = t("connectionNone");
    $("#device-count").textContent = state.preferences.locale === "ja" ? "0台" : "0";
    $("#device-details").textContent = t("noDevices");
    return;
  }
  const mobile = state.credential?.peerLabel ?? (state.preferences.locale === "ja" ? "スマホ" : "Phone");
  const connectorCount = state.connector ? 1 : 0;
  const count = 1 + connectorCount;
  const connected = t("connectionActive", { count });
  $("#connection-state").textContent = connected;
  $("#connection-state-detail").textContent = connected;
  $("#device-count").textContent = state.preferences.locale === "ja" ? `${count}台` : String(count);
  $("#device-details").textContent = state.connector ? t("mobileConnector", { mobile }) : t("mobileConnected", { mobile });
}

function renderConnector() {
  renderDeviceSummary();
  const connect = $("#connect-extension");
  const disconnect = $("#disconnect-extension");
  if (state.connector) {
    $("#connector-description").textContent = t("connectorConnected");
    connect.hidden = true; disconnect.hidden = false;
    return;
  }
  if (state.connectorError) {
    $("#connector-description").textContent = state.connectorError;
    connect.hidden = false; disconnect.hidden = true;
    return;
  }
  if (state.extensionId) {
    $("#connector-description").textContent = t("connectorFound");
    connect.hidden = false;
  } else {
    $("#connector-description").textContent = t("connectorNone");
    connect.hidden = true;
  }
  disconnect.hidden = true;
}

function addEvent(event) {
  if (state.events.has(event.id)) return false;
  state.events.set(event.id, event);
  const fragment = $("#event-template").content.cloneNode(true);
  const item = fragment.querySelector(".event");
  item.dataset.eventId = event.id;
  fragment.querySelector(".event-host").textContent = event.host ?? t("eventText");
  fragment.querySelector(".event-value").textContent = event.data;
  fragment.querySelector(".event-time").textContent = new Intl.DateTimeFormat(state.preferences.locale === "ja" ? "ja-JP" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt));
  const open = fragment.querySelector(".open-event");
  open.textContent = t("open");
  if (event.openUrl) open.addEventListener("click", () => window.open(event.openUrl, "_blank", "noopener,noreferrer")); else open.remove();
  const copy = fragment.querySelector(".copy-event");
  copy.textContent = t("copy");
  copy.addEventListener("click", async () => { await navigator.clipboard.writeText(event.data); copy.textContent = t("copied"); });
  fragment.querySelector(".event-kind").textContent = event.openUrl ? t("eventUrl") : t("eventText");
  $("#event-list").prepend(fragment);
  $("#empty-inbox").hidden = state.events.size !== 0;
  return true;
}

function refreshEventCopy(event) {
  const item = document.querySelector(`[data-event-id="${CSS.escape(event.id)}"]`);
  if (!item) return;
  item.querySelector(".event-kind").textContent = event.openUrl ? t("eventUrl") : t("eventText");
  item.querySelector(".event-time").textContent = new Intl.DateTimeFormat(state.preferences.locale === "ja" ? "ja-JP" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt));
  const copy = item.querySelector(".copy-event"); if (copy) copy.textContent = t("copy");
  const open = item.querySelector(".open-event"); if (open) open.textContent = t("open");
}

function showForegroundNotification(event) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification("QR Scan", { body: t("notificationForeground"), tag: `qr-scan-handoff:${event.id}`, renotify: false }); } catch { /* Inbox is the visible fallback. */ }
}

async function receiveHandoff(event) { if (!event?.id) return; if (addEvent(event)) showForegroundNotification(event); await acknowledgeEvent(event.id, event.expiresAt); }

async function acknowledgeEvent(eventId, expiresAt = Date.now() + 10 * 60 * 1000) {
  if (!state.credential || typeof eventId !== "string" || !eventId) return;
  try {
    await api(`/api/v1/pairs/${state.credential.code}/ack`, { method: "POST", body: { eventId } });
    const pending = state.pendingAcks.get(eventId); if (pending) window.clearTimeout(pending.timer); state.pendingAcks.delete(eventId);
  } catch { scheduleAckRetry(eventId, expiresAt); }
}

function scheduleAckRetry(eventId, expiresAt) {
  if (!state.credential || state.pendingAcks.has(eventId)) return;
  const expiresAtMs = typeof expiresAt === "number" && expiresAt > Date.now() ? expiresAt : Date.now() + 10 * 60 * 1000;
  const retry = () => {
    const pending = state.pendingAcks.get(eventId); if (!pending || !state.credential) return;
    if (Date.now() >= pending.expiresAt) return state.pendingAcks.delete(eventId);
    pending.attempt += 1; void acknowledgeEvent(eventId, pending.expiresAt);
    if (state.pendingAcks.has(eventId)) pending.timer = window.setTimeout(retry, Math.min(30_000, 1_000 * 2 ** pending.attempt));
  };
  state.pendingAcks.set(eventId, { attempt: 0, expiresAt: expiresAtMs, timer: window.setTimeout(retry, 1_000) });
}

async function requestNotifications() {
  if (!state.credential) return setNotificationStatusKey("notificationNeedPair", true);
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setNotificationStatusKey("notificationUnsupported", true);
  const buttons = [$("#notification-button"), $("#settings-notification-button")];
  buttons.forEach((button) => { button.disabled = true; });
  setNotificationStatusKey("notificationPreparing");
  try {
    const permission = await Notification.requestPermission();
    const permissionState = notificationPermissionState(permission);
    if (!permissionState.continueSetup) return setNotificationStatusKey(permissionState.statusKey, permissionState.isError);
    const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
    const { publicKey } = await api("/api/v1/vapid-public-key");
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(publicKey) });
    await api(`/api/v1/pairs/${state.credential.code}/push-subscriptions`, { method: "POST", body: { subscription: subscription.toJSON() } });
    state.notification.enabled = true;
    state.notification.statusKey = "notificationReady";
    state.notification.status = "";
    state.notification.isError = false;
    renderNotificationControls();
  } catch (error) { setNotificationStatus(messageFor(error), true); } finally { buttons.forEach((button) => { button.disabled = false; }); }
}

async function refreshWebPushStatus() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    state.notification.supported = false;
    state.notification.enabled = false;
    state.notification.statusKey = "notificationUnsupported";
    state.notification.status = "";
    state.notification.isError = true;
    renderNotificationControls();
    return setNotificationStatusKey("notificationUnsupported", true);
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    registration?.active?.postMessage({ type: "retry-handoff-acks" });
    const subscription = await registration?.pushManager.getSubscription();
    state.notification.supported = true;
    state.notification.enabled = Boolean(subscription && Notification.permission === "granted");
    state.notification.statusKey = state.notification.enabled ? "notificationReady" : "";
    state.notification.status = "";
    state.notification.isError = false;
    renderNotificationControls();
  } catch { setNotificationStatusKey("notificationUnknown", true); }
}

function receiveExtensionBridge(event) {
  if (event.source !== window || event.origin !== location.origin || !event.data || event.data.source !== "qr-scan-extension") return;
  if (event.data.type === "ready") {
    if (!/^[a-p]{32}$/.test(event.data.extensionId ?? "")) return;
    state.extensionId = event.data.extensionId; state.connectorError = ""; renderConnector(); return;
  }
  if (event.data.type === "connector-result") {
    if (event.data.ok) { state.connectorError = ""; $("#connector-description").textContent = t("connectorConnecting"); window.setTimeout(() => { void syncConnector(); }, 250); }
    else { state.connectorError = extensionMessage(event.data.error); renderConnector(); }
  }
}

async function syncConnector() { if (!state.credential) return; const data = await api(`/api/v1/pairs/${state.credential.code}/connector-status`); state.connector = data.connector; renderConnector(); }
async function connectExtension() {
  if (!state.credential || !state.extensionId) return;
  try {
    state.connectorError = "";
    const link = await api(`/api/v1/pairs/${state.credential.code}/connector-link`, { method: "POST", body: { extensionId: state.extensionId } });
    window.postMessage({ source: "qr-scan-web", type: "connector-link", token: link.token, extensionId: state.extensionId }, location.origin);
    $("#connector-description").textContent = t("connectorConnecting"); window.setTimeout(() => { void syncConnector(); }, 2_000);
  } catch (error) { state.connectorError = extensionMessage(error instanceof Error ? error.message : "request_failed"); renderConnector(); }
}
async function disconnectExtension() { if (!state.credential || !state.connector?.extensionId) return; try { await api(`/api/v1/pairs/${state.credential.code}/connector-disconnect`, { method: "POST", body: { extensionId: state.connector.extensionId } }); state.connector = null; renderConnector(); } catch (error) { setPairStatus(messageFor(error), true); } }
async function revokePair() {
  if (!state.credential || state.credential.status !== "paired") return renderUnpaired(t("revokeNone"), true);
  if (!window.confirm(t("revokeConfirm"))) return;
  try { await api(`/api/v1/pairs/${state.credential.code}/revoke`, { method: "POST", body: {} }); renderUnpaired(t("revokeDone")); showView("inbox"); }
  catch (error) { setNotificationStatus(messageFor(error), true); }
}

function setPairStatus(message, isError = false) { const target = $("#pair-status"); target.textContent = message; target.classList.toggle("is-error", isError); }
function renderNotificationControls() {
  const buttons = [$("#notification-button"), $("#settings-notification-button")];
  buttons.forEach((button) => {
    button.hidden = !state.notification.supported;
    button.textContent = state.notification.enabled ? t("notificationEnabled") : t("notificationEnable");
  });
  const message = state.notification.statusKey ? t(state.notification.statusKey) : state.notification.status;
  [$("#notification-status"), $("#settings-notification-status")].forEach((target) => { target.textContent = message; target.classList.toggle("is-error", state.notification.isError); });
}
function setNotificationStatusKey(statusKey, isError = false) { state.notification.statusKey = statusKey; state.notification.status = ""; state.notification.isError = isError; renderNotificationControls(); }
function setNotificationStatus(message, isError = false) { state.notification.statusKey = ""; state.notification.status = message; state.notification.isError = isError; renderNotificationControls(); }
function authHeaders() { return { "X-QR-Role": "web" }; }
function loadCredential() { try { return JSON.parse(localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? "null"); } catch { localStorage.removeItem(key); sessionStorage.removeItem(key); return null; } }
function defaultLocale() { const locale = navigator.language.toLowerCase(); return locale === "en" || locale.startsWith("en-") ? "en" : "ja"; }
function loadPreferences() { try { const value = JSON.parse(localStorage.getItem(preferencesKey) ?? "{}"); return { theme: ["system", "light", "dark"].includes(value.theme) ? value.theme : "system", locale: ["ja", "en"].includes(value.locale) ? value.locale : defaultLocale() }; } catch { return { theme: "system", locale: defaultLocale() }; } }
function browserLabel() { return navigator.userAgent.includes("Mac") ? (state.preferences.locale === "ja" ? "Mac のブラウザ" : "Mac browser") : (state.preferences.locale === "ja" ? "このブラウザ" : "This browser"); }
function formatPairCode(code) { return typeof code === "string" && code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code; }
function remainingTime(expiresAt) { const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function base64UrlToUint8Array(value) { const padded = value + "=".repeat((4 - value.length % 4) % 4); const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
async function api(path, options = {}) { const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers ?? {}) }, body: options.body ? JSON.stringify(options.body) : undefined }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiMessage(data.error)); return data; }
function apiMessage(code) { return ({ rate_limited: t("rateLimited"), expired: t("expired"), unauthorized: t("unauthorized"), already_claimed: t("alreadyClaimed"), push_unavailable: t("pushUnavailable"), invalid_subscription: t("invalidSubscription"), link_expired: t("linkExpired") })[code] ?? t("genericError"); }
function extensionMessage(code) { return ({ link_expired: t("linkExpired"), push_unavailable: t("notificationUnsupported"), request_failed: t("connectorFailure") })[code] ?? t("connectorFailure"); }
function messageFor(error) { return error instanceof Error ? error.message : t("genericError"); }
