import * as Dialog from '@radix-ui/react-dialog'
import { ExternalLink, LocateFixed, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components'
import { useCategories, useSizes } from '@/features/admin/useTaxonomy'
import { useCurrencySetting } from '@/features/admin/useCurrencySetting'
import { useAuth } from '@/hooks/useAuth'
import { lookupDistrict, trafficMapUrl } from '@/lib/geocode'
import type { TrafficLevel } from '@/types'
import { LocationPickerMap } from './LocationPickerMap'
import { uploadBillboardImages } from './useRentorBillboards'
import type { RentorBillboard, RentorBillboardInput } from './useRentorBillboards'

const TRAFFIC_LEVELS: { value: TrafficLevel; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: 'Heavy' },
]

interface BillboardFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: RentorBillboard | null
  onSubmit: (input: RentorBillboardInput) => void
}

// Default map center for a brand-new listing — Colombo — until the owner
// clicks the map or "Use my location" to place the actual pin.
const DEFAULT_LAT = 6.9271
const DEFAULT_LNG = 79.8612

const EMPTY: RentorBillboardInput = {
  title: '',
  description: '',
  categoryId: '',
  sizeId: '',
  address: '',
  city: '',
  lat: DEFAULT_LAT,
  lng: DEFAULT_LNG,
  pricePerDay: 0,
  images: [],
  district: null,
  trafficLevel: null,
}

function fieldLabelClass() {
  return 'mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50'
}

function inputClass() {
  return 'w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30'
}

