/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'

// Database tests: real Postgres (PGlite/WASM) with every migration in
// supabase/migrations applied. Run with `npm run test:db`. Kept separate from
// the jsdom app suite in vite.config.ts. See src/test/db/README.md.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/test/db/**/*.test.ts'],
    environment: 'node',
    // Building the migrated snapshot (PostGIS + all migrations) takes a few
    // seconds once per test file; individual RPC tests are fast.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Each PGlite instance holds a full WASM Postgres heap; one fork keeps
    // memory bounded.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
