import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders the root layout without crashing', () => {
    render(<App />)
    expect(
      screen.getByRole('link', { name: 'Billboard Renting System' }),
    ).toBeInTheDocument()
  })
})
