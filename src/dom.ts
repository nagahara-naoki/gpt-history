// dom.ts
// 入力欄と送信ボタンに関する DOM 操作を集約する。
// ChatGPT 側の DOM 変更で壊れた場合、原則このファイルだけ直せば復旧できるようにする責務を持つ。
// 上位レイヤ (caret.ts / keybind.ts / content.ts) は textarea か contenteditable かを意識しなくて済む。

import { INPUT_SELECTORS, SEND_BUTTON_SELECTORS, USER_MESSAGE_SELECTORS } from './constants';

/**
 * セレクタ候補リストを順に試し、最初に見つかった要素を返す。
 *
 * @param selectors - CSS セレクタの優先順リスト
 * @param root - 探索のルート (省略時は document)
 * @returns 見つかった要素。なければ null。
 */
function querySelectorFirst(
  selectors: readonly string[],
  root: ParentNode = document,
): Element | null {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) return el;
  }
  return null;
}

/**
 * 現在ページ上にある ChatGPT の入力欄要素を取得する。
 * 取得できる要素は <textarea> か contenteditable な <div> のどちらか。
 */
export function getPromptInput(): HTMLElement | null {
  return querySelectorFirst(INPUT_SELECTORS) as HTMLElement | null;
}

/**
 * 現在ページ上にある ChatGPT の送信ボタンを取得する。
 * 送信検知 (クリック検知) の対象判定に使う。
 */
export function getSendButton(): HTMLButtonElement | null {
  return querySelectorFirst(SEND_BUTTON_SELECTORS) as HTMLButtonElement | null;
}

/**
 * 画面上に表示されているユーザー発言を古い順に取得する。
 *
 * 途中から既存会話を開いた場合、その発言は送信イベントとして観測できない。
 * そこで ChatGPT のメッセージ DOM から自分の発言だけを拾い、履歴ナビゲーションに合流させる。
 */
export function getVisibleUserMessages(): string[] {
  return getUserMessageElements()
    .map((el) => normalizeMessageText(getElementText(el)))
    .filter((text) => text.length > 0);
}

/**
 * ユーザー発言らしい要素を DOM 順に取得する。
 * セレクタ候補が親子で同じ発言に当たる場合は、外側の要素だけを残して重複を避ける。
 */
function getUserMessageElements(): Element[] {
  const elements: Element[] = [];
  const selector = USER_MESSAGE_SELECTORS.join(',');

  for (const el of document.querySelectorAll(selector)) {
    if (elements.some((existing) => existing.contains(el))) continue;

    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const existing = elements[index];
      if (existing && el.contains(existing)) elements.splice(index, 1);
    }

    elements.push(el);
  }

  return elements;
}

/**
 * 表示テキストとして自然な形で読める文字列を取得する。
 * HTMLElement なら innerText を優先し、改行や非表示要素の扱いをブラウザに任せる。
 */
function getElementText(el: Element): string {
  if (el instanceof HTMLElement) return el.innerText;
  return el.textContent ?? '';
}

/**
 * DOM 由来のテキストを履歴として扱いやすい形に正規化する。
 * textarea / contenteditable から取れる送信テキストと揃えるため、改行と空白だけを最小限整える。
 */
function normalizeMessageText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .trim();
}

/** 渡された要素が <textarea> かを判定する。 */
export function isTextarea(el: Element): el is HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement;
}

/** 渡された要素が contenteditable かを判定する。 */
export function isContentEditable(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * 入力欄から現在のテキストを取得する。
 * textarea は value、contenteditable は innerText を使う。
 * innerText は改行を `\n` として返してくれるため、行判定にも一貫して使える。
 */
export function getInputText(el: HTMLElement): string {
  if (isTextarea(el)) return el.value;
  if (isContentEditable(el)) return el.innerText;
  return '';
}

/**
 * 入力欄が「送信される候補となる対象」かを判定する。
 * 上位の keydown ハンドラで、押された要素が我々の対象かを判別するために使う。
 */
export function isPromptInputElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // textarea は ID 一致で判定可能、contenteditable は祖先まで含めて確認
  const joined = INPUT_SELECTORS.join(',');
  if (target.matches(joined)) return true;
  return target.closest(joined) !== null;
}

/**
 * textarea にテキストをセットし、ChatGPT 側に変更を知らせる input イベントを発火する。
 */
function setTextareaValue(el: HTMLTextAreaElement, text: string): void {
  el.value = text;
  // React が制御する textarea は value 代入だけだと検知しないことがあるため、
  // input イベントを明示的に発火させて再描画と内部 state 更新を促す。
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
  // キャレットを末尾に置く (履歴呼び出し後に続けて編集できるよう)
  const end = text.length;
  el.setSelectionRange(end, end);
}

/**
 * contenteditable な要素のテキストを置き換える。
 *
 * ChatGPT の入力欄は Lexical / ProseMirror 系で管理されている可能性が高く、
 * innerText / innerHTML を直接書き換えると内部 state とずれて送信時に空になる事故が起きる。
 * そのため「全選択 → execCommand('insertText') による挿入」で、エディタ側に
 * input イベントを正しく流す。execCommand は deprecated だが、現状もっとも互換性が高い。
 */
function setContentEditableValue(el: HTMLElement, text: string): void {
  el.focus();

  const selection = window.getSelection();
  if (!selection) return;

  // 既存の内容を全選択
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);

  if (text === '') {
    // 空文字を insertText に渡してもエディタが拾いきれないことがあるので、
    // 「Delete で全消去」相当のコマンドを使う
    document.execCommand('delete', false);
    return;
  }

  // insertText は選択範囲を置換するように動くため、結果として全置換になる
  document.execCommand('insertText', false, text);
}

/**
 * 入力欄のテキストを置き換える。textarea / contenteditable の差を吸収する。
 */
export function setInputText(el: HTMLElement, text: string): void {
  if (isTextarea(el)) {
    setTextareaValue(el, text);
    return;
  }
  if (isContentEditable(el)) {
    setContentEditableValue(el, text);
    return;
  }
  // ここに来るのは想定外。サイレントに無効化する (本体を壊さない最優先)。
  console.warn('[gpt-history] 未対応の入力欄タイプです:', el);
}
