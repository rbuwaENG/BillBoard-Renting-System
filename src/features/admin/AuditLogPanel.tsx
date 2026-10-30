import { ArrowRight } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card } from '@/components'
import {
  EmptyState,
  FieldLabel,
  LoadMore,
  QueryState,
  SearchBox,
} from './AdminUi'
import { ADMIN_INPUT_CLASSES, formatAge, matchesSearch } from './adminUtils'
import {
  AUDIT_ENTITIES,
  auditChanges,
  describeAuditAction,
  entityLabel,
  useAuditLog,
  type AuditEntity,
  type AuditLogEntry,
  type AuditLogFilters,
} from './useAuditLog'

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function EntityRef({ entry }: { entry: AuditLogEntry }) {
  if (!entry.entityId) return <span>{entityLabel(entry.entity)}</span>
  const shortId = entry.entityId.slice(0, 8)
  if (entry.entity === 'billboard') {
    return (
      <Link
        to={`/billboards/${entry.entityId}`}
        className="text-accent hover:underline"
        title={entry.entityId}
      >
        {entityLabel(entry.entity)} {shortId}
      </Link>
    )
  }
  return (
    <span title={entry.entityId}>
      {entityLabel(entry.entity)} {shortId}
    </span>
  )
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const changes = auditChanges(entry)
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {describeAuditAction(entry.action)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 dark:text-paper/50">
            <EntityRef entry={entry} /> · by{' '}
            <span className={entry.actorId ? '' : 'italic'}>
              {entry.actorName}
            </span>
          </p>
        </div>
        <time
          dateTime={entry.createdAt}
          title={formatTimestamp(entry.createdAt)}
          className="shrink-0 font-mono text-[11px] text-ink/40 dark:text-paper/40"
        >
          {formatAge(entry.createdAt)}
        </time>
      </div>
      {changes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {changes.map((c) => (
            <li
              key={c.field}
              className="flex flex-wrap items-center gap-1.5 text-xs"
            >
              <span className="text-ink/50 dark:text-paper/50">{c.label}:</span>
              <Badge className="border-ink/15 text-ink/60 line-through dark:border-paper/15 dark:text-paper/60">
                {c.from}
              </Badge>
              <ArrowRight
                aria-label="changed to"
                className="size-3 text-ink/40 dark:text-paper/40"
              />
              <Badge className="border-accent/40 text-accent">{c.to}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const EMPTY_FILTERS: AuditLogFilters = { entity: 'all', from: '', to: '' }

export function AuditLogPanel() {
  const [filters, setFilters] = useState<AuditLogFilters>(EMPTY_FILTERS)
  const [actorSearch, setActorSearch] = useState('')
  const query = useAuditLog(filters)
  const entityId = useId()
  const fromId = useId()
  const toId = useId()

  const visible = useMemo(
    () =>
      query.items.filter((e) =>
        matchesSearch(actorSearch, e.actorName, e.actorId),
      ),
    [query.items, actorSearch],
  )

  const rangeInvalid =
    filters.from !== '' && filters.to !== '' && filters.to < filters.from
  const filtersActive =
    filters.entity !== 'all' ||
    filters.from !== '' ||
    filters.to !== '' ||
    actorSearch.trim() !== ''

  return (
    <section aria-label="Audit log" className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Audit log
        </h3>
        <p className="mt-1 text-xs text-ink/50 dark:text-paper/50">
          Role and status changes, billboard moderation and price overrides, and
          payment / payout status changes. Owners switching their own listings
          on or off aren't recorded.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label htmlFor={entityId} className="block">
          <FieldLabel>Entity</FieldLabel>
          <select
            id={entityId}
            value={filters.entity}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                entity: e.target.value as AuditEntity | 'all',
              }))
            }
            className={ADMIN_INPUT_CLASSES}
          >
            <option value="all">All entities</option>
            {AUDIT_ENTITIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={fromId} className="block">
          <FieldLabel>From</FieldLabel>
          <input
            id={fromId}
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) =>
              setFilters((f) => ({ ...f, from: e.target.value }))
            }
            className={ADMIN_INPUT_CLASSES}
          />
        </label>
        <label htmlFor={toId} className="block">
          <FieldLabel>To</FieldLabel>
          <input
            id={toId}
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className={ADMIN_INPUT_CLASSES}
          />
        </label>
        <SearchBox
          value={actorSearch}
          onChange={setActorSearch}
          label="Search by actor"
          placeholder="Search actor…"
        />
        {filtersActive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              setActorSearch('')
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {rangeInvalid ? (
        <p role="alert" className="text-xs text-brand-error">
          The end date is before the start date.
        </p>
      ) : (
        <>
          <QueryState
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => query.refetch()}
            label="Loading audit log…"
          />
          {!query.isLoading && !query.error && (
            <>
              {visible.length === 0 ? (
                <EmptyState>
                  {filtersActive
                    ? 'No audit entries match these filters.'
                    : 'No admin actions recorded yet.'}
                </EmptyState>
              ) : (
                <div className="space-y-2">
                  {visible.map((entry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
              {(query.items.length > 0 || query.hasNextPage) && (
                <LoadMore
                  hasNextPage={!!query.hasNextPage}
                  isFetchingNextPage={query.isFetchingNextPage}
                  onLoadMore={() => query.fetchNextPage()}
                  loadedCount={query.items.length}
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
