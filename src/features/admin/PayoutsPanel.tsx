import { useState } from 'react'
import { Badge, Button, Card } from '@/components'
import { useFormatPrice } from './useCurrencySetting'
import {
  useAdminPayouts,
  useCreatePayout,
  usePayableBookings,
  useReleasePayout,
  type PayableOwnerGroup,
} from './useAdminPayouts'

const STATUS_BADGE_CLASSES: Record<string, string> = {
  approved: 'border-accent/40 text-accent',
  paid: 'border-brand-success/40 text-brand-success',
  cancelled: 'border-brand-error/40 text-brand-error',
}

function CreatePayoutCard({ group }: { group: PayableOwnerGroup }) {
  const formatPrice = useFormatPrice()
  const createPayout = useCreatePayout()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(group.bookings.map((b) => b.id)),
  )
  const [releaseDate, setReleaseDate] = useState('')

  const selectedTotal = group.bookings
    .filter((b) => selected.has(b.id))
    .reduce((sum, b) => sum + b.priceQuoted, 0)

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (selected.size === 0 || !releaseDate) return
    await createPayout.mutateAsync({
      ownerId: group.ownerId,
      bookingIds: Array.from(selected),
      scheduledReleaseDate: releaseDate,
    })
    setOpen(false)
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold tracking-tight">
            {group.ownerName}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
            {group.bookings.length} payable booking
            {group.bookings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <span className="font-mono text-sm font-semibold text-accent">
          {formatPrice(group.total)}
        </span>
      </div>

      {open ? (
        <div className="mt-3 space-y-2 border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
          <ul className="space-y-1">
            {group.bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(b.id)}
                  onChange={() => toggle(b.id)}
                />
                <span className="flex-1 truncate">{b.billboardTitle}</span>
                <span className="font-mono text-xs text-ink/50 dark:text-paper/50">
                  {formatPrice(b.priceQuoted)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="date"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
              className="border-b border-ink/20 bg-transparent py-1 text-sm focus:border-accent focus:outline-none dark:border-paper/20"
            />
            <span className="font-mono text-xs text-accent">
              {formatPrice(selectedTotal)}
            </span>
            <Button
              size="sm"
              onClick={submit}
              disabled={selected.size === 0 || !releaseDate || createPayout.isPending}
            >
              Approve + schedule
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          {createPayout.isError && (
            <p className="text-xs text-brand-error">
              {(createPayout.error as Error).message}
            </p>
          )}
        </div>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>
          Create payout
        </Button>
      )}
    </Card>
  )
}

export function PayoutsPanel() {
  const formatPrice = useFormatPrice()
  const { data: payableData } = usePayableBookings()
  const payable = payableData ?? []
  const { data: payoutsData } = useAdminPayouts()
  const payouts = payoutsData ?? []
  const releasePayout = useReleasePayout()

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Payable balances
        </h3>
        {payable.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40 dark:text-paper/40">
            No payable bookings right now.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {payable.map((group) => (
              <CreatePayoutCard key={group.ownerId} group={group} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Payout history
        </h3>
        {payouts.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40 dark:text-paper/40">
            No payouts yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {payouts.map((p) => (
              <Card key={p.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.ownerName}</p>
                  <p className="font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                    Release {p.scheduledReleaseDate}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-accent">
                    {formatPrice(p.amount)}
                  </span>
                  <Badge className={STATUS_BADGE_CLASSES[p.status]}>{p.status}</Badge>
                  {p.status === 'approved' && (
                    <Button
                      size="sm"
                      onClick={() => releasePayout.mutate(p.id)}
                      disabled={releasePayout.isPending}
                    >
                      Release now
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
