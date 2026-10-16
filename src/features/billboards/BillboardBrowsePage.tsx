import { useMemo, useState } from 'react'
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet'
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
import { TrafficLegend } from './TrafficLegend'
import { useBillboards, useBillboardsNear, type BillboardWithDetails } from './useBillboards'

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
  const { role } = useAuth()
  const { data: billboardsData } = useBillboards()
  const { data: myBookings } = useMyBookings()
  const billboards = useMemo(() => billboardsData ?? [], [billboardsData])
  const myBillboardIds = useMemo(
    () => new Set((myBookings ?? []).map((b) => b.billboardId)),
    [myBookings],
  )

  const [locateStatus, setLocateStatus] = useState<LocateStatus>('locating')
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailBillboard, setDetailBillboard] =
    useState<BillboardWithDetails | null>(null)
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

  function handleSelect(id: string) {
    setSelectedId(id)
    const list = nearMeActive ? (nearBillboardsData ?? billboards) : billboards
    setDetailBillboard(list.find((b) => b.id === id) ?? null)
  }

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
        billboards={billboards}
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
            <RenterBookingsControl onSelectBillboard={handleSelect} />
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
      />

      <BillboardDetailDialog
        billboard={detailBillboard}
        onClose={() => setDetailBillboard(null)}
        userCoords={userCoords}
      />
    </div>
  )
}
