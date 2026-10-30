import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import * as useAuthModule from '@/hooks/useAuth'
import { ChatPanel } from './ChatPanel'
import * as useChatModule from './useChat'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function setup(mutateAsync: ReturnType<typeof vi.fn>) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user: { uid: 'owner-1' },
  } as unknown as ReturnType<typeof useAuthModule.useAuth>)
  vi.spyOn(useChatModule, 'useChatMessages').mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useChatModule.useChatMessages>)
  vi.spyOn(useChatModule, 'useSendChatMessage').mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useChatModule.useSendChatMessage>)

  render(<ChatPanel threadId="thread-1" title="Jane" onBack={() => {}} />)
  return screen.getByRole('textbox', { name: 'Message' })
}

describe('ChatPanel', () => {
  it('sends once even when Enter is pressed repeatedly mid-send', async () => {
    let resolveSend: () => void = () => {}
    const mutateAsync = vi.fn(
      () => new Promise<void>((resolve) => (resolveSend = resolve)),
    )
    const input = setup(mutateAsync)

    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(mutateAsync).toHaveBeenCalledWith({
      threadId: 'thread-1',
      senderId: 'owner-1',
      body: 'Hello',
      attachmentPath: undefined,
    })

    await act(async () => resolveSend())
    expect(input).toHaveValue('')
  })

  it('keeps the draft and shows an error when sending fails', async () => {
    const mutateAsync = vi.fn(() => Promise.reject({ message: 'Network down' }))
    const input = setup(mutateAsync)

    fireEvent.change(input, { target: { value: 'Still there?' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Message not sent: Network down',
    )
    expect(input).toHaveValue('Still there?')
  })
})
