# 画像生成と資産準備の編集元

`src/` の3つのTypeScript moduleを編集し、rootの `npm run build:tooling` でstrict型検査後に、このフォルダーの同名MJSと実source由来の型宣言を生成します。型エラー時はemitしません。既存のTypeScript/compilerをextensionのlocked dependencyから使います。生成MJSや宣言を直接修正しません。CIの `npm run check:tooling` は、空の一時領域から生成した全出力と公開位置の集合・byte・台帳・Git追跡状態/差分を照合します。追加・rename・削除に伴う孤立出力やuntracked/ignored生成物も拒否します。

rootの画像生成・brand/native準備・asset検査は先にbuildします。native/CLI/standaloneの既存呼出しは同じMJS配布入力を使い、MTS編集元を直接実行しません。生成物を追跡して、native側やpngjsだけを用意したstandalone環境でも既存のJavaScript入力を使えるようにします。

アイコンの正本は `assets/brand/qr-scan-icon.svg` です。`generate-brand-assets` は既存9つのSVG/PNG/Android vector派生物を生成し、`--check` はSVG/vectorのbyte、PNGの寸法と全pixelを照合します。source/サイズ/alpha/配布先/見た目を変えません。派生画像を直接編集しません。

`prepare-native-assets` は既存lockのURL/size/MIME/hash/path検査と外部Cacheを使います。全inputを検証してからbundle inputに触れ、各pathはtemporary fileからrenameします。失敗時の未到達・保持・次回再実行を保ち、全bundleのACIDや途中IO失敗のrollbackは追加しません。未知lock/例外の葉への型投影は既存アクセスを記述するだけで、新しいvalidationやschema保証を追加しません。

既存assetテスト2つのsourceは親Issue #15の後続型移行対象です。CDN upload、実native build、端末、署名keyや本番操作はこの型移行の範囲外です。

`build-tooling.mts` もstrict型検査の対象です。Node.js 22.18以降でrunnerを起動し、root/extensionの既存locked TypeScriptを使います。3moduleは空の一時領域へ生成し、型検査と全出力読取りを終えてから、生成物台帳 `generated-files.json` の所有範囲だけを反映します。MJS/宣言は平坦な同名pairにします。台帳外の既存候補やsymlinkは変更しません。型エラーは既存出力を保持し、source削除後に残る所有済み旧出力は生成成功後だけ取り除きます。反映前に台帳へ旧・新出力の所有範囲の和集合を登録し、各pathのrename後に確定した期待集合を最後に保存します。source追加/rename中の部分出力も、登録済み所有範囲から同じ編集元で再生成できます。固定checkout・単一builderの前提で、全集合のACIDは主張せず、途中失敗はcheckで検出し同じ編集元から再実行します。
