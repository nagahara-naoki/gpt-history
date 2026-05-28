// caret.ts
// textarea / contenteditable のキャレット位置を取得し、
// 「先頭行か」「末尾行か」「入力欄が空か」を判定する責務を持つ。
// 行判定は ↑↓ キーを奪うか奪わないかを決める中心ロジックなので、
// ここがバグると複数行入力の通常カーソル移動が壊れる。テストで重点的に確認する。

import { getInputText, isContentEditable, isTextarea } from './dom';

/** キャレット位置で分割したテキスト。 */
type CaretSplit = {
  before: string;
  after: string;
};

/** 表示上の同じ行とみなすための余白。ブラウザの小数 px 差を吸収する。 */
const LINE_RECT_TOLERANCE_PX = 3;

/** contenteditable 上のキャレットが表示上どの端の行にいるか。 */
type CaretLinePosition = {
  isFirstLine: boolean;
  isLastLine: boolean;
};

/**
 * テキスト中に改行が含まれるか判定する純粋関数。
 * `\n` (textarea / DOM 構造由来) と `\r` の両方をカバーする。
 */
function hasNewline(text: string): boolean {
  return /[\n\r]/.test(text);
}

/** ブロック境界を改行として扱う要素名。 */
const BLOCK_ELEMENT_NAMES = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'P',
  'PRE',
  'SECTION',
]);

/**
 * DOM を、行判定用のテキストへ変換する。
 * contenteditable の block / br 境界を明示的に改行へ戻しつつ、
 * キャレット位置には目印文字を差し込む。
 */
function getTextWithCaretMarker(root: Node, caretNode: Node, caretOffset: number): string {
  const marker = '\uE000';

  const shouldAddNewlineAfter = (node: Node, next: Node | undefined): boolean => {
    if (!next) return false;
    return node instanceof Element && BLOCK_ELEMENT_NAMES.has(node.tagName);
  };

  const serialize = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (node !== caretNode) return text;
      return text.slice(0, caretOffset) + marker + text.slice(caretOffset);
    }

    if (node instanceof HTMLBRElement) return '\n';
    if (!(node instanceof Element || node instanceof DocumentFragment)) return '';

    const children = Array.from(node.childNodes);
    let text = '';

    for (let index = 0; index <= children.length; index += 1) {
      if (node === caretNode && index === caretOffset) text += marker;
      const child = children[index];
      if (!child) continue;
      text += serialize(child);
      if (shouldAddNewlineAfter(child, children[index + 1])) text += '\n';
    }

    return text;
  };

  return serialize(root);
}

/**
 * DOM 構造ベースで contenteditable のキャレット前後を分割する。
 * 表示座標が取れない環境でのフォールバックとして使う。
 */
function getStructuralCaretSplitFromContentEditable(
  el: HTMLElement,
  caretNode: Node,
  caretOffset: number,
): CaretSplit | null {
  const marker = '\uE000';
  const text = getTextWithCaretMarker(el, caretNode, caretOffset);
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return null;

  return {
    before: text.slice(0, markerIndex),
    after: text.slice(markerIndex + marker.length),
  };
}

/**
 * 矩形リストから実際に行判定に使えるものだけを取り出す。
 * 空の装飾要素などの 0 サイズ矩形はノイズになりやすい。
 */
function getUsableRects(rects: DOMRectList): DOMRect[] {
  return Array.from(rects).filter((rect) => rect.height > 0 && rect.width >= 0);
}

/**
 * contenteditable の表示上の行位置を判定する。
 * 長い 1 行が折り返されている場合でも、キャレットの表示位置を基準にする。
 */
