// Small, framework-free helpers shared by the admin panels.

// Rows fetched per "Load more" click on the admin tables (`.range()` paging).
export const PAGE_SIZE = 50

// Underlined text-input look used across the admin panels.
export const ADMIN_INPUT_CLASSES =
  'w-full border-b border-ink/20 bg-transparent py-1.5 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30'

interface ErrorLike {
  message?: unknown
  code?: unknown
  details?: unknown
}

// Supabase/PostgREST errors are plain objects ({ message, code, details }),
// not `Error` instances — read the message defensively from either.
export function getErrorMessage(
  err: unknown,
  fallback = 'Something went wrong',
): string {
  if (!err) return fallback
  if (typeof err === 'string') return err
  const message = (err as ErrorLike).message
  return typeof message === 'string' && message ? message : fallback
}

export function getErrorCode(err: unknown): string | undefined {
  const code = (err as ErrorLike | null)?.code
  return typeof code === 'string' ? code : undefined
}

// PostgREST answers PGRST202 when an RPC isn't in its schema cache (i.e. the
// migration defining it hasn't been applied yet); Postgres itself uses 42883.
export function isMissingFunctionError(err: unknown): boolean {
  const code = getErrorCode(err)
  return code === 'PGRST202' || code === '42883'
}

// Today's date in the admin's local timezone, as `YYYY-MM-DD` — the format
// `<input type="date">` uses for `min`/`value`.
export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Compact "how long ago" label: "just now", "12m ago", "5h ago", "3d ago".
export function formatAge(
  iso: string | null | undefined,
  now: number = Date.now(),
): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const minutes = Math.max(0, Math.floor((now - then) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Case-insensitive "does any field contain the query" check for the
// client-side search boxes. An empty query matches everything.
export function matchesSearch(
  query: string,
  ...fields: (string | number | null | undefined)[]
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some(
    (f) => f !== null && f !== undefined && String(f).toLowerCase().includes(q),
  )
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
