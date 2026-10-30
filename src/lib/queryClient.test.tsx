import { QueryClientProvider, useMutation } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { Toaster } from '@/components'
import { createQueryClient } from './queryClient'
import { getErrorMessage, useToastStore } from './toast'

function FailingAction({ suppress = false }: { suppress?: boolean }) {
  const mutation = useMutation({
    mutationFn: async () => {
      // Supabase errors are plain objects with a message, not Error instances.
      throw {
        message: 'Selected dates overlap an existing booking',
        code: 'P0001',
      }
    },
    meta: suppress ? { suppressErrorToast: true } : undefined,
  })
  return (
    <button type="button" onClick={() => mutation.mutate()}>
      {mutation.isError ? 'failed' : 'submit'}
    </button>
  )
}

function renderWithClient(ui: ReactNode) {
  const client = createQueryClient()
  return render(
    <QueryClientProvider client={client}>
      {ui}
      <Toaster />
    </QueryClientProvider>,
  )
}

describe('global mutation error toast', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('shows a toast in a polite live region when a mutation fails', async () => {
    renderWithClient(<FailingAction />)

    act(() => screen.getByRole('button', { name: 'submit' }).click())

    expect(
      await screen.findByText('Selected dates overlap an existing booking'),
    ).toBeInTheDocument()
    const region = screen
      .getByText('Selected dates overlap an existing booking')
      .closest('[aria-live]')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('stays quiet when the mutation opts out via meta', async () => {
    renderWithClient(<FailingAction suppress />)

    act(() => screen.getByRole('button', { name: 'submit' }).click())

    expect(
      await screen.findByRole('button', { name: 'failed' }),
    ).toBeInTheDocument()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('lets the user dismiss a toast', async () => {
    renderWithClient(<FailingAction />)
    act(() => screen.getByRole('button', { name: 'submit' }).click())

    const dismiss = await screen.findByRole('button', {
      name: 'Dismiss notification',
    })
    act(() => dismiss.click())

    expect(
      screen.queryByText('Selected dates overlap an existing booking'),
    ).not.toBeInTheDocument()
  })
})

describe('getErrorMessage', () => {
  it('reads messages from Errors, plain objects and strings', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
    expect(getErrorMessage({ message: 'rls' })).toBe('rls')
    expect(getErrorMessage('plain')).toBe('plain')
    expect(getErrorMessage(undefined)).toMatch(/something went wrong/i)
    expect(getErrorMessage({ message: '' }, 'fallback')).toBe('fallback')
  })
})
