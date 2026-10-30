import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowLeft,
  Calendar,
  Check,
  Link2,
  MessageCircle,
  Plus,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, BillboardMark, Button, FileDropzone, Tabs } from '@/components'
import { currentPath, loginPath } from '@/features/auth/redirect'
import {
  BookingActivityHistory,
  BookingDocuments,
  BookingStatusBadge,
  BookingTimeline,
  CONTACT_UNLOCKED_STATUSES,
  ConfirmDialog,
  canCancelBooking,
  canUploadDocuments,
  computeBookingTimeline,
  getBookingPrimaryCta,
  splitBillboardBookings,
  useAddBookingDocument,
  useBookingEvents,
  useCancelBooking,
} from '@/features/bookings'
import {
  bookingDays,
  hasDateErrors,
  todayISO,
  validateDateRange,
} from '@/features/bookings/dateRange'
import { useBookingContact } from '@/features/bookings/useBookingContact'
import { useRequestBooking } from '@/features/bookings/useRequestBooking'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { RenterChatPanel } from '@/features/chat/RenterChatPanel'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { PAYMENT_STATE_MESSAGE } from '@/features/payments/paymentState'
import { formatDateRange } from '@/features/renter/formatDateRange'
import { MarkPaidDialog } from '@/features/renter/MarkPaidDialog'
import { ReviewDialog } from '@/features/renter/ReviewDialog'
import { useMyBookings, type MyBooking } from '@/features/renter/useMyBookings'
import { useAuth } from '@/hooks/useAuth'
import { distanceKm } from '@/lib/geohash'
import { cn } from '@/lib/utils'
import type { TrafficLevel } from '@/types'
import { getDisplayPrice, resolveEffectivePricePerDay } from './pricing'
import { RatingSummary } from './RatingSummary'
import { usePricingTiers } from './usePricingTiers'
import { useDistrictProfile } from './useDistrictProfile'
import type { BillboardWithDetails } from './useBillboards'

const MAX_CREATIVE_BYTES = 10 * 1024 * 1024

const TRAFFIC_LABEL: Record<TrafficLevel, string> = {
  light: 'Light',
  moderate: 'Moderate',
  heavy: 'Heavy',
}

const TRAFFIC_BADGE_CLASSES: Record<TrafficLevel, string> = {
  light: 'border-brand-success/40 text-brand-success',
  moderate: 'border-accent/40 text-accent',
  heavy: 'border-brand-error/40 text-brand-error',
}

// Keyed by string so statuses added server-side (e.g. 'archived') still get
// a sensible badge instead of the raw value.
const BILLBOARD_STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  active: {
    label: 'Available',
    className: 'border-brand-success/40 text-brand-success',
  },
  inactive: {
    label: 'Not listed',
    className:
      'border-ink/20 text-ink/50 dark:border-paper/20 dark:text-paper/50',
  },
  archived: {
    label: 'Archived',
    className:
      'border-ink/20 text-ink/50 dark:border-paper/20 dark:text-paper/50',
  },
  flagged: {
    label: 'Under review',
    className: 'border-brand-error/40 text-brand-error',
  },
}

