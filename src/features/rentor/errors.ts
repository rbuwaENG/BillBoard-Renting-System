// Supabase/PostgREST errors are plain `{ message, code, details, hint }`
// objects (not always `Error` instances), so read the fields defensively.

export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong.',
) {
  if (error instanceof Error && error.message) return error.message
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    (error as { message: string }).message
  ) {
    return (error as { message: string }).message
  }
  return fallback
}

export function errorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

// SQLSTATE 23503 — the row is still referenced by another table (e.g. a
// billboard that has bookings, whose FK is ON DELETE RESTRICT).
export function isForeignKeyViolation(error: unknown) {
  return errorCode(error) === '23503'
}
