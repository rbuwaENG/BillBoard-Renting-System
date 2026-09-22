import L from 'leaflet'
import { useEffect, useState } from 'react'
import { Circle, Marker, useMap } from 'react-leaflet'
import type { LocateStatus } from './locateStatus'

interface CurrentLocationLayerProps {
  onStatusChange: (status: LocateStatus) => void
  onLocated?: (coords: [number, number]) => void
  relocateTrigger?: number
  showGeofence?: boolean
  radiusKm?: number
}

// A plain HTML marker (not an SVG CircleMarker) for the "you are here" dot.
// Leaflet's SVG renderer CSS-scales the whole vector layer during a
// flyTo/zoom animation and only redraws paths once it settles — across a
// big zoom jump (e.g. 5 -> 14 on initial locate) that made a small
// CircleMarker balloon up to fill the screen mid-flight. A divIcon marker
// is repositioned, not scaled, by that same animation, so it stays a
// constant, correct size throughout.
function currentLocationIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:36px;height:36px;">
        <div class="animate-locate-pulse" style="position:absolute;inset:0;border-radius:9999px;border:1px solid #f2540c;opacity:0.4;"></div>
        <div style="position:absolute;top:50%;left:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:9999px;background:#f2540c;border:2px solid #faf6ec;"></div>
      </div>
    `,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

// Recenters the map on the visitor's current position via the browser
// Geolocation API. Falls back to leaving the map at its default view when
// permission is denied or geolocation isn't available — never blocks
// rendering the rest of the page. Re-locates on mount and again whenever
// `relocateTrigger` changes (the "near me" icon bumps it to re-fetch a
// fresh, exact position on demand).
export function CurrentLocationLayer({
  onStatusChange,
  onLocated,
  relocateTrigger = 0,
  showGeofence = false,
  radiusKm = 0,
}: CurrentLocationLayerProps) {
  const map = useMap()
  const [coords, setCoords] = useState<[number, number] | null>(null)

  useEffect(() => {
    // Guards against React StrictMode's dev-only double-invoke of this
    // effect: without it, two overlapping getCurrentPosition callbacks can
    // each call flyTo, and the second one restarts the first mid-animation
    // — the exact "bad transition" glitch this was fixing.
    let cancelled = false

    if (!('geolocation' in navigator)) {
      onStatusChange('unsupported')
      return
    }

    onStatusChange('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return
        const next: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ]
        setCoords(next)
        map.flyTo(next, 14, { duration: 1.75, easeLinearity: 0.15 })
        onStatusChange('found')
        onLocated?.(next)
      },
      () => {
        if (!cancelled) onStatusChange('denied')
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relocateTrigger])

  // A radius circle is often bigger than the viewport at the zoom level a
  // location-fly lands on — its edge would sit far off-screen and only a
  // barely-visible fill tint would show. Fit the view to the circle's
  // actual bounds whenever it's toggled visible (or resized) so the
  // coverage area is something you can actually see.
  useEffect(() => {
    if (!coords || !showGeofence || radiusKm <= 0) return
    const bounds = L.latLng(coords).toBounds(radiusKm * 2000)
    map.flyToBounds(bounds, { duration: 1, padding: [40, 40] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGeofence, radiusKm])

  if (!coords) return null

  return (
    <>
      {showGeofence && radiusKm > 0 && (
        <Circle
          center={coords}
          radius={radiusKm * 1000}
          pathOptions={{
            color: '#f2540c',
            weight: 1.5,
            fillColor: '#f2540c',
            fillOpacity: 0.1,
            dashArray: '6 6',
          }}
        />
      )}
      <Marker position={coords} icon={currentLocationIcon()} />
    </>
  )
}
