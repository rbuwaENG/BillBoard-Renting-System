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
