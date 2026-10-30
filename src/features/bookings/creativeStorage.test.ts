import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import {
  getBookingCreativeUrl,
  getCreativeFilename,
  getCreativeKind,
  uploadBookingCreative,
} from './creativeStorage'

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

describe('getCreativeKind', () => {
  it.each([
    ['booking-1/uuid-photo.jpg', 'image'],
    ['booking-1/uuid-photo.PNG', 'image'],
    ['booking-1/uuid-clip.mp4', 'video'],
    ['booking-1/uuid-spec.pdf', 'pdf'],
    ['booking-1/uuid-notes.txt', 'other'],
  ] as const)('classifies %s as %s', (path, kind) => {
    expect(getCreativeKind(path)).toBe(kind)
  })
})

describe('getCreativeFilename', () => {
  it('strips the uuid prefix without cutting into the uuid itself', () => {
    expect(
      getCreativeFilename(
        'booking-1/3fa85f64-5717-4562-b3fc-2c963f66afa6-my-ad.png',
      ),
    ).toBe('my-ad.png')
  })

  it('returns the name as-is when there is no uuid prefix', () => {
    expect(getCreativeFilename('booking-1/my-ad.png')).toBe('my-ad.png')
  })
})
