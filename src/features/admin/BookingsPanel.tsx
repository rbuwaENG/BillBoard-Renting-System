import { useMemo, useState } from 'react'
import { Badge, Card } from '@/components'
import { cn } from '@/lib/utils'
import {
  CsvExportButton,
  EmptyState,
  LoadMore,
  QueryState,
  SearchBox,
} from './AdminUi'
import { matchesSearch } from './adminUtils'
import { toCsv } from './csv'
import { useAdminBookingsPaged, type AdminBookingRow } from './useAdminBookings'
import { useFormatPrice } from './useCurrencySetting'

const STATUS_CLASSES: Record<string, string> = {
  pending_owner_review: 'border-accent/40 text-accent',
  payment_pending: 'border-accent/40 text-accent',
  confirmed: 'border-brand-success/40 text-brand-success',
  active: 'border-brand-success/40 text-brand-success',
  rejected: 'border-brand-error/40 text-brand-error',
  cancelled: 'border-brand-error/40 text-brand-error',
}

function buildBookingsCsv(rows: AdminBookingRow[]) {
  return toCsv(rows, [
    { header: 'Booking ID', value: (b) => b.id },
    { header: 'Billboard', value: (b) => b.billboardTitle },
    { header: 'Renter', value: (b) => b.renterName },
    { header: 'Owner', value: (b) => b.ownerName },
    { header: 'Start date', value: (b) => b.startDate },
    { header: 'End date', value: (b) => b.endDate },
    { header: 'Quoted', value: (b) => b.priceQuoted },
    { header: 'Status', value: (b) => b.status },
    { header: 'Payment ID', value: (b) => b.paymentId },
    { header: 'Rejection reason', value: (b) => b.rejectionReason },
    { header: 'Requested at', value: (b) => b.createdAt },
    { header: 'Decided at', value: (b) => b.decisionAt },
  ])
}

export function BookingsPanel() {
  const formatPrice = useFormatPrice()
  const paged = useAdminBookingsPaged()
  const [search, setSearch] = useState('')
  const rows = useMemo(
    () =>
      paged.items.filter((b) =>
        matchesSearch(
          search,
          b.billboardTitle,
          b.renterName,
          b.ownerName,
          b.status,
          b.id,
        ),
      ),
    [paged.items, search],
  )

  return (
    <Card ticks className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Bookings
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox
            value={search}
            onChange={setSearch}
            label="Search loaded bookings"
            placeholder="Search billboard, renter, owner, status…"
          />
          <CsvExportButton
            name="bookings"
            disabled={rows.length === 0}
            build={() => buildBookingsCsv(rows)}
          />
        </div>
      </div>

      <QueryState
        isLoading={paged.isLoading}
        error={paged.error}
        onRetry={() => paged.refetch()}
        label="Loading bookings…"
      />

      {!paged.isLoading && !paged.error && (
        <>
          {rows.length === 0 ? (
            <EmptyState>
              {search.trim()
                ? 'No loaded bookings match your search.'
                : 'No bookings yet.'}
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="mt-4 w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:border-paper/15 dark:text-paper/50">
                    <th className="py-2 pr-4 font-medium">Billboard</th>
                    <th className="py-2 pr-4 font-medium">Renter</th>
                    <th className="py-2 pr-4 font-medium">Owner</th>
                    <th className="py-2 pr-4 font-medium">Dates</th>
                    <th className="py-2 pr-4 font-medium">Quoted</th>
                    <th className="py-2 pr-0 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-ink/5 last:border-0 dark:border-paper/10"
                    >
                      <td className="py-2 pr-4 font-medium">
                        {b.billboardTitle}
                      </td>
                      <td className="py-2 pr-4">{b.renterName}</td>
                      <td className="py-2 pr-4">{b.ownerName}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {b.startDate} → {b.endDate}
                      </td>
                      <td className="py-2 pr-4 font-mono">
                        {formatPrice(b.priceQuoted)}
                      </td>
                      <td className="py-2 pr-0">
                        <Badge className={cn(STATUS_CLASSES[b.status])}>
                          {b.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <LoadMore
            hasNextPage={paged.hasNextPage}
            isFetchingNextPage={paged.isFetchingNextPage}
            onLoadMore={() => paged.fetchNextPage()}
            loadedCount={paged.items.length}
          />
        </>
      )}
    </Card>
  )
}
