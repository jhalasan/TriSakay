import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@trisakay/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@trisakay/utils': path.resolve(__dirname, '../../packages/utils/src'),
    },
  },
  server: {
    port: 5173,
  },
});
