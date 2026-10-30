import {
  ArchiveRestore,
  Pencil,
  Plus,
  Power,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Badge, BillboardMark, Button, Card } from '@/components'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { cn } from '@/lib/utils'
import { BillboardFormDialog } from './BillboardFormDialog'
import { errorMessage } from './errors'
import { PanelError, PanelLoading } from './PanelState'
import { RemoveBillboardDialog } from './RemoveBillboardDialog'
import {
  useCreateBillboard,
  useRentorBillboards,
  useSetBillboardStatus,
  useUpdateBillboard,
  type RentorBillboard,
  type RentorBillboardInput,
} from './useRentorBillboards'

const STATUS_CLASSES: Record<string, string> = {
  active: 'border-brand-success/40 text-brand-success',
  inactive: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
  flagged: 'border-brand-error/40 text-brand-error',
  archived: 'border-ink/15 text-ink/40 dark:border-paper/15 dark:text-paper/40',
}

export function MyBillboardsPanel() {
  const formatPrice = useFormatPrice()
  const {
    data: billboardsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useRentorBillboards()
  const billboards = billboardsData ?? []
  const createBillboard = useCreateBillboard()
  const updateBillboard = useUpdateBillboard()
  const setStatus = useSetBillboardStatus()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RentorBillboard | null>(null)
  const [removing, setRemoving] = useState<RentorBillboard | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const archivedCount = billboards.filter((b) => b.status === 'archived').length
  const visible = showArchived
    ? billboards
    : billboards.filter((b) => b.status !== 'archived')

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(b: RentorBillboard) {
    setEditing(b)
    setFormOpen(true)
  }

  // Returned promise keeps the form dialog open until the save resolves.
  function handleSubmit(input: RentorBillboardInput) {
    return editing
      ? updateBillboard.mutateAsync({ id: editing.id, input })
      : createBillboard.mutateAsync(input)
  }

  function toggleStatus(b: RentorBillboard) {
    if (setStatus.isPending) return
    setStatus.mutate({
      id: b.id,
      status: b.status === 'active' ? 'inactive' : 'active',
    })
  }

  function unarchive(b: RentorBillboard) {
    if (setStatus.isPending) return
    setStatus.mutate({ id: b.id, status: 'inactive' })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/60 dark:text-paper/60">
          {visible.length} listing{visible.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-4">
          {archivedCount > 0 && (
            <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="accent-accent"
              />
              Show archived ({archivedCount})
            </label>
          )}
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-3.5" />
            Add billboard
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <PanelLoading label="Loading your billboards…" />
        ) : isError ? (
          <PanelError
            error={error}
            onRetry={() => refetch()}
            label="Couldn't load your billboards."
          />
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink/40 dark:text-paper/40">
            {archivedCount > 0
              ? 'All your listings are archived — tick "Show archived" to see them.'
              : 'No billboards yet — add your first listing to start receiving bookings.'}
          </p>
        ) : null}

        {!isLoading &&
          !isError &&
          visible.map((b) => {
            const statusPending =
              setStatus.isPending && setStatus.variables?.id === b.id
            const statusError =
              setStatus.isError && setStatus.variables?.id === b.id
                ? errorMessage(setStatus.error)
                : null
            const override = b.adminPriceOverridePerDay
            return (
              <Card key={b.id} className="p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:flex-nowrap">
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
                      {b.category} · {b.size} · {b.location.city}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {override != null ? (
                      <>
                        <span className="font-mono text-sm font-semibold text-accent">
                          {formatPrice(override)}
                          <span className="text-ink/40 dark:text-paper/40">
                            /day
                          </span>
                        </span>
                        <p
                          className="font-mono text-[10px] tracking-wide text-ink/50 uppercase dark:text-paper/50"
                          title="An admin has set this listing's price. Contact support to change it."
                        >
                          Admin price · yours {formatPrice(b.pricePerDay)}
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-sm font-semibold text-accent">
                          {formatPrice(b.salePricePerDay ?? b.pricePerDay)}
                          <span className="text-ink/40 dark:text-paper/40">
                            /day
                          </span>
                        </span>
                        {b.salePricePerDay != null && (
                          <p className="font-mono text-[10px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                            Sale · was {formatPrice(b.pricePerDay)}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEdit(b)}
                      title="Edit"
                      aria-label={`Edit ${b.title}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    {b.status === 'archived' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={statusPending}
                        onClick={() => unarchive(b)}
                      >
                        <ArchiveRestore className="size-3.5" />
                        {statusPending ? 'Restoring…' : 'Unarchive'}
                      </Button>
                    ) : b.status !== 'flagged' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={statusPending}
                        title={
                          b.status === 'active' ? 'Deactivate' : 'Activate'
                        }
                        aria-label={`${b.status === 'active' ? 'Deactivate' : 'Activate'} ${b.title}`}
                        onClick={() => toggleStatus(b)}
                      >
                        <Power className="size-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="danger"
                      title={
                        b.status === 'archived' ? 'Delete' : 'Archive or delete'
                      }
                      aria-label={`${b.status === 'archived' ? 'Delete' : 'Archive or delete'} ${b.title}`}
                      onClick={() => setRemoving(b)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {b.status === 'flagged' && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-brand-error">
                    <ShieldAlert className="size-3.5 shrink-0" />
                    Flagged by an admin — hidden from renters and can't be
                    reactivated here. Contact support.
                  </p>
                )}
                {statusError && (
                  <p role="alert" className="mt-3 text-xs text-brand-error">
                    Couldn't update this listing: {statusError}
                  </p>
                )}
              </Card>
            )
          })}
      </div>

      <BillboardFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSubmit={handleSubmit}
      />

      <RemoveBillboardDialog
        key={removing?.id ?? 'none'}
        billboard={removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
      />
    </div>
  )
}
