import { MutationCache, QueryClient } from '@tanstack/react-query'
import { getErrorMessage, toast } from './toast'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: Record<string, unknown> & {
      // Set when the calling component already shows the error inline, so
      // the user doesn't get the same failure twice.
      suppressErrorToast?: boolean
    }
  }
}

export function createQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      // Global safety net: no mutation fails silently. Components that render
      // their own error state opt out with `meta: { suppressErrorToast: true }`.
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.suppressErrorToast) return
        toast.error(getErrorMessage(error))
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  })
}

export const queryClient = createQueryClient()
