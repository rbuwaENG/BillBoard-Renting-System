import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { useSendChatMessage } from './useChat'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useSendChatMessage', () => {
  it('inserts a chat_messages row for the thread', async () => {
    const insertBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(insertBuilder as never)

    const { result } = renderHook(() => useSendChatMessage(), { wrapper })
    result.current.mutate({
      threadId: 'thread-1',
      senderId: 'user-1',
      body: 'Is this still available?',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.from).toHaveBeenCalledWith('chat_messages')
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      thread_id: 'thread-1',
      sender_id: 'user-1',
      body: 'Is this still available?',
      attachment_path: null,
    })
  })

  it('includes the attachment path when sending media', async () => {
    const insertBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(insertBuilder as never)

    const { result } = renderHook(() => useSendChatMessage(), { wrapper })
    result.current.mutate({
      threadId: 'thread-1',
      senderId: 'user-1',
      body: '',
      attachmentPath: 'thread-1/uuid-photo.jpg',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(insertBuilder.insert).toHaveBeenCalledWith({
      thread_id: 'thread-1',
      sender_id: 'user-1',
      body: '',
      attachment_path: 'thread-1/uuid-photo.jpg',
    })
  })
})
