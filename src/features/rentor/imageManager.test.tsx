import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BillboardImageManager } from './BillboardImageManager'
import {
  MAX_IMAGE_BYTES,
  imageFileError,
  makeCover,
  markUploaded,
  moveItem,
  removeAt,
  storedItems,
  useRevokeRemovedPreviews,
  type ImageItem,
} from './imageManager'

describe('image list helpers', () => {
  it('moves, removes and sets the cover without mutating', () => {
    const list = ['a', 'b', 'c', 'd']
    expect(moveItem(list, 1, 2)).toEqual(['a', 'c', 'b', 'd'])
    expect(moveItem(list, 0, -1)).toBe(list)
    expect(moveItem(list, 3, 4)).toBe(list)
    expect(removeAt(list, 1)).toEqual(['a', 'c', 'd'])
    expect(makeCover(list, 2)).toEqual(['c', 'a', 'b', 'd'])
    expect(list).toEqual(['a', 'b', 'c', 'd'])
  })

  it('swaps an uploaded file in place, keeping its position', () => {
    const file = new File(['x'], 'new.png', { type: 'image/png' })
    const items: ImageItem[] = [
      { kind: 'new', key: 'n1', file, previewUrl: 'blob:1' },
      ...storedItems(['https://img.test/a.jpg']),
    ]
    const next = markUploaded(items, 'n1', 'https://img.test/new.png')
    expect(next[0]).toEqual({
      kind: 'stored',
      key: 'n1',
      url: 'https://img.test/new.png',
    })
    expect(next[1]).toBe(items[1])
  })

  it('validates type and the 5MB limit', () => {
    expect(
      imageFileError(new File(['x'], 'a.pdf', { type: 'application/pdf' })),
    ).toMatch(/isn't an image/)
    const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: MAX_IMAGE_BYTES + 1 })
    expect(imageFileError(big)).toMatch(/max 5MB/)
    expect(
      imageFileError(new File(['x'], 'ok.jpg', { type: 'image/jpeg' })),
    ).toBeNull()
  })
})

describe('useRevokeRemovedPreviews', () => {
  it('revokes previews that leave the list, and the rest on unmount', () => {
    const revoke = vi.fn()
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const a: ImageItem = { kind: 'new', key: 'a', file, previewUrl: 'blob:a' }
    const b: ImageItem = { kind: 'new', key: 'b', file, previewUrl: 'blob:b' }
    const { rerender, unmount } = renderHook(
      ({ items }) => useRevokeRemovedPreviews(items, revoke),
      { initialProps: { items: [a, b] } },
    )
    expect(revoke).not.toHaveBeenCalled()
    rerender({ items: [b] })
    expect(revoke).toHaveBeenCalledWith('blob:a')
    expect(revoke).toHaveBeenCalledTimes(1)
    unmount()
    expect(revoke).toHaveBeenCalledWith('blob:b')
  })
})

function Harness({ initial }: { initial: ImageItem[] }) {
  const [items, setItems] = useState(initial)
  return (
    <>
      <BillboardImageManager items={items} onChange={setItems} />
      <output data-testid="order">
        {items
          .map((i) => (i.kind === 'stored' ? i.url : i.file.name))
          .join(',')}
      </output>
    </>
  )
}

describe('BillboardImageManager', () => {
  const initial = storedItems(['a.jpg', 'b.jpg', 'c.jpg'])
  const order = () => screen.getByTestId('order').textContent

  it('marks the first image as the cover', () => {
    render(<Harness initial={initial} />)
    expect(
      screen.getByRole('img', { name: 'Listing image 1 of 3 (cover)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Move image 1 of 3 left' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move image 3 of 3 right' }),
    ).toBeDisabled()
  })

  it('reorders with move left/right and set as cover', () => {
    render(<Harness initial={initial} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Move image 1 of 3 right' }),
    )
    expect(order()).toBe('b.jpg,a.jpg,c.jpg')
    fireEvent.click(
      screen.getByRole('button', { name: 'Move image 3 of 3 left' }),
    )
    expect(order()).toBe('b.jpg,c.jpg,a.jpg')
    fireEvent.click(
      screen.getByRole('button', { name: 'Set image 3 of 3 as cover' }),
    )
    expect(order()).toBe('a.jpg,b.jpg,c.jpg')
  })

  it('removes an image', () => {
    render(<Harness initial={initial} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 2 of 3' }))
    expect(order()).toBe('a.jpg,c.jpg')
  })

  it('adds picked images with previews, rejecting oversized ones', () => {
    const createObjectURL = vi.fn(() => 'blob:preview')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL }))
    const { container } = render(<Harness initial={initial} />)
    const input = container.querySelector('input[type="file"]')!
    const ok = new File(['x'], 'new.png', { type: 'image/png' })
    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: MAX_IMAGE_BYTES + 1 })
    fireEvent.change(input, { target: { files: [ok, big] } })

    expect(order()).toBe('a.jpg,b.jpg,c.jpg,new.png')
    expect(createObjectURL).toHaveBeenCalledWith(ok)
    expect(screen.getByRole('alert')).toHaveTextContent(
      '"big.png" is too large',
    )
    expect(
      screen.getByRole('img', { name: 'Listing image 4 of 4' }),
    ).toHaveAttribute('src', 'blob:preview')
    vi.unstubAllGlobals()
  })
})
