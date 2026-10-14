# WebのTypeScript編集元

現在は `notification-state.ts` が通知許可の状態判定を持ちます。permissionはunknownとして受け、既存のgranted比較後に、このmodule自身が作る状態を返します。新しい入力検証や言語切替は追加しません。

`npm run build:web` を `apps/handoff` で実行すると、`tsconfig.web.json` のstrict型検査を経て `public/notification-state.js` を生成します。型エラー時はemitせず、test前とWranglerのcustom buildでも同じ生成を行います。ブラウザーはJavaScriptを必要とするため、配布JSは小さな生成物として追跡し、編集元はこのフォルダーのTypeScriptに統一します。生成物を直接修正しません。CIは全check後に、この配布JSのGit差分がないことを確認して、編集元と追跡した生成物の不一致を拒否します。

`app.ts` もstrict型検査から `public/app.js` を生成します。ブラウザーの `/notification-state.js` importは保持し、型検査時だけ同じTypeScript編集元へ解決します。配布URLと既存のpublic assetsを維持し、このsourceフォルダーやprivate資料をassetsとして配信しません。

本コマンド開始時のWeb型エラーは、`deploy:production` のlocal buildでDB migrationとWorker deployに到達する前に拒否します。固定checkout内でbuild→既存migration→既存deployの順を守る前提であり、DBと公開を跨ぐACIDやremote失敗時のrollbackを追加したものではありません。

`service-worker.ts` は `tsconfig.worker.json` のWebWorker型・strict検査で同じ `public/service-worker.js` に生成します。classic script形式を保つためmoduleや新しいstrict directiveを出力しません。配布URL・登録手順は保持します。3つの生成物をtest前・Wrangler build・CI同期確認の対象にします。

ACK Cacheはpair codeとevent IDを保存する再試行記録の正本です。読み取り本文・URLは保存しません。送信成功時に削除し、失敗時はSyncまたは受信箱起動の再試行へ残します。既存キーの置換、server側event IDの冪等性、通知クリック時のsame-origin認証取得とHTTP(S)限定を保持します。未検証JSONのpropertyと標準API引数への型投影は既存coercionを記述するだけで、新規検証や跨storeのACIDを主張しません。

appのcredential/API/storage/bridgeは未検証値として扱い、型投影は既存propertyアクセスと標準APIのcoercionを記述するだけです。固定HTML要素とこのmoduleが作るstate/Map/タイマーの型を分け、server認証・ACK重複抑制・成功時のretry取消/失敗時の期限とbackoff・連携解除後の片付けを保持します。HTML/CSS・日本語/英語辞書・表示・状態遷移・操作を変えません。
