// 自己extensionのbackgroundが返す2種類の応答だけを宣言する。
// connectorの内容はここで検証せず、既存どおり存在だけを判定する。
type ConnectorMessage =
  | { type: "connector.get" }
  | { type: "connector.open-inbox" };

type ConnectorResponse =
  | { ok: true; state: { connector: unknown } }
  | { ok: false; error: string };

declare const chrome: {
  runtime: {
    sendMessage(message: ConnectorMessage): Promise<ConnectorResponse | undefined>;
  };
};
