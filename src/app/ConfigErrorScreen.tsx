import { BillboardMark, Card } from '@/components'

// Rendered by main.tsx instead of the app when the Supabase env vars are
// missing or malformed — far easier to act on than a blank page and a
// console stack trace.
export function ConfigErrorScreen({ problems }: { problems: string[] }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-paper px-4 py-16 text-ink dark:bg-ink dark:text-paper">
      <Card ticks className="w-full max-w-xl p-8 sm:p-10" role="alert">
        <div className="flex items-center gap-2.5">
          <BillboardMark className="size-7" />
          <span className="font-mono text-xs tracking-widest text-accent uppercase">
            Configuration error
          </span>
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          The app isn't configured yet
        </h1>
        <p className="mt-2 text-sm text-ink/60 dark:text-paper/60">
          It can't connect to Supabase because the build is missing required
          settings:
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 font-mono text-xs">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-ink/60 dark:text-paper/60">
          Copy <code className="font-mono text-xs">.env.example</code> to{' '}
          <code className="font-mono text-xs">.env.local</code>, fill in the
          values from your Supabase project (Project Settings → API), then
          restart the dev server or rebuild.
        </p>
      </Card>
    </div>
  )
}
