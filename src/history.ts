// history.ts
// 履歴ナビゲーションの「状態」を保持・更新する責務を持つ。
//
// 主な状態:
//   - history    : 現在保持している履歴配列 (古い順)
//   - cursor     : 履歴上の現在位置 (null = ナビゲーション未開始 = 末尾より先)
//   - draft      : ナビゲーション開始時点の編集中バッファ (↓ で末尾を超えたら戻す)
//
// このモジュールは I/O を持たない、ほぼ純粋なステートマシン。

/**
 * 履歴として扱う価値がある文字列かを判定する。
 * 空文字・空白のみは除外する。
 */
function isWorthSaving(message: string): boolean {
  return message.trim().length > 0;
}

/**
 * 履歴配列をナビゲーション用に整える。
 * DOM から同じメッセージ群を何度も読み直すため、連続重複だけはここで落としておく。
 */
function normalizeHistory(history: readonly string[]): string[] {
  const normalized: string[] = [];

  for (const message of history) {
    if (!isWorthSaving(message)) continue;
    if (normalized[normalized.length - 1] === message) continue;
    normalized.push(message);
  }

  return normalized;
}

export class HistoryNavigator {
  /** 現在開いている会話 DOM から拾った履歴配列。古い順。 */
  private pageHistory: string[] = [];
  /** 送信直後など、DOM 反映前の同一チャット内メッセージ。古い順。 */
  private pendingHistory: string[] = [];
  /** 履歴上のカーソル位置。null は「ナビゲーション未開始」を意味する。 */
  private cursor: number | null = null;
  /** ナビゲーション開始前に入力欄にあったテキスト (↓で末尾超えしたとき復元)。 */
  private draft = '';

  /** 現在の履歴件数。 */
  get size(): number {
    return this.history.length;
  }

  /** ナビゲーションで参照する、現在開いているチャットだけの履歴。 */
  private get history(): string[] {
    return normalizeHistory(this.pageHistory.concat(this.pendingHistory));
  }

  /** ナビゲーション中かどうか。 */
  isNavigating(): boolean {
    return this.cursor !== null;
  }

  /**
   * ナビゲーションを解除する (履歴状態を「未開始」に戻す)。
   * 編集発生時 (F-4) や送信完了後 (F-4) に呼ぶ。
   * draft はクリアする — 次回呼び出し時にあらためて編集中バッファを取り直す。
   */
  cancel(): void {
    this.cursor = null;
    this.draft = '';
  }

  /**
   * メッセージ送信時の処理。
   * ChatGPT の DOM 反映より先に ↑ を押しても直近送信を呼び出せるよう、
   * 現在開いているチャット内の一時履歴としてだけ保持する。
   */
  recordSent(message: string): void {
    this.pendingHistory = normalizeHistory(this.pendingHistory.concat(message));
    this.cancel();
  }

  /**
   * 現在開いている会話から拾ったユーザー発言を履歴候補として取り込む。
   * DOM 由来の履歴は保存せず、今のページでのナビゲーションにだけ使う。
   */
  refreshPageHistory(messages: readonly string[]): void {
    this.pageHistory = normalizeHistory(messages);
    this.pendingHistory = this.pendingHistory.filter(
      (message) => !this.pageHistory.includes(message),
    );
  }

  /**
   * チャット切替時に、前のチャット由来の候補を即座に捨てる。
   * 新しいチャットの DOM がまだ描画途中でも、古い履歴を出さないことを優先する。
   */
  clearOpenedChatHistory(): void {
    this.pageHistory = [];
    this.pendingHistory = [];
    this.cancel();
  }

  /**
   * 1 つ前の履歴を返す (↑ キー押下時)。
   *
   * 内部のカーソル位置を 1 つ古い側へ進める。
   * - 履歴が空、またはカーソルがすでに最古に達している場合は null を返す (何もしない)。
   * - ナビゲーション開始時 (cursor=null) は、現在の入力欄テキストを draft として記憶し、
   *   最新の履歴 (末尾) を返す。
   *
   * @param currentInput - 現在の入力欄テキスト (draft 候補)
   * @returns 入力欄に挿入すべき文字列。null なら無視 (= 何もしない)
   */
  prev(currentInput: string): string | null {
    const history = this.history;
    if (history.length === 0) return null;

    if (this.cursor === null) {
      // ナビゲーション開始: 現在の編集内容を退避し、末尾 (= 最新) を指す
      this.draft = currentInput;
      this.cursor = history.length - 1;
      return history[this.cursor] ?? null;
    }

    // すでに最古 (= 0) に到達していたら、それ以上は遡らない
    if (this.cursor <= 0) return null;

    this.cursor -= 1;
    return history[this.cursor] ?? null;
  }

  /**
   * 1 つ次の履歴を返す (↓ キー押下時)。
   *
   * - ナビゲーション未開始の場合は何もしない (null)。
   *   (空欄や入力末尾で ↓ を押すケース。挿入する候補がそもそも無い)
   * - 末尾を超えた場合は、開始前に退避した draft を返してナビゲーションを終了する (F-3)。
   *
   * @returns 入力欄に挿入すべき文字列。null なら無視
   */
  next(): string | null {
    if (this.cursor === null) return null;

    const history = this.history;
    if (this.cursor >= history.length - 1) {
      // 末尾を超える: draft を復元してナビゲーション終了
      const restored = this.draft;
      this.cancel();
      return restored;
    }

    this.cursor += 1;
    return history[this.cursor] ?? null;
  }
}
