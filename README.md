# QR Scan

QRコードをカメラなしで読み取るChrome拡張と、スマホで読んだコードをペアリング済みPCへ渡すためのモバイル／Web受信箱をまとめたプロジェクトです。

## できること

### Chrome拡張

- 表示中タブの可視領域にあるQRコードを、ポップアップを開くだけでスキャン
- PNG・JPEG・WebP・GIF画像からQRコードをスキャン
- 読み取り結果をコピーし、HTTP(S) URLだけを明示操作で新しいタブに開く
- カメラ権限や全サイトへの常時アクセスを要求せず、スキャンは端末内で実行

### モバイルとPCの連携

- iOS／AndroidでQRコード・バーコード・印刷されたURLを検出
- 複数候補では送信する1件を選択し、ペアリング済みPCへ明示的に渡す
- PCのWeb受信箱または任意のChrome拡張コネクタで受信
- Web受信箱では内容と送信先ホストを確認してからURLを開く。非URL値はコピーのみ
- Chrome拡張コネクタの通知クリックでは、検証済みのHTTP(S) URLだけを直接開き、それ以外はWeb受信箱を開く

## プロジェクト構成

| パス | 内容 |
| --- | --- |
| `apps/extension/` | Manifest V3 Chrome拡張。カメラを使わないQRスキャンと任意の受信箱コネクタ。 |
| `apps/mobile/` | ExpoベースのiOS／Androidスキャナー。 |
| `apps/handoff/` | `qr.snkisk.com`向けのCloudflare Worker、D1、Durable Object、PCのWeb受信箱。 |

## Chrome拡張をローカルで試す

```sh
npm install
npm run check:extension
```

次にChromeで `chrome://extensions` を開き、デベロッパーモードを有効にして「パッケージ化されていない拡張機能を読み込む」から生成された `apps/extension/dist/` を選択します。

## セキュリティとプライバシー

- Chrome拡張のページ／画像スキャンは、ユーザー操作後に取得したデータを端末内だけで解析します。画像データは外部へ送信・保存しません。
- モバイルからPCへ渡す値は、明示的にペアリングした受信先だけに配信します。ペアリングは各画面で確認でき、いつでも解除できます。
- Web受信箱ではリンクを自動で開きません。HTTP(S) URLだけを表示し、確認後の操作で開きます。
- Chrome拡張の通知には、読み取った本文やURL全体を入れません。クリック時は、ペアリング済みイベントから検証済みのHTTP(S) URLだけを直接開きます。

## 開発

各コンポーネントの詳細は、それぞれのREADMEを参照してください。

- [モバイルアプリ](apps/mobile/README.md)
- [PC受信箱とWorker](apps/handoff/README.md)

## License

This project is licensed under the [MIT License](LICENSE).
