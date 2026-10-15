import { vi } from 'vitest'

export interface QueryResult<T = unknown> {
  data: T
  error: unknown
}

// A chainable stand-in for the Supabase query builder: every filter/modifier
// method returns itself, and awaiting the builder (or calling a terminal
// method like `.single()`) resolves to the configured result.
export function createQueryBuilderMock<T = unknown>(result: QueryResult<T>) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (
      resolve: (value: QueryResult<T>) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

export function createChannelMock() {
  const channel: Record<string, unknown> = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  }
  return channel
}

export function createSupabaseMock() {
  return {
    from: vi.fn(() => createQueryBuilderMock({ data: null, error: null })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.test/file' } })),
        createSignedUrl: vi.fn(() =>
          Promise.resolve({ data: { signedUrl: 'https://example.test/signed' }, error: null }),
        ),
      })),
    },
    channel: vi.fn(() => createChannelMock()),
    removeChannel: vi.fn(),
    auth: {
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  }
}
