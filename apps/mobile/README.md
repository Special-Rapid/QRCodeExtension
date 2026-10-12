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

## 契約テストの型検査

`test/*.test.mts` の既存3テストを `tsconfig.test.json` のstrict検査へ含めます。Node用の型環境はアプリのExpo設定から分けます。固定repoファイルを読むpathをstringで表し、既存の10回帰とassertionを保持します。Node.js 22.18以降で `npm run check` を実行してください。これらのソース契約テストは、実機のカメラ・Share Sheet・Control Center・Quick Settingsの受入確認とは別です。
