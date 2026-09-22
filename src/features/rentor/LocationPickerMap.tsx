import L from 'leaflet'
import { useEffect } from 'react'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { usePrefersDark } from '@/hooks/usePrefersDark'

// Same free, no-API-key Esri basemap as the public Browse map
// (src/features/billboards/BillboardBrowsePage.tsx) for visual consistency.
const LIGHT_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const DARK_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community'
// Matches BillboardBrowsePage's MAX_ZOOM: this Esri canvas basemap has no
// real tiles past 15 — maxNativeZoom must equal maxZoom so Leaflet upscales
// the last real tile instead of requesting one that doesn't exist (which is
// what renders as a "map data not available" placeholder tile).
const MAX_ZOOM = 15

const PIN_GLYPH = `
  <svg viewBox="0 0 32 32" fill="none" width="13" height="13">
    <rect x="2" y="4" width="28" height="15" rx="1" stroke="white" stroke-width="3"/>
    <path d="M9 19v3M23 19v3" stroke="white" stroke-width="3" stroke-linecap="square"/>
    <path d="M6.5 14.5l5-6 4 4.5 4-5.5 6 7" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`

function pinIcon() {
  return L.divIcon({
    html: `<div style="width:28px;height:28px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:#f2540c;border:2px solid #faf6ec;box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);">${PIN_GLYPH}</div></div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  })
}

function ClickToPick({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)))
    },
  })
  return null
}

// Imperatively re-centers the map only when `signal` changes (e.g. the
// dialog's "Use my location" button), not on every click/drag pick — those
// already land the marker where the user pointed, so re-flying to the same
// spot would just be a redundant animation.
function RecenterOnSignal({
  lat,
  lng,
  signal,
}: {
  lat: number
  lng: number
  signal: number
}) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 13), { duration: 0.75 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal])
  return null
}

interface LocationPickerMapProps {
  lat: number
  lng: number
  onPick: (lat: number, lng: number) => void
  recenterSignal: number
}

export function LocationPickerMap({
  lat,
  lng,
  onPick,
  recenterSignal,
}: LocationPickerMapProps) {
  const isDark = usePrefersDark()

  return (
    <div className="h-48 w-full overflow-hidden border border-ink/15 dark:border-paper/20">
      <MapContainer
        center={[lat, lng]}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={isDark ? DARK_TILE_URL : LIGHT_TILE_URL}
          maxZoom={MAX_ZOOM}
          maxNativeZoom={MAX_ZOOM}
        />
        <ClickToPick onPick={onPick} />
        <RecenterOnSignal lat={lat} lng={lng} signal={recenterSignal} />
        <Marker
          position={[lat, lng]}
          icon={pinIcon()}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const pos = e.target.getLatLng()
              onPick(Number(pos.lat.toFixed(5)), Number(pos.lng.toFixed(5)))
            },
          }}
        />
      </MapContainer>
    </div>
  )
}
