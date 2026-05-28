// constants.ts
// アプリ全体で利用する定数を集約する責務を持つ。
// マジックナンバー禁止ポリシーに従い、調整候補となる値はすべてここに置く。

/**
 * 入力欄を特定するためのセレクタ候補。
 * 上から順に試し、最初にヒットしたものを採用する。
 * ChatGPT の DOM 変更で壊れた場合はここを増やす/差し替えるだけで済むようにしている。
 */
export const INPUT_SELECTORS = [
  '#prompt-textarea',
  'div[contenteditable="true"][data-virtualkeyboard="true"]',
  'form textarea',
  'main form div[contenteditable="true"]',
] as const;

/**
 * 送信ボタンを特定するためのセレクタ候補。
 * data-testid は ChatGPT の以前のリビジョンから比較的安定しているが、
 * 念のため複数の候補を用意して耐性を持たせる。
 */
export const SEND_BUTTON_SELECTORS = [
  'button[data-testid="send-button"]',
  'button[data-testid="fruitjuice-send-button"]',
  'button[aria-label="プロンプトを送信する"]',
  'button[aria-label="Send prompt"]',
  'form button[type="submit"]',
] as const;

/**
 * 既に画面上に表示されているユーザーメッセージを特定するためのセレクタ候補。
 * 開き直した会話では送信イベントを観測できないため、DOM 上の発言を履歴候補として拾う。
 */
export const USER_MESSAGE_SELECTORS = [
  '[data-message-author-role="user"]',
  '[data-testid="user-message"]',
] as const;
