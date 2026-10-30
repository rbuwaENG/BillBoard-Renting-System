import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Tests must run offline and without a `.env.local`: replace the real
// Supabase client everywhere with the chainable mock. Suites that need their
// own handle still call `vi.mock('@/lib/supabase', ...)`, which takes
// precedence over this default for that file.
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./supabaseMock')
  return { supabase: createSupabaseMock() }
})

// Unmount React trees between tests — without this, a component rendered
// in one test is still in the document for the next `render()` in the same
// file, and queries like getByRole can match leftover elements from both.
// Also clear mock call history (not implementations) — otherwise a shared
// supabase mock's call count accumulates across tests in the same file.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// react-router's data router builds a `Request` (with an AbortController
// signal) for every navigation that has to run a route `lazy`/loader. Under
// jsdom, AbortController is jsdom's but `Request` is Node's, and Node rejects
// the foreign signal ("Expected signal to be an instance of AbortSignal").
// Nothing in the test environment hits the network, so dropping the signal
// is harmless.
const NodeRequest = globalThis.Request
globalThis.Request = class extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init ? { ...init, signal: undefined } : init)
  }
} as typeof Request

// jsdom doesn't implement matchMedia — polyfill it for hooks like
// usePrefersDark that read prefers-color-scheme.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
