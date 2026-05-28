// keybind.ts
// キーイベントをハンドリングし、↑↓キーを「奪うか / 通常動作させるか」を判定する責務を持つ。
//
// 設計上のポイント:
//   - document に capture フェーズで一度だけリスナーを張る (DOM 動的差し替えに強い)
//   - 対象は ChatGPT の入力欄に限定する (他の入力欄/サイト挙動を壊さない)
//   - IME 変換中 (isComposing) は一切奪わない (誤爆防止)
//   - 修飾キー (Ctrl/Alt/Meta/Shift) 同時押しは奪わない (ショートカット衝突防止)

import { isAtFirstLine, isAtLastLine, isEmpty } from './caret';
import { getInputText, getPromptInput, isPromptInputElement, setInputText } from './dom';

/** ↑キーのイベント key 値。 */
const KEY_ARROW_UP = 'ArrowUp';
/** ↓キーのイベント key 値。 */
const KEY_ARROW_DOWN = 'ArrowDown';
/** Enter キーのイベント key 値。 */
const KEY_ENTER = 'Enter';

/**
 * 修飾キーが押されているかを判定する。
 * 修飾キー付きの ↑↓ (例: Shift+↑ で選択) は本拡張の管轄外なので奪わない。
 */
function hasModifierKey(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
}

/**
 * IME 変換中かを判定する。
 *
 * `event.isComposing` に加えて keyCode 229 もチェックする。
 * 一部ブラウザは compositionend 直後のキーで isComposing=false でも 229 を返すことがあり、
 * その間に Enter を奪うと変換確定を壊すので、両方を見ておく。
 */
function isComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229;
}

/** キーバインドハンドラの依存。 */
export type KeybindHandlers = {
  /** ↑ が「奪われた」ときに呼ばれる。挿入文字列を返す。null なら何もしない (履歴の端) */
  onArrowUp: () => string | null;
  /** ↓ が「奪われた」ときに呼ばれる。挿入文字列を返す。null なら何もしない */
  onArrowDown: () => string | null;
  /** Enter による送信が検知されたときに呼ばれる */
  onSubmit: (message: string) => void;
  /** ユーザーが入力欄を手動で編集したときに呼ばれる (ナビゲーション解除) */
  onManualEdit: () => void;
};

/**
 * ↑キーの処理。条件を満たせば履歴呼び出しに使い、それ以外は通常動作させる。
 */
function handleArrowUp(
  inputEl: HTMLElement,
  event: KeyboardEvent,
  handlers: KeybindHandlers,
): void {
  // 発火条件: 空、または先頭行。中間行では通常の ↑ 移動を優先する。
  if (!isEmpty(inputEl) && !isAtFirstLine(inputEl)) return;

  const text = handlers.onArrowUp();
  // 履歴の端などで挿入対象が無い場合は「キー入力をなかったことにする」のが体感的に近い。
  // (bash も最古から ↑ を押し続けると何も起きない)。よって text が null でも preventDefault は行う。
  event.preventDefault();
  event.stopPropagation();
  if (text !== null) setInputText(inputEl, text);
}

/**
 * ↓キーの処理。条件を満たせば履歴呼び出しに使い、それ以外は通常動作させる。
 */
function handleArrowDown(
  inputEl: HTMLElement,
  event: KeyboardEvent,
  handlers: KeybindHandlers,
): void {
  // 発火条件: 空、または末尾行。中間行では通常の ↓ 移動を優先する。
  if (!isEmpty(inputEl) && !isAtLastLine(inputEl)) return;

  const text = handlers.onArrowDown();
  // ↓ は「ナビゲーション中でない」場合に挿入対象が無いケースが多い。
  // その状態でキーを奪うとカーソルが末尾から動かなくなって違和感が出るので、
  // 「ナビゲーション中でない (= text が null)」かつ「空欄でない」場合は素通しする。
  if (text === null && !isEmpty(inputEl)) return;

  event.preventDefault();
  event.stopPropagation();
  if (text !== null) setInputText(inputEl, text);
}

