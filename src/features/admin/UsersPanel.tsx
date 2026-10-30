import { useId, useMemo, useState } from 'react'
import { Badge, Button, Card } from '@/components'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { UserProfile, UserRole } from '@/types'
import {
  ConfirmDialog,
  CsvExportButton,
  EmptyState,
  ErrorText,
  FieldLabel,
  LoadMore,
  QueryState,
  SearchBox,
} from './AdminUi'
import { ADMIN_INPUT_CLASSES, PAGE_SIZE, matchesSearch } from './adminUtils'
import { toCsv } from './csv'
import { useSetUserRole, useSetUserStatus } from './useUserAdminActions'
import { useAllUsers, useInviteAdmin } from './useUsers'

function InviteAdminForm() {
  const inviteAdmin = useInviteAdmin()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const nameId = useId()
  const emailId = useId()

  function handleSubmit() {
    if (!email.trim()) return
    inviteAdmin.mutate(
      { email: email.trim(), name: name.trim() },
      {
        onSuccess: () => {
          setEmail('')
          setName('')
        },
      },
    )
  }

  return (
    <Card ticks className="mb-5 max-w-lg p-5">
      <h3 className="font-display text-lg font-semibold tracking-tight">
        Invite an admin
      </h3>
      <p className="mt-1 text-xs text-ink/50 dark:text-paper/50">
        Sends an email invite to set up a new account with admin access.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
      >
        <label htmlFor={nameId} className="block min-w-[140px] flex-1">
          <FieldLabel>Name</FieldLabel>
          <input
            id={nameId}
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={ADMIN_INPUT_CLASSES}
          />
        </label>
        <label htmlFor={emailId} className="block min-w-[200px] flex-1">
          <FieldLabel>Email</FieldLabel>
          <input
            id={emailId}
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={ADMIN_INPUT_CLASSES}
          />
        </label>
        <Button
          type="submit"
          size="sm"
          disabled={!email.trim() || inviteAdmin.isPending}
        >
          {inviteAdmin.isPending ? 'Sending…' : 'Send invite'}
        </Button>
      </form>
      {inviteAdmin.isSuccess && (
        <p role="status" className="mt-2 text-xs text-brand-success">
          Invite sent.
        </p>
      )}
      <div className="mt-2">
        <ErrorText error={inviteAdmin.error} />
      </div>
    </Card>
  )
}

type UserAction =
  | { kind: 'promote'; user: UserProfile }
  | { kind: 'demote'; user: UserProfile }
  | { kind: 'suspend'; user: UserProfile }
  | { kind: 'reinstate'; user: UserProfile }

function UserActionDialog({
  action,
  onClose,
}: {
  action: UserAction | null
  onClose: () => void
}) {
  const setRole = useSetUserRole()
  const setStatus = useSetUserStatus()
  // Previous role isn't stored, so the admin picks what to demote to.
  const [demoteTo, setDemoteTo] = useState<Exclude<UserRole, 'admin'>>('renter')
  const selectId = useId()
  const user = action?.user
  const name = user?.displayName || user?.email || 'this user'

  const copy = !action
    ? null
    : action.kind === 'promote'
      ? {
          title: 'Promote to admin',
          description: `${name} will get full admin access: moderating listings, confirming payments, releasing payouts and changing other users' roles.`,
          confirm: 'Promote to admin',
          danger: true,
        }
      : action.kind === 'demote'
        ? {
            title: 'Remove admin access',
            description: `${name} will lose admin access immediately.`,
            confirm: 'Remove admin access',
            danger: true,
          }
        : action.kind === 'suspend'
          ? {
              title: 'Suspend user',
              description: `${name} won't be able to create bookings, listings, messages or reviews until reinstated.`,
              confirm: 'Suspend',
              danger: true,
            }
          : {
              title: 'Reinstate user',
              description: `${name} regains normal access.`,
              confirm: 'Reinstate',
              danger: false,
            }

  return (
    <ConfirmDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) {
          setDemoteTo('renter')
          onClose()
        }
      }}
      title={copy?.title ?? ''}
      description={copy?.description}
      confirmLabel={copy?.confirm ?? 'Confirm'}
      variant={copy?.danger ? 'danger' : 'primary'}
      onConfirm={async () => {
        if (!action) return
        const uid = action.user.uid
        if (action.kind === 'promote')
          await setRole.mutateAsync({ uid, role: 'admin' })
        else if (action.kind === 'demote')
          await setRole.mutateAsync({ uid, role: demoteTo })
        else if (action.kind === 'suspend')
          await setStatus.mutateAsync({ uid, status: 'suspended' })
        else await setStatus.mutateAsync({ uid, status: 'active' })
      }}
    >
      {action?.kind === 'demote' && (
        <label htmlFor={selectId} className="block">
          <FieldLabel>New role</FieldLabel>
          <select
            id={selectId}
            value={demoteTo}
            onChange={(e) =>
              setDemoteTo(e.target.value as Exclude<UserRole, 'admin'>)
            }
            className={ADMIN_INPUT_CLASSES}
          >
            <option value="renter">Renter</option>
            <option value="rentor">Billboard owner (rentor)</option>
          </select>
        </label>
      )}
    </ConfirmDialog>
  )
}

