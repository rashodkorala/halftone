import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// The portfolio proxies rashodkorala.com/dithertool/* to this deployment's
// /dithertool/*, so the app is built under that base path and emitted into a
// matching folder: URLs are identical on both hosts.
export default defineConfig({
  base: '/dithertool/',
  build: { outDir: 'dist/dithertool' },
  plugins: [react()],
})
