import { describe, expect, it } from 'vitest'
import { loginPath, sanitizeNext } from './redirect'

describe('sanitizeNext', () => {
  it.each([
    ['/', '/'],
    ['/billboards/abc', '/billboards/abc'],
    ['/?billboard=abc', '/?billboard=abc'],
    ['/rentor#inbox', '/rentor#inbox'],
  ])('accepts same-origin path %s', (input, expected) => {
    expect(sanitizeNext(input)).toBe(expected)
  })

  it.each([
    null,
    undefined,
    '',
    'billboards/abc',
    '//evil.example',
    '//evil.example/path',
    '/\\evil.example',
    '/\\/evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    ' /leading-space',
    '/\nnewline',
    '/login',
    '/login?next=/x',
    '/signup',
    '/reset-password',
    // Dot segments that normalise into a protocol-relative path.
    '/..//evil.com',
    '/.//evil.com',
    '/a/../..//evil.com/x',
    '/./\\evil.com',
    '/../\\evil.com',
  ])('rejects %j', (input) => {
    expect(sanitizeNext(input as string | null | undefined)).toBeNull()
  })
})

describe('sanitizeNext — encoded slashes', () => {
  it('keeps percent-encoded slashes encoded, so they never form //host', () => {
    const result = sanitizeNext('/%2F%2Fevil.com')
    expect(result).toBe('/%2F%2Fevil.com')
    expect(result!.startsWith('//')).toBe(false)
  })
})

describe('loginPath', () => {
  it('encodes a safe next path', () => {
    expect(loginPath('/?billboard=a b')).toBe(
      '/login?next=%2F%3Fbillboard%3Da%2520b',
    )
  })
  it('drops an unsafe next path', () => {
    expect(loginPath('//evil.example')).toBe('/login')
  })
})
