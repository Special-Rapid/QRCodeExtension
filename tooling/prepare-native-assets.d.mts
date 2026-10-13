interface NativeAssetFields {
    sha256: unknown;
    bytes: unknown;
    mime: unknown;
    url: unknown;
    destinations: unknown;
}
interface PreparationOptions {
    root?: string;
    lock?: unknown;
    cacheDir?: string;
    offline?: boolean;
    fetchImpl?: typeof fetch;
}
export declare const repositoryRoot: string;
export declare function validateLock(lock: unknown): NativeAssetFields[];
export declare function prepareNativeAssets({ root, lock, cacheDir, offline, fetchImpl }?: PreparationOptions): Promise<{
    objects: number;
    destinations: number;
    offline: boolean;
}>;
export {};
