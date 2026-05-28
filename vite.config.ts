// vite.config.ts
// Vite + @crxjs/vite-plugin の設定。
// Manifest V3 の content script を ES Modules で扱うために必要。
// 出力先は dist/。開発時は HMR が効く。

import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
});
