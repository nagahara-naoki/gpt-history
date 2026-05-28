# Privacy Policy

This policy describes how the Chrome extension **gpt-history** (the "Extension") handles information.

## 1. Information processed

The Extension reads the text of user messages that are currently visible on ChatGPT (https://chatgpt.com) so that you can recall them with the `↑` / `↓` keys.

It may also keep a message briefly in memory immediately after you send it, only to cover the short delay before ChatGPT renders that message into the page.

The Extension does not collect personally identifying information, browsing history, cookies, IP addresses, or any other data.

## 2. Storage

The Extension does **not** persist chat history.

- It does not use `chrome.storage.local`.
- It does not use `chrome.storage.sync`.
- It keeps only in-memory state for the currently open chat page.
- When you switch chats, the previous chat's in-memory history is cleared.

## 3. External transmission

**None.** The Extension does not communicate with any external server.

## 4. Sharing with third parties

**None.** The Extension does not share any information with any third party.

## 5. Analytics

**None.** The Extension does not track or analyze usage in any way.

## 6. Deleting your data

Because the Extension does not persist chat history, there is no stored history to delete. In-memory state disappears when the page is closed, reloaded, or when you switch chats.

## 7. Contact

Questions about this policy can be submitted via GitHub Issues.

(Repository URL will be added once the project is published.)

## 8. Revision history

| Date | Notes |
|---|---|
| 2026-05-28 | Updated to open-chat-only, non-persistent history |
| 2026-05-28 | Initial version |
