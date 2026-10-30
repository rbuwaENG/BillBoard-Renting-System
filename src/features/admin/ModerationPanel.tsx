import { Flag, Star, Tag } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Badge, BillboardMark, Button, Card } from '@/components'
import type { BillboardWithDetails } from '@/features/billboards/useBillboards'
import { cn } from '@/lib/utils'
import {
  ConfirmDialog,
  EmptyState,
  ErrorText,
  FieldLabel,
  LoadMore,
  QueryState,
  SearchBox,
} from './AdminUi'
import { ADMIN_INPUT_CLASSES, matchesSearch } from './adminUtils'
import {
  MODERATION_FILTERS,
  useAdminBillboardsPaged,
  useAdminSetBillboardStatus,
  useFlaggedBillboardCount,
  useSetAdminPriceOverride,
  type AdminBillboardStatus,
  type ModerationFilter,
} from './useAdminBillboards'
import { useFormatPrice } from './useCurrencySetting'

const STATUS_CLASSES: Record<string, string> = {
  active: 'border-brand-success/40 text-brand-success',
  inactive: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
  flagged: 'border-brand-error/40 text-brand-error',
  archived: 'border-ink/20 text-ink/40 dark:border-paper/20 dark:text-paper/40',
}

interface PendingAction {
  billboard: BillboardWithDetails
  status: AdminBillboardStatus
}

const ACTION_COPY: Record<
  AdminBillboardStatus,
  { title: string; confirm: string; description: string }
> = {
  flagged: {
    title: 'Flag listing',
    confirm: 'Flag listing',
    description:
      'The listing is hidden from renters and the owner is notified with your reason. Owners cannot un-flag it themselves.',
  },
  inactive: {
    title: 'Unpublish listing',
    confirm: 'Unpublish',
    description: 'The listing is hidden from renters until it is restored.',
  },
  active: {
    title: 'Restore listing',
    confirm: 'Restore',
    description: 'The listing becomes visible to renters again.',
  },
}

function StatusChangeDialog({
  action,
  onClose,
}: {
  action: PendingAction | null
  onClose: () => void
}) {
  const setStatus = useAdminSetBillboardStatus()
  const [reason, setReason] = useState('')
  const reasonId = useId()
  const copy = action ? ACTION_COPY[action.status] : null
  const requiresReason = action?.status === 'flagged'

  return (
    <ConfirmDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReason('')
          onClose()
        }
      }}
      title={copy ? `${copy.title}: ${action?.billboard.title}` : ''}
      description={copy?.description}
      confirmLabel={copy?.confirm ?? 'Confirm'}
      variant={action?.status === 'flagged' ? 'danger' : 'primary'}
      confirmDisabled={requiresReason && !reason.trim()}
      onConfirm={async () => {
        if (!action) return
        await setStatus.mutateAsync({
          id: action.billboard.id,
          status: action.status,
          reason: reason.trim() || null,
        })
        setReason('')
      }}
    >
      {action && (
        <label htmlFor={reasonId} className="block">
          <FieldLabel>
            {requiresReason
              ? 'Reason (sent to the owner)'
              : 'Note to owner (optional)'}
          </FieldLabel>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required={requiresReason}
            placeholder={
              requiresReason ? 'e.g. Photos do not match the location' : ''
            }
            className="w-full resize-none border border-ink/15 bg-transparent px-2 py-1.5 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/15 dark:placeholder:text-paper/30"
          />
        </label>
      )}
    </ConfirmDialog>
  )
}

function PriceOverrideEditor({
  billboard,
  onDone,
}: {
  billboard: BillboardWithDetails
  onDone: () => void
}) {
  const setPriceOverride = useSetAdminPriceOverride()
  const [value, setValue] = useState(
    billboard.adminPriceOverridePerDay !== null &&
      billboard.adminPriceOverridePerDay !== undefined
      ? String(billboard.adminPriceOverridePerDay)
      : '',
  )
  const inputId = useId()
  const trimmed = value.trim()
  const price = trimmed ? Number(trimmed) : null
  const invalid = price !== null && (!Number.isFinite(price) || price < 0)

  return (
    <div className="mt-3 border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
      <div className="flex flex-wrap items-end gap-2">
        <label htmlFor={inputId} className="block w-56">
          <FieldLabel>Override price / day</FieldLabel>
          <input
            id={inputId}
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Regular: ${billboard.pricePerDay}`}
            className={ADMIN_INPUT_CLASSES}
          />
        </label>
        <Button
          size="sm"
          disabled={setPriceOverride.isPending || invalid}
          onClick={() =>
            setPriceOverride.mutate(
              { id: billboard.id, price },
              { onSuccess: onDone },
            )
          }
        >
          Save
        </Button>
        {billboard.adminPriceOverridePerDay !== null && (
          <Button
            size="sm"
            variant="secondary"
            disabled={setPriceOverride.isPending}
            onClick={() =>
              setPriceOverride.mutate(
                { id: billboard.id, price: null },
                { onSuccess: onDone },
              )
            }
          >
            Clear override
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {invalid && (
        <p className="mt-1 text-xs text-brand-error">
          Enter a price of 0 or more.
        </p>
      )}
      <div className="mt-1">
        <ErrorText error={setPriceOverride.error} />
      </div>
    </div>
  )
}

export function ModerationPanel() {
  const formatPrice = useFormatPrice()
  const [filter, setFilter] = useState<ModerationFilter>('all')
  const [search, setSearch] = useState('')
  const paged = useAdminBillboardsPaged(filter)
  const { data: flaggedCount } = useFlaggedBillboardCount()
  const [overridingId, setOverridingId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const billboards = useMemo(() => {
    const filtered = paged.items.filter((b) =>
      matchesSearch(search, b.title, b.ownerName, b.location.city, b.status),
    )
    // Flagged listings first; otherwise keep the server order (newest first).
    return [...filtered].sort((a, b) =>
      a.status === b.status
        ? 0
        : a.status === 'flagged'
          ? -1
          : b.status === 'flagged'
            ? 1
            : 0,
    )
  }, [paged.items, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter by status"
        >
          {MODERATION_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'border px-2.5 py-1 font-mono text-[11px] tracking-widest uppercase transition-colors',
                filter === f
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-ink/15 text-ink/60 hover:border-ink/30 dark:border-paper/15 dark:text-paper/60 dark:hover:border-paper/30',
              )}
            >
              {f === 'flagged' ? `Flagged (${flaggedCount ?? '…'})` : f}
            </button>
          ))}
        </div>
        <SearchBox
          value={search}
          onChange={setSearch}
          label="Search loaded billboards"
          placeholder="Search title, owner, city…"
        />
      </div>

      <QueryState
        isLoading={paged.isLoading}
        error={paged.error}
        onRetry={() => paged.refetch()}
        label="Loading billboards…"
      />

      {!paged.isLoading && !paged.error && billboards.length === 0 && (
        <EmptyState>
          {search.trim()
            ? 'No loaded billboards match your search.'
            : 'No billboards in this view.'}
        </EmptyState>
      )}

      <div className="space-y-3">
        {billboards.map((b) => (
          <Card key={b.id} className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center bg-paper-dim dark:bg-ink">
                <BillboardMark className="size-4 text-ink/15 dark:text-paper/15" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-sm font-semibold tracking-tight">
                    {b.title}
                  </p>
                  <Badge className={cn(STATUS_CLASSES[b.status])}>
                    {b.status}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                  {b.ownerName} · {b.location.city} ·{' '}
                  {formatPrice(b.pricePerDay)}/day
                  {b.adminPriceOverridePerDay !== null &&
                    b.adminPriceOverridePerDay !== undefined && (
                      <span className="text-accent">
                        {' '}
                        → {formatPrice(b.adminPriceOverridePerDay)}/day (admin)
                      </span>
                    )}
                </p>
                <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-ink/50 dark:text-paper/50">
                  <Star aria-hidden="true" className="size-3 fill-current" />
                  {b.rating.count > 0
                    ? `${b.rating.avg.toFixed(1)} (${b.rating.count} review${b.rating.count !== 1 ? 's' : ''})`
                    : 'No reviews yet'}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setOverridingId(overridingId === b.id ? null : b.id)
                  }
                >
                  <Tag aria-hidden="true" className="size-3.5" />
                  Override price
                </Button>
                {b.status !== 'flagged' && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      setPendingAction({ billboard: b, status: 'flagged' })
                    }
                  >
                    <Flag aria-hidden="true" className="size-3.5" />
                    Flag
                  </Button>
                )}
                {(b.status === 'active' || b.status === 'flagged') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setPendingAction({ billboard: b, status: 'inactive' })
                    }
                  >
                    Unpublish
                  </Button>
                )}
                {(b.status === 'inactive' || b.status === 'flagged') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setPendingAction({ billboard: b, status: 'active' })
                    }
                  >
                    Restore
                  </Button>
                )}
              </div>
            </div>

            {overridingId === b.id && (
              <PriceOverrideEditor
                billboard={b}
                onDone={() => setOverridingId(null)}
              />
            )}
          </Card>
        ))}
      </div>

      {!paged.isLoading && !paged.error && (
        <LoadMore
          hasNextPage={paged.hasNextPage}
          isFetchingNextPage={paged.isFetchingNextPage}
          onLoadMore={() => paged.fetchNextPage()}
          loadedCount={paged.items.length}
        />
      )}

      <StatusChangeDialog
        action={pendingAction}
        onClose={() => setPendingAction(null)}
      />
    </div>
  )
}
