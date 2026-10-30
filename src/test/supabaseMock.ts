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
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    is: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    not: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    match: vi.fn(() => builder),
    filter: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
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
    unsubscribe: vi.fn(() => Promise.resolve('ok')),
  }
  return channel
}

const noSession = () =>
  Promise.resolve({ data: { session: null }, error: null })
const noUser = () =>
  Promise.resolve({ data: { user: null, session: null }, error: null })

// A fully offline Supabase client. `src/test/setup.ts` installs one of these
// as the global `@/lib/supabase` mock, so no test ever reaches the network;
// individual suites may still `vi.mock('@/lib/supabase', ...)` themselves to
// get a fresh instance they control.
export function createSupabaseMock() {
  return {
    from: vi.fn(() => createQueryBuilderMock({ data: null, error: null })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
        remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
        getPublicUrl: vi.fn(() => ({
          data: { publicUrl: 'https://example.test/file' },
        })),
        createSignedUrl: vi.fn(() =>
          Promise.resolve({
            data: { signedUrl: 'https://example.test/signed' },
            error: null,
          }),
        ),
      })),
    },
    channel: vi.fn(() => createChannelMock()),
    removeChannel: vi.fn(() => Promise.resolve('ok')),
    auth: {
      getSession: vi.fn(noSession),
      getUser: vi.fn(noUser),
      signInWithPassword: vi.fn(noUser),
      signUp: vi.fn(noUser),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      resetPasswordForEmail: vi.fn(() =>
        Promise.resolve({ data: {}, error: null }),
      ),
      updateUser: vi.fn(noUser),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { ok: true }, error: null })),
    },
  }
}
