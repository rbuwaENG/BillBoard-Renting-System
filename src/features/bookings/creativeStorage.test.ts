import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { getBookingCreativeUrl, uploadBookingCreative } from './creativeStorage'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

describe('uploadBookingCreative', () => {
  it('uploads to the booking-creatives bucket under the booking id', async () => {
    const file = new File(['content'], 'artwork.png', { type: 'image/png' })

    const path = await uploadBookingCreative(file, 'booking-1')

    expect(supabase.storage.from).toHaveBeenCalledWith('booking-creatives')
    expect(path.startsWith('booking-1/')).toBe(true)
    expect(path.endsWith('-artwork.png')).toBe(true)
  })
})

describe('getBookingCreativeUrl', () => {
  it('returns a signed url for the stored path', async () => {
    const url = await getBookingCreativeUrl('booking-1/artwork.png')
    expect(url).toBe('https://example.test/signed')
  })

  it('returns null when signing fails', async () => {
    const bucket = vi.mocked(supabase.storage.from)('booking-creatives')
    vi.mocked(bucket.createSignedUrl).mockResolvedValueOnce({
      data: null,
      error: new Error('not found'),
    } as never)
    vi.mocked(supabase.storage.from).mockReturnValueOnce(bucket)

    const url = await getBookingCreativeUrl('missing/path.png')
    expect(url).toBeNull()
  })
})
