import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import { RenterBookingsControl } from '@/features/renter'
import { useMyBookings } from '@/features/renter/useMyBookings'
import { useAdvanceBookingLifecycle } from '@/hooks/useAdvanceBookingLifecycle'
import { useAuth } from '@/hooks/useAuth'
import { usePrefersDark } from '@/hooks/usePrefersDark'
import { distanceKm } from '@/lib/geohash'
import { BillboardDetailDialog } from './BillboardDetailDialog'
import { BillboardMarkers } from './BillboardMarkers'
import { BillboardPanel } from './BillboardPanel'
import { CurrentLocationLayer } from './CurrentLocationLayer'
import type { LocateStatus } from './locateStatus'
import { MapOverlayControls } from './MapOverlayControls'
import { useMapPopoverStore, type ActivityTabKey } from './mapPopoverStore'
import { TrafficLegend } from './TrafficLegend'
import { useBillboard } from './useBillboard'
import { useBillboards, useBillboardsNear } from './useBillboards'

const ACTIVITY_TABS: ActivityTabKey[] = ['bookings', 'payments', 'campaigns', 'messages']

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629]
const MIN_ZOOM = 3
const MAX_ZOOM = 15
const DEFAULT_RADIUS_KM = 300

// Esri's free (no API key) canvas basemaps — muted light/dark grays built
// for exactly this "data overlay on top" use case, which also happens to
// suit the poster-flat brand palette better than a colorful street map.
// maxNativeZoom matches MAX_ZOOM so Leaflet upscales the last real tile
// instead of requesting one that doesn't exist (that's what was showing as
// a "no data available" placeholder tile when zoomed in further).
const LIGHT_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const DARK_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community'

