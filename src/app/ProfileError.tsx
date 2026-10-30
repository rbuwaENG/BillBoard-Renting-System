import { Button, Card } from '@/components'
import { useAuth } from '@/hooks/useAuth'

const TITLE = "We couldn't load your profile"

// A session exists but the profile fetch failed (network, RLS, missing row):
// the visitor isn't logged out, so offer a retry instead of the login page.
// Shown in place of a guarded page.
export function ProfileErrorScreen() {
  const { isLoading, reloadProfile } = useAuth()
  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-4 py-16">
      <Card ticks role="alert" className="w-full max-w-lg p-8 sm:p-10">
        <span className="font-mono text-xs tracking-widest text-accent uppercase">
          Error
        </span>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {TITLE}
        </h1>
        <p className="mt-2 text-sm text-ink/60 dark:text-paper/60">
          You're still signed in, but your account details didn't load — usually
          a dropped connection. Try again in a moment.
        </p>
        <div className="mt-8">
          <Button disabled={isLoading} onClick={() => void reloadProfile()}>
            {isLoading ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// Small non-blocking notice under the header, so public pages stay usable.
export function ProfileErrorBanner() {
  const { isLoading, reloadProfile } = useAuth()
  return (
    <div
      role="alert"
      className="border-b border-brand-error/30 bg-brand-error/10 text-sm"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <span>{TITLE}. Some pages may be unavailable.</span>
        <Button
          size="sm"
          variant="secondary"
          disabled={isLoading}
          onClick={() => void reloadProfile()}
        >
          {isLoading ? 'Retrying…' : 'Retry'}
        </Button>
      </div>
    </div>
  )
}
