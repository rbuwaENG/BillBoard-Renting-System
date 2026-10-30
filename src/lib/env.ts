export interface SupabaseEnv {
  url: string
  anonKey: string
}

export type EnvCheck =
  { ok: true; env: SupabaseEnv } | { ok: false; problems: string[] }

type EnvSource = Partial<Record<string, string | boolean | undefined>>

function readString(source: EnvSource, key: string): string {
  const value = source[key]
  return typeof value === 'string' ? value.trim() : ''
}

// Validates the build-time Supabase config. Kept dependency-free and pure
// (the source is injectable) so it can be unit-tested without stubbing
// `import.meta.env`.
export function checkSupabaseEnv(
  source: EnvSource = import.meta.env,
): EnvCheck {
  const url = readString(source, 'VITE_SUPABASE_URL')
  const anonKey = readString(source, 'VITE_SUPABASE_ANON_KEY')
  const problems: string[] = []

  if (!url) {
    problems.push('VITE_SUPABASE_URL is not set.')
  } else {
    let protocol = ''
    try {
      protocol = new URL(url).protocol
    } catch {
      // handled below
    }
    if (protocol !== 'https:' && protocol !== 'http:') {
      problems.push(`VITE_SUPABASE_URL must be an http(s) URL (got "${url}").`)
    }
  }

  if (!anonKey) problems.push('VITE_SUPABASE_ANON_KEY is not set.')

  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, env: { url, anonKey } }
}

export const envCheck = checkSupabaseEnv()
