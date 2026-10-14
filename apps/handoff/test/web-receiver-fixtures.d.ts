// 固定service-worker scriptをnew Functionで実行するテスト専用fixture。
// 実CacheStorage/Fetch/Notification APIの完全実装や製品入力schemaとは扱わない。
export interface WorkerFixtureEvent {
  data?: { json(): unknown };
  notification?: { data: Record<string, string>; close(): void };
  waitUntil(promise: Promise<unknown>): void;
}
export type WorkerFixtureHandler = (event: WorkerFixtureEvent) => void;
export interface NotificationFixtureOptions { tag: string; renotify?: boolean }
export interface NotificationFixture { title: string; options: NotificationFixtureOptions }
export interface WorkerFixtureScope {
  addEventListener(type: string, handler: WorkerFixtureHandler): void;
  registration?: {
    showNotification(title: string, options: NotificationFixtureOptions): Promise<void>;
    sync: { register(): Promise<void> };
  };
  location: { origin: string };
  clients: { matchAll(): Promise<unknown[]>; openWindow(url: string): Promise<void> };
}
export type WorkerFixtureExecutor = (scope: WorkerFixtureScope) => void;
// testが一時的に置換する値は部分fixture。native API型へ偽装せずunknownで受ける。
export interface WorkerFixtureGlobals { caches: unknown; fetch: unknown }
