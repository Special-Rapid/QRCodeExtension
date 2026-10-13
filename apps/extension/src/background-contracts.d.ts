// このbackgroundが使うChrome/worker APIの範囲。外部JSON/storageの検証済みschemaではない。
export interface ListenerEvent<Args extends unknown[], Result = void> {
  addListener(listener: (...args: Args) => Result): void;
}
export interface BackgroundChrome {
  runtime: {
    id: string;
    getURL(path: string): string;
    onStartup: ListenerEvent<[]>;
    onInstalled: ListenerEvent<[]>;
    onMessage: ListenerEvent<[unknown, unknown, (response: unknown) => void], boolean>;
  };
  alarms: {
    onAlarm: ListenerEvent<[{ name: string }]>;
    create(name: string, options: { when: number }): void;
    clear(name: string): Promise<unknown>;
  };
  notifications: {
    onClicked: ListenerEvent<[string]>;
    create(id: string, options: { type: "basic"; title: string; message: string; iconUrl: string }): Promise<unknown>;
  };
  tabs: { create(options: { url: string }): Promise<unknown> };
  storage: { local: {
    get(key: string): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
  } };
}
export interface BackgroundPushEvent {
  data?: { json(): unknown } | null;
  waitUntil(promise: Promise<unknown>): void;
}
export interface MessageProjection { type?: unknown; token?: unknown; extensionId?: unknown }
export interface PayloadProjection { type?: unknown; eventId?: unknown }
export interface ConnectorProjection { id: unknown; code: unknown; token: unknown }
export interface ResponseProjection { publicKey?: unknown; connector?: unknown; events?: unknown; error?: unknown }
export interface EventProjection { id?: unknown; data?: unknown }
export interface PendingAckInput { connectorId?: unknown; code?: unknown; eventId?: unknown; expiresAt?: unknown }
export interface PendingAckWrite { connectorId: unknown; code: unknown; eventId: string; expiresAt: number }
export interface ValidatedPendingAck extends PendingAckWrite { connectorId: string; code: string }
export type AckMutation = (records: PendingAckWrite[]) => PendingAckWrite[] | null | Promise<PendingAckWrite[] | null>;
export interface ApiOptions { method?: string; headers?: Record<string, string>; body?: unknown }
// 既存JavaScriptのcoerce-or-throw呼出しを表す。入力の検証済み宣言ではない。
export type LegacyUriEncoder = (value: unknown) => string;
export type LegacyJsonParser = (value: unknown) => unknown;
export type LegacyErrorConstructor = new(message?: unknown) => Error;
export interface LengthProjection { length: unknown }
