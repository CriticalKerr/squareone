import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

//______________________________________________________
// VITE CONFIGURATION
// This file configures Vite (the build tool) to:
// - Bundle and serve the React app during development
// - Set up path aliases (@ = ./src folder)
// - Proxy API calls to the Python backend
// - Build optimised production bundles
// https://vitejs.dev/config/
//______________________________________________________

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',  // LOCAL BACKEND
        //target: 'https://squareone-backend-730103287771.us-central1.run.app', // CLOUD BACKEND
        changeOrigin: true,
        rewrite: (path) => {
          console.log('Proxying request:', path);
          return path;
        },
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('Proxying:', req.method, req.url, '→', proxyReq.getHeader('host') + req.url);
          });
        },
      },
      '/static': {
        target: 'http://localhost:8000',  // LOCAL BACKEND
        //target: 'https://squareone-backend-730103287771.us-central1.run.app', // CLOUD BACKEND
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      }
    }
  }
})