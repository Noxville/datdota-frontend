import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Named User-Agent lets dev API requests clear the Cloudflare challenge.
const envPath = path.resolve(__dirname, '.env')
if (fs.existsSync(envPath)) process.loadEnvFile(envPath)
const DATDOTA_USER_AGENT = process.env.DATDOTA_USER_AGENT || 'datdota-dev-proxy/1.0'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3111,
    proxy: {
      '/api': {
        target: 'https://api.datdota.com',
        changeOrigin: true,
        secure: true,
        headers: { 'User-Agent': DATDOTA_USER_AGENT },
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router') || id.includes('node_modules/scheduler')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/@tanstack')) {
            return 'vendor-tanstack'
          }
          if (id.includes('node_modules/d3')) {
            return 'vendor-d3'
          }
        },
      },
    },
  },
})
