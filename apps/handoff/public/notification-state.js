export function notificationPermissionState(permission) {
  if (permission === "granted") return { continueSetup: true, statusKey: "", isError: false };
  return { continueSetup: false, statusKey: "notificationDenied", isError: true };
}