export function BillboardFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: BillboardFormDialogProps) {
  const { user } = useAuth()
  const { data: categories } = useCategories()
  const { data: sizes } = useSizes()
  const { data: currencySetting } = useCurrencySetting()
  const [form, setForm] = useState<RentorBillboardInput>(EMPTY)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [recenterSignal, setRecenterSignal] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [districtStatus, setDistrictStatus] = useState<
    'idle' | 'loading' | 'done'
  >('idle')
  const districtLookupId = useRef(0)

  useEffect(() => {
    if (!open) return
    setNewFiles([])
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description,
        categoryId: editing.categoryId,
        sizeId: editing.sizeId,
        address: editing.location.address,
        city: editing.location.city,
        lat: editing.location.lat,
        lng: editing.location.lng,
        pricePerDay: editing.pricePerDay,
        images: editing.images,
        district: editing.district,
        trafficLevel: editing.trafficLevel,
      })
      setDistrictStatus(editing.district ? 'done' : 'idle')
    } else {
      setForm({
        ...EMPTY,
        categoryId: categories?.[0]?.id ?? '',
        sizeId: sizes?.[0]?.id ?? '',
      })
      setDistrictStatus('idle')
    }
  }, [open, editing, categories, sizes])

  // Auto-detect the district whenever the pin settles on a new spot, debounced
  // so dragging the marker doesn't fire a lookup per pixel. Free, no API key
  // (OpenStreetMap Nominatim) — see src/lib/geocode.ts.
  useEffect(() => {
    if (!open) return
    const requestId = ++districtLookupId.current
    setDistrictStatus('loading')
    const timeout = setTimeout(async () => {
      const district = await lookupDistrict(form.lat, form.lng)
      if (districtLookupId.current !== requestId) return
      setForm((f) => ({ ...f, district }))
      setDistrictStatus('done')
    }, 600)
    return () => clearTimeout(timeout)
  }, [open, form.lat, form.lng])

  function handlePick(lat: number, lng: number) {
    setForm((f) => ({ ...f, lat, lng }))
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((f) => ({
        ...f,
        lat: Number(pos.coords.latitude.toFixed(5)),
        lng: Number(pos.coords.longitude.toFixed(5)),
      }))
      setRecenterSignal((s) => s + 1)
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.city.trim() || !form.pricePerDay) return
    if (!form.categoryId || !form.sizeId || !user) return

    let images = form.images
    if (newFiles.length > 0) {
      setUploading(true)
      try {
        const uploaded = await uploadBillboardImages(newFiles, user.uid)
        images = [...form.images, ...uploaded]
      } finally {
        setUploading(false)
      }
    }

    onSubmit({ ...form, images })
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1900] bg-ink/50 backdrop-blur-[2px] dark:bg-ink/70" />
        <Dialog.Content
          className="fixed inset-0 z-[2000] flex flex-col overflow-y-auto border-ink/10 bg-paper shadow-xl focus:outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[85svh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:border dark:border-paper/15 dark:bg-ink-soft"
          aria-describedby={undefined}
        >
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4 dark:border-paper/15">
              <Dialog.Title className="font-display text-lg font-semibold tracking-tight">
                {editing ? 'Edit billboard' : 'Add billboard'}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  title="Close"
                  className="text-ink/40 hover:text-ink dark:text-paper/40 dark:hover:text-paper"
                >
                  <X className="size-5" />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex-1 space-y-5 p-5">
              <label className="block">
                <span className={fieldLabelClass()}>Title</span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Riverside Overpass Hoarding"
                  className={inputClass()}
                />
              </label>

              <label className="block">
                <span className={fieldLabelClass()}>Description</span>
                <textarea
                  required
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Southbound commuter traffic, unobstructed sightline."
                  className={inputClass() + ' resize-none'}
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={fieldLabelClass()}>Category</span>
                  <select
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, categoryId: e.target.value }))
                    }
                    className={inputClass()}
                  >
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={fieldLabelClass()}>Size</span>
                  <select
                    value={form.sizeId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sizeId: e.target.value }))
                    }
                    className={inputClass()}
                  >
                    {(sizes ?? []).map((sz) => (
                      <option key={sz.id} value={sz.id}>
                        {sz.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={fieldLabelClass()}>Address</span>
                  <input
                    required
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                    placeholder="Baseline Road"
                    className={inputClass()}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabelClass()}>City</span>
                  <input
                    required
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Colombo"
                    className={inputClass()}
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className={fieldLabelClass()}>Location</span>
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    className="mb-1.5 flex items-center gap-1 font-mono text-[11px] tracking-widest text-accent uppercase hover:underline"
                  >
                    <LocateFixed className="size-3" />
                    Use my location
                  </button>
                </div>
                <LocationPickerMap
                  lat={form.lat}
                  lng={form.lng}
                  onPick={handlePick}
                  recenterSignal={recenterSignal}
                />
                <p className="mt-1.5 font-mono text-[11px] text-ink/50 dark:text-paper/50">
                  Click the map or drag the pin to place this billboard ·{' '}
                  {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                </p>
                <p className="mt-1 font-mono text-[11px] text-ink/50 dark:text-paper/50">
                  District:{' '}
                  {districtStatus === 'loading'
                    ? 'Detecting…'
                    : (form.district ?? 'Not detected — you can still publish')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={fieldLabelClass()}>Traffic level</span>
                  <select
                    value={form.trafficLevel ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        trafficLevel: (e.target.value || null) as TrafficLevel | null,
                      }))
                    }
                    className={inputClass()}
                  >
                    <option value="">Not set</option>
                    {TRAFFIC_LEVELS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end pb-2">
                  <a
                    href={trafficMapUrl(form.lat, form.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 font-mono text-[11px] tracking-widest text-accent uppercase hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    Check live traffic on Google Maps
                  </a>
                </div>
              </div>

              <label className="block">
                <span className={fieldLabelClass()}>
                  Price per day ({currencySetting?.currency ?? 'LKR'})
                </span>
                <input
                  required
                  type="number"
                  min="1"
                  value={form.pricePerDay || ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pricePerDay: Number(e.target.value) }))
                  }
                  placeholder="150"
                  className={inputClass()}
                />
              </label>

              <label className="block">
                <span className={fieldLabelClass()}>Images</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))}
                  className="w-full text-xs text-ink/60 dark:text-paper/60"
                />
                {form.images.length > 0 && (
                  <p className="mt-1 font-mono text-[11px] text-ink/50 dark:text-paper/50">
                    {form.images.length} existing image
                    {form.images.length !== 1 ? 's' : ''}
                  </p>
                )}
              </label>
            </div>

            <div className="border-t border-ink/10 p-5 dark:border-paper/15">
              <Button type="submit" disabled={uploading} className="w-full">
                {uploading
                  ? 'Uploading images…'
                  : editing
                    ? 'Save changes'
                    : 'Add billboard'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