function getCaretLinePositionFromContentEditable(el: HTMLElement): CaretLinePosition | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const caretRange = selection.getRangeAt(0);
  if (!caretRange.collapsed) return null;
  if (!el.contains(caretRange.startContainer)) return null;

  const caretRects = getUsableRects(caretRange.getClientRects());
  const caretRect = caretRects[0] ?? caretRange.getBoundingClientRect();
  if (caretRect.height <= 0) return null;

  const contentRange = document.createRange();
  contentRange.selectNodeContents(el);
  const contentRects = getUsableRects(contentRange.getClientRects()).filter(
    (rect) => rect.height > 0 && rect.width > 0,
  );
  if (contentRects.length === 0) return null;

  const firstTop = Math.min(...contentRects.map((rect) => rect.top));
  const lastBottom = Math.max(...contentRects.map((rect) => rect.bottom));
  const firstBottom = Math.max(
    ...contentRects
      .filter((rect) => Math.abs(rect.top - firstTop) <= LINE_RECT_TOLERANCE_PX)
      .map((rect) => rect.bottom),
  );
  const lastTop = Math.min(
    ...contentRects
      .filter((rect) => Math.abs(rect.bottom - lastBottom) <= LINE_RECT_TOLERANCE_PX)
      .map((rect) => rect.top),
  );
  const caretCenterY = (caretRect.top + caretRect.bottom) / 2;

  return {
    isFirstLine: caretCenterY <= firstBottom + LINE_RECT_TOLERANCE_PX,
    isLastLine: caretCenterY >= lastTop - LINE_RECT_TOLERANCE_PX,
  };
}

/**
 * textarea のキャレット周りのテキストを取得する。
 * selectionStart は IME 中などに null を返すケースがあるため、安全側にフォールバックする。
 */
function getCaretSplitFromTextarea(el: HTMLTextAreaElement): CaretSplit | null {
  const value = el.value;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  // 選択範囲がある場合は履歴ではなくブラウザ標準の選択解除/移動を優先する。
  if (start !== end) return null;

  const position = start;
  return {
    before: value.slice(0, position),
    after: value.slice(position),
  };
}

/**
 * contenteditable のキャレット位置を境にテキストを「前」「後ろ」に分割する。
 *
 * 表示座標が取れない環境でのフォールバック用に、DOM 構造から改行を復元する。
 *
 * @returns 取得できなければ null
 */
function getCaretSplitFromContentEditable(el: HTMLElement): CaretSplit | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  // 選択範囲がある場合は履歴ではなくブラウザ標準の選択解除/移動を優先する。
  if (!range.collapsed) return null;

  const anchorNode = range.startContainer;
  const anchorOffset = range.startOffset;

  // 入力欄の中にキャレットが無いケースをはじく (フォーカスが別要素にあるなど)
  if (!el.contains(anchorNode)) return null;

  return getStructuralCaretSplitFromContentEditable(el, anchorNode, anchorOffset);
}

/**
 * キャレット位置で入力テキストを「前」「後ろ」に分割する共通インタフェース。
 */
function getCaretSplit(el: HTMLElement): CaretSplit | null {
  if (isTextarea(el)) return getCaretSplitFromTextarea(el);
  if (isContentEditable(el)) return getCaretSplitFromContentEditable(el);
  return null;
}

/**
 * 入力欄が空 (空白のみを含む) かを判定する。
 *
 * 仕様: 改行・空白のみのときも「空扱い」とする。
 * これは F-2 / F-3 の発火条件「入力欄が空」を厳密化すると、
 * 改行 1 文字だけ残った状態で履歴呼び出しできなくなり実用上不便なため。
 */
export function isEmpty(el: HTMLElement): boolean {
  return getInputText(el).trim().length === 0;
}

/**
 * キャレットが入力欄の先頭行にあるかを判定する。
 *
 * 仕様: キャレットより前のテキストに改行が含まれない場合に true。
 * 1 行しか入力がない場合は、どの桁にいても先頭行として扱う。
 *
 * @param el - 入力欄要素 (textarea または contenteditable)
 * @returns 先頭行なら true。判定不能なら false。
 */
export function isAtFirstLine(el: HTMLElement): boolean {
  if (isContentEditable(el)) {
    const linePosition = getCaretLinePositionFromContentEditable(el);
    if (linePosition) return linePosition.isFirstLine;
  }

  const split = getCaretSplit(el);
  if (!split) return false;
  return !hasNewline(split.before);
}

/**
 * キャレットが入力欄の末尾行にあるかを判定する。
 *
 * 仕様: キャレットより後のテキストに改行が含まれない場合に true。
 * 1 行しか入力がない場合は、どの桁にいても末尾行として扱う。
 *
 * @param el - 入力欄要素 (textarea または contenteditable)
 * @returns 末尾行なら true。判定不能なら false。
 */
export function isAtLastLine(el: HTMLElement): boolean {
  if (isContentEditable(el)) {
    const linePosition = getCaretLinePositionFromContentEditable(el);
    if (linePosition) return linePosition.isLastLine;
  }

  const split = getCaretSplit(el);
  if (!split) return false;
  return !hasNewline(split.after);
}
