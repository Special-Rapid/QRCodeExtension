# Chrome拡張機能

カメラを使わず、現在のWebページURLとページ内QRを扱うManifest V3拡張です。機能とローカル起動の説明は [ルートREADME](../../README.md) を参照してください。

## TypeScriptへの段階移行

URL検証と現在タブURL取得の編集元は `src/safe-url.ts` と `src/current-url.ts` です。画像読み取りの編集元 `src/qr-decoder.ts` も、pixel入力・領域・検出座標・結果をstrict型検査へ含めます。設定画面の編集元 `src/options.ts` と `src/chrome.d.ts` は、固定DOMと自己extensionのruntime message応答を型検査します。connectorの内容は `unknown` のまま保持し、既存の存在判定だけを行います。新規canvasの2D contextを使う既存の前提は型注釈でも維持し、runtimeの失敗処理を変更しません。`npm run typecheck` でこの段階のTypeScript source・テストを厳格に検査し、`npm run check` でbundleと回帰テストも確認します。Node.js 22.18以降で実行してください。

Chromeへ配布するJavaScriptは既存esbuildから生成する `dist/` 内の成果物です。生成元を編集し、配布物を直接編集しないでください。他のJavaScript source/scripts/testsは親Issue #15の後続段階で移行し、移行完了済みとは扱いません。

作業記録・状態表・検証証跡は非公開のローカル `docs/` に保存し、stage・commit・push・公開配信しません。専用worktreeではprimary checkoutの既存記録を更新して読み戻し、公開PRでは実読による確認結果だけを要約します。非公開記録本体を公開差分へ追加しません。

既存manifestの回帰テスト `test/manifest.test.mts` もstrict型検査の対象です。自己repoの固定manifestを読むテスト用構造を明示し、権限・対応Chrome版・配布ファイルのassertionを保持します。この構造宣言は外部JSONのruntime検証には使いません。

画像decoderの既存回帰テスト `test/qr-decoder.test.mts` もstrict型検査へ含めます。`test/fixture-libraries.d.ts` はfixtureで使うQR生成・PNG pixel APIの範囲を宣言し、テストのassertionと実行内容は保持します。

extensionの既存回帰テストはすべて`.mts`でstrict型検査します。popupとbackgroundの代替DOM/Chrome/workerはfixture専用の構造で表し、本物のブラウザーAPIの完全実装とは扱いません。brand-assetsテストが使う未移行generatorのexport範囲は`tooling/generate-brand-assets.d.mts`で宣言しています。generator実装自体の型移行は親Issue #15の後続対象です。

popupの編集元 `src/popup.mts` は、固定HTMLのDOM、設定のmembership判定、表示状態、QR結果、Chrome tabs/storageとQR生成libraryの使用範囲をstrict型検査へ含めます。`src/qrcode-browser.d.ts` は使用するPromise版だけを宣言します。保存値は `unknown` として受け、既存の判定後だけ設定値へ絞ります。固定HTMLのdatasetとFileReaderのreadAsDataURL成功値への型注釈は、runtime検証の追加ではありません。配布先 `dist/popup.js` と挙動を維持します。
