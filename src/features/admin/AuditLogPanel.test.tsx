import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { AuditLogPanel } from './AuditLogPanel'
import {
  auditChanges,
  describeAuditAction,
  localDayStartIso,
} from './useAuditLog'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const ROWS = [
  {
    id: 'a1',
    actor_id: 'admin-1',
    action: 'status_changed',
    entity: 'billboard',
    entity_id: '11111111-2222-3333-4444-555555555555',
    before: { status: 'active' },
    after: { status: 'flagged' },
    created_at: new Date().toISOString(),
    profiles: { display_name: 'Ada Admin' },
  },
  {
    id: 'a2',
    actor_id: null,
    action: 'status_changed',
    entity: 'payout',
    entity_id: '99999999-2222-3333-4444-555555555555',
    before: { status: 'approved' },
    after: { status: 'paid' },
    created_at: new Date().toISOString(),
    profiles: null,
  },
]

describe('audit log helpers', () => {
  it('describes actions and diffs', () => {
    expect(describeAuditAction('role_changed,status_changed')).toBe(
      'Role & status changed',
    )
    expect(describeAuditAction('admin_price_override_per_day_changed')).toBe(
      'Price override / day changed',
    )
    expect(
      auditChanges({
        before: { admin_price_override_per_day: null },
        after: { admin_price_override_per_day: 750 },
      }),
    ).toEqual([
      {
        field: 'admin_price_override_per_day',
        label: 'Price override / day',
        from: '—',
        to: '750',
      },
    ])
  })

  it('turns a local date into the start of that local day', () => {
    expect(new Date(localDayStartIso('2026-03-05')).getDate()).toBe(5)
    expect(new Date(localDayStartIso('2026-03-31', 1)).getDate()).toBe(1)
  })
})

describe('AuditLogPanel', () => {
  it('lists entries with actor, entity link and before → after', async () => {
    const builder = createQueryBuilderMock({ data: ROWS, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)
    render(<AuditLogPanel />, { wrapper })

    expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
    expect(supabase.from).toHaveBeenCalledWith('admin_audit_log')
    expect(builder.range).toHaveBeenCalledWith(0, 49)
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Billboard 11111111' }),
    ).toHaveAttribute(
      'href',
      '/billboards/11111111-2222-3333-4444-555555555555',
    )
    expect(screen.getByText('flagged')).toBeInTheDocument()
    expect(screen.getByText('paid')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search by actor'), {
      target: { value: 'ada' },
    })
    expect(screen.queryByText('System')).not.toBeInTheDocument()
  })

  it('filters by entity on the server', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)
    render(<AuditLogPanel />, { wrapper })
    expect(
      await screen.findByText('No admin actions recorded yet.'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Entity'), {
      target: { value: 'payment' },
    })
    expect(
      await screen.findByText('No audit entries match these filters.'),
    ).toBeInTheDocument()
    expect(builder.eq).toHaveBeenCalledWith('entity', 'payment')
  })

  it('shows load errors', async () => {
    const builder = createQueryBuilderMock({
      data: null,
      error: { message: 'permission denied' },
    })
    vi.mocked(supabase.from).mockReturnValue(builder as never)
    render(<AuditLogPanel />, { wrapper })
    expect(
      await screen.findByText("Couldn't load: permission denied"),
    ).toBeInTheDocument()
  })
})
