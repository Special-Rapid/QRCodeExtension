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

## ブランド画像

`assets/brand/qr-scan-icon.svg`はブランド生成の正本です。Chrome拡張・native用の必須アイコンは引き続きローカル生成・同梱します。Web受信箱のfaviconとロゴは、同じ生成済み128px PNGを`images.snkisk.com`から配信するため、handoffの公開ディレクトリにはコピーを生成しません。ブランドを更新する際は新しい配信用PNGを公開してから、favicon・ロゴのURLとブランド契約テストを一緒に更新してください。

## CI と配布ビルド

GitHub Actionsの`Verify`は、PR・`main`へのpush・手動実行時に、アプリ、tooling、lockfile、workflow自体が変わった場合だけ`npm run check`を実行します。`docs/`だけの変更では起動せず、同じPRまたはbranchへ新しいcommitが来た場合は古いverifyを取消します。

iOS/Androidの配布バイナリは、pushごとには作りません。Expo GitHub Appでこのrepositoryをモバイルprojectへ接続し、base directoryを`apps/mobile`に設定したうえで、必要なPRに次のラベルを付けます。

- `eas-build-android:preview` — Android internal preview
- `eas-build-ios:preview` — iOS internal preview
- `eas-build-all:preview` — 両platformのinternal preview

production build / store submitは、SemVerのversion tagを作成したrelease candidateだけで、EAS dashboardまたは明示的なEAS workflowから実行します。通常の`main` pushをproduction buildのトリガーにはしません。

## License

This project is licensed under the [MIT License](LICENSE).


### ビルド用画像とGit

編集用正本`assets/brand/qr-scan-icon.svg`とIcon Composerの編集用SVG、inline SVGはソースとして版管理します。PNG・派生SVG・生成Android vector XMLのコピーはGitに保存せず、build前に既存パスへ生成・復元します。最終extension/native配布物には従来どおり画像を同梱し、アプリ起動時にCDNへ取りに行きません。iOS実プロジェクトのIcon Composer定義とExpo設定側の定義は、この移行では変更しません。

```sh
npm ci
npm --prefix apps/handoff ci
npm --prefix apps/mobile ci
npm run prepare:native-assets
npm run check
```

`tooling/native-assets.lock.json`は確認済みCDN URL、SHA-256、bytes、MIME、同梱先を固定します。取得はHTTPSの`images.snkisk.com/QRCodeExtension/`のみでredirectを許可せず、全入力を検証してから同梱先へ書き込みます。HTTP/MIME/サイズ/hash不一致や未公開URLではbuildを停止します。既存の未追跡画像をfallbackに使いません。25個のAndroid `.webp`パスは元からPNG bytesのため、既存byteとパスを保持しています。

cacheはGit外の`~/.cache/qr-scan/sha256`です。`QR_ASSET_CACHE_DIR`で別のGit外ディレクトリを指定できます。オンライン準備を一度行ったcacheを使うと、画像についてネットワーク不要で同じbyteを復元できます。

```sh
QR_ASSETS_OFFLINE=1 npm run prepare:native-assets
# または node tooling/prepare-build-assets.mjs --native --offline
```

依存packageのインストール用cacheは別途必要です。cache未準備・破損では安全に停止します。破損したhashファイルは原因確認後に明示的に除去し、オンライン準備をやり直してください。PNG原本は確定URLとhashを更新せず上書きしません。ブランド更新では正本・固定原本・生成recipe・配布物の確認を一緒に行います。

root CI、mobileのnpm postinstall（EAS prebuild前）とstart/android/ios/web/check、EAS post-install、直接Gradle preBuild、Xcodeのresource compile前に準備を接続しています。extension build/testはCDN不要で正本SVGから生成します。`npx expo`を直接実行する場合は先に`npm run prepare:native-assets`を行ってください。cacheと入力を揃えたclean checkoutで、生成のpixel/dimensionsと固定入力の完全hashを確認します。
