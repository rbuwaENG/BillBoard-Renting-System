import { Badge } from '@/components'
import { cn } from '@/lib/utils'
import type { BookingStatus } from '@/types'

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_owner_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  payment_pending: 'Payment pending',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_CLASSES: Record<BookingStatus, string> = {
  pending_owner_review: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
  approved: 'border-accent/40 text-accent',
  rejected: 'border-brand-error/40 text-brand-error',
  payment_pending: 'border-accent/40 text-accent',
  confirmed: 'border-brand-success/40 text-brand-success',
  active: 'border-brand-success bg-brand-success text-paper',
  completed: 'border-ink/15 text-ink/40 dark:border-paper/15 dark:text-paper/40',
  cancelled: 'border-brand-error/40 text-brand-error',
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge className={cn(STATUS_CLASSES[status])}>{STATUS_LABEL[status]}</Badge>
  )
}
