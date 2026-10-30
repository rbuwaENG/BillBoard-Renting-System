import { LocateFixed, Moon, ShoppingCart, SlidersHorizontal, Sun, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { currentPath, loginPath } from '@/features/auth/redirect'
import { CampaignDraftForm } from '@/features/campaigns/CampaignDraftForm'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { useListedDraft } from '@/features/campaigns/useListedDraft'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { MapIconButton } from './MapIconButton'
import { useMapPopoverStore } from './mapPopoverStore'

interface MapOverlayControlsProps {
  isDark: boolean
  onToggleTheme: () => void
  categories: string[]
  selectedCategories: Set<string>
  onToggleCategory: (category: string) => void
  sizes: string[]
  selectedSizes: Set<string>
  onToggleSize: (size: string) => void
  districts: string[]
  selectedDistricts: Set<string>
  onToggleDistrict: (district: string) => void
  priceBounds: [number, number]
  priceMax: number
  onPriceMaxChange: (price: number) => void
  myBillboardsActive: boolean
  onToggleMyBillboards: () => void
  nearMeActive: boolean
  onLocateMe: () => void
  onDisableNearMe: () => void
  nearMeDisabled: boolean
  radiusKm: number
  onRadiusChange: (km: number) => void
  showGeofence: boolean
  onToggleGeofence: () => void
  renterControl?: ReactNode
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'border px-2 py-1 font-mono text-[11px] uppercase transition-colors',
        active
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-ink/15 text-ink/60 hover:border-ink/30 dark:border-paper/15 dark:text-paper/60 dark:hover:border-paper/30',
      )}
    >
      {children}
    </button>
  )
}

