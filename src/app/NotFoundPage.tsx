import { NavLink } from 'react-router-dom'
import { Button } from '@/components'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-4 text-center">
      <span className="font-mono text-xs tracking-widest text-accent uppercase">
        Error — 04
      </span>
      <h1 className="mt-3 font-display text-7xl font-semibold tracking-tight sm:text-8xl">
        404
      </h1>
      <p className="mt-3 text-sm text-ink/60 dark:text-paper/60">
        That page doesn't exist or hasn't been built yet.
      </p>
      <Button asChild className="mt-8">
        <NavLink to="/">Back to browse</NavLink>
      </Button>
    </div>
  )
}
