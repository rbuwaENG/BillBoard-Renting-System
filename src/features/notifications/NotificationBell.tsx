import { Bell } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  useMarkNotificationsRead,
  useMyNotifications,
} from './useNotifications'

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationBell() {
  const { data } = useMyNotifications()
  const notifications = data ?? []
  const unreadCount = notifications.filter((n) => !n.read).length
  const markRead = useMarkNotificationsRead()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next) {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
      if (unreadIds.length > 0) markRead.mutate(unreadIds)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Notifications"
        onClick={handleToggle}
        className="relative text-ink/60 hover:text-ink dark:text-paper/60 dark:hover:text-paper"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[1000]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full right-0 z-[1001] mt-2 max-h-96 w-80 overflow-y-auto border border-ink/10 bg-paper shadow-xl dark:border-paper/15 dark:bg-ink-soft">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-ink/40 dark:text-paper/40">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink/10 dark:divide-paper/10">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      'p-3 text-sm',
                      !n.read && 'bg-accent/5',
                    )}
                  >
                    <p className="text-ink dark:text-paper">{n.message}</p>
                    <p className="mt-1 font-mono text-[10px] tracking-wide text-ink/40 uppercase dark:text-paper/40">
                      {timeAgo(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
