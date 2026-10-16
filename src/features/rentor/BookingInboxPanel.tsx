import { Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Card } from '@/components'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import {
  BookingActivityHistory,
  BookingDocuments,
  BookingStatusBadge,
  BookingTimeline,
  computeBookingTimeline,
  CreativeLink,
  useBookingEvents,
  useRequestBookingDocuments,
} from '@/features/bookings'
import { useAuth } from '@/hooks/useAuth'
import { useOwnerBookings, useRespondToBooking, type RentorBookingRequest } from './useRentorBookings'

function formatDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const short: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', short)} – ${e.toLocaleDateString('en-US', { ...short, year: 'numeric' })}`
}

const DOCUMENT_REQUESTABLE_STATUSES = new Set(['pending_owner_review', 'payment_pending'])

function BookingDetailsDisclosure({ request }: { request: RentorBookingRequest }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [note, setNote] = useState('')
  const { data: eventsData } = useBookingEvents(open ? request.id : null)
  const events = useMemo(() => eventsData ?? [], [eventsData])
  const requestDocuments = useRequestBookingDocuments()

  const ownerName = user?.displayName ?? 'You'

  const stages = useMemo(
    () =>
      computeBookingTimeline(request, events, {
        viewerRole: 'owner',
        ownerName,
        renterName: request.renterName,
      }),
    [request, events, ownerName],
  )

  const canRequestDocuments = DOCUMENT_REQUESTABLE_STATUSES.has(request.status)

  return (
    <div className="mt-3 border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-ink/50 uppercase hover:text-ink dark:text-paper/50 dark:hover:text-paper"
      >
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {open ? 'Hide timeline & documents' : 'View timeline & documents'}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <BookingTimeline stages={stages} viewerRole="owner" />

          {canRequestDocuments && (
            <div className="border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
              <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                Request documents
              </span>
              {showRequestForm ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What do you need? (e.g. final artwork)"
                    className="min-w-0 flex-1 border-b border-ink/20 bg-transparent py-1 text-xs placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
                  />
                  <Button
                    size="sm"
                    disabled={!note.trim() || requestDocuments.isPending}
                    onClick={() =>
                      requestDocuments.mutate(
                        { bookingId: request.id, note: note.trim() },
                        {
                          onSuccess: () => {
                            setNote('')
                            setShowRequestForm(false)
                          },
                        },
                      )
                    }
                  >
                    {requestDocuments.isPending ? 'Sending…' : 'Send'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowRequestForm(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="mt-2">
                  <Button size="sm" variant="secondary" onClick={() => setShowRequestForm(true)}>
                    Request documents
                  </Button>
                </div>
              )}
              {requestDocuments.isError && (
                <p className="mt-1.5 text-xs text-brand-error">
                  {(requestDocuments.error as Error).message}
                </p>
              )}
            </div>
          )}

          <div className="border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
            <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
              Documents
            </span>
            <div className="mt-2">
              <BookingDocuments bookingId={request.id} canUpload={false} canRemove={() => false} />
            </div>
          </div>

          <BookingActivityHistory
            booking={request}
            events={events}
            renterName={request.renterName}
            ownerName={ownerName}
          />
        </div>
      )}
    </div>
  )
}

export function BookingInboxPanel() {
  const formatPrice = useFormatPrice()
  const { data } = useOwnerBookings()
  const requests = data ?? []
  const respondToBooking = useRespondToBooking()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const sorted = [...requests].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )

  function confirmReject(id: string) {
    respondToBooking.mutate({
      bookingId: id,
      approve: false,
      reason: reason.trim() || 'No reason given.',
    })
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

          {r.creativeUrl && <CreativeLink path={r.creativeUrl} />}

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-accent">
              {formatPrice(r.priceQuoted)}
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
                    <Button
                      size="sm"
                      onClick={() =>
                        respondToBooking.mutate({ bookingId: r.id, approve: true })
                      }
                    >
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

          <BookingDetailsDisclosure request={r} />
        </Card>
      ))}
    </div>
  )
}
