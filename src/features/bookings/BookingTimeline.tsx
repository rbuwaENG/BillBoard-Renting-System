import {
  Ban,
  Camera,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Hourglass,
  PartyPopper,
  Radio,
  Send,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components'
import { cn } from '@/lib/utils'
import type {
  TimelineActor,
  TimelineStage,
  TimelineStageState,
} from './bookingTimelineLogic'
import { ProofOfPostingGallery } from './ProofOfPostingGallery'

const STAGE_ICON: Record<string, LucideIcon> = {
  submitted: Send,
  review: Eye,
  'awaiting-info': FileText,
  payment: CreditCard,
  confirmed: CheckCircle2,
  posted: Camera,
  active: Radio,
  completed: PartyPopper,
  declined: XCircle,
  cancelled: Ban,
  expired: Hourglass,
}

const CIRCLE_CLASSES: Record<TimelineStageState, string> = {
  completed: 'border-brand-success bg-brand-success text-paper',
  current: 'border-accent text-accent bg-paper dark:bg-ink-soft',
  upcoming: 'border-ink/15 text-ink/30 dark:border-paper/15 dark:text-paper/30',
  blocked: 'border-brand-error bg-brand-error text-paper',
}

const LINE_CLASSES: Record<TimelineStageState, string> = {
  completed: 'bg-brand-success',
  current: 'bg-ink/15 dark:bg-paper/15',
  upcoming: 'bg-ink/15 dark:bg-paper/15',
  blocked: 'bg-brand-error/40',
}

const LABEL_CLASSES: Record<TimelineStageState, string> = {
  completed: 'text-ink dark:text-paper',
  current: 'text-accent',
  upcoming: 'text-ink/35 dark:text-paper/35',
  blocked: 'text-brand-error',
}

function actorLabel(
  actor: TimelineActor | undefined,
  viewerRole: 'renter' | 'owner',
): string | null {
  if (!actor) return null
  if (actor === 'platform') return "We'll update this automatically"
  if (actor === 'customer')
    return viewerRole === 'renter'
      ? 'Action needed from you'
      : 'Waiting on the renter'
  return viewerRole === 'owner'
    ? 'Action needed from you'
    : 'Waiting on the owner'
}

function formatStageTimestamp(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

interface BookingTimelineProps {
  stages: TimelineStage[]
  viewerRole: 'renter' | 'owner'
  primaryCta?: { label: string; onClick: () => void; pending?: boolean } | null
  secondaryActions?: ReactNode
}

export function BookingTimeline({
  stages,
  viewerRole,
  primaryCta,
  secondaryActions,
}: BookingTimelineProps) {
  const current = stages.find(
    (s) => s.state === 'current' || s.state === 'blocked',
  )
  const proofBookingId = stages.find(
    (s) => s.key === 'posted' && s.proofBookingId,
  )?.proofBookingId

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-0 sm:flex-row sm:items-start">
        {stages.map((stage, i) => {
          const Icon = STAGE_ICON[stage.key] ?? Eye
          const isLast = i === stages.length - 1
          return (
            <div
              key={stage.key}
              className="flex gap-3 sm:flex-1 sm:flex-col sm:items-center sm:gap-0"
            >
              <div className="flex flex-col items-center sm:w-full sm:flex-row">
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    CIRCLE_CLASSES[stage.state],
                  )}
                >
                  <Icon className="size-4" />
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      'my-1 w-0.5 min-h-[1.75rem] flex-1 sm:my-0 sm:ml-1 sm:h-0.5 sm:w-auto sm:min-h-0',
                      LINE_CLASSES[stage.state],
                    )}
                  />
                )}
              </div>
              <div className="pb-5 sm:px-1.5 sm:pt-2 sm:pb-0 sm:text-center">
                <p
                  className={cn(
                    'font-mono text-[11px] tracking-widest uppercase',
                    LABEL_CLASSES[stage.state],
                  )}
                >
                  {stage.label}
                </p>
                {stage.timestamp && (
                  <p className="mt-0.5 font-mono text-[10px] text-ink/40 dark:text-paper/40">
                    {formatStageTimestamp(stage.timestamp)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {proofBookingId && <ProofOfPostingGallery bookingId={proofBookingId} />}

      {current?.description && (
        <div className={cn('border-t border-ink/10 pt-4 dark:border-paper/10')}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'font-mono text-xs font-semibold tracking-wide uppercase',
                current.state === 'blocked'
                  ? 'text-brand-error'
                  : 'text-accent',
              )}
            >
              {current.label}
            </span>
            {actorLabel(current.actor, viewerRole) && (
              <span className="border border-ink/15 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-ink/50 uppercase dark:border-paper/15 dark:text-paper/50">
                {actorLabel(current.actor, viewerRole)}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-ink/70 dark:text-paper/70">
            {current.description}
          </p>

          {(primaryCta || secondaryActions) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {primaryCta && (
                <Button
                  size="sm"
                  onClick={primaryCta.onClick}
                  disabled={primaryCta.pending}
                >
                  {primaryCta.pending ? 'Working…' : primaryCta.label}
                </Button>
              )}
              {secondaryActions}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
