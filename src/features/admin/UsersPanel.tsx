import { Badge, Button, Card } from '@/components'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { useAllUsers, useToggleUserStatus } from './useUsers'

export function UsersPanel() {
  const { user: currentUser } = useAuth()
  const { data } = useAllUsers()
  const users = data ?? []
  const toggleStatus = useToggleUserStatus()

  return (
    <Card ticks className="overflow-x-auto p-5">
      <h3 className="font-display text-lg font-semibold tracking-tight">
        Users
      </h3>
      <table className="mt-4 w-full min-w-[560px] text-left text-sm">
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}
