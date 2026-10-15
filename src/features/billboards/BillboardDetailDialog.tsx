import * as Dialog from '@radix-ui/react-dialog'
import { Calendar, Check, MessageCircle, Plus, Star, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, BillboardMark, Button } from '@/components'
import { uploadBookingCreative } from '@/features/bookings/creativeStorage'
import {
  useAttachBookingCreative,
  useRequestBooking,
} from '@/features/bookings/useRequestBooking'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { RenterChatPanel } from '@/features/chat/RenterChatPanel'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { useAuth } from '@/hooks/useAuth'
import { distanceKm } from '@/lib/geohash'
import { cn } from '@/lib/utils'
import type { TrafficLevel } from '@/types'
import { useDistrictProfile } from './useDistrictProfile'
import type { BillboardWithDetails } from './useBillboards'

interface BillboardDetailDialogProps {
  billboard: BillboardWithDetails | null
  onClose: () => void
  userCoords: [number, number] | null
}

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

function formatPopulation(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
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
      <span className="font-mono text-xs tracking-widest text-ink/40 uppercase dark:text-paper/40">
        Site insights
      </span>
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
                {TRAFFIC_LABEL[billboard.trafficLevel]}
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

// Rough day/week/month packages computed from the daily rate — a future
// admin-managed pricing tiers feature could replace this with real tiers
// stored per billboard.
function pricingPackages(pricePerDay: number) {
  return [
    { label: 'Day', price: pricePerDay },
    { label: 'Week', price: Math.round(pricePerDay * 7 * 0.9) },
    { label: 'Month', price: Math.round(pricePerDay * 30 * 0.75) },
  ]
}

function RequestBookingForm({
  billboard,
  onDone,
}: {
  billboard: BillboardWithDetails
  onDone: () => void
}) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creativeFile, setCreativeFile] = useState<File | null>(null)
  const [uploadingCreative, setUploadingCreative] = useState(false)
  const requestBooking = useRequestBooking()
  const attachBookingCreative = useAttachBookingCreative()

  async function handleSubmit() {
    if (!startDate || !endDate) return
    try {
      const booking = await requestBooking.mutateAsync({
        billboardId: billboard.id,
        startDate,
        endDate,
      })
      if (creativeFile) {
        setUploadingCreative(true)
        try {
          const path = await uploadBookingCreative(creativeFile, booking.id)
          await attachBookingCreative.mutateAsync({
            bookingId: booking.id,
            creativePath: path,
          })
        } catch (err) {
          console.error('Creative upload failed:', err)
        } finally {
          setUploadingCreative(false)
        }
      }
      onDone()
    } catch {
      // error surfaced via requestBooking.error below
    }
  }

  return (
    <div className="space-y-4 border-t border-ink/10 pt-4 dark:border-paper/10">
      <span className="font-mono text-xs tracking-widest text-ink/40 uppercase dark:text-paper/40">
        Request booking
      </span>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-mono text-[11px] text-ink/50 uppercase dark:text-paper/50">
            Start
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border-b border-ink/20 bg-transparent py-1.5 text-sm focus:border-accent focus:outline-none dark:border-paper/20"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[11px] text-ink/50 uppercase dark:text-paper/50">
            End
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border-b border-ink/20 bg-transparent py-1.5 text-sm focus:border-accent focus:outline-none dark:border-paper/20"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block font-mono text-[11px] text-ink/50 uppercase dark:text-paper/50">
          Creative file (optional)
        </span>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setCreativeFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm file:mr-3 file:border file:border-ink/20 file:bg-transparent file:px-2 file:py-1 file:font-mono file:text-[11px] file:uppercase dark:file:border-paper/20"
        />
      </label>

      {requestBooking.isError && (
        <p className="text-xs text-brand-error">
          {(requestBooking.error as Error).message}
        </p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!startDate || !endDate || requestBooking.isPending || uploadingCreative}
        className="w-full"
      >
        {requestBooking.isPending
          ? 'Sending request…'
          : uploadingCreative
            ? 'Uploading creative…'
            : 'Send booking request'}
      </Button>
    </div>
  )
}

