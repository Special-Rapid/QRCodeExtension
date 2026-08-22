# QR Scan Mobile

iPhoneとAndroidで動くQR／バーコードスキャナーです。カメラ画像は端末内で解析し、URLは確認後にだけ開きます。

## 開発

```sh
npm install
npm run check
./script/build_and_run.sh
```

Expo Goで表示されたQRコードを読み取ると、iOS／Androidの実機で起動できます。直接起動する場合は `--ios` または `--android` を渡してください。

## EASビルド

`eas.json` にdevelopment／preview／productionプロファイルを用意しています。Expoへログイン後、次のコマンドでビルドできます。

```sh
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
```

初回のEASプロジェクト初期化、Apple Developer・Google Play Consoleの資格情報、ストア提出情報はユーザー所有のアカウントで設定してください。
