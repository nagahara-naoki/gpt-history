# gpt-history

A Chrome extension that lets you recall previously sent messages in the ChatGPT (chatgpt.com) input box using the `↑` / `↓` arrow keys, just like a terminal (bash / zsh).

## Features

- **Arrow keys are all you need.** No modifier keys required. Press `↑` to go to the previous message, `↓` to go forward.
- **Fully local storage.** Your history is stored only in your browser (`chrome.storage.local`) and is never sent anywhere.
- **Does not break multi-line cursor movement.** Arrow keys are only intercepted when the caret is on the first or last line (or when the input is empty), so normal cursor navigation inside multi-line input is preserved.
- **Skips consecutive duplicates and empty messages.** Equivalent to bash's `HISTCONTROL=ignoredups`.
- **Capped at 1,000 entries.** Older entries are deleted automatically once the cap is reached.

## Demo

(GIFs and screenshots will be placed in `docs/screenshots/`.)

## Installation

### (A) Load from GitHub (development build)

1. Clone this repository or download it as a zip.
2. In a terminal, run:
   ```bash
   pnpm install
   pnpm build
   ```
   This writes the build artifacts to `dist/`.
   (This project uses [pnpm](https://pnpm.io/) as its package manager. If you don't have it, enable it with `corepack enable` or install it from https://pnpm.io/installation.)
3. Open `chrome://extensions/` in Chrome.
4. Turn on **Developer mode** (top-right corner).
5. Click **Load unpacked** and select the `dist/` directory.
6. Open `https://chatgpt.com` — the extension is now active.

### (B) Install from the Chrome Web Store

Not published yet (planned).

## Usage

| Key | Action | Trigger condition |
|---|---|---|
| `↑` | Recall the previous message | Input is empty, or the caret is on the first line |
| `↓` | Recall the next message (or the pre-navigation state) | Input is empty, or the caret is on the last line |
| `↑` / `↓` (condition not met) | Normal cursor movement | Caret is between the first and last line |

- Every time you send a message, it is added to your history.
- When you press `↓` past the most recent entry, the input is restored to whatever you had typed before you started navigating.
- If you manually edit the input while navigating, navigation state is cleared.

## Privacy

**Your history is stored only inside your browser (`chrome.storage.local`) and is never transmitted externally.**

See [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) for the full policy.

## Known limitations

- If ChatGPT changes its UI such that the input box or send button can no longer be found, the extension silently disables itself (to avoid breaking the host page). Recovery is usually a matter of updating the selectors in `src/dom.ts` and `src/constants.ts`.
- Arrow keys are not intercepted while an IME composition is in progress (e.g. while typing Japanese).
- Sites other than ChatGPT (Claude, Gemini, etc.) are not supported.

## Development

### Setup

```bash
pnpm install
pnpm dev     # development mode with HMR
pnpm build   # produce a production build in dist/
```

### Code quality

The project uses [Biome](https://biomejs.dev/) for formatting and linting, and TypeScript (strict mode) for type checking.

```bash
pnpm typecheck  # run tsc --noEmit
pnpm lint       # check only
pnpm format     # auto-format
pnpm check      # lint + format checks
```

### Project layout

```
gpt-history/
├── manifest.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── content.ts     # content-script entry point
│   ├── history.ts     # history state management
│   ├── storage.ts     # chrome.storage.local wrapper
│   ├── caret.ts       # first-/last-line detection
│   ├── dom.ts         # input box / send button lookup
│   ├── keybind.ts     # key event handling
│   └── constants.ts   # constants
├── icons/
└── docs/
```

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

[MIT License](./LICENSE)

## Author

(GitHub username goes here)
# gpt-history
