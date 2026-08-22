import { isSafeOpenUrl } from "./handoff-client.js";

const $ = (selector) => document.querySelector(selector);
const sections = { unpaired: $("#unpaired"), pending: $("#pending"), inbox: $("#inbox") };
let state = { credential: null, events: [] };

$("#create").addEventListener("click", () => run("handoff.create"));
$("#restart").addEventListener("click", () => run("handoff.create"));
$("#confirm").addEventListener("click", () => run("handoff.confirm"));
$("#refresh").addEventListener("click", () => run("handoff.status"));
$("#revoke").addEventListener("click", () => run("handoff.revoke"));
void run("handoff.status");

async function run(type) {
  try {
    const response = await chrome.runtime.sendMessage({ type });
    if (!response?.ok) throw new Error(response?.error ?? "PC連携を完了できませんでした。");
    state = response.state;
    render();
  } catch (error) { setStatus(error instanceof Error ? error.message : "PC連携を完了できませんでした。", true); }
}

function render() {
  const credential = state.credential;
  Object.values(sections).forEach((section) => { section.hidden = true; });
  if (!credential) return void (sections.unpaired.hidden = false);
  if (credential.status !== "paired") {
    sections.pending.hidden = false;
    $("#code").textContent = credential.code;
    $("#phrase").textContent = credential.phrase;
    $("#expires").textContent = `有効期限: ${new Date(credential.expiresAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
    $("#confirm").disabled = !credential.peerConfirmed || credential.selfConfirmed;
    setStatus(credential.peerConfirmed ? "スマホ側のフレーズを見比べてから、このPCで確認してください。" : "スマホアプリでコードを入力してください。");
    return;
  }
  sections.inbox.hidden = false;
  $("#device").textContent = `${credential.peerLabel ?? "スマホ"} と連携済みです。`;
  const events = $("#events");
  events.replaceChildren(...state.events.map(renderEvent));
  $("#empty").hidden = state.events.length !== 0;
  const requested = new URLSearchParams(location.hash.slice(1)).get("event");
  if (requested) document.getElementById(`event-${requested}`)?.scrollIntoView({ block: "center" });
}

function renderEvent(event) {
  const item = document.createElement("li"); item.className = "event"; item.id = `event-${event.id}`;
  const title = document.createElement("strong"); title.textContent = event.host ?? "テキスト・バーコード";
  const value = document.createElement("code"); value.textContent = event.data;
  const actions = document.createElement("div"); actions.className = "event-actions";
  if (isSafeOpenUrl(event.data)) { const open = document.createElement("button"); open.textContent = "リンクを開く"; open.addEventListener("click", () => chrome.tabs.create({ url: event.data })); actions.append(open); }
  const copy = document.createElement("button"); copy.textContent = "コピー"; copy.addEventListener("click", () => navigator.clipboard.writeText(event.data)); actions.append(copy);
  item.append(title, value, actions); return item;
}

function setStatus(message, error = false) { const status = $("#status"); status.textContent = message; status.style.color = error ? "#b42318" : ""; }
