import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Note: Electron main process is run separately (electron .).
    // We avoid bundling the main process with vite-plugin-electron here to prevent
    // automatic restarts causing crash loops during development.
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})
