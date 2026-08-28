import { describe, expect, it } from "vitest";
import { notificationPermissionState } from "../public/notification-state.js";

describe("Web notification permission state", () => {
  it("keeps a rejected permission visible instead of resuming setup", () => {
    expect(notificationPermissionState("denied")).toEqual({
      continueSetup: false,
      message: "通知は許可されませんでした。ブラウザ設定から許可できます。",
      isError: true
    });
  });

  it("allows setup only after permission is granted", () => {
    expect(notificationPermissionState("granted")).toEqual({ continueSetup: true, message: "", isError: false });
  });
});
