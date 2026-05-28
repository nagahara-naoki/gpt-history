// content.ts
// ChatGPT のページに注入されるエントリーポイント。
// 各モジュール (history / keybind / dom) を結線して、機能を組み立てる責務を持つ。
//
// 全体の流れ:
//   1. HistoryNavigator を生成し、現在開いているチャットの表示済み発言を取得
//   2. キーイベントハンドラを document に取り付け、↑↓ で navigator を操作
//   3. 送信検知 (Enter / 送信ボタンクリック) で同一チャット内の一時履歴に追加
//   4. SPA のチャット切替や DOM 追加を監視し、開いているチャットの履歴だけに保つ

import { getInputText, getPromptInput, getVisibleUserMessages } from './dom';
import { HistoryNavigator } from './history';
import { attachKeybind, attachSubmitClick } from './keybind';

declare global {
  interface Window {
    __gptHistoryInitialized__?: boolean;
  }
}

/**
 * 拡張機能の初期化を行う。
 * Content Script は同一ページで複数回 import される事故が起きにくいが、
 * 念のためグローバルフラグで二重起動をガードする。
 */
async function bootstrap(): Promise<void> {
  // 二重起動ガード (例: HMR で複数回注入された場合)
  if (window.__gptHistoryInitialized__) return;
  window.__gptHistoryInitialized__ = true;

  const navigator = new HistoryNavigator();
  let currentUrl = location.href;
  let acceptedHistorySignature = '';
  let blockedHistorySignature: string | null = null;
  let refreshScheduled = false;

  const getHistorySignature = (messages: readonly string[]): string => {
    // チャット切替時の旧 DOM 判定に使うだけなので、本文そのものは保持しない。
    let hash = 0x811c9dc5;

    for (const message of messages) {
      hash ^= message.length;
      hash = Math.imul(hash, 0x01000193);

      for (let index = 0; index < message.length; index += 1) {
        hash ^= message.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
      }
    }

    return `${messages.length}:${hash >>> 0}`;
  };

  const refreshOpenedChatHistory = (): void => {
    const messages = getVisibleUserMessages();
    const signature = getHistorySignature(messages);

    // チャット切替直後に旧チャットの DOM が一瞬残ることがある。
    // その間は空履歴のままにして、別チャットの履歴が出る事故を防ぐ。
    if (blockedHistorySignature !== null && signature === blockedHistorySignature) return;

    blockedHistorySignature = null;
    acceptedHistorySignature = signature;
    navigator.refreshPageHistory(messages);
  };

  const checkOpenedChatChanged = (): void => {
    if (currentUrl === location.href) return;

    currentUrl = location.href;
    blockedHistorySignature = acceptedHistorySignature;
    acceptedHistorySignature = '';
    navigator.clearOpenedChatHistory();
  };

  const scheduleHistoryRefresh = (): void => {
    if (refreshScheduled) return;

    refreshScheduled = true;
    requestAnimationFrame(() => {
      refreshScheduled = false;
      checkOpenedChatChanged();
      refreshOpenedChatHistory();
    });
  };

  refreshOpenedChatHistory();

  const observer = new MutationObserver(scheduleHistoryRefresh);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => {
    checkOpenedChatChanged();
    scheduleHistoryRefresh();
  });

  document.addEventListener(
    'click',
    () => {
      checkOpenedChatChanged();
      scheduleHistoryRefresh();
    },
    true,
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      checkOpenedChatChanged();
      scheduleHistoryRefresh();
    },
    true,
  );

  const syncOpenedChatHistory = (): void => {
    checkOpenedChatChanged();
    refreshOpenedChatHistory();
  };

  attachKeybind({
    /**
     * ↑キーが奪われた時の処理。
     * 現在の入力テキストを draft として保存しつつ、1 つ前の履歴を返す。
     */
    onArrowUp: () => {
      syncOpenedChatHistory();
      const inputEl = getPromptInput();
      const currentInput = inputEl ? getInputText(inputEl) : '';
      return navigator.prev(currentInput);
    },

    /**
     * ↓キーが奪われた時の処理。
     * 1 つ次の履歴 (または末尾を超えたら draft) を返す。
     */
    onArrowDown: () => {
      syncOpenedChatHistory();
      return navigator.next();
    },

    /**
     * Enter による送信が検知されたときの処理。
     * 履歴に追加し、ナビゲーション位置をリセットする。
     */
    onSubmit: (message) => {
      navigator.recordSent(message);
    },

    /**
     * ユーザーが入力欄を手動で編集したときの処理。
     * 履歴ナビゲーション中であれば解除する (F-4)。
     */
    onManualEdit: () => navigator.cancel(),
  });

  attachSubmitClick((message) => {
    navigator.recordSent(message);
  });
}

bootstrap().catch((error) => {
  // ChatGPT 本体の動作を壊さないことを最優先にするため、起動失敗してもサイレントに無効化
  console.warn('[gpt-history] 初期化に失敗:', error);
});
