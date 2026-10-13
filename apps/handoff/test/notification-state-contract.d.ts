// 未移行public moduleのテスト使用exportだけ。実装の型検査・外部入力validationではない。
// 追加引数は従来JavaScriptが無視する範囲で、言語切替を行う契約ではない。
declare module "*/public/notification-state.js" {
  export function notificationPermissionState(permission: unknown, ...ignored: unknown[]): {
    continueSetup: boolean;
    statusKey: string;
    isError: boolean;
  };
}
