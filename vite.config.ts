import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const supabaseUrl = env.VITE_SUPABASE_URL;

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: supabaseUrl
      ? {
          proxy: {
            '/openai-proxy': {
              target: supabaseUrl,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(/^\/openai-proxy/, '/functions/v1/openai-proxy'),
            },
          },
        }
      : undefined,
  };
});
