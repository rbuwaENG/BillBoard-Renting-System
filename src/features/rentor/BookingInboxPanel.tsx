import { Camera, Check, ChevronDown, ChevronUp, Clock, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card } from '@/components'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import {
  BookingActivityHistory,
  BookingDocuments,
  BookingStatusBadge,
  BookingTimeline,
  computeBookingTimeline,
  CreativeLink,
  PROOF_UPLOAD_STATUSES,
  ProofOfPostingUploader,
  useBookingEvents,
  useRequestBookingDocuments,
} from '@/features/bookings'
import { formatDateRange } from '@/features/renter/formatDateRange'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { errorMessage } from './errors'
import { PanelError, PanelLoading } from './PanelState'
import {
  useOwnerBookings,
  useRespondToBooking,
  type RentorBookingRequest,
} from './useRentorBookings'

const DOCUMENT_REQUESTABLE_STATUSES = new Set([
  'pending_owner_review',
  'payment_pending',
])

function BookingDetailsDisclosure({
  request,
}: {
  request: RentorBookingRequest
}) {
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
        {open ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowRequestForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowRequestForm(true)}
                  >
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
              <BookingDocuments
                bookingId={request.id}
                canUpload={false}
                canRemove={() => false}
              />
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

// Contract 7: once a booking is paid, the owner shares photos of the
// installed creative. The renter sees them in the timeline's "Posted" step.
function ProofOfPostingAction({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
      <Button
        size="sm"
        variant={open ? 'ghost' : 'secondary'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Camera className="size-3.5" />
        {open ? 'Close proof of posting' : 'Upload proof of posting'}
      </Button>
      {open && (
        <div className="mt-3">
          <ProofOfPostingUploader bookingId={bookingId} />
        </div>
      )}
    </div>
  )
}

// Requests the owner hasn't answered expire 72h after creation (contract 3).
const RESPONSE_WINDOW_MS = 72 * 60 * 60 * 1000

const QUICK_REJECT_REASONS = [
  'Dates unavailable',
  'Creative doesn’t meet our content guidelines',
  'Billboard under maintenance',
]

// `'expired'` (contract 3) may not be in the shared BookingStatus type or the
// shared badge yet, so the inbox labels it itself.
type InboxStatus = RentorBookingRequest['status'] | 'expired'

const STATUS_FILTERS: { value: 'all' | InboxStatus; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_owner_review', label: 'Pending review' },
  { value: 'payment_pending', label: 'Payment pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
]

function InboxStatusBadge({ status }: { status: InboxStatus }) {
  if (status === 'expired') {
    return (
      <Badge className="border-ink/15 text-ink/40 dark:border-paper/15 dark:text-paper/40">
        Expired
      </Badge>
    )
  }
  return <BookingStatusBadge status={status} />
}

function respondByHint(createdAt: string, now: number) {
  const deadline = new Date(createdAt).getTime() + RESPONSE_WINDOW_MS
  if (Number.isNaN(deadline)) return null
  if (deadline <= now) {
    return {
      overdue: true,
      text: 'Response window passed — this request will expire shortly',
    }
  }
  const formatted = new Date(deadline).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const hoursLeft = Math.floor((deadline - now) / (60 * 60 * 1000))
  return {
    overdue: false,
    urgent: hoursLeft < 24,
    text: `Respond by ${formatted}${hoursLeft < 24 ? ` (${hoursLeft < 1 ? 'under 1' : hoursLeft}h left)` : ''}`,
  }
}

// Pending requests first (oldest first — they expire soonest), then
// everything else newest first.
function sortInboxRequests(requests: RentorBookingRequest[]) {
  return [...requests].sort((a, b) => {
    const aPending = a.status === 'pending_owner_review'
    const bPending = b.status === 'pending_owner_review'
    if (aPending !== bPending) return aPending ? -1 : 1
    return aPending
      ? a.createdAt.localeCompare(b.createdAt)
      : b.createdAt.localeCompare(a.createdAt)
  })
}

export function BookingInboxPanel() {
  const formatPrice = useFormatPrice()
  const { data, isLoading, isError, error, refetch } = useOwnerBookings()
  const requests = useMemo(() => data ?? [], [data])
  const respondToBooking = useRespondToBooking()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | InboxStatus>('all')
  const [billboardFilter, setBillboardFilter] = useState('all')
  // Captured once per mount; good enough for an "hours left" hint.
  const [now] = useState(() => Date.now())

  const billboardOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const r of requests) byId.set(r.billboardId, r.billboardTitle)
    return Array.from(byId, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title),
    )
  }, [requests])

  const visible = useMemo(
    () =>
      sortInboxRequests(
        requests.filter(
          (r) =>
            (statusFilter === 'all' || r.status === statusFilter) &&
            (billboardFilter === 'all' || r.billboardId === billboardFilter),
        ),
      ),
    [requests, statusFilter, billboardFilter],
  )

  const pendingId = respondToBooking.isPending
    ? respondToBooking.variables?.bookingId
    : undefined
  const failedId = respondToBooking.isError
    ? respondToBooking.variables?.bookingId
    : undefined

  function approve(id: string) {
    if (respondToBooking.isPending) return
    respondToBooking.mutate({ bookingId: id, approve: true })
  }

  function confirmReject(id: string) {
    const trimmed = reason.trim()
    if (!trimmed || respondToBooking.isPending) return
    respondToBooking.mutate(
      { bookingId: id, approve: false, reason: trimmed },
      {
        onSuccess: () => {
          setRejectingId(null)
          setReason('')
        },
      },
    )
  }

  if (isLoading) return <PanelLoading label="Loading booking requests…" />
  if (isError) {
    return (
      <PanelError
        error={error}
        onRetry={() => refetch()}
        label="Couldn't load your booking requests."
      />
    )
  }

  const filtersActive = statusFilter !== 'all' || billboardFilter !== 'all'
  const selectClass =
    'border-b border-ink/20 bg-transparent py-1.5 text-xs focus:border-accent focus:outline-none dark:border-paper/20'

  return (
    <div className="space-y-3">
      {requests.length > 0 && (
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | InboxStatus)
              }
              className={selectClass}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          {billboardOptions.length > 1 && (
            <label className="block">
              <span className="mb-1 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                Billboard
              </span>
              <select
                value={billboardFilter}
                onChange={(e) => setBillboardFilter(e.target.value)}
                className={cn(selectClass, 'max-w-[14rem]')}
              >
                <option value="all">All billboards</option>
                {billboardOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {filtersActive && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setStatusFilter('all')
                setBillboardFilter('all')
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink/40 dark:text-paper/40">
          No booking requests yet.
        </p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink/40 dark:text-paper/40">
          No booking requests match these filters.
        </p>
      ) : null}

      {visible.map((r) => {
        const status = r.status as InboxStatus
        const isPendingReview = status === 'pending_owner_review'
        const responding = pendingId === r.id
        const respondError =
          failedId === r.id ? errorMessage(respondToBooking.error) : null
        const hint = isPendingReview ? respondByHint(r.createdAt, now) : null
        return (
          <Card
            key={r.id}
            className={cn('p-4', isPendingReview && 'border-accent/40')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold tracking-tight">
                  {r.billboardTitle}
                </p>
                <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                  {r.renterName} · {formatDateRange(r.startDate, r.endDate)}
                </p>
              </div>
              <InboxStatusBadge status={status} />
            </div>

            {hint && (
              <p
                className={cn(
                  'mt-2 flex items-center gap-1.5 font-mono text-[11px] tracking-wide',
                  hint.overdue || hint.urgent
                    ? 'text-brand-error'
                    : 'text-ink/50 dark:text-paper/50',
                )}
              >
                <Clock className="size-3.5 shrink-0" />
                {hint.text}
              </p>
            )}

            {status === 'expired' && (
              <p className="mt-2 text-xs text-ink/50 italic dark:text-paper/50">
                This request expired before it was answered or paid for.
              </p>
            )}

            {status === 'rejected' && r.rejectionReason && (
              <p className="mt-2 text-xs text-ink/50 italic dark:text-paper/50">
                Reason: {r.rejectionReason}
              </p>
            )}

            {r.creativeUrl && <CreativeLink path={r.creativeUrl} />}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm font-semibold text-accent">
                {formatPrice(r.priceQuoted)}
              </span>

              {isPendingReview && rejectingId !== r.id && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={respondToBooking.isPending}
                    onClick={() => approve(r.id)}
                  >
                    <Check className="size-3.5" />
                    {responding ? 'Approving…' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={respondToBooking.isPending}
                    onClick={() => {
                      setRejectingId(r.id)
                      setReason('')
                    }}
                  >
                    <X className="size-3.5" />
                    Reject
                  </Button>
                </div>
              )}
            </div>

            {isPendingReview && rejectingId === r.id && (
              <div className="mt-3 border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
                <label className="block">
                  <span className="mb-1 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                    Reason (shared with the renter)
                  </span>
                  <input
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        confirmReject(r.id)
                      }
                    }}
                    placeholder="Reason for rejecting"
                    className="w-full border-b border-ink/20 bg-transparent py-1 text-xs placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
                  />
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_REJECT_REASONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setReason(q)}
                      className="border border-ink/15 px-2 py-0.5 text-[11px] text-ink/60 hover:border-accent hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none dark:border-paper/15 dark:text-paper/60 dark:hover:text-paper"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={responding}
                    onClick={() => {
                      setRejectingId(null)
                      setReason('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!reason.trim() || respondToBooking.isPending}
                    onClick={() => confirmReject(r.id)}
                  >
                    {responding ? 'Rejecting…' : 'Confirm reject'}
                  </Button>
                </div>
              </div>
            )}

            {respondError && (
              <p role="alert" className="mt-2 text-xs text-brand-error">
                Couldn't update this request: {respondError}
              </p>
            )}

            {PROOF_UPLOAD_STATUSES.has(status) && (
              <ProofOfPostingAction bookingId={r.id} />
            )}

            <BookingDetailsDisclosure request={r} />
          </Card>
        )
      })}
    </div>
  )
}
