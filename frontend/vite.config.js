import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = (env.VITE_DEV_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

  return {
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: backendUrl,
        },
        '/healthz': {
          target: backendUrl,
        },
        '/ws': {
          target: backendUrl,
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      // Source maps stay out of public images by default. A release pipeline
      // may enable private upload after wiring its error-tracking provider.
      sourcemap: env.VITE_SOURCEMAP === 'true',
    },
  };
});
