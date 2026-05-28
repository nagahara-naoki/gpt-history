# Changelog

本ファイルは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) 形式に従い、
バージョニングは [セマンティックバージョニング](https://semver.org/lang/ja/) に従います。

## [Unreleased]

### Changed
- 履歴ナビゲーション対象を「現在開いているチャット」に限定
- `chrome.storage.local` による履歴の永続保存を廃止
- チャット切替時に前チャットの一時履歴を即時クリア
- 表示中チャットの DOM 変更を監視し、開いたチャットの履歴を素早く取得

## [0.1.0] - 2026-05-28

### Added
- 初回リリース (MVP)
- ChatGPT 入力欄での `↑` / `↓` キーによる送信履歴ナビゲーション
- メッセージ送信時の自動履歴保存 (上限 1000 件、連続重複・空文字は除外)
- カーソルが先頭行・末尾行にあるとき (または空欄のとき) だけ矢印キーを奪う制御
- `↓` で末尾を超えたときの編集前バッファ復元
- `chrome.storage.local` への完全ローカル保存 (外部送信なし)
- TypeScript (strict) + Vite + @crxjs/vite-plugin + Biome のビルド構成
