import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // inline the bundled Vazirmatn woff2 into the CSS so the whole app can
    // ship as a single self-contained file (artifact demo has no network)
    assetsInlineLimit: 200000,
  },
})