export function BillboardBrowsePage() {
  useAdvanceBookingLifecycle()
  const { role, isLoading: authLoading } = useAuth()
  const {
    data: billboardsData,
    isLoading: billboardsLoading,
    isError: billboardsError,
    error: billboardsErrorValue,
    refetch: refetchBillboards,
  } = useBillboards()
  const { data: myBookings } = useMyBookings()
  const openActivity = useMapPopoverStore((s) => s.openActivity)
  const [searchParams, setSearchParams] = useSearchParams()
  const billboards = useMemo(() => billboardsData ?? [], [billboardsData])
  const myBillboardIds = useMemo(
    () => new Set((myBookings ?? []).map((b) => b.billboardId)),
    [myBookings],
  )

  const [locateStatus, setLocateStatus] = useState<LocateStatus>('locating')
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  )
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set())
  const [selectedDistricts, setSelectedDistricts] = useState<Set<string>>(
    new Set(),
  )
  const [priceMax, setPriceMax] = useState<number | null>(null)
  const [myBillboardsActive, setMyBillboardsActive] = useState(false)
  const [nearMeActive, setNearMeActive] = useState(false)
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM)
  const [showGeofence, setShowGeofence] = useState(false)
  const [relocateTrigger, setRelocateTrigger] = useState(0)
  const [manualDark, setManualDark] = useState<boolean | null>(null)
  const systemPrefersDark = usePrefersDark()
  const isDark = manualDark ?? systemPrefersDark

  const { data: nearBillboardsData } = useBillboardsNear(
    nearMeActive ? (userCoords?.[0] ?? null) : null,
    nearMeActive ? (userCoords?.[1] ?? null) : null,
    radiusKm,
  )

  const CATEGORIES = useMemo(
    () => Array.from(new Set(billboards.map((b) => b.category))),
    [billboards],
  )
  const SIZES = useMemo(
    () => Array.from(new Set(billboards.map((b) => b.size))),
    [billboards],
  )
  const DISTRICTS = useMemo(
    () =>
      Array.from(
        new Set(
          billboards
            .map((b) => b.district)
            .filter((d): d is string => Boolean(d)),
        ),
      ).sort(),
    [billboards],
  )
  const PRICE_BOUNDS = useMemo((): [number, number] => {
    if (billboards.length === 0) return [0, 100]
    const prices = billboards.map((b) => b.pricePerDay)
    return [
      Math.floor(Math.min(...prices) / 10) * 10,
      Math.ceil(Math.max(...prices) / 10) * 10,
    ]
  }, [billboards])
  const effectivePriceMax = priceMax ?? PRICE_BOUNDS[1]

  const baseList = useMemo(
    () => (nearMeActive ? (nearBillboardsData ?? []) : billboards),
    [nearMeActive, nearBillboardsData, billboards],
  )

  // Look the selection up in what's already loaded; only fetch it on its own
  // when it isn't in the active listing (e.g. "View on map" for a booking
  // whose billboard has since been unlisted, or a deep link).
  const listedDetail = useMemo(
    () =>
      detailId
        ? (billboards.find((b) => b.id === detailId) ??
          nearBillboardsData?.find((b) => b.id === detailId) ??
          null)
        : null,
    [detailId, billboards, nearBillboardsData],
  )
  const needsFetch = !!detailId && !listedDetail && !billboardsLoading
  const fetchedDetail = useBillboard(needsFetch ? detailId : null)
  const detailBillboard =
    listedDetail ?? (needsFetch ? (fetchedDetail.data ?? null) : null)
  const unlistedNotice =
    needsFetch && fetchedDetail.isFetched && !fetchedDetail.data
      ? fetchedDetail.isError
        ? "Couldn't load that billboard. Please try again."
        : 'That billboard is no longer listed, so it can’t be shown on the map.'
      : null

  function handleSelect(id: string, bookingId: string | null = null) {
    setSelectedId(id)
    setDetailId(id)
    setDetailBookingId(bookingId)
  }

  function closeDetail() {
    setDetailId(null)
    setDetailBookingId(null)
  }

  // Deep links: ?billboard=<id> (shared link / return from login),
  // ?booking=<id> (notifications), ?activity=<tab>. Consumed once, then
  // stripped from the URL.
  const billboardParam = searchParams.get('billboard')
  const bookingParam = searchParams.get('booking')
  const activityParam = searchParams.get('activity')
  useEffect(() => {
    if (!billboardParam && !bookingParam && !activityParam) return
    if (authLoading) return
    if (bookingParam && role === 'renter' && myBookings === undefined) return // wait for bookings
    const next = new URLSearchParams(searchParams)
    if (billboardParam) {
      handleSelect(billboardParam)
      next.delete('billboard')
    }
    if (bookingParam) {
      const booking = (myBookings ?? []).find((b) => b.id === bookingParam)
      if (booking) handleSelect(booking.billboardId, booking.id)
      else if (role === 'renter') openActivity('bookings')
      next.delete('booking')
    }
    if (activityParam) {
      if (role === 'renter') {
        openActivity(
          ACTIVITY_TABS.includes(activityParam as ActivityTabKey)
            ? (activityParam as ActivityTabKey)
            : 'bookings',
        )
      }
      next.delete('activity')
    }
    setSearchParams(next, { replace: true })
    // handleSelect/openActivity are stable in effect; re-run only on input changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billboardParam, bookingParam, activityParam, myBookings, role, authLoading])

  function toggleCategory(category: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  function toggleSize(size: string) {
    setSelectedSizes((prev) => {
      const next = new Set(prev)
      if (next.has(size)) next.delete(size)
      else next.add(size)
      return next
    })
  }

  function toggleDistrict(district: string) {
    setSelectedDistricts((prev) => {
      const next = new Set(prev)
      if (next.has(district)) next.delete(district)
      else next.add(district)
      return next
    })
  }

  function handleLocateMe() {
    setNearMeActive(true)
    setRelocateTrigger((t) => t + 1)
  }

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = baseList
    if (q) {
      list = list.filter((b) =>
        `${b.title} ${b.location.city} ${b.category}`
          .toLowerCase()
          .includes(q),
      )
    }
    if (selectedCategories.size > 0) {
      list = list.filter((b) => selectedCategories.has(b.category))
    }
    if (selectedSizes.size > 0) {
      list = list.filter((b) => selectedSizes.has(b.size))
    }
    if (selectedDistricts.size > 0) {
      list = list.filter(
        (b) => b.district !== null && selectedDistricts.has(b.district),
      )
    }
    list = list.filter((b) => b.pricePerDay <= effectivePriceMax)
    if (myBillboardsActive) {
      list = list.filter((b) => myBillboardIds.has(b.id))
    }
    return list
  }, [
    baseList,
    query,
    selectedCategories,
    selectedSizes,
    selectedDistricts,
    effectivePriceMax,
    myBillboardsActive,
    myBillboardIds,
  ])

  const baseEmptyMessage = myBillboardsActive
    ? "No billboards match your filters among the ones you've booked."
    : query.trim()
      ? `No billboards match "${query}".`
      : 'No billboards match the selected filters.'

  const { results, distanceById, emptyMessage } = useMemo(() => {
    if (!nearMeActive || !userCoords) {
      return {
        results: searched,
        distanceById: new Map<string, number>(),
        emptyMessage: baseEmptyMessage,
      }
    }
    const withDistance = searched
      .map((b) => ({
        billboard: b,
        km: distanceKm(userCoords, [b.location.lat, b.location.lng]),
      }))
      .sort((a, b) => a.km - b.km)

    return {
      results: withDistance.map((x) => x.billboard),
      distanceById: new Map(withDistance.map((x) => [x.billboard.id, x.km])),
      emptyMessage: `No billboards within ${radiusKm} km of your location.`,
    }
  }, [searched, nearMeActive, userCoords, radiusKm, baseEmptyMessage])

  return (
    <div className="relative h-[calc(100svh-4rem)] w-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={5}
        minZoom={MIN_ZOOM}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={isDark ? DARK_TILE_URL : LIGHT_TILE_URL}
          maxZoom={MAX_ZOOM}
          maxNativeZoom={MAX_ZOOM}
        />
        <ZoomControl position="bottomright" />
        <CurrentLocationLayer
          onStatusChange={setLocateStatus}
          onLocated={setUserCoords}
          relocateTrigger={relocateTrigger}
          showGeofence={showGeofence && nearMeActive}
          radiusKm={radiusKm}
        />
        <BillboardMarkers
          billboards={results}
          selectedId={selectedId}
          onViewDetails={handleSelect}
        />
      </MapContainer>

      <TrafficLegend />

      <MapOverlayControls
        isDark={isDark}
        onToggleTheme={() => setManualDark(!isDark)}
        categories={CATEGORIES}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        sizes={SIZES}
        selectedSizes={selectedSizes}
        onToggleSize={toggleSize}
        districts={DISTRICTS}
        selectedDistricts={selectedDistricts}
        onToggleDistrict={toggleDistrict}
        priceBounds={PRICE_BOUNDS}
        priceMax={effectivePriceMax}
        onPriceMaxChange={setPriceMax}
        myBillboardsActive={myBillboardsActive}
        onToggleMyBillboards={() => setMyBillboardsActive((v) => !v)}
        nearMeActive={nearMeActive}
        onLocateMe={handleLocateMe}
        onDisableNearMe={() => setNearMeActive(false)}
        nearMeDisabled={locateStatus !== 'found'}
        radiusKm={radiusKm}
        onRadiusChange={setRadiusKm}
        showGeofence={showGeofence}
        onToggleGeofence={() => setShowGeofence((v) => !v)}
        renterControl={
          role === 'renter' ? (
            <RenterBookingsControl
              onSelectBillboard={(id) => handleSelect(id)}
              onSelectBooking={(billboardId, bookingId) =>
                handleSelect(billboardId, bookingId)
              }
            />
          ) : undefined
        }
      />

      <BillboardPanel
        results={results}
        query={query}
        onQueryChange={setQuery}
        selectedId={selectedId}
        onSelect={handleSelect}
        locateStatus={locateStatus}
        distanceById={distanceById}
        emptyMessage={emptyMessage}
        isLoading={billboardsLoading}
        isError={billboardsError}
        error={billboardsErrorValue}
        onRetry={() => refetchBillboards()}
      />

      {unlistedNotice && (
        <div
          role="status"
          className="absolute bottom-14 left-1/2 z-[700] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-start gap-3 border border-ink/10 bg-paper p-3 text-sm shadow-lg dark:border-paper/15 dark:bg-ink-soft"
        >
          <p className="flex-1">{unlistedNotice}</p>
          <button
            type="button"
            onClick={closeDetail}
            title="Dismiss"
            aria-label="Dismiss"
            className="shrink-0 text-ink/40 hover:text-ink dark:text-paper/40 dark:hover:text-paper"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <BillboardDetailDialog
        billboard={detailBillboard}
        initialBookingId={detailBookingId}
        onClose={closeDetail}
        userCoords={userCoords}
      />
    </div>
  )
}
