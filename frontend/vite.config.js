import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

import { fileURLToPath } from 'url'

// emulate __dirname in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // point react-map-gl imports to its ESM build
      'react-map-gl': path.resolve(
          __dirname,
          'node_modules/react-map-gl/dist/esm/index.js'
      )
    }
  }
})