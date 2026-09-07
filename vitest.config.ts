import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@domain': resolve(__dirname, 'src/domain'),
      '@platforms': resolve(__dirname, 'src/platforms'),
      '@repository': resolve(__dirname, 'src/repository'),
    },
  },
});