function buildUsersCsv(rows: UserProfile[]) {
  return toCsv(rows, [
    { header: 'User ID', value: (u) => u.uid },
    { header: 'Name', value: (u) => u.displayName },
    { header: 'Email', value: (u) => u.email },
    { header: 'Role', value: (u) => u.role },
    { header: 'Status', value: (u) => u.status },
    { header: 'Joined', value: (u) => u.createdAt },
  ])
}

export function UsersPanel() {
  const { user: currentUser } = useAuth()
  const usersQuery = useAllUsers()
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [action, setAction] = useState<UserAction | null>(null)

  const filtered = useMemo(
    () =>
      (usersQuery.data ?? []).filter((u) =>
        matchesSearch(search, u.displayName, u.email, u.role, u.status),
      ),
    [usersQuery.data, search],
  )
  // The users list arrives in one request (its read path is owned by the
  // profile-privacy work); "Load more" pages the rendered rows.
  const shown = filtered.slice(0, visible)

  return (
    <div>
      <InviteAdminForm />
      <Card ticks className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Users
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox
              value={search}
              onChange={(v) => {
                setSearch(v)
                setVisible(PAGE_SIZE)
              }}
              label="Search users"
              placeholder="Search name, email, role…"
            />
            <CsvExportButton
              name="users"
              disabled={filtered.length === 0}
              build={() => buildUsersCsv(filtered)}
            />
          </div>
        </div>

        <QueryState
          isLoading={usersQuery.isLoading}
          error={usersQuery.error}
          onRetry={() => usersQuery.refetch()}
          label="Loading users…"
        />

        {!usersQuery.isLoading && !usersQuery.error && (
          <>
            {shown.length === 0 ? (
              <EmptyState>
                {search.trim()
                  ? 'No users match your search.'
                  : 'No users yet.'}
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="mt-4 w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:border-paper/15 dark:text-paper/50">
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 pr-4 font-medium">Email</th>
                      <th className="py-2 pr-4 font-medium">Role</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-0 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((u) => {
                      const isSelf = currentUser?.uid === u.uid
                      const selfTitle = isSelf
                        ? "You can't change your own account"
                        : undefined
                      return (
                        <tr
                          key={u.uid}
                          className="border-b border-ink/5 last:border-0 dark:border-paper/10"
                        >
                          <td className="py-2.5 pr-4 font-medium">
                            {u.displayName}
                            {isSelf && (
                              <span className="ml-1 text-xs text-ink/40 dark:text-paper/40">
                                (you)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-ink/60 dark:text-paper/60">
                            {u.email}
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge variant="accent">{u.role}</Badge>
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge
                              className={cn(
                                u.status === 'suspended' &&
                                  'border-brand-error/40 text-brand-error',
                              )}
                            >
                              {u.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-0 text-right">
                            <div className="flex justify-end gap-2">
                              {u.role === 'admin' ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={isSelf}
                                  title={selfTitle}
                                  aria-label={`Demote ${u.displayName}`}
                                  onClick={() =>
                                    setAction({ kind: 'demote', user: u })
                                  }
                                >
                                  Demote
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  aria-label={`Promote to admin: ${u.displayName}`}
                                  onClick={() =>
                                    setAction({ kind: 'promote', user: u })
                                  }
                                >
                                  Promote to admin
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant={
                                  u.status === 'active' ? 'danger' : 'secondary'
                                }
                                disabled={isSelf}
                                title={selfTitle}
                                aria-label={`${u.status === 'active' ? 'Suspend' : 'Reinstate'} ${u.displayName}`}
                                onClick={() =>
                                  setAction({
                                    kind:
                                      u.status === 'active'
                                        ? 'suspend'
                                        : 'reinstate',
                                    user: u,
                                  })
                                }
                              >
                                {u.status === 'active'
                                  ? 'Suspend'
                                  : 'Reinstate'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <LoadMore
              hasNextPage={filtered.length > shown.length}
              isFetchingNextPage={false}
              onLoadMore={() => setVisible((v) => v + PAGE_SIZE)}
              loadedCount={shown.length}
            />
          </>
        )}
      </Card>

      <UserActionDialog action={action} onClose={() => setAction(null)} />
    </div>
  )
}
