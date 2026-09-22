import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Button, Card } from '@/components'
import { BookingStatusBadge } from '@/features/bookings'
import { useRentorBookingStore } from './rentorBookingStore'

function formatDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const short: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', short)} – ${e.toLocaleDateString('en-US', { ...short, year: 'numeric' })}`
}

export function BookingInboxPanel() {
  const requests = useRentorBookingStore((s) => s.requests)
  const approve = useRentorBookingStore((s) => s.approve)
  const reject = useRentorBookingStore((s) => s.reject)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const sorted = [...requests].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )

  function confirmReject(id: string) {
    reject(id, reason.trim() || 'No reason given.')
    setRejectingId(null)
    setReason('')
  }

  return (
    <div className="space-y-3">
      {sorted.length === 0 && (
        <p className="py-10 text-center text-sm text-ink/40 dark:text-paper/40">
          No booking requests yet.
        </p>
      )}

      {sorted.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold tracking-tight">
                {r.billboardTitle}
              </p>
              <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                {r.renterName} · {formatDateRange(r.startDate, r.endDate)}
              </p>
            </div>
            <BookingStatusBadge status={r.status} />
          </div>

          {r.status === 'rejected' && r.rejectionReason && (
            <p className="mt-2 text-xs text-ink/50 italic dark:text-paper/50">
              Reason: {r.rejectionReason}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-accent">
              ${r.priceQuoted.toLocaleString()}
            </span>

            {r.status === 'pending_owner_review' && (
              <div className="flex gap-2">
                {rejectingId === r.id ? (
                  <>
                    <input
                      autoFocus
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for rejecting"
                      className="w-48 border-b border-ink/20 bg-transparent py-1 text-xs placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
                    />
                    <Button size="sm" variant="danger" onClick={() => confirmReject(r.id)}>
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRejectingId(null)
                        setReason('')
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={() => approve(r.id)}>
                      <Check className="size-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setRejectingId(r.id)}
                    >
                      <X className="size-3.5" />
                      Reject
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
