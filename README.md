# QR Scan

カメラを使わず、Chromeで表示中のQRコードやローカル画像のQRコードを読み取るChrome拡張です。解析はすべて端末内で完結し、カメラ権限や外部サーバーは使いません。

## できること

- 表示中タブの見えている範囲をワンクリックでスキャン
- PNG / JPEG / WebP / GIF画像を選んでスキャン
- 読み取り結果をコピー、HTTP(S) URLなら新しいタブで開く

## 開発・読み込み

```sh
npm install
npm run check
```

Chromeの `chrome://extensions` でデベロッパーモードを有効にし、「パッケージ化されていない拡張機能を読み込む」から `dist/` を選択してください。

## プライバシー

カメラにはアクセスしません。「このページをスキャン」は、ユーザー操作後にアクティブタブの可視領域だけを一時キャプチャして端末内で解析します。画像を含むデータは送信・保存しません。

## プロジェクト構成

- `src/`: Chrome上のQRコードをカメラなしで読むManifest V3拡張
- `apps/mobile/`: iOS／Android共通のQR・バーコードスキャナー。PC連携のコード入力と安全な送信機能を含む
- `apps/handoff/`: `qr-handoff` Cloudflare Worker、D1、Durable Object、PCのWeb受信箱

Chrome拡張は「拡張機能のオプション」からスマホとの連携コードを作成できます。連携後は、拡張の受信箱とOS通知に読み取り結果が届きます。通知をクリックしてもリンクは開かず、受信箱で表示内容を確認してから開く仕様です。

`apps/handoff`はローカル検証済みです。Workerは`qr.snkisk.com`のCustom Domainだけで公開し、`workers.dev`とPreview URLは設定ファイルで無効化します。VAPIDによるバックグラウンドWeb Pushはまだ行っていません。
