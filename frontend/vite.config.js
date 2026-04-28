import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:7420',
      '/health': 'http://localhost:7420',
    },
  },
  build: {
    outDir: 'dist',
  },
})