function CampaignControl() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const open = useMapPopoverStore((s) => s.active === 'campaign')
  const togglePopover = useMapPopoverStore((s) => s.toggle)
  const closePopover = useMapPopoverStore((s) => s.close)
  const removeFromDraft = useCampaignStore((s) => s.removeFromDraft)
  const { draftBillboards, staleIds, count } = useListedDraft()

  // Cart is a renter feature; logged-out visitors still see it (→ log in).
  if (user && role !== 'renter') return null

  function handleToggleOpen() {
    if (!user) {
      navigate(loginPath(currentPath(location)))
      return
    }
    togglePopover('campaign')
  }

  return (
    <div className="pointer-events-auto relative">
      <MapIconButton
        title={count > 0 ? `Cart (${count})` : 'Cart'}
        aria-expanded={open}
        active={open || count > 0}
        onClick={handleToggleOpen}
        className="relative"
      >
        <ShoppingCart className="size-4" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper"
          >
            {count}
          </span>
        )}
      </MapIconButton>

      {open && (
        <div
          role="dialog"
          aria-label="Cart"
          className="absolute top-0 right-full mr-2 max-h-[70svh] w-72 max-w-[calc(100vw-5rem)] space-y-3 overflow-y-auto border border-ink/10 bg-paper p-3 shadow-lg dark:border-paper/15 dark:bg-ink-soft"
        >
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Cart
          </span>

          {draftBillboards.length === 0 ? (
            <p className="text-xs text-ink/40 dark:text-paper/40">
              Add billboards from the list or map to bundle them into a
              campaign.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {draftBillboards.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate">{b.title}</span>
                  <button
                    type="button"
                    onClick={() => removeFromDraft(b.id)}
                    title="Remove"
                    aria-label={`Remove ${b.title} from cart`}
                    className="shrink-0 text-ink/40 hover:text-brand-error dark:text-paper/40"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {staleIds.length > 0 && (
            <p className="flex items-center justify-between gap-2 text-[11px] text-ink/50 dark:text-paper/50">
              <span>
                {staleIds.length === 1
                  ? '1 billboard is no longer listed.'
                  : `${staleIds.length} billboards are no longer listed.`}
              </span>
              <button
                type="button"
                onClick={() => staleIds.forEach(removeFromDraft)}
                className="shrink-0 font-mono text-accent uppercase hover:underline"
              >
                Remove
              </button>
            </p>
          )}

          <div className="border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
            <CampaignDraftForm
              compact
              draftBillboards={draftBillboards}
              onCreated={closePopover}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function MapOverlayControls({
  isDark,
  onToggleTheme,
  categories,
  selectedCategories,
  onToggleCategory,
  sizes,
  selectedSizes,
  onToggleSize,
  districts,
  selectedDistricts,
  onToggleDistrict,
  priceBounds,
  priceMax,
  onPriceMaxChange,
  myBillboardsActive,
  onToggleMyBillboards,
  nearMeActive,
  onLocateMe,
  onDisableNearMe,
  nearMeDisabled,
  radiusKm,
  onRadiusChange,
  showGeofence,
  onToggleGeofence,
  renterControl,
}: MapOverlayControlsProps) {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const formatPrice = useFormatPrice()
  const anyOpen = useMapPopoverStore((s) => s.active !== null)
  const filtersOpen = useMapPopoverStore((s) => s.active === 'filters')
  const nearMeOpen = useMapPopoverStore((s) => s.active === 'nearme')
  const togglePopover = useMapPopoverStore((s) => s.toggle)
  const closePopover = useMapPopoverStore((s) => s.close)
  const [priceMin, priceCeil] = priceBounds
  const showMyBillboards = !user || role === 'renter'

  // Escape closes whichever map popover is open (filters, cart, near me,
  // My activity) - they all share this store.
  useEffect(() => {
    if (!anyOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closePopover()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [anyOpen, closePopover])

  function handleToggleMyBillboards() {
    if (!user) {
      navigate(loginPath(currentPath(location)))
      return
    }
    onToggleMyBillboards()
  }

  return (
    <div className="pointer-events-none absolute top-4 right-4 z-[500] flex flex-col items-end gap-2">
      <MapIconButton
        title={isDark ? 'Switch to light map' : 'Switch to dark map'}
        onClick={onToggleTheme}
        className="pointer-events-auto"
      >
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </MapIconButton>

      <div className="pointer-events-auto relative">
        <MapIconButton
          title="Filter by category, size, district & price"
          active={
            filtersOpen ||
            selectedCategories.size > 0 ||
            selectedSizes.size > 0 ||
            selectedDistricts.size > 0 ||
            priceMax < priceCeil
          }
          onClick={() => togglePopover('filters')}
        >
          <SlidersHorizontal className="size-4" />
        </MapIconButton>

        {filtersOpen && (
          <div className="absolute top-0 right-full mr-2 w-64 space-y-4 border border-ink/10 bg-paper p-3 shadow-lg dark:border-paper/15 dark:bg-ink-soft">
            <div>
              <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                Category
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categories.map((category) => (
                  <ChipButton
                    key={category}
                    active={selectedCategories.has(category)}
                    onClick={() => onToggleCategory(category)}
                  >
                    {category}
                  </ChipButton>
                ))}
              </div>
            </div>

            <div className="border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
              <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                Size
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sizes.map((size) => (
                  <ChipButton
                    key={size}
                    active={selectedSizes.has(size)}
                    onClick={() => onToggleSize(size)}
                  >
                    {size}
                  </ChipButton>
                ))}
              </div>
            </div>

            {districts.length > 0 && (
              <div className="border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
                <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                  District
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {districts.map((district) => (
                    <ChipButton
                      key={district}
                      active={selectedDistricts.has(district)}
                      onClick={() => onToggleDistrict(district)}
                    >
                      {district}
                    </ChipButton>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                  Price
                </span>
                <span className="font-mono text-xs font-semibold text-accent">
                  Up to {formatPrice(priceMax)}/day
                </span>
              </div>
              <input
                type="range"
                min={priceMin}
                max={priceCeil}
                step={10}
                value={priceMax}
                onChange={(e) => onPriceMaxChange(Number(e.target.value))}
                className="mt-2 w-full accent-accent"
              />
            </div>

            {showMyBillboards && (
              <div className="flex items-center justify-between border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
                <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                  My billboards
                </span>
                <ChipButton
                  active={myBillboardsActive}
                  onClick={handleToggleMyBillboards}
                >
                  {myBillboardsActive ? 'On' : 'Off'}
                </ChipButton>
              </div>
            )}
          </div>
        )}
      </div>

      <CampaignControl />

      {renterControl}

      <div className="pointer-events-auto relative">
        <MapIconButton
          title={
            nearMeDisabled
              ? 'Enable location access to use Near me'
              : 'Near me settings'
          }
          active={nearMeOpen || nearMeActive}
          disabled={nearMeDisabled}
          onClick={() => togglePopover('nearme')}
        >
          <LocateFixed className="size-4" />
        </MapIconButton>

        {nearMeOpen && (
          <div className="absolute top-0 right-full mr-2 w-64 space-y-4 border border-ink/10 bg-paper p-3 shadow-lg dark:border-paper/15 dark:bg-ink-soft">
            <div>
              <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                Near me
              </span>
              <button
                type="button"
                onClick={onLocateMe}
                className="mt-2 w-full border border-accent bg-accent px-3 py-2 font-mono text-xs uppercase text-paper transition-colors hover:bg-accent-dim"
              >
                {nearMeActive ? 'Locate me again' : 'Use my exact location'}
              </button>
              {nearMeActive && (
                <button
                  type="button"
                  onClick={onDisableNearMe}
                  className="mt-1.5 w-full text-center font-mono text-[11px] text-ink/50 uppercase hover:text-ink dark:text-paper/50 dark:hover:text-paper"
                >
                  Turn off
                </button>
              )}
            </div>

            <div className="border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                  Radius
                </span>
                <span className="font-mono text-xs font-semibold text-accent">
                  {radiusKm} km
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={400}
                step={10}
                value={radiusKm}
                onChange={(e) => onRadiusChange(Number(e.target.value))}
                className="mt-2 w-full accent-accent"
              />
            </div>

            <div className="flex items-center justify-between border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
              <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                Show radius on map
              </span>
              <ChipButton active={showGeofence} onClick={onToggleGeofence}>
                {showGeofence ? 'On' : 'Off'}
              </ChipButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
