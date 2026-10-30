import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Hourglass,
  MessageCircle,
  Star,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types'
import { notificationHref } from './notificationLinks'
import {
  useMarkNotificationsRead,
  useMyNotifications,
} from './useNotifications'

const TYPE_ICON: Record<string, LucideIcon> = {
  booking_requested: Calendar,
  booking_approved: CheckCircle2,
  booking_rejected: XCircle,
  booking_expired: Hourglass,
  payment_confirmed: CreditCard,
  payment_submitted: CreditCard,
  payment_rejected: XCircle,
  booking_completed: CheckCircle2,
  booking_cancelled: XCircle,
  review_received: Star,
  payout_released: Wallet,
  payout_scheduled: Wallet,
  new_message: MessageCircle,
  documents_requested: FileText,
  payment_reminder: Clock,
  rental_starting_soon: Calendar,
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function NotificationBody({ n }: { n: Notification }) {
  const Icon = TYPE_ICON[n.type] ?? Bell
  return (
    <>
      <Icon
        className="mt-0.5 size-3.5 shrink-0 text-ink/40 dark:text-paper/40"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-ink dark:text-paper">
          {!n.read && <span className="sr-only">Unread: </span>}
          {n.message}
        </p>
        <p className="mt-1 font-mono text-[10px] tracking-wide text-ink/40 uppercase dark:text-paper/40">
          {timeAgo(n.createdAt)}
        </p>
      </div>
    </>
  )
}

export function NotificationBell() {
  const { role } = useAuth()
  const { data, isLoading, isError } = useMyNotifications()
  const notifications = data ?? []
  const unreadCount = notifications.filter((n) => !n.read).length
  const markRead = useMarkNotificationsRead()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

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
        ref={buttonRef}
        type="button"
        title="Notifications"
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : 'Notifications'
        }
        aria-expanded={open}
        onClick={handleToggle}
        className="relative text-ink/60 hover:text-ink dark:text-paper/60 dark:hover:text-paper"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper"
          >
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
          <div className="absolute top-full right-0 z-[1001] mt-2 max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto border border-ink/10 bg-paper shadow-xl dark:border-paper/15 dark:bg-ink-soft">
            {isLoading ? (
              <p
                role="status"
                className="p-4 text-center text-sm text-ink/40 dark:text-paper/40"
              >
                Loading notifications…
              </p>
            ) : isError ? (
              <p
                role="alert"
                className="p-4 text-center text-sm text-brand-error"
              >
                Couldn't load notifications.
              </p>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-ink/40 dark:text-paper/40">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink/10 dark:divide-paper/10">
                {notifications.map((n) => {
                  const href = notificationHref(n, role)
                  const rowClass = cn(
                    'flex gap-2.5 p-3 text-sm',
                    !n.read && 'bg-accent/5',
                  )
                  return (
                    <li key={n.id}>
                      {href ? (
                        <Link
                          to={href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            rowClass,
                            'hover:bg-ink/5 focus-visible:bg-ink/5 focus-visible:outline-none dark:hover:bg-paper/5 dark:focus-visible:bg-paper/5',
                          )}
                        >
                          <NotificationBody n={n} />
                        </Link>
                      ) : (
                        <div className={rowClass}>
                          <NotificationBody n={n} />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
