import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query'
import { useMemo } from 'react'
import { PAGE_SIZE } from './adminUtils'

// "Load more" paging for the admin tables: each page fetches PAGE_SIZE rows
// with `.range(from, to)`; a short page means there's nothing further.
// Search/filter on top of the loaded rows stays client-side — server-side
// search/aggregation is out of scope for this round.
export function usePagedQuery<T>(
  queryKey: QueryKey,
  fetchPage: (from: number, to: number) => Promise<T[]>,
) {
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE
      return fetchPage(from, from + PAGE_SIZE - 1)
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length,
  })
  const items = useMemo(() => query.data?.pages.flat() ?? [], [query.data])
  return { ...query, items }
}
