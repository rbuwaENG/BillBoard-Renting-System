import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it(
    'renders the root layout without crashing',
    { timeout: 20_000 },
    async () => {
      render(<App />)
      // The index route is lazy, so the layout appears once its chunk loads.
      expect(
        await screen.findByRole(
          'link',
          { name: 'Billboard Renting System' },
          // First import of the map page is slow under vitest's transform.
          { timeout: 15_000 },
        ),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: 'Skip to content' }),
      ).toHaveAttribute('href', '#main-content')
    },
  )
})
