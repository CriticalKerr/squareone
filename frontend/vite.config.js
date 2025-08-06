import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

//______________________________________________________
// EMULATE __dirname
// Turn the module URL into a file path and get its folder name
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

//______________________________________________________
// VITE CONFIG
// Export settings so Vite knows how to build and run our app
export default defineConfig({
  plugins: [react()], // Plugins we want Vite to use

  //______________________________________________________
  // PATH ALIASES
  // Let us use '@' to mean the src folder and fix react-map-gl imports
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // point react-map-gl imports to its ESM build
      'react-map-gl': path.resolve(
          __dirname,
          'node_modules/react-map-gl/dist/esm/index.js'
      )
    }
  },

  //______________________________________________________
  // DEV SERVER PROXY
  // Forward requests for /static to our backend at localhost:8000
  server: {
    proxy: {
      // forward /static/* to your FastAPI server on localhost:8000
      '/static': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },

  //______________________________________________________
  // GLOBAL DEFINE
  // Prevent Node.js stuff from ending up in the browser
  define: {
    global: 'globalThis',
  },

  //______________________________________________________
  // DEPENDENCY OPTIMIZATION
  // Skip optimizing these packages during dev to avoid errors
  optimizeDeps: {
    exclude: ['postcss', 'autoprefixer']
  }
})