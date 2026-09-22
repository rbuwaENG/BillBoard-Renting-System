import { LayoutList, Search } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { BillboardCard } from './BillboardCard'
import { MapIconButton } from './MapIconButton'
import { LOCATE_STATUS_LABEL, type LocateStatus } from './locateStatus'
import type { MockBillboard } from './mockBillboards'

interface BillboardPanelProps {
  results: MockBillboard[]
  query: string
  onQueryChange: (query: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
  locateStatus: LocateStatus
  distanceById: Map<string, number>
  emptyMessage: string
}

// A floating search bar + list-toggle icon (top-left), matching the
// floating theme/filter/near-me icons on the right — the results list
// itself is a floating dropdown underneath, not a docked sidebar.
export function BillboardPanel({
  results,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  locateStatus,
  distanceById,
  emptyMessage,
}: BillboardPanelProps) {
  const [listOpen, setListOpen] = useState(true)

  return (
    <div className="pointer-events-none absolute top-4 left-4 z-[500] flex w-[calc(100%-6rem)] max-w-sm flex-col gap-2">
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink/40 dark:text-paper/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setListOpen(true)
            }}
            placeholder="Search billboards, city, category…"
            className="w-full border border-ink/10 bg-paper py-2.5 pr-3 pl-9 text-sm shadow-md placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/15 dark:bg-ink-soft dark:placeholder:text-paper/30"
          />
        </div>

        <MapIconButton
          title={listOpen ? 'Hide billboards list' : 'Show billboards list'}
          active={listOpen}
          onClick={() => setListOpen((o) => !o)}
          className="relative shrink-0"
        >
          <LayoutList className="size-4" />
          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper">
            {results.length}
          </span>
        </MapIconButton>
      </div>

      <span className="pointer-events-auto flex w-fit items-center gap-1.5 border border-ink/10 bg-paper/90 px-2.5 py-1 font-mono text-[11px] tracking-wide text-ink/60 shadow-sm backdrop-blur-sm dark:border-paper/10 dark:bg-ink/90 dark:text-paper/60">
        <span
          className={cn(
            'size-1.5 rounded-full',
            locateStatus === 'found'
              ? 'bg-accent'
              : locateStatus === 'locating'
                ? 'animate-pulse bg-ink/40 dark:bg-paper/40'
                : 'bg-ink/25 dark:bg-paper/25',
          )}
        />
        {LOCATE_STATUS_LABEL[locateStatus]}
      </span>

      {listOpen && (
        <div className="pointer-events-auto flex max-h-[60svh] flex-col gap-2 overflow-y-auto border border-ink/10 bg-paper/95 p-3 shadow-lg backdrop-blur-sm dark:border-paper/10 dark:bg-ink/95">
          {results.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/40 dark:text-paper/40">
              {emptyMessage}
            </p>
          ) : (
            results.map((billboard) => (
              <BillboardCard
                key={billboard.id}
                billboard={billboard}
                selected={billboard.id === selectedId}
                onClick={() => onSelect(billboard.id)}
                distanceKm={distanceById.get(billboard.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