function formatPopulation(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

function sectionLabelClass() {
  return 'font-mono text-xs tracking-widest text-ink/40 uppercase dark:text-paper/40'
}

function SiteInsights({
  billboard,
  userCoords,
}: {
  billboard: BillboardWithDetails
  userCoords: [number, number] | null
}) {
  const { data: districtProfile } = useDistrictProfile(billboard.district)
  const proximityKm = userCoords
    ? distanceKm(userCoords, [billboard.location.lat, billboard.location.lng])
    : null

  return (
    <div className="border-t border-ink/10 pt-4 dark:border-paper/10">
      <span className={sectionLabelClass()}>Site insights</span>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div className="border border-ink/10 p-3 dark:border-paper/15">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            District
          </span>
          <p className="mt-1 text-sm text-ink dark:text-paper">
            {billboard.district ?? 'Not available'}
          </p>
        </div>

        <div className="border border-ink/10 p-3 dark:border-paper/15">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Traffic
          </span>
          <p className="mt-1">
            {billboard.trafficLevel ? (
              <Badge className={TRAFFIC_BADGE_CLASSES[billboard.trafficLevel]}>
                {TRAFFIC_LABEL[billboard.trafficLevel]} traffic
              </Badge>
            ) : (
              <span className="text-sm text-ink/50 dark:text-paper/50">
                Not reported
              </span>
            )}
          </p>
        </div>

        <div className="border border-ink/10 p-3 dark:border-paper/15">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Audience (district)
          </span>
          {districtProfile ? (
            <>
              <p className="mt-1 text-sm text-ink dark:text-paper">
                {formatPopulation(districtProfile.population)} people
              </p>
              <p className="font-mono text-[11px] text-ink/50 dark:text-paper/50">
                {Math.round(districtProfile.populationDensity).toLocaleString()}
                /km² · 2012 Census
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink/50 dark:text-paper/50">—</p>
          )}
        </div>

        <div className="border border-ink/10 p-3 dark:border-paper/15">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Proximity
          </span>
          <p className="mt-1 text-sm text-ink dark:text-paper">
            {proximityKm !== null
              ? `${proximityKm.toFixed(1)} km from your location`
              : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

export interface RequestOutcome {
  creativeWarning: string | null
}

function RequestBookingForm({
  billboard,
  onDone,
  onCancel,
}: {
  billboard: BillboardWithDetails
  onDone: (outcome: RequestOutcome) => void
  onCancel: () => void
}) {
  const today = todayISO()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creativeFile, setCreativeFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploadingCreative, setUploadingCreative] = useState(false)
  const requestBooking = useRequestBooking()
  const addDocument = useAddBookingDocument()
  const { data: tiers } = usePricingTiers(billboard.id)
  const formatPrice = useFormatPrice()

  const dateErrors = validateDateRange(startDate, endDate, today)
  const datesInvalid = hasDateErrors(dateErrors)
  const days = datesInvalid ? 0 : bookingDays(startDate, endDate)
  const rate =
    days > 0 ? resolveEffectivePricePerDay(billboard, days, tiers) : null

  async function handleSubmit() {
    if (!startDate || !endDate || datesInvalid) return
    let booking: { id: string }
    try {
      booking = await requestBooking.mutateAsync({
        billboardId: billboard.id,
        startDate,
        endDate,
      })
    } catch {
      return // surfaced via requestBooking.error below
    }

    let creativeWarning: string | null = null
    if (creativeFile) {
      setUploadingCreative(true)
      try {
        await addDocument.mutateAsync({
          bookingId: booking.id,
          file: creativeFile,
          kind: 'creative',
        })
      } catch (err) {
        creativeWarning = `Your request was sent, but "${creativeFile.name}" couldn't be uploaded${
          err instanceof Error && err.message ? ` (${err.message})` : ''
        }. Open the booking's Documents tab to try again.`
      } finally {
        setUploadingCreative(false)
      }
    }
    onDone({ creativeWarning })
  }

  return (
    <div className="space-y-4 border-t border-ink/10 pt-4 dark:border-paper/10">
      <span className={sectionLabelClass()}>Request booking</span>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-mono text-[11px] text-ink/50 uppercase dark:text-paper/50">
            Start date
          </span>
          <input
            type="date"
            value={startDate}
            min={today}
            aria-invalid={!!dateErrors.start}
            aria-describedby={
              dateErrors.start ? 'request-start-error' : undefined
            }
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border-b border-ink/20 bg-transparent py-1.5 text-sm focus:border-accent focus:outline-none dark:border-paper/20"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[11px] text-ink/50 uppercase dark:text-paper/50">
            End date
          </span>
          <input
            type="date"
            value={endDate}
            min={startDate && startDate > today ? startDate : today}
            aria-invalid={!!dateErrors.end}
            aria-describedby={dateErrors.end ? 'request-end-error' : undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border-b border-ink/20 bg-transparent py-1.5 text-sm focus:border-accent focus:outline-none dark:border-paper/20"
          />
        </label>
      </div>
      {(dateErrors.start || dateErrors.end) && (
        <div className="space-y-1 text-xs text-brand-error">
          {dateErrors.start && (
            <p id="request-start-error">{dateErrors.start}</p>
          )}
          {dateErrors.end && <p id="request-end-error">{dateErrors.end}</p>}
        </div>
      )}

      <div>
        <span className="mb-1 block font-mono text-[11px] text-ink/50 uppercase dark:text-paper/50">
          Creative file (optional)
        </span>
        <FileDropzone
          accept="image/*,video/*,application/pdf"
          maxSizeBytes={MAX_CREATIVE_BYTES}
          hint="Image, video, or PDF — up to 10MB"
          onFilesSelected={(files) => {
            setFileError(null)
            setCreativeFile(files[0] ?? null)
          }}
          onError={(message) => {
            setCreativeFile(null)
            setFileError(message)
          }}
        />
        {fileError && (
          <p className="mt-1 text-xs text-brand-error">{fileError}</p>
        )}
        {creativeFile && (
          <p className="mt-1 flex items-center gap-2 font-mono text-[11px] text-ink/50 dark:text-paper/50">
            <span className="truncate">
              {creativeFile.type.startsWith('video/')
                ? 'Video'
                : creativeFile.type.startsWith('image/')
                  ? 'Image'
                  : creativeFile.type === 'application/pdf'
                    ? 'PDF'
                    : 'File'}{' '}
              selected · {creativeFile.name}
            </span>
            <button
              type="button"
              onClick={() => setCreativeFile(null)}
              className="shrink-0 text-accent uppercase hover:underline"
            >
              Remove
            </button>
          </p>
        )}
      </div>

      {rate !== null && (
        <p className="text-right font-mono text-sm text-accent">
          {days} day{days !== 1 ? 's' : ''} × {formatPrice(rate)}/day ={' '}
          <span className="font-semibold">{formatPrice(rate * days)}</span>
        </p>
      )}

      {requestBooking.isError && (
        <p role="alert" className="text-xs text-brand-error">
          {(requestBooking.error as Error).message}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={requestBooking.isPending || uploadingCreative}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            !startDate ||
            !endDate ||
            datesInvalid ||
            requestBooking.isPending ||
            uploadingCreative
          }
          className="flex-1"
        >
          {requestBooking.isPending
            ? 'Sending request…'
            : uploadingCreative
              ? 'Uploading creative…'
              : 'Send booking request'}
        </Button>
      </div>
    </div>
  )
}

function OwnerContact({
  billboard,
  booking,
  isOwner,
  onOpenChat,
  onLogin,
}: {
  billboard: BillboardWithDetails
  booking: MyBooking | null
  isOwner: boolean
  onOpenChat: () => void
  onLogin: () => void
}) {
  const { user } = useAuth()
  const unlocked = !!booking && CONTACT_UNLOCKED_STATUSES.has(booking.status)
  const contact = useBookingContact(booking?.id, unlocked)

  return (
    <div className="border-t border-ink/10 pt-4 dark:border-paper/10">
      <span className={sectionLabelClass()}>Owner</span>

      <div className="mt-2 space-y-3">
        <p className="text-sm font-medium text-ink dark:text-paper">
          {billboard.ownerName}
        </p>

        {!isOwner &&
          (unlocked ? (
            contact.isLoading ? (
              <p className="text-xs text-ink/50 dark:text-paper/50">
                Loading contact details…
              </p>
            ) : contact.isError || !contact.data ? (
              <p className="text-xs text-ink/50 dark:text-paper/50">
                Contact details aren't available right now — use Messages to
                reach the owner.
              </p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
                <dt className="text-ink/50 uppercase dark:text-paper/50">
                  Email
                </dt>
                <dd className="truncate">
                  {contact.data.email ? (
                    <a
                      href={`mailto:${contact.data.email}`}
                      className="text-accent hover:underline"
                    >
                      {contact.data.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt className="text-ink/50 uppercase dark:text-paper/50">
                  Phone
                </dt>
                <dd className="truncate">
                  {contact.data.phone ? (
                    <a
                      href={`tel:${contact.data.phone}`}
                      className="text-accent hover:underline"
                    >
                      {contact.data.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </dl>
            )
          ) : (
            <p className="text-xs text-ink/50 dark:text-paper/50">
              Contact details are shared once your booking is confirmed.
            </p>
          ))}

        {!isOwner &&
          (user ? (
            <Button onClick={onOpenChat} className="w-full">
              <MessageCircle className="size-4" />
              Message {billboard.ownerName.split(' ')[0]}
            </Button>
          ) : (
            <Button onClick={onLogin} className="w-full">
              Log in to contact owner
            </Button>
          ))}
      </div>
    </div>
  )
}

function BillboardOverview({
  billboard,
  userCoords,
  isOwner,
  contactBooking,
  onOpenChat,
  onLogin,
}: {
  billboard: BillboardWithDetails
  userCoords: [number, number] | null
  isOwner: boolean
  contactBooking: MyBooking | null
  onOpenChat: () => void
  onLogin: () => void
}) {
  const formatPrice = useFormatPrice()
  const { data: tiers } = usePricingTiers(billboard.id)
  const { price, strikethroughFrom } = getDisplayPrice(billboard)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink/60 dark:text-paper/60">
          {billboard.description}
        </p>
        <RatingSummary rating={billboard.rating} className="mt-2" />
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-ink/10 pt-4 font-mono text-xs dark:border-paper/10">
        <div>
          <span className="tracking-widest text-ink/40 uppercase dark:text-paper/40">
            Location
          </span>
          <p className="mt-1 text-sm text-ink dark:text-paper">
            {billboard.location.address}, {billboard.location.city}
          </p>
        </div>
        <div>
          <span className="tracking-widest text-ink/40 uppercase dark:text-paper/40">
            Size
          </span>
          <p className="mt-1 text-sm text-ink dark:text-paper">
            {billboard.size}
          </p>
        </div>
      </div>

      <SiteInsights billboard={billboard} userCoords={userCoords} />

      <div className="border-t border-ink/10 pt-4 dark:border-paper/10">
        <span className={sectionLabelClass()}>Price</span>
        <p className="mt-1 flex items-baseline gap-2 font-mono text-lg font-semibold text-accent">
          {strikethroughFrom !== null && (
            <span className="text-sm font-normal text-ink/40 line-through dark:text-paper/40">
              {formatPrice(strikethroughFrom)}
            </span>
          )}
          {formatPrice(price)}
          <span className="text-sm text-ink/40 dark:text-paper/40">/day</span>
        </p>
      </div>

      {tiers && tiers.length > 0 && (
        <div className="border-t border-ink/10 pt-4 dark:border-paper/10">
          <span className={sectionLabelClass()}>Packages</span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="border border-ink/10 p-3 text-center dark:border-paper/15"
              >
                <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                  {tier.minDays}
                  {tier.maxDays ? `–${tier.maxDays}` : '+'} days
                </span>
                <p className="mt-1 font-mono text-sm font-semibold text-accent">
                  {formatPrice(tier.pricePerDay)}
                  <span className="text-ink/40 dark:text-paper/40">/day</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <OwnerContact
        billboard={billboard}
        booking={contactBooking}
        isOwner={isOwner}
        onOpenChat={onOpenChat}
        onLogin={onLogin}
      />
    </div>
  )
}

function PastBookingsList({
  bookings,
  onView,
}: {
  bookings: MyBooking[]
  onView: (id: string) => void
}) {
  const formatPrice = useFormatPrice()
  if (bookings.length === 0) return null
  return (
    <div className="border-t border-ink/10 pt-4 dark:border-paper/10">
      <span className={sectionLabelClass()}>Your past bookings</span>
      <ul className="mt-2 space-y-1.5">
        {bookings.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 border border-ink/10 px-3 py-2 text-xs dark:border-paper/15"
          >
            <span className="font-mono text-ink/70 dark:text-paper/70">
              {formatDateRange(b.startDate, b.endDate)} ·{' '}
              {formatPrice(b.priceQuoted)}
            </span>
            <span className="flex items-center gap-2">
              <BookingStatusBadge status={b.status} />
              <button
                type="button"
                onClick={() => onView(b.id)}
                className="font-mono text-[11px] tracking-wide text-accent uppercase hover:underline"
              >
                View history
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const BOOKING_TABS = [
  { key: 'timeline', label: 'Status & Timeline' },
  { key: 'overview', label: 'Overview' },
  { key: 'documents', label: 'Documents' },
  { key: 'messages', label: 'Messages' },
]

interface BillboardDetailContentProps {
  billboard: BillboardWithDetails
  userCoords: [number, number] | null
  // When set (e.g. from a notification link), open on this booking's timeline.
  initialBookingId?: string | null
  // Rendered as a standalone page (/billboards/:id) instead of in a dialog.
  asPage?: boolean
  onClose?: () => void
  renderTitle: (title: string) => ReactNode
  closeButton?: ReactNode
}

// The full detail view — shared by the map's BillboardDetailDialog and the
// shareable BillboardPage. Remount (key by billboard id) to reset its state.
export function BillboardDetailContent({
  billboard,
  userCoords,
  initialBookingId = null,
  asPage = false,
  onClose,
  renderTitle,
  closeButton,
}: BillboardDetailContentProps) {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showChat, setShowChat] = useState(false)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [requestOutcome, setRequestOutcome] = useState<RequestOutcome | null>(
    null,
  )
  const [activeTab, setActiveTab] = useState('timeline')
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    initialBookingId,
  )
  const [reviewOpen, setReviewOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const inDraft = useCampaignStore((s) => s.draftIds.includes(billboard.id))
  const toggleDraft = useCampaignStore((s) => s.toggleDraft)

  const { data: myBookingsData } = useMyBookings()
  const cancelBooking = useCancelBooking()

  const { current: currentBooking, past: pastBookings } = useMemo(
    () => splitBillboardBookings(myBookingsData ?? [], billboard.id),
    [myBookingsData, billboard.id],
  )
  const selectedBooking = selectedBookingId
    ? ((myBookingsData ?? []).find(
        (b) => b.id === selectedBookingId && b.billboardId === billboard.id,
      ) ?? null)
    : null
  // The booking whose workspace (timeline/documents/messages) is shown: an
  // explicitly selected one, else the in-progress one. Past bookings never
  // take over the dialog on their own, so the renter can always book again.
  const activeBooking = selectedBooking ?? currentBooking
  const viewingPast = !!selectedBooking && selectedBooking !== currentBooking

  const { data: eventsData } = useBookingEvents(activeBooking?.id)
  const events = useMemo(() => eventsData ?? [], [eventsData])

  const isOwner = !!user && user.uid === billboard.ownerId
  // Renter-only actions: shown to renters and to logged-out visitors (who
  // are sent to log in), hidden for owners/admins.
  const canRent = !isOwner && (!user || role === 'renter')
  const isListed = billboard.status === 'active'
  const statusBadge = BILLBOARD_STATUS_BADGE[billboard.status] ?? {
    label: billboard.status,
    className:
      'border-ink/20 text-ink/50 dark:border-paper/20 dark:text-paper/50',
  }

  function requireLogin(action: () => void) {
    if (!user) {
      const back = asPage
        ? currentPath(location)
        : `/?billboard=${billboard.id}`
      onClose?.()
      navigate(loginPath(back))
      return
    }
    action()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/billboards/${billboard.id}`,
      )
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      setLinkCopied(false)
    }
  }

  const stages = useMemo(() => {
    if (!activeBooking) return []
    return computeBookingTimeline(activeBooking, events, {
      viewerRole: 'renter',
      ownerName: billboard.ownerName,
      renterName: user?.displayName ?? 'You',
      paymentState: activeBooking.paymentState,
    })
  }, [activeBooking, events, billboard.ownerName, user])

  const primaryCta = activeBooking
    ? getBookingPrimaryCta(activeBooking, events, {
        paymentState: activeBooking.paymentState,
        hasReview: !!activeBooking.review,
      })
    : null

  function handlePrimaryCta() {
    if (!primaryCta || !activeBooking) return
    if (primaryCta.key === 'upload-documents') setActiveTab('documents')
    else if (primaryCta.key === 'complete-payment') setPayOpen(true)
    else if (primaryCta.key === 'leave-review') setReviewOpen(true)
  }

  const cancellable =
    !!activeBooking &&
    canCancelBooking(activeBooking) &&
    activeBooking.paymentState !== 'submitted'

  const paymentNotice =
    activeBooking?.status === 'payment_pending' &&
    activeBooking.paymentState !== 'none'
      ? activeBooking.paymentState === 'paid'
        ? null
        : PAYMENT_STATE_MESSAGE[activeBooking.paymentState]
      : null

  const contactBooking =
    activeBooking ?? pastBookings.find((b) => b.status === 'completed') ?? null

  return (
    <>
      <div className="relative flex h-40 shrink-0 items-center justify-center overflow-hidden bg-paper-dim dark:bg-ink">
        {billboard.images[0] ? (
          <img
            src={billboard.images[0]}
            alt={billboard.title}
            className="size-full object-cover"
          />
        ) : (
          <BillboardMark className="size-14 text-ink/10 dark:text-paper/10" />
        )}
        <span className="absolute top-3 left-3 bg-ink px-2 py-1 font-mono text-[11px] tracking-widest text-paper uppercase dark:bg-paper dark:text-ink">
          {billboard.category}
        </span>
        {closeButton}
      </div>

      <div className="flex-1 space-y-5 p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {renderTitle(billboard.title)}
            <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
            {canRent && isListed && (
              <button
                type="button"
                aria-pressed={inDraft}
                onClick={() => requireLogin(() => toggleDraft(billboard.id))}
                className={cn(
                  'flex items-center gap-1 border px-2 py-0.5 font-mono text-[11px] uppercase transition-colors',
                  inDraft
                    ? 'border-accent bg-accent text-paper'
                    : 'border-ink/20 text-ink/60 hover:border-ink/40 dark:border-paper/20 dark:text-paper/60 dark:hover:border-paper/40',
                )}
              >
                {inDraft ? (
                  <Check className="size-3" />
                ) : (
                  <Plus className="size-3" />
                )}
                {inDraft ? 'In campaign' : 'Add to campaign'}
              </button>
            )}
            {isListed && (
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-1 border border-ink/20 px-2 py-0.5 font-mono text-[11px] text-ink/60 uppercase hover:border-ink/40 dark:border-paper/20 dark:text-paper/60 dark:hover:border-paper/40"
              >
                <Link2 className="size-3" />
                {linkCopied ? 'Copied' : 'Copy link'}
              </button>
            )}
          </div>
          {!isListed && !isOwner && (
            <p className="mt-3 flex items-start gap-2 border border-ink/15 p-3 text-xs text-ink/70 dark:border-paper/15 dark:text-paper/70">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              This billboard is no longer listed, so it can't be booked or added
              to a campaign. Your existing bookings stay available below.
            </p>
          )}
        </div>

        {!isOwner && activeBooking ? (
          <>
            {viewingPast && (
              <button
                type="button"
                onClick={() => {
                  setSelectedBookingId(null)
                  setActiveTab('timeline')
                }}
                className="flex items-center gap-1 font-mono text-[11px] tracking-wide text-accent uppercase hover:underline"
              >
                <ArrowLeft className="size-3" />
                {currentBooking
                  ? 'Back to current booking'
                  : 'Back to overview'}
              </button>
            )}
            <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink/50 uppercase dark:text-paper/50">
              {formatDateRange(activeBooking.startDate, activeBooking.endDate)}
              <BookingStatusBadge status={activeBooking.status} />
            </p>
            <Tabs
              items={BOOKING_TABS}
              active={activeTab}
              onChange={setActiveTab}
            />

            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <BookingTimeline
                  stages={stages}
                  viewerRole="renter"
                  primaryCta={
                    primaryCta
                      ? { label: primaryCta.label, onClick: handlePrimaryCta }
                      : null
                  }
                  secondaryActions={
                    cancellable ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={cancelBooking.isPending}
                        onClick={() => setCancelOpen(true)}
                      >
                        Cancel booking
                      </Button>
                    ) : undefined
                  }
                />
                {paymentNotice && (
                  <p
                    role="status"
                    className={cn(
                      'text-xs',
                      activeBooking.paymentState === 'rejected'
                        ? 'text-brand-error'
                        : 'text-accent',
                    )}
                  >
                    {paymentNotice}
                  </p>
                )}
                <BookingActivityHistory
                  booking={activeBooking}
                  events={events}
                  renterName={user?.displayName ?? 'You'}
                  ownerName={billboard.ownerName}
                />
                {!currentBooking && canRent && isListed && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      setSelectedBookingId(null)
                      setShowBookingForm(true)
                    }}
                  >
                    <Calendar className="size-4" />
                    Book again
                  </Button>
                )}
              </div>
            )}

            {activeTab === 'overview' && (
              <BillboardOverview
                billboard={billboard}
                userCoords={userCoords}
                isOwner={isOwner}
                contactBooking={activeBooking}
                onOpenChat={() => setActiveTab('messages')}
                onLogin={() => requireLogin(() => undefined)}
              />
            )}

            {activeTab === 'documents' && (
              <>
                {!canUploadDocuments(activeBooking.status) && (
                  <p className="text-xs text-ink/50 dark:text-paper/50">
                    This booking is closed — documents can no longer be added.
                  </p>
                )}
                <BookingDocuments
                  bookingId={activeBooking.id}
                  canUpload={canUploadDocuments(activeBooking.status)}
                  canRemove={
                    canUploadDocuments(activeBooking.status)
                      ? (doc) => doc.uploadedBy === user?.uid
                      : () => false
                  }
                />
              </>
            )}

            {activeTab === 'messages' && (
              <RenterChatPanel
                billboardId={billboard.id}
                ownerName={billboard.ownerName}
                onBack={() => setActiveTab('timeline')}
              />
            )}
          </>
        ) : showChat ? (
          <RenterChatPanel
            billboardId={billboard.id}
            ownerName={billboard.ownerName}
            onBack={() => setShowChat(false)}
          />
        ) : (
          <>
            <BillboardOverview
              billboard={billboard}
              userCoords={userCoords}
              isOwner={isOwner}
              contactBooking={contactBooking}
              onOpenChat={() => setShowChat(true)}
              onLogin={() => requireLogin(() => undefined)}
            />

            {canRent &&
              isListed &&
              (requestOutcome ? (
                <div className="space-y-2 border-t border-ink/10 pt-4 dark:border-paper/10">
                  <p role="status" className="text-sm text-brand-success">
                    Your request has been sent to {billboard.ownerName}. We'll
                    notify you when they respond — track its status from "My
                    activity".
                  </p>
                  {requestOutcome.creativeWarning && (
                    <p
                      role="alert"
                      className="flex items-start gap-2 text-xs text-brand-error"
                    >
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                      {requestOutcome.creativeWarning}
                    </p>
                  )}
                </div>
              ) : showBookingForm ? (
                <RequestBookingForm
                  billboard={billboard}
                  onCancel={() => setShowBookingForm(false)}
                  onDone={(outcome) => {
                    setShowBookingForm(false)
                    setRequestOutcome(outcome)
                  }}
                />
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => requireLogin(() => setShowBookingForm(true))}
                  className="w-full"
                >
                  <Calendar className="size-4" />
                  {pastBookings.length > 0 ? 'Book again' : 'Request booking'}
                </Button>
              ))}

            {!isOwner && (
              <PastBookingsList
                bookings={pastBookings}
                onView={(id) => {
                  setSelectedBookingId(id)
                  setActiveTab('timeline')
                }}
              />
            )}
          </>
        )}
      </div>

      {activeBooking && (
        <>
          <ReviewDialog
            bookingId={activeBooking.id}
            billboardTitle={billboard.title}
            open={reviewOpen}
            onOpenChange={setReviewOpen}
          />
          <MarkPaidDialog
            booking={
              payOpen
                ? { ...activeBooking, billboardTitle: billboard.title }
                : null
            }
            resubmit={activeBooking.paymentState === 'rejected'}
            onOpenChange={setPayOpen}
          />
          <ConfirmDialog
            open={cancelOpen}
            onOpenChange={(open) => {
              setCancelOpen(open)
              if (!open) cancelBooking.reset()
            }}
            title="Cancel this booking?"
            confirmLabel="Cancel booking"
            pendingLabel="Cancelling…"
            cancelLabel="Keep booking"
            destructive
            pending={cancelBooking.isPending}
            error={
              cancelBooking.isError
                ? (cancelBooking.error as Error).message
                : null
            }
            onConfirm={() =>
              cancelBooking.mutate(activeBooking.id, {
                onSuccess: () => setCancelOpen(false),
              })
            }
          >
            <p>
              Your request for {billboard.title} (
              {formatDateRange(activeBooking.startDate, activeBooking.endDate)})
              will be withdrawn and the owner notified. This can't be undone.
            </p>
          </ConfirmDialog>
        </>
      )}
    </>
  )
}

interface BillboardDetailDialogProps {
  billboard: BillboardWithDetails | null
  onClose: () => void
  userCoords: [number, number] | null
  initialBookingId?: string | null
}

export function BillboardDetailDialog({
  billboard,
  onClose,
  userCoords,
  initialBookingId,
}: BillboardDetailDialogProps) {
  return (
    <Dialog.Root
      open={billboard !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1900] bg-ink/50 backdrop-blur-[2px] dark:bg-ink/70" />
        <Dialog.Content
          className="fixed inset-0 z-[2000] flex flex-col overflow-y-auto border-ink/10 bg-paper shadow-xl focus:outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[85svh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:border dark:border-paper/15 dark:bg-ink-soft"
          aria-describedby={undefined}
        >
          {billboard && (
            <BillboardDetailContent
              key={`${billboard.id}:${initialBookingId ?? ''}`}
              billboard={billboard}
              userCoords={userCoords}
              initialBookingId={initialBookingId}
              onClose={onClose}
              renderTitle={(title) => (
                <Dialog.Title className="font-display text-xl font-semibold tracking-tight">
                  {title}
                </Dialog.Title>
              )}
              closeButton={
                <Dialog.Close asChild>
                  <button
                    type="button"
                    title="Close"
                    aria-label="Close"
                    className="absolute top-3 right-3 flex size-8 items-center justify-center border border-ink/10 bg-paper/90 text-ink shadow-md hover:border-ink/30 dark:border-paper/15 dark:bg-ink-soft/90 dark:text-paper dark:hover:border-paper/30"
                  >
                    <X className="size-4" />
                  </button>
                </Dialog.Close>
              }
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
