// Return-to-after-login helpers. `next` comes from the URL, so it's untrusted:
// only same-origin, root-relative paths are honoured (no `//host`, no
// `/\host`, no scheme, no control characters) — anything else is dropped.
export function sanitizeNext(next: string | null | undefined): string | null {
  if (!next) return null
  if (!next.startsWith('/')) return null
  if (next.startsWith('//') || next.startsWith('/\\')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return null
  try {
    const base = 'https://app.invalid'
    const url = new URL(next, base)
    if (url.origin !== base) return null
    const path = `${url.pathname}${url.search}${url.hash}`
    // Don't bounce back into the auth screens themselves.
    if (/^\/(login|signup|forgot-password|reset-password)(\/|$|\?)/.test(path))
      return null
    return path
  } catch {
    return null
  }
}

export function loginPath(next?: string | null): string {
  const safe = sanitizeNext(next)
  return safe ? `/login?next=${encodeURIComponent(safe)}` : '/login'
}

export function currentPath(location: {
  pathname: string
  search: string
  hash?: string
}): string {
  return `${location.pathname}${location.search}${location.hash ?? ''}`
}
