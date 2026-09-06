import { describe, expect, it } from "vitest";
import { notificationPermissionState } from "../public/notification-state.js";

describe("Web notification permission state", () => {
  it("keeps a rejected permission visible instead of resuming setup", () => {
    expect(notificationPermissionState("denied")).toEqual({ continueSetup: false, statusKey: "notificationDenied", isError: true });
  });

  it("returns a localizable status key for a denied permission", () => {
    expect(notificationPermissionState("denied", "en")).toEqual({ continueSetup: false, statusKey: "notificationDenied", isError: true });
  });

  it("allows setup only after permission is granted", () => {
    expect(notificationPermissionState("granted")).toEqual({ continueSetup: true, statusKey: "", isError: false });
  });
});
