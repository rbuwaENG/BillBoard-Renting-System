import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'
import { PageLoader } from './PageLoader'
import { router } from './router'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Shown until the first matched route's lazy chunk has loaded. */}
      <RouterProvider
        router={router}
        fallbackElement={<PageLoader fullScreen />}
      />
    </QueryClientProvider>
  )
}
