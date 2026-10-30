// PostgREST (and Supabase's default `max_rows`) silently caps a response at
// 1000 rows, so an unpaged select over a growing table quietly loses data.
// `fetchAllRows` pages through a query until a short page comes back.
//
// `page(from, to)` must return the query with `.range(from, to)` applied and
// a deterministic order (end with a unique column such as `.order('id')`),
// otherwise rows can repeat or go missing between pages.
export const FETCH_ALL_PAGE_SIZE = 1000

export interface RowsResult {
  data: unknown
  error: unknown
}

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<RowsResult>,
  pageSize = FETCH_ALL_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) throw error
    const batch = (data ?? []) as T[]
    for (const row of batch) rows.push(row)
    if (batch.length < pageSize) return rows
  }
}
