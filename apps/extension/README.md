# Chrome拡張機能

カメラを使わず、現在のWebページURLとページ内QRを扱うManifest V3拡張です。機能とローカル起動の説明は [ルートREADME](../../README.md) を参照してください。

## TypeScriptへの段階移行

URL検証と現在タブURL取得の編集元は `src/safe-url.ts` と `src/current-url.ts` です。画像読み取りの編集元 `src/qr-decoder.ts` も、pixel入力・領域・検出座標・結果をstrict型検査へ含めます。設定画面の編集元 `src/options.ts` と `src/chrome.d.ts` は、固定DOMと自己extensionのruntime message応答を型検査します。connectorの内容は `unknown` のまま保持し、既存の存在判定だけを行います。新規canvasの2D contextを使う既存の前提は型注釈でも維持し、runtimeの失敗処理を変更しません。`npm run typecheck` でこの段階のTypeScript source・テストを厳格に検査し、`npm run check` でbundleと回帰テストも確認します。Node.js 22.18以降で実行してください。

Chromeへ配布するJavaScriptは既存esbuildから生成する `dist/` 内の成果物です。生成元を編集し、配布物を直接編集しないでください。他のJavaScript source/scripts/testsは親Issue #15の後続段階で移行し、移行完了済みとは扱いません。

作業記録・状態表・検証証跡は非公開のローカル `docs/` に保存し、stage・commit・push・公開配信しません。専用worktreeではprimary checkoutの既存記録を更新して読み戻し、公開PRでは実読による確認結果だけを要約します。非公開記録本体を公開差分へ追加しません。
