import { cn } from '@/lib/utils'

// The brand mark: a billboard panel on a single post, drawn as line art.
// Deliberately not "an icon inside a gradient-rounded-square" — that pattern
// is the fastest tell of a templated AI build.
export function BillboardMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('text-accent', className)}
      aria-hidden
    >
      <rect
        x="2"
        y="4"
        width="28"
        height="15"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M9 19v3M23 19v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        d="M6 28h8M18 28h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        opacity="0.4"
      />
      <path d="M6.5 14.5l5-6 4 4.5 4-5.5 6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
