import { useState } from 'react'
import { Badge, Button, Card } from '@/components'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import {
  useAllUsers,
  useInviteAdmin,
  usePromoteToAdmin,
  useToggleUserStatus,
} from './useUsers'

function InviteAdminForm() {
  const inviteAdmin = useInviteAdmin()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  function handleSubmit() {
    if (!email.trim()) return
    inviteAdmin.mutate(
      { email: email.trim(), name: name.trim() },
      { onSuccess: () => { setEmail(''); setName('') } },
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
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-[140px] flex-1 border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
        />
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-[200px] flex-1 border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
        />
        <Button
          size="sm"
          disabled={!email.trim() || inviteAdmin.isPending}
          onClick={handleSubmit}
        >
          {inviteAdmin.isPending ? 'Sending…' : 'Send invite'}
        </Button>
      </div>
      {inviteAdmin.isError && (
        <p className="mt-2 text-xs text-brand-error">
          {(inviteAdmin.error as Error).message}
        </p>
      )}
    </Card>
  )
}

export function UsersPanel() {
  const { user: currentUser } = useAuth()
  const { data } = useAllUsers()
  const users = data ?? []
  const toggleStatus = useToggleUserStatus()
  const promoteToAdmin = usePromoteToAdmin()

  return (
    <div>
      <InviteAdminForm />
      <Card ticks className="overflow-x-auto p-5">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Users
        </h3>
        <table className="mt-4 w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:border-paper/15 dark:text-paper/50">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-0 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = currentUser?.uid === u.uid
              return (
                <tr
                  key={u.uid}
                  className="border-b border-ink/5 last:border-0 dark:border-paper/10"
                >
                  <td className="py-2.5 pr-4 font-medium">{u.displayName}</td>
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
                      {u.role !== 'admin' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={promoteToAdmin.isPending}
                          onClick={() => promoteToAdmin.mutate(u.uid)}
                        >
                          Promote to admin
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={u.status === 'active' ? 'danger' : 'secondary'}
                        disabled={isSelf}
                        title={isSelf ? "You can't suspend your own account" : undefined}
                        onClick={() =>
                          toggleStatus.mutate({
                            uid: u.uid,
                            status: u.status === 'active' ? 'suspended' : 'active',
                          })
                        }
                      >
                        {u.status === 'active' ? 'Suspend' : 'Reinstate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
