import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { Booking } from '@/types'
import { STATUS_LABEL } from './bookingStatus'
import type { BookingEvent } from './useBookingEvents'

function describeEvent(event: BookingEvent): string {
  if (event.eventType === 'document_requested') {
    return event.message
      ? `Requested documents: ${event.message}`
      : 'Requested additional documents'
  }
  if (event.eventType === 'document_uploaded') {
    return event.message ? `Uploaded "${event.message}"` : 'Uploaded a document'
  }
  if (event.eventType === 'proof_posted') {
    return event.message
      ? `Shared proof of posting "${event.message}"`
      : 'Shared proof of posting'
  }
  if (!event.fromStatus) return 'Submitted the booking request'
  if (event.toStatus) {
    const label =
      STATUS_LABEL[event.toStatus as keyof typeof STATUS_LABEL] ??
      event.toStatus
    return `Status changed to ${label}`
  }
  return 'Updated the booking'
}

function actorName(
  event: BookingEvent,
  booking: Booking,
  renterName: string,
  ownerName: string,
): string {
  if (!event.actorId) return 'Platform'
  if (event.actorId === booking.renterId) return renterName
  if (event.actorId === booking.ownerId) return ownerName
  return 'Platform'
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

interface BookingActivityHistoryProps {
  booking: Booking
  events: BookingEvent[]
  renterName: string
  ownerName: string
}

export function BookingActivityHistory({
  booking,
  events,
  renterName,
  ownerName,
}: BookingActivityHistoryProps) {
  const [open, setOpen] = useState(false)
  const sorted = [...events].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )

  return (
    <div className="border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between font-mono text-[11px] tracking-widest text-ink/50 uppercase hover:text-ink dark:text-paper/50 dark:hover:text-paper"
      >
        Activity history
        {open ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
      </button>
      {open && (
        <ul className="mt-3 space-y-2.5">
          {sorted.length === 0 && (
            <li className="text-sm text-ink/40 dark:text-paper/40">
              No activity recorded yet.
            </li>
          )}
          {sorted.map((event) => (
            <li
              key={event.id}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="text-ink dark:text-paper">
                  {describeEvent(event)}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-ink/40 dark:text-paper/40">
                  {actorName(event, booking, renterName, ownerName)}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-ink/40 dark:text-paper/40">
                {formatTimestamp(event.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
