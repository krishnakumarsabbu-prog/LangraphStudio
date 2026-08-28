import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          'kogito-bpmn': ['@kogito-tooling/kie-editors-standalone/dist/bpmn'],
          'kogito-dmn': ['@kogito-tooling/kie-editors-standalone/dist/dmn'],
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/kogito': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error - using mock service instead');
          });
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    global: 'globalThis',
  },
});
