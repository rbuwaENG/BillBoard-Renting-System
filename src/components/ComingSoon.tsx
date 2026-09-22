import type { LucideIcon } from 'lucide-react'
import { Badge } from './Badge'
import { Card } from './Card'

interface ComingSoonProps {
  icon: LucideIcon
  title: string
  description: string
  phase: string
  features: string[]
}

export function ComingSoon({
  icon: Icon,
  title,
  description,
  phase,
  features,
}: ComingSoonProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:py-20">
      <Card ticks className="p-8 sm:p-10">
        <div className="flex items-center justify-between">
          <Badge variant="accent">{phase}</Badge>
          <Icon className="size-5 text-ink/30 dark:text-paper/30" strokeWidth={1.75} />
        </div>

        <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-ink/60 dark:text-paper/60">
          {description}
        </p>

        <ol className="mt-8 space-y-4 border-t border-ink/10 pt-6 dark:border-paper/10">
          {features.map((feature, i) => (
            <li key={feature} className="flex items-baseline gap-4">
              <span className="font-mono text-xs text-accent tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-sm text-ink/80 dark:text-paper/80">
                {feature}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
