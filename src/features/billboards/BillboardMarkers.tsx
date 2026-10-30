import L from 'leaflet'
import { ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { getDisplayPrice } from './pricing'
import { TRAFFIC_COLORS, TRAFFIC_LABELS } from './trafficLevel'
import type { BillboardWithDetails } from './useBillboards'

// Same glyph as the brand mark (src/components/BillboardMark.tsx), inlined
// as raw SVG since Leaflet's divIcon only accepts an HTML string, not a
// React component.
const BILLBOARD_GLYPH = `
  <svg viewBox="0 0 32 32" fill="none" width="13" height="13" style="flex-shrink:0">
    <rect x="2" y="4" width="28" height="15" rx="1" stroke="currentColor" stroke-width="3"/>
    <path d="M9 19v3M23 19v3" stroke="currentColor" stroke-width="3" stroke-linecap="square"/>
    <path d="M6.5 14.5l5-6 4 4.5 4-5.5 6 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`

function priceTagIcon(
  formattedPrice: string,
  traffic: { color: string; label: string } | null,
  onSale: boolean,
) {
  // Colour dot plus a text equivalent (title + screen-reader text), so the
  // traffic level isn't conveyed by colour alone.
  const dot = traffic
    ? `<span title="${traffic.label}" style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:${traffic.color};flex-shrink:0" aria-hidden="true"></span><span class="sr-only">, ${traffic.label}</span>`
    : ''
  const background = onSale ? 'bg-accent' : 'bg-ink'
  return L.divIcon({
    html: `<div class="flex w-max items-center gap-1 justify-center border border-paper/40 ${background} px-2 py-1 font-mono text-[11px] font-semibold whitespace-nowrap text-paper shadow-md">${BILLBOARD_GLYPH}${formattedPrice}${dot}</div>`,
    className: '',
    iconSize: [64, 24],
    iconAnchor: [32, 24],
  })
}

interface BillboardMarkersProps {
  billboards: BillboardWithDetails[]
  selectedId: string | null
  onViewDetails: (id: string) => void
}

export function BillboardMarkers({
  billboards,
  selectedId,
  onViewDetails,
}: BillboardMarkersProps) {
  const map = useMap()
  const formatPrice = useFormatPrice()
  const markerRefs = useRef<Record<string, L.Marker | null>>({})

  useEffect(() => {
    if (!selectedId) return
    const billboard = billboards.find((b) => b.id === selectedId)
    if (!billboard) return
    map.flyTo([billboard.location.lat, billboard.location.lng], 13, {
      duration: 1,
    })
    markerRefs.current[selectedId]?.openPopup()
    // Re-run only when the selection changes, not on every billboards/map identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  return (
    <>
      {billboards.map((billboard) => {
        const { price, strikethroughFrom } = getDisplayPrice(billboard)
        return (
          <Marker
            key={billboard.id}
            position={[billboard.location.lat, billboard.location.lng]}
            icon={priceTagIcon(
              formatPrice(price),
              billboard.trafficLevel
                ? {
                    color: TRAFFIC_COLORS[billboard.trafficLevel],
                    label: TRAFFIC_LABELS[billboard.trafficLevel],
                  }
                : null,
              strikethroughFrom !== null,
            )}
            ref={(ref) => {
              markerRefs.current[billboard.id] = ref
            }}
          >
            <Popup>
              <button
                type="button"
                onClick={() => onViewDetails(billboard.id)}
                className="min-w-40 cursor-pointer text-left font-display"
              >
                <span className="inline-block bg-ink px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-widest text-paper uppercase dark:bg-paper dark:text-ink">
                  {billboard.category}
                </span>
                <h3 className="mt-0.5 text-sm font-semibold tracking-tight text-ink dark:text-paper">
                  {billboard.title}
                </h3>
                <p className="mt-0.5 text-xs text-ink/60 dark:text-paper/60">
                  {billboard.location.city} · {billboard.size}
                </p>
                {billboard.trafficLevel && (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink/60 dark:text-paper/60">
                    <span
                      className="inline-block size-1.5 rounded-full"
                      style={{
                        background: TRAFFIC_COLORS[billboard.trafficLevel],
                      }}
                    />
                    {TRAFFIC_LABELS[billboard.trafficLevel]}
                  </p>
                )}
                <p className="mt-1.5 flex items-baseline gap-1.5 font-mono text-sm font-semibold text-accent">
                  {strikethroughFrom !== null && (
                    <span className="text-xs font-normal text-ink/40 line-through dark:text-paper/40">
                      {formatPrice(strikethroughFrom)}
                    </span>
                  )}
                  {formatPrice(price)}
                  <span className="text-ink/40 dark:text-paper/40">/day</span>
                </p>
                <span className="mt-2 flex items-center gap-0.5 border-t border-ink/10 pt-1.5 text-[11px] font-medium text-accent dark:border-paper/15">
                  View details
                  <ChevronRight className="size-3" />
                </span>
              </button>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}