export function BillboardDetailDialog({
  billboard,
  onClose,
  userCoords,
}: BillboardDetailDialogProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const formatPrice = useFormatPrice()
  const [showChat, setShowChat] = useState(false)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const inDraft = useCampaignStore((s) =>
    billboard ? s.draftIds.includes(billboard.id) : false,
  )
  const toggleDraft = useCampaignStore((s) => s.toggleDraft)

  useEffect(() => {
    setShowChat(false)
    setShowBookingForm(false)
    setRequestSent(false)
  }, [billboard?.id])

  function requireLogin(action: () => void) {
    if (!user) {
      onClose()
      navigate('/login')
      return
    }
    action()
  }

  const isOwner = billboard && user && user.uid === billboard.ownerId

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
            <>
              <div className="relative flex h-40 shrink-0 items-center justify-center bg-paper-dim dark:bg-ink">
                <BillboardMark className="size-14 text-ink/10 dark:text-paper/10" />
                <span className="absolute top-3 left-3 bg-ink px-2 py-1 font-mono text-[11px] tracking-widest text-paper uppercase dark:bg-paper dark:text-ink">
                  {billboard.category}
                </span>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    title="Close"
                    className="absolute top-3 right-3 flex size-8 items-center justify-center border border-ink/10 bg-paper/90 text-ink shadow-md hover:border-ink/30 dark:border-paper/15 dark:bg-ink-soft/90 dark:text-paper dark:hover:border-paper/30"
                  >
                    <X className="size-4" />
                  </button>
                </Dialog.Close>
              </div>

              {showChat ? (
                <div className="flex-1 p-5 sm:p-6">
                  <RenterChatPanel
                    billboardId={billboard.id}
                    ownerName={billboard.ownerName}
                    onBack={() => setShowChat(false)}
                  />
                </div>
              ) : (
                <div className="flex-1 space-y-6 p-5 sm:p-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Dialog.Title className="font-display text-xl font-semibold tracking-tight">
                        {billboard.title}
                      </Dialog.Title>
                      <Badge
                        variant="accent"
                        className="border-brand-success/40 text-brand-success"
                      >
                        {billboard.status === 'active'
                          ? 'Available'
                          : billboard.status}
                      </Badge>
                      <button
                        type="button"
                        onClick={() =>
                          requireLogin(() => toggleDraft(billboard.id))
                        }
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
                    </div>
                    <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
                      {billboard.description}
                    </p>
                    <div className="mt-2 flex items-center gap-1 font-mono text-xs text-ink/60 dark:text-paper/60">
                      <Star className="size-3.5 fill-accent text-accent" />
                      {billboard.rating.avg.toFixed(1)}
                      <span className="text-ink/40 dark:text-paper/40">
                        ({billboard.rating.count} reviews)
                      </span>
                    </div>
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
                    <span className="font-mono text-xs tracking-widest text-ink/40 uppercase dark:text-paper/40">
                      Packages
                    </span>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {pricingPackages(billboard.pricePerDay).map((pkg) => (
                        <div
                          key={pkg.label}
                          className="border border-ink/10 p-3 text-center dark:border-paper/15"
                        >
                          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                            {pkg.label}
                          </span>
                          <p className="mt-1 font-mono text-sm font-semibold text-accent">
                            {formatPrice(pkg.price)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-ink/10 pt-4 dark:border-paper/10">
                    <span className="font-mono text-xs tracking-widest text-ink/40 uppercase dark:text-paper/40">
                      Owner
                    </span>

                    {user ? (
                      <div className="mt-2 space-y-3">
                        <p className="text-sm font-medium text-ink dark:text-paper">
                          {billboard.ownerName}
                        </p>
                        {!isOwner && (
                          <Button
                            onClick={() => setShowChat(true)}
                            className="w-full"
                          >
                            <MessageCircle className="size-4" />
                            Message {billboard.ownerName.split(' ')[0]}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-3">
                        <p className="text-sm text-ink/50 blur-[3px] select-none dark:text-paper/50">
                          {billboard.ownerName} · +__ ____ ______ ·
                          owner@example.com
                        </p>
                        <Button
                          onClick={() => {
                            onClose()
                            navigate('/login')
                          }}
                          className="w-full"
                        >
                          Log in to contact owner
                        </Button>
                      </div>
                    )}
                  </div>

                  {!isOwner &&
                    (requestSent ? (
                      <p className="border-t border-ink/10 pt-4 text-sm text-brand-success dark:border-paper/10">
                        Booking request sent — track its status from "My
                        activity".
                      </p>
                    ) : showBookingForm ? (
                      <RequestBookingForm
                        billboard={billboard}
                        onDone={() => {
                          setShowBookingForm(false)
                          setRequestSent(true)
                        }}
                      />
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          requireLogin(() => setShowBookingForm(true))
                        }
                        className="w-full"
                      >
                        <Calendar className="size-4" />
                        Request booking
                      </Button>
                    ))}
                </div>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
