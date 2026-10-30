import { supabase } from '@/lib/supabase'
import { usePagedQuery } from './usePagedQuery'

// admin_audit_log (0034): one row per admin-relevant change, written by
// triggers on profiles / billboards / payments / payouts. Admin-only SELECT.
// Entity and date range filter server-side; the actor search runs on the
// loaded rows (like the other admin tables).

export type AuditEntity = 'profile' | 'billboard' | 'payment' | 'payout'

export const AUDIT_ENTITIES: { value: AuditEntity; label: string }[] = [
  { value: 'profile', label: 'Users' },
  { value: 'billboard', label: 'Billboards' },
  { value: 'payment', label: 'Payments' },
  { value: 'payout', label: 'Payouts' },
]

export interface AuditLogFilters {
  entity: AuditEntity | 'all'
  // Local `YYYY-MM-DD` (from <input type="date">), inclusive; '' = open.
  from: string
  to: string
}

interface AuditLogRow {
  id: string
  actor_id: string | null
  action: string
  entity: string
  entity_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
  profiles: { display_name: string | null } | null
}

export interface AuditLogEntry {
  id: string
  actorId: string | null
  actorName: string
  action: string
  entity: string
  entityId: string | null
  before: Record<string, unknown>
  after: Record<string, unknown>
  createdAt: string
}

const AUDIT_SELECT =
  'id, actor_id, action, entity, entity_id, before, after, created_at, ' +
  'profiles!admin_audit_log_actor_id_fkey(display_name)'

function toEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_id
      ? (row.profiles?.display_name ?? 'Unknown user')
      : 'System',
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    before: row.before ?? {},
    after: row.after ?? {},
    createdAt: row.created_at,
  }
}

// Start of a local calendar day as an ISO timestamp (`YYYY-MM-DD` parsed as
// local time, not UTC midnight), optionally shifted by whole days.
export function localDayStartIso(day: string, addDays = 0): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d + addDays).toISOString()
}

export function useAuditLog(filters: AuditLogFilters) {
  return usePagedQuery(['admin-audit-log', filters], async (from, to) => {
    let query = supabase
      .from('admin_audit_log')
      .select(AUDIT_SELECT)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    if (filters.entity !== 'all') query = query.eq('entity', filters.entity)
    if (filters.from)
      query = query.gte('created_at', localDayStartIso(filters.from))
    if (filters.to)
      query = query.lt('created_at', localDayStartIso(filters.to, 1))
    const { data, error } = await query.range(from, to)
    if (error) throw error
    return (data as unknown as AuditLogRow[]).map(toEntry)
  })
}

const FIELD_LABEL: Record<string, string> = {
  role: 'Role',
  status: 'Status',
  admin_price_override_per_day: 'Price override / day',
}

export interface AuditChange {
  field: string
  label: string
  from: string
  to: string
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Compact before → after list over the union of changed columns.
export function auditChanges(
  entry: Pick<AuditLogEntry, 'before' | 'after'>,
): AuditChange[] {
  const fields = Array.from(
    new Set([...Object.keys(entry.before), ...Object.keys(entry.after)]),
  )
  return fields.map((field) => ({
    field,
    label: FIELD_LABEL[field] ?? field,
    from: formatValue(entry.before[field]),
    to: formatValue(entry.after[field]),
  }))
}

// 'role_changed,status_changed' → 'Role & status changed'
export function describeAuditAction(action: string): string {
  const parts = action
    .split(',')
    .map((a) => a.trim().replace(/_changed$/, ''))
    .filter(Boolean)
    .map((f) => (FIELD_LABEL[f] ?? f.replace(/_/g, ' ')).toLowerCase())
  if (parts.length === 0) return action
  const text = parts.join(' & ') + ' changed'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const ENTITY_LABEL: Record<string, string> = {
  profile: 'User',
  billboard: 'Billboard',
  payment: 'Payment',
  payout: 'Payout',
}

export function entityLabel(entity: string): string {
  return ENTITY_LABEL[entity] ?? entity
}
