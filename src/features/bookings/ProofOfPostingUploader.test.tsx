import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProofOfPostingUploader } from './ProofOfPostingUploader'
import * as docsModule from './useBookingDocuments'
import type { BookingDocument } from './useBookingDocuments'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function proofDoc(i: number): BookingDocument {
  return {
    id: `doc-${i}`,
    bookingId: 'booking-1',
    uploadedBy: 'owner-1',
    storagePath: `booking-1/proof/${i}.jpg`,
    fileName: `${i}.jpg`,
    fileSize: 10,
    kind: 'proof_of_posting',
    createdAt: '2026-11-01T00:00:00.000Z',
  }
}

function image(name: string) {
  return new File(['x'], name, { type: 'image/jpeg' })
}

function setup(existing: number, mutateAsync = vi.fn(() => Promise.resolve())) {
  vi.spyOn(docsModule, 'useBookingDocuments').mockReturnValue({
    data: Array.from({ length: existing }, (_, i) => proofDoc(i)),
    isLoading: false,
  } as unknown as ReturnType<typeof docsModule.useBookingDocuments>)
  vi.spyOn(docsModule, 'useAddProofOfPosting').mockReturnValue({
    mutateAsync,
  } as unknown as ReturnType<typeof docsModule.useAddProofOfPosting>)
  render(<ProofOfPostingUploader bookingId="booking-1" />, { wrapper })
  return mutateAsync
}

function pick(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files } })
}

describe('ProofOfPostingUploader', () => {
  beforeEach(() => {
    let n = 0
    URL.createObjectURL = vi.fn(() => `blob:preview-${++n}`)
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('previews selected images and uploads each one', async () => {
    const mutateAsync = setup(0)
    pick([image('a.jpg'), image('b.jpg')])
    expect(screen.getByAltText('Preview of a.jpg')).toBeInTheDocument()
    expect(screen.getByAltText('Preview of b.jpg')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Upload 2 photos' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2))
    expect(mutateAsync).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      file: expect.objectContaining({ name: 'a.jpg' }),
    })
    expect(
      await screen.findByText('2 photos shared with the renter.'),
    ).toBeInTheDocument()
  })

  it('rejects non-images and enforces the 10-photo cap', () => {
    setup(9)
    pick([
      image('a.jpg'),
      image('b.jpg'),
      new File(['x'], 'c.pdf', { type: 'application/pdf' }),
    ])
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Only JPEG, PNG, WebP, GIF or AVIF images can be used as proof of posting. Only 1 more photo can be added (max 10 per booking).',
    )
    expect(screen.getByAltText('Preview of a.jpg')).toBeInTheDocument()
    expect(screen.queryByAltText('Preview of b.jpg')).not.toBeInTheDocument()
  })

  it('rejects SVG images (the bucket only takes an explicit list)', () => {
    setup(0)
    pick([new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })])
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Only JPEG, PNG, WebP, GIF or AVIF images can be used as proof of posting.',
    )
    expect(screen.queryByAltText('Preview of logo.svg')).not.toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp,image/gif,image/avif',
    )
  })

  it('hides the picker once the booking has 10 photos', () => {
    setup(10)
    expect(
      screen.getByText(/already has the maximum of 10 proof photos/),
    ).toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })

  it('keeps failed files selected with their error', async () => {
    const mutateAsync = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({
        message: 'A booking can have at most 10 proof-of-posting photos',
      })
    setup(0, mutateAsync)
    pick([image('ok.jpg'), image('bad.jpg')])
    fireEvent.click(screen.getByRole('button', { name: 'Upload 2 photos' }))

    expect(
      await screen.findByText(
        'A booking can have at most 10 proof-of-posting photos',
      ),
    ).toBeInTheDocument()
    expect(screen.getByAltText('Preview of bad.jpg')).toBeInTheDocument()
    expect(screen.queryByAltText('Preview of ok.jpg')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Upload 1 photo' }),
    ).toBeInTheDocument()
  })
})