/**
 * Enter キー送信の処理。
 * 修飾キー無し / IME 中でない / 入力に中身がある、を満たすときに送信扱いとする。
 *
 * このフックでは preventDefault しない (送信自体は ChatGPT 本体に任せる)。
 * あくまで「送信を観測して上位に通知する」だけが責務。
 */
function handleEnter(inputEl: HTMLElement, event: KeyboardEvent, handlers: KeybindHandlers): void {
  // Shift+Enter は改行であって送信ではない
  if (event.shiftKey) return;
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (isComposing(event)) return;

  const text = getInputText(inputEl);
  if (text.trim().length === 0) return;

  handlers.onSubmit(text);
}

/**
 * document に keydown リスナーを取り付ける。
 *
 * @returns アンインストール関数
 */
export function attachKeybind(handlers: KeybindHandlers): () => void {
  // 直近の keydown が「手動編集を発生させうるキー」だったかのフラグ。
  // setInputText が発火する input イベントと、ユーザーのタイピングによる
  // input イベントを区別するために用いる。
  let lastKeyWasManualEdit = false;

  const onKeyDownFlag = (event: KeyboardEvent): void => {
    // ↑↓ は履歴ナビゲーション用なので手動編集ではない
    if (event.key === KEY_ARROW_UP || event.key === KEY_ARROW_DOWN) {
      lastKeyWasManualEdit = false;
      return;
    }
    // それ以外で input を発火させるキーが押されたら、続く input は手動編集とみなす
    lastKeyWasManualEdit = true;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    // 我々の管轄外のキーは早期 return で素通し
    if (event.key !== KEY_ARROW_UP && event.key !== KEY_ARROW_DOWN && event.key !== KEY_ENTER) {
      return;
    }

    if (!isPromptInputElement(event.target)) return;
    if (isComposing(event)) return;

    // 入力欄要素を取り直す (target は子要素の可能性がある)
    const inputEl = getPromptInput();
    if (!inputEl) return;

    if (event.key === KEY_ENTER) {
      handleEnter(inputEl, event, handlers);
      return;
    }

    // ↑↓ は修飾キー無しのときだけ我々の管轄
    if (hasModifierKey(event)) return;

    if (event.key === KEY_ARROW_UP) {
      handleArrowUp(inputEl, event, handlers);
      return;
    }
    if (event.key === KEY_ARROW_DOWN) {
      handleArrowDown(inputEl, event, handlers);
    }
  };

  /**
   * ユーザーがキーボードで手動編集したときにナビゲーション状態を解除する (F-4)。
   * input イベントは setInputText 経由でも発火するため、
   * 「キー押下に伴う input」だけを拾う必要がある。
   * 直近の keydown が ↑↓ 以外の文字入力系キーだったときのみ手動編集とみなす。
   */
  const onInput = (event: Event): void => {
    if (!isPromptInputElement(event.target)) return;
    if (!lastKeyWasManualEdit) return;
    handlers.onManualEdit();
  };

  // capture フェーズでフックすることで、ChatGPT 本体に届く前に判断する
  document.addEventListener('keydown', onKeyDownFlag, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('input', onInput, true);

  return () => {
    document.removeEventListener('keydown', onKeyDownFlag, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('input', onInput, true);
  };
}

/**
 * 送信ボタンのクリック検知をドキュメント全体に張る。
 * ボタン要素自体が動的に再生成されても、closest による祖先検索で拾える。
 *
 * @param onSubmit - 送信が検知されたときに呼ばれる
 * @returns アンインストール関数
 */
export function attachSubmitClick(onSubmit: (message: string) => void): () => void {
  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // セレクタは複数試す (constants で定義)。ここでは closest 経由で網羅的に当たれば十分。
    const button = target.closest('button[data-testid="send-button"], button[type="submit"]');
    if (!button) return;

    const inputEl = getPromptInput();
    if (!inputEl) return;
    const text = getInputText(inputEl);
    if (text.trim().length === 0) return;

    onSubmit(text);
  };

  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
