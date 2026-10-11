// 自己extensionのbackgroundが返す2種類の応答だけを宣言する。
// connectorの内容はここで検証せず、既存どおり存在だけを判定する。
type ConnectorMessage =
  | { type: "connector.get" }
  | { type: "connector.open-inbox" };

type ConnectorResponse =
  | { ok: true; state: { connector: unknown } }
  | { ok: false; error: string };

declare const chrome: {
  tabs: {
    query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Array<{ id?: number; windowId?: number; url?: string }>>;
    captureVisibleTab(windowId: number, options: { format: "png" }): Promise<string>;
    create(createProperties: { url: string }): Promise<unknown>;
  };
  storage: { local: {
    get(key: string): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
  } };
  runtime: {
    sendMessage(message: ConnectorMessage): Promise<ConnectorResponse | undefined>;
  };
};
