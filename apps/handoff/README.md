# QR Handoff Worker

`qr-handoff` は、スマホで読み取ったQRコード・バーコードの値を、ペアリング済みPCのWeb受信箱へ渡すCloudflare Workerです。

## ローカル確認

```sh
npm install
npx wrangler d1 migrations apply DB --local
npm run check
npm run dev -- --local
```

ブラウザは `http://localhost:8787` を開きます。ローカルHTTPではCookieの`Secure`属性を外しますが、本番HTTPSでは必ず`HttpOnly; Secure; SameSite=Strict`になります。

## 本番に必要なCloudflare設定

- Worker名: `qr-handoff`
- D1 binding: `DB`
- D1 ID: `47ec50ec-4820-4bb1-b4fb-dbcba5407978`
- D1名: `qr-handoff-prod` を前提にしています。Dashboardで異なる名前なら、デプロイ前に `wrangler.jsonc` を修正してください。
- Durable Object binding: `PAIR_DO` (`PairingRoom`)

本番マイグレーションとWorkerデプロイは、必ず次の順で実行します。

```sh
npm run deploy:production
```

`main` のみがこのコマンドを実行するWorkers Builds構成にします。非本番ブランチは本番D1へマイグレーションを適用してはいけません。

## DNSと通知

`qr.snkisk.com`には既存DNSレコードがあるため、このリポジトリはCustom Domainをまだ設定しません。最初のデプロイ後に現在のDNSの用途を確認してから接続します。

開いたWeb受信箱にはDurable Object WebSocketで新着が届きます。タブを閉じた状態でも届くWeb Pushは、VAPID鍵をCloudflare secretとして登録してから追加します。秘密鍵やトークンはGitへ入れません。
