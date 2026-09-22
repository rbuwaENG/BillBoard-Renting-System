import '@testing-library/jest-dom/vitest'

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
