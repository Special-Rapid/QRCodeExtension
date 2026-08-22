declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    PAIR_DO: DurableObjectNamespace<import('../src/index').PairingRoom>;
  }
}
