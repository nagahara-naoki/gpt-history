# コントリビューションガイド

このプロジェクトへのご関心ありがとうございます。
Issue や Pull Request は歓迎します。気軽に投げてください。

## Issue の出し方

以下の情報があると、修正がスムーズに進みます。

- 期待していた挙動
- 実際に起きた挙動
- 再現手順 (可能ならスクリーンショットや GIF)
- 環境情報 (OS, Chrome のバージョン, 拡張機能のバージョン)

ChatGPT 本体の UI 変更で動かなくなった、というケースは特に歓迎します。
その場合は、新しい入力欄要素・送信ボタン要素の CSS セレクタを教えてもらえると、`src/constants.js` への反映がすぐにできます。

## Pull Request の出し方

1. リポジトリを fork する
2. ブランチを切る (`git checkout -b fix/awesome-bug`)
3. 変更を加える
4. `pnpm check` でリンタとフォーマッタを通す (型チェックは `pnpm typecheck`)
5. コミット & プッシュ
6. PR を作成する

なお、本プロジェクトのパッケージマネージャは **pnpm** です。npm / yarn は使わないでください (lock ファイルの混在を避けるため `.gitignore` で除外しています)。
pnpm が未インストールの場合は `corepack enable` で有効化できます。

### コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/ja/) を推奨します (必須ではありません)。

例:
- `feat: ↑↓ キーで履歴をナビゲートする機能を追加`
- `fix: contenteditable で複数行入力時に末尾行判定が誤る不具合を修正`
- `docs: README にスクリーンショットを追加`

## コーディングスタイル

- 言語: **TypeScript** (strict モード有効、`tsconfig.json` に従う)
- フォーマット / リンタ: [Biome](https://biomejs.dev/) (`biome.json` の設定に従う)
- コメントは日本語で記述する (識別子は英語)
- public な関数 / クラスには TSDoc コメントを付ける
- 型は明示的に書く (戻り値型は省略可だが、公開 API では明示推奨)
- 1 ファイル 1 責任を守る
- マジックナンバーは `constants.ts` か各モジュール上部にまとめる

詳細は `実装要件.md` を参照してください。
(注: 実装要件は当初 JavaScript を想定していたが、本リポジトリでは TypeScript を採用している。)

## 動作確認

`docs/manual-test.md` に手動テストのチェックリストがあります。
PR を出す前に一通り通しておくと、レビューがスムーズです。
