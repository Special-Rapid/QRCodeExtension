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

## WebのQR読み取り

[Issue #6](https://github.com/Special-Rapid/QRCodeExtension/issues/6)の「読み取る」画面は連携なしでも使えます。カメラはHTTPS/localhostとブラウザ許可が必要で、非対応・拒否・カメラなしの場合は画像選択を使います。映像・画像を送信せず、結果はコピーまたはHTTP(S)リンクを明示して開きます。結果後は停止し、次の読取を再開します。離脱・非表示・停止中に解決した権限要求の映像も解放します。

`public/scan-decoder.js`は拡張と同じjsQRデコーダーを同梱した生成済みコードです。rootの依存を用意して`node apps/handoff/scripts/build-scanner.mjs`で再生成します。実カメラ、Safari/Firefoxの実機は未検証です。

表示言語は日本語/英語、未保存時はOS localeのexact/base一致、それ以外は日本語です。手動言語・System/Light/DarkはlocalStorageに保存し、画面遷移やreloadなしで切り替えます。SystemはOSのappearance変更に追従し、色は共有semantic token、browser theme-colorは解決したcanvas色を使います。Webに標準のOS accent-color取得APIはないため非適用です。RTL localeは現在サポートしていません。

映像領域の`--camera-canvas`は映像未到着時の黒背景を定義する共通tokenです。

同梱jsQRの著作権・Apache-2.0本文は`public/jsqr-LICENSE.txt`に保持し、再生成時にコピーします。

## 双方向の端末連携（Issue #7）

直接承認した端末関係だけをD1 `peer_links`へ保存し、推移的な共有を作りません。端末一覧と送信宛先は認証済みidentityから算出し、自己送信を禁止します。両側確認を済ませた1行の関係だけが配送権限です。D1のunique/conditional writeと、既存DO namespace内の専用peer keyで操作を直列化します。旧receivers/pairingsを削除せず、既存のスマホfanout/connector APIを保持します。

配送は宛先ごとに期限10分のqueueとrequestId receiptをDOへatomic putし、同じrequestIdの再送は重複を作りません。複数宛先は分散transactionではなくpartial結果を返す回復可能workflowです。同じrequestId/宛先でretryします。読取時に現在の関係と生成時linkIdを確認し、解除後の再連携でも古いqueueを返しません。受信から自動転送せず、自己echo/ループを作りません。

Webは2秒pollで前景受信します。既存VAPID設定と明示許可がある場合は閉じたWebへgeneric Pushを配送し、payload/URLは認証後に解決します。登録先はChrome/Firefox/Safariの標準Pushホストに限定します。OSやタブ停止で通知時刻は保証されません。アプリは前景受信と端末内通知表示に対応し、native背景Push基盤は未実装です。実機通知は未検証です。

`0003_peer_links.sql`はadditive migrationで、v1 APIの意味を保持します。production適用は範囲外です。旧アプリ実機とのcompatibility、support window、store配信、Access保護されたrelease-control planeは未確認で、mobile release-readyとは扱いません。候補clientと既存v1の合成integrationを隔離DBで検証します。rollbackは旧client/APIへの復帰で、新tableを削除する必要はありません。
