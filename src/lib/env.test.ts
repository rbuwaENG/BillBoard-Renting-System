import { describe, expect, it } from 'vitest'
import { checkSupabaseEnv } from './env'

describe('checkSupabaseEnv', () => {
  it('accepts a valid URL and key', () => {
    expect(
      checkSupabaseEnv({
        VITE_SUPABASE_URL: ' https://abc.supabase.co ',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual({
      ok: true,
      env: { url: 'https://abc.supabase.co', anonKey: 'anon-key' },
    })
  })

  it('reports every missing variable', () => {
    const result = checkSupabaseEnv({ VITE_SUPABASE_URL: '' })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.problems).toEqual([
      'VITE_SUPABASE_URL is not set.',
      'VITE_SUPABASE_ANON_KEY is not set.',
    ])
  })

  it('rejects a malformed URL', () => {
    const result = checkSupabaseEnv({
      VITE_SUPABASE_URL: 'abc.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.problems[0]).toMatch(
      /VITE_SUPABASE_URL must be an http\(s\) URL/,
    )
  })
})
