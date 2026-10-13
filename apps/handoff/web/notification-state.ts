export interface NotificationPermissionState {
  continueSetup: boolean;
  statusKey: "" | "notificationDenied";
  isError: boolean;
}

export function notificationPermissionState(permission: unknown): NotificationPermissionState {
  if (permission === "granted") return { continueSetup: true, statusKey: "", isError: false };
  return { continueSetup: false, statusKey: "notificationDenied", isError: true };
}
