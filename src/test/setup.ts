import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Unmount React trees between tests — without this, a component rendered
// in one test is still in the document for the next `render()` in the same
// file, and queries like getByRole can match leftover elements from both.
// Also clear mock call history (not implementations) — otherwise a shared
// supabase mock's call count accumulates across tests in the same file.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

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
