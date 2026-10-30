import { create } from 'zustand'

export type ToastVariant = 'error' | 'success' | 'info'

export interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastState {
  toasts: ToastItem[]
  push: (message: string, variant?: ToastVariant) => number
  dismiss: (id: number) => void
}

// Keep the stack short — a burst of failures shouldn't bury the page.
const MAX_TOASTS = 4

let nextId = 1

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (message, variant = 'info') => {
    const id = nextId++
    set((s) => {
      // Collapse identical messages (e.g. the same mutation retried twice).
      const rest = s.toasts.filter(
        (t) => !(t.message === message && t.variant === variant),
      )
      return { toasts: [...rest, { id, message, variant }].slice(-MAX_TOASTS) }
    })
    return id
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// Imperative API usable outside React (e.g. the QueryClient's MutationCache).
export const toast = {
  error: (message: string) => useToastStore.getState().push(message, 'error'),
  success: (message: string) =>
    useToastStore.getState().push(message, 'success'),
  info: (message: string) => useToastStore.getState().push(message, 'info'),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
}

// Supabase errors (PostgrestError, AuthError, FunctionsError) and plain
// Errors all carry a `message`; fall back to something human for the rest.
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}
