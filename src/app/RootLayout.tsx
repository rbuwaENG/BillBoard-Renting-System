import { ShoppingCart } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BillboardMark, Button } from '@/components'
import { useCurrencySetting } from '@/features/admin/useCurrencySetting'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { useMapPopoverStore } from '@/features/billboards/mapPopoverStore'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { useAuth, useAuthStore } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

const DEFAULT_SITE_NAME = 'Billboard Renting System'

// Persistent cart entry point — the map's own cart icon only exists on the
// browse page, so renters need a way to reach their draft from anywhere.
function CartButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const draftCount = useCampaignStore((s) => s.draftIds.length)
  const togglePopover = useMapPopoverStore((s) => s.toggle)

  function handleClick() {
    togglePopover('campaign')
    if (location.pathname !== '/') navigate('/')
  }

  return (
    <button
      type="button"
      title="Cart"
      onClick={handleClick}
      className="relative text-ink/60 hover:text-ink dark:text-paper/60 dark:hover:text-paper"
    >
      <ShoppingCart className="size-5" />
      {draftCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper">
          {draftCount}
        </span>
      )}
    </button>
  )
}

interface NavLinkDef {
  to: string
  label: string
  end?: boolean
  roles?: UserRole[]
}

const NAV_LINKS: NavLinkDef[] = [
  { to: '/', label: 'Browse', end: true },
  { to: '/rentor', label: 'Rentor', roles: ['rentor'] },
  { to: '/admin', label: 'Admin', roles: ['admin'] },
]

export function RootLayout() {
  const { user, role } = useAuth()
  const signOut = useAuthStore((s) => s.signOut)
  const { data: settings } = useCurrencySetting()
  const siteName = settings?.siteName || DEFAULT_SITE_NAME

  useEffect(() => {
    document.title = siteName
  }, [siteName])

  const visibleLinks = NAV_LINKS.filter(
    (link) => !link.roles || (role && link.roles.includes(role)),
  )

  return (
    <div className="flex min-h-svh flex-col bg-paper text-ink dark:bg-ink dark:text-paper">
      <header className="border-b border-ink/10 dark:border-paper/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5">
            {settings?.siteLogoUrl ? (
              <img src={settings.siteLogoUrl} alt={siteName} className="h-7 w-auto" />
            ) : (
              <BillboardMark className="size-7" />
            )}
            <span className="font-display text-[15px] leading-none font-semibold tracking-tight">
              {settings?.siteName ? (
                siteName
              ) : (
                <>
                  Billboard Renting <span className="text-accent">System</span>
                </>
              )}
            </span>
          </NavLink>

          <nav className="flex items-center gap-6 overflow-x-auto font-mono text-xs tracking-widest uppercase">
            {visibleLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'border-b-2 border-transparent py-1 whitespace-nowrap text-ink/50 transition-colors hover:text-ink dark:text-paper/50 dark:hover:text-paper',
                    isActive && 'border-accent text-ink dark:text-paper',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {user ? (
            <div className="flex items-center gap-3">
              {role === 'renter' && <CartButton />}
              <NotificationBell />
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  cn(
                    'hidden font-mono text-[11px] tracking-widest text-ink/50 uppercase hover:text-ink sm:inline dark:text-paper/50 dark:hover:text-paper',
                    isActive && 'text-ink dark:text-paper',
                  )
                }
              >
                {user.displayName} · {user.role}
              </NavLink>
              <Button size="sm" variant="secondary" onClick={() => signOut()}>
                Log out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <NavLink
                to="/signup"
                className="hidden font-mono text-xs tracking-widest text-ink/50 uppercase hover:text-ink sm:inline dark:text-paper/50 dark:hover:text-paper"
              >
                Sign up
              </NavLink>
              <Button asChild size="sm">
                <NavLink to="/login">Log in</NavLink>
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
