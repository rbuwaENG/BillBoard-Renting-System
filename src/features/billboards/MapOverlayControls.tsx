import { FolderPlus, LocateFixed, Moon, SlidersHorizontal, Sun, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { useCreateCampaign } from '@/features/renter/useCampaigns'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { MapIconButton } from './MapIconButton'
import { useMapPopoverStore } from './mapPopoverStore'
import type { BillboardWithDetails } from './useBillboards'

interface MapOverlayControlsProps {
  billboards: BillboardWithDetails[]
  isDark: boolean
  onToggleTheme: () => void
  categories: string[]
  selectedCategories: Set<string>
  onToggleCategory: (category: string) => void
  sizes: string[]
  selectedSizes: Set<string>
  onToggleSize: (size: string) => void
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

function CampaignControl({ billboards }: { billboards: BillboardWithDetails[] }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const formatPrice = useFormatPrice()
  const open = useMapPopoverStore((s) => s.active === 'campaign')
  const togglePopover = useMapPopoverStore((s) => s.toggle)
  const closePopover = useMapPopoverStore((s) => s.close)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const draftIds = useCampaignStore((s) => s.draftIds)
  const removeFromDraft = useCampaignStore((s) => s.removeFromDraft)
  const clearDraft = useCampaignStore((s) => s.clearDraft)
  const createCampaign = useCreateCampaign()

  const draftBillboards = draftIds
    .map((id) => billboards.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b))

  const days =
    startDate && endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) /
              86_400_000,
          ) + 1,
        )
      : 0
  const total =
    draftBillboards.reduce((sum, b) => sum + b.pricePerDay, 0) * days

  function handleToggleOpen() {
    if (!user) {
      navigate('/login')
      return
    }
    togglePopover('campaign')
  }

  async function handleCreate() {
    if (!name.trim() || !startDate || !endDate || draftBillboards.length === 0)
      return
    try {
      await createCampaign.mutateAsync({
        name: name.trim(),
        startDate,
        endDate,
        billboardIds: draftBillboards.map((b) => b.id),
      })
      setName('')
      setStartDate('')
      setEndDate('')
      closePopover()
      clearDraft()
    } catch {
      // error surfaced via createCampaign.error below
    }
  }

  return (
    <div className="pointer-events-auto relative">
      <MapIconButton
        title="Campaign draft"
        active={open || draftIds.length > 0}
        onClick={handleToggleOpen}
        className="relative"
      >
        <FolderPlus className="size-4" />
        {draftIds.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper">
            {draftIds.length}
          </span>
        )}
      </MapIconButton>

      {open && (
        <div className="absolute top-0 right-full mr-2 w-72 space-y-3 border border-ink/10 bg-paper p-3 shadow-lg dark:border-paper/15 dark:bg-ink-soft">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Campaign draft
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
                    className="shrink-0 text-ink/40 hover:text-brand-error dark:text-paper/40"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
            <input
              type="text"
              placeholder="Campaign name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-ink/15 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-paper/15"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 border border-ink/15 bg-transparent px-2 py-1.5 text-xs focus:border-accent focus:outline-none dark:border-paper/15"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 border border-ink/15 bg-transparent px-2 py-1.5 text-xs focus:border-accent focus:outline-none dark:border-paper/15"
              />
            </div>
            {days > 0 && draftBillboards.length > 0 && (
              <p className="text-right font-mono text-xs text-accent">
                Est. total {formatPrice(total)}
              </p>
            )}
            {createCampaign.isError && (
              <p className="text-xs text-brand-error">
                {(createCampaign.error as Error).message}
              </p>
            )}
            <button
              type="button"
              disabled={
                !name.trim() ||
                !startDate ||
                !endDate ||
                draftBillboards.length === 0 ||
                createCampaign.isPending
              }
              onClick={handleCreate}
              className="w-full border border-accent bg-accent px-3 py-2 font-mono text-xs uppercase text-paper transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-40"
            >
              {createCampaign.isPending ? 'Creating…' : 'Create campaign'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function MapOverlayControls({
  billboards,
  isDark,
  onToggleTheme,
  categories,
  selectedCategories,
  onToggleCategory,
  sizes,
  selectedSizes,
  onToggleSize,
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
  const { user } = useAuth()
  const navigate = useNavigate()
  const formatPrice = useFormatPrice()
  const filtersOpen = useMapPopoverStore((s) => s.active === 'filters')
  const nearMeOpen = useMapPopoverStore((s) => s.active === 'nearme')
  const togglePopover = useMapPopoverStore((s) => s.toggle)
  const [priceMin, priceCeil] = priceBounds

  function handleToggleMyBillboards() {
    if (!user) {
      navigate('/login')
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
          title="Filter by category, size & price"
          active={
            filtersOpen ||
            selectedCategories.size > 0 ||
            selectedSizes.size > 0 ||
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
          </div>
        )}
      </div>

      <CampaignControl billboards={billboards} />

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
                max={1000}
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
