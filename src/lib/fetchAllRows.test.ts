import { describe, expect, it, vi } from 'vitest'
import { fetchAllRows } from './fetchAllRows'

function rowsFor(from: number, to: number, total: number) {
  const rows: { n: number }[] = []
  for (let n = from; n <= Math.min(to, total - 1); n++) rows.push({ n })
  return rows
}

describe('fetchAllRows', () => {
  it('pages with inclusive ranges until a short page', async () => {
    const page = vi.fn((from: number, to: number) =>
      Promise.resolve({ data: rowsFor(from, to, 7), error: null }),
    )
    const rows = await fetchAllRows<{ n: number }>(page, 3)
    expect(rows.map((r) => r.n)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(page.mock.calls).toEqual([
      [0, 2],
      [3, 5],
      [6, 8],
    ])
  })

  it('makes one extra request when the total is an exact multiple of the page size', async () => {
    const page = vi.fn((from: number, to: number) =>
      Promise.resolve({ data: rowsFor(from, to, 4), error: null }),
    )
    const rows = await fetchAllRows(page, 2)
    expect(rows).toHaveLength(4)
    expect(page).toHaveBeenCalledTimes(3)
  })

  it('uses pages of 1000 by default and treats null data as empty', async () => {
    const page = vi.fn(() => Promise.resolve({ data: null, error: null }))
    await expect(fetchAllRows(page)).resolves.toEqual([])
    expect(page).toHaveBeenCalledWith(0, 999)
  })

  it('throws the first page error', async () => {
    const error = { message: 'permission denied' }
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ n: 0 }, { n: 1 }], error: null })
      .mockResolvedValueOnce({ data: null, error })
    await expect(fetchAllRows(page, 2)).rejects.toBe(error)
  })
})
