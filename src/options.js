const status = document.querySelector("#status");
document.querySelector("#open-inbox").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "connector.open-inbox" });
});

void refresh();

async function refresh() {
  const response = await chrome.runtime.sendMessage({ type: "connector.get" });
  if (!response?.ok) return;
  status.textContent = response.state.connector
    ? "高速通知コネクタとして接続済みです。通知を押すとURLは直接開き、文字列はWeb受信箱を開きます。"
    : "スマホ連携と通知設定は qr.snkisk.com で行います。";
}
