# QR Scan Mobile

iPhoneとAndroidで動くQR／バーコードスキャナーです。カメラ画像は端末内で解析し、URLは確認後にだけ開きます。

## 開発

```sh
npm install
npm run check
./scripts/build_and_run.sh
```

Expo Goで表示されたQRコードを読み取ると、iOS／Androidの実機で起動できます。直接起動する場合は `--ios` または `--android` を渡してください。

## EASビルド

`eas.json` にdevelopment／preview／productionプロファイルを用意しています。Expoへログイン後、次のコマンドでビルドできます。

```sh
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
```

初回のEASプロジェクト初期化、Apple Developer・Google Play Consoleの資格情報、ストア提出情報はユーザー所有のアカウントで設定してください。

### GitHub PRからのpreview build

Expo GitHub Appをこのrepositoryへ接続し、base directoryを`apps/mobile`にすると、PRへ`eas-build-android:preview`を付けてAndroid internal previewを作れます。通常のpushではmobile buildを作りません。iOSまたは両方をPR labelで起動する場合は、先に各platformの成功済みEAS buildと`preview.ios.image`を用意したうえで、`eas-build-ios:preview`または`eas-build-all:preview`を使います。

## 双方向端末連携

[Issue #7](https://github.com/Special-Rapid/QRCodeExtension/issues/7)ではPC連携画面から「端末連携」を開き、Web/アプリを短期コードと双方確認で追加します。直接連携した端末だけが一覧に入り、保存した送信先へ読み取り結果を送ります。未保存時は既存v1のスマホfanoutを保持し、空の選択を保存した場合は自動送信しません。受信は前景で行い、全画面から受信bannerを開けます。背景OS通知は未実装です。

SecureStoreの既存identityを再利用します。新しい連携の際に発行される端末credentialは機能内の認証情報で、production secret/configurationの新設ではありません。宛先設定と不確定な送信1件のretry ID/内容をSecureStoreへ保存し、成功時に削除します。pendingの有効期限は10分、次の読取時に期限・内容を確認し、別の送信に置換します。受信内容は最大100件・10分のメモリだけです。

API/schemaは追加型で旧clientの送信APIを保持します。本番migration、実機compatibility、native背景通知、store配布とserver enforced maintenance/update control planeは未確認です。Draftのlocal検証をrelease-readyと扱いません。System/Light/Dark、保存した日本語/英語とOS fallbackは既存PreferencesProviderに従い、端末画面の切替でinput/selectionを保持します。
