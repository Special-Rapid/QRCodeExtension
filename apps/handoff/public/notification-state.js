export function notificationPermissionState(permission) {
  if (permission === "granted") return { continueSetup: true, message: "", isError: false };
  return { continueSetup: false, message: "通知は許可されませんでした。ブラウザ設定から許可できます。", isError: true };
}
