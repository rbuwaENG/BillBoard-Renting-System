import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: they change far less often than app code,
        // so returning visitors keep them cached across deploys. Leaflet is
        // only pulled in by the map pages, so it stays off the entry path.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (
            /[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/.test(
              id,
            )
          ) {
            return 'leaflet'
          }
          if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return 'supabase'
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(
              id,
            )
          ) {
            return 'react'
          }
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Database tests run under node via `npm run test:db` (vitest.db.config.ts).
    exclude: [...configDefaults.exclude, 'src/test/db/**', '.claude/worktrees/**'],
    // Several suites render real Supabase clients / Leaflet maps; the
    // default multi-worker thread pool reliably OOMs on memory-constrained
    // runners. A single fork is slower but deterministic.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
