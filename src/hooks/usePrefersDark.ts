import { useEffect, useState } from 'react'

const QUERY = '(prefers-color-scheme: dark)'

// Drives which map tile set to request — CSS `dark:` variants handle every
// other themed element, but Leaflet tile URLs can only be chosen in JS.
export function usePrefersDark() {
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const listener = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  return prefersDark
}
