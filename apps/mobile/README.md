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

## ESLint設定の型検査とJS例外

`eslint.config.js` はExpo CLIの既存flat-config検出（JS/MJS/CJS）を保つためJavaScriptの編集元として残します。現在のlocked ESLintでTS設定を直接読む経路は追加loaderまたはnative TS用flagが必要です。TSへrenameして別のセットアップ経路を起動する変更は混ぜず、新しい依存・flag・生成builderも追加しません。

この設定を `tsconfig.eslint.json` のstrict `checkJs` / `noEmit`で型検査します。`npm run typecheck:eslint-config` が設定単体、`npm run typecheck` がappと設定の検査です。`npm run lint` は従来のExpo入口で同じ設定を読みます。配列の順序・ignore・rule・runtime実行は保持します。JSDocはESLintの実API型とlocked Expo flat-configの配列API範囲を表し、未知データのruntime validationを追加するものではありません。生成物ではないため設定自体を編集し、MJS/CJSの再生成は不要です。

`config-types/eslint-config-expo.d.ts` は、型宣言を同梱しないlocked `eslint-config-expo/flat` が返す設定配列だけを宣言します。ESLint本体の設定型を使い、vendorの内部実装全体や未知のJSONの安全性を保証しません。
