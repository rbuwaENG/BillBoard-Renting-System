import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/hooks/useAuth'
import type { UserProfile } from '@/types'
import { draftStorageKey, useCampaignStore } from './campaignStore'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

function profile(uid: string): UserProfile {
  return {
    uid,
    displayName: uid,
    email: `${uid}@example.test`,
    role: 'renter',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
  }
}

describe('campaign cart storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.setState({ user: null, isLoading: false })
  })

  it('keeps a separate cart per account and swaps it on user change', () => {
    useAuthStore.setState({ user: profile('alice') })
    useCampaignStore.getState().toggleDraft('bb-1')
    useCampaignStore.getState().toggleDraft('bb-2')
    expect(useCampaignStore.getState().draftIds).toEqual(['bb-1', 'bb-2'])
    expect(
      JSON.parse(window.localStorage.getItem(draftStorageKey('alice'))!),
    ).toEqual(['bb-1', 'bb-2'])

    useAuthStore.setState({ user: profile('bob') })
    expect(useCampaignStore.getState().draftIds).toEqual([])
    useCampaignStore.getState().toggleDraft('bb-9')

    useAuthStore.setState({ user: null })
    expect(useCampaignStore.getState().draftIds).toEqual([])

    useAuthStore.setState({ user: profile('alice') })
    expect(useCampaignStore.getState().draftIds).toEqual(['bb-1', 'bb-2'])
  })

  it('ignores cart changes while logged out', () => {
    useCampaignStore.getState().toggleDraft('bb-1')
    expect(useCampaignStore.getState().draftIds).toEqual([])
  })

  it('survives corrupt storage', () => {
    window.localStorage.setItem(draftStorageKey('carol'), '{not json')
    useAuthStore.setState({ user: profile('carol') })
    expect(useCampaignStore.getState().draftIds).toEqual([])
  })
})
