import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BillboardGallery } from './BillboardGallery'
import { BillboardPhoto } from './BillboardPhoto'

const IMAGES = [
  'https://img.test/a.jpg',
  'https://img.test/b.jpg',
  'https://img.test/c.jpg',
]

function mainImage() {
  return screen.getByRole('img', { name: /photo \d of 3/ })
}

describe('BillboardGallery', () => {
  it('shows the placeholder and no controls without images', () => {
    render(<BillboardGallery images={[]} title="Main St" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Next photo' })).toBeNull()
  })

  it('shows a single image without navigation', () => {
    render(<BillboardGallery images={[IMAGES[0]]} title="Main St" />)
    expect(
      screen.getByRole('img', { name: 'Photo of Main St' }),
    ).toHaveAttribute('src', IMAGES[0])
    expect(screen.queryByRole('button', { name: 'Next photo' })).toBeNull()
  })

  it('navigates with the arrow keys, wrapping around', () => {
    render(<BillboardGallery images={IMAGES} title="Main St" />)
    const region = screen.getByRole('region', { name: 'Photos of Main St' })
    expect(mainImage()).toHaveAttribute('src', IMAGES[0])
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(mainImage()).toHaveAttribute('src', IMAGES[1])
    expect(mainImage()).toHaveAccessibleName('Main St — photo 2 of 3')
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    expect(mainImage()).toHaveAttribute('src', IMAGES[2])

    fireEvent.keyDown(region, { key: 'Home' })
    expect(mainImage()).toHaveAttribute('src', IMAGES[0])
    fireEvent.keyDown(region, { key: 'End' })
    expect(mainImage()).toHaveAttribute('src', IMAGES[2])
  })

  it('navigates with prev/next buttons and thumbnails', () => {
    render(<BillboardGallery images={IMAGES} title="Main St" />)
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(mainImage()).toHaveAttribute('src', IMAGES[1])
    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(mainImage()).toHaveAttribute('src', IMAGES[0])

    const third = screen.getByRole('button', { name: 'Show photo 3 of 3' })
    fireEvent.click(third)
    expect(mainImage()).toHaveAttribute('src', IMAGES[2])
    expect(third).toHaveAttribute('aria-current', 'true')
  })

  it('swipes on touch', () => {
    render(<BillboardGallery images={IMAGES} title="Main St" />)
    const target = mainImage().parentElement!.parentElement!
    fireEvent.touchStart(target, { touches: [{ clientX: 200 }] })
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 100 }] })
    expect(mainImage()).toHaveAttribute('src', IMAGES[1])
    // A small drag isn't a swipe.
    fireEvent.touchStart(target, { touches: [{ clientX: 100 }] })
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 120 }] })
    expect(mainImage()).toHaveAttribute('src', IMAGES[1])
    fireEvent.touchStart(target, { touches: [{ clientX: 100 }] })
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 200 }] })
    expect(mainImage()).toHaveAttribute('src', IMAGES[0])
  })
})

describe('BillboardPhoto', () => {
  it('lazy-loads and falls back to the placeholder on error', () => {
    render(
      <BillboardPhoto src="https://img.test/broken.jpg" alt="Photo of X" />,
    )
    const img = screen.getByRole('img', { name: 'Photo of X' })
    expect(img).toHaveAttribute('loading', 'lazy')
    fireEvent.error(img)
    expect(screen.queryByRole('img')).toBeNull()
  })
})
