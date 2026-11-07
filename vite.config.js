import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, o Vite repassa /api e /ws para a HydraSmart API (padrão: localhost:3333).
// Assim o painel usa sempre caminhos relativos, igual em produção atrás do nginx.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const alvo = env.API_PROXY_TARGET || 'http://localhost:3333';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target: alvo, changeOrigin: true },
        '/ws': { target: alvo.replace(/^http/, 'ws'), ws: true },
        '/docs': { target: alvo, changeOrigin: true }
      }
    },
    preview: { port: 4173, host: true },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/leaflet') || id.includes('react-leaflet')) return 'mapa';
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'graficos';
            return undefined;
          }
        }
      }
    },
    test: {
      environment: 'jsdom',
      globals: false
    }
  };
});
