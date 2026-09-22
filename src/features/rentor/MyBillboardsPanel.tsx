import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge, BillboardMark, Button, Card } from '@/components'
import { cn } from '@/lib/utils'
import { BillboardFormDialog } from './BillboardFormDialog'
import {
  useRentorBillboardStore,
  type RentorBillboard,
  type RentorBillboardInput,
} from './rentorBillboardStore'

const STATUS_CLASSES: Record<string, string> = {
  active: 'border-brand-success/40 text-brand-success',
  inactive: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
  flagged: 'border-brand-error/40 text-brand-error',
}

export function MyBillboardsPanel() {
  const billboards = useRentorBillboardStore((s) => s.billboards)
  const addBillboard = useRentorBillboardStore((s) => s.addBillboard)
  const updateBillboard = useRentorBillboardStore((s) => s.updateBillboard)
  const setStatus = useRentorBillboardStore((s) => s.setStatus)
  const deleteBillboard = useRentorBillboardStore((s) => s.deleteBillboard)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RentorBillboard | null>(null)

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(b: RentorBillboard) {
    setEditing(b)
    setFormOpen(true)
  }

  function handleSubmit(input: RentorBillboardInput) {
    if (editing) updateBillboard(editing.id, input)
    else addBillboard(input)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/60 dark:text-paper/60">
          {billboards.length} listing{billboards.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-3.5" />
          Add billboard
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {billboards.length === 0 && (
          <p className="py-10 text-center text-sm text-ink/40 dark:text-paper/40">
            No billboards yet — add your first listing to start receiving
            bookings.
          </p>
        )}

        {billboards.map((b) => (
          <Card key={b.id} className="flex items-center gap-4 p-4">
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

            <span className="shrink-0 font-mono text-sm font-semibold text-accent">
              ${b.pricePerDay}
              <span className="text-ink/40 dark:text-paper/40">/day</span>
            </span>

            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="secondary" onClick={() => openEdit(b)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                title={b.status === 'active' ? 'Deactivate' : 'Activate'}
                onClick={() =>
                  setStatus(b.id, b.status === 'active' ? 'inactive' : 'active')
                }
              >
                <Power className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => deleteBillboard(b.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <BillboardFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
