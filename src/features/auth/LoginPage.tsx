import { Link, useNavigate } from 'react-router-dom'
import { Badge, BillboardMark, Button } from '@/components'
import { useAuthStore } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

const ROLE_HOME: Record<UserRole, string> = {
  renter: '/',
  rentor: '/rentor',
  admin: '/admin',
}

const BYPASS_ROLES: { role: UserRole; label: string }[] = [
  { role: 'renter', label: 'Renter' },
  { role: 'rentor', label: 'Rentor (owner)' },
  { role: 'admin', label: 'Admin' },
]

// Phase 2 ("Auth & roles", PLAN.md section 7) replaces the email/password
// form below with real Firebase Auth. Until a Firebase project exists, the
// "preview" section is the only way to reach role-gated routes — it's
// import.meta.env.DEV-only so it never ships in a production build.
export function LoginPage() {
  const navigate = useNavigate()
  const mockLogin = useAuthStore((s) => s.mockLogin)

  function bypassAs(role: UserRole) {
    mockLogin(role)
    navigate(ROLE_HOME[role])
  }

  return (
    <div className="grid min-h-[calc(100svh-4rem)] sm:grid-cols-2">
      <div className="bg-grain relative hidden flex-col justify-between overflow-hidden bg-ink px-10 py-12 text-paper sm:flex">
        <BillboardMark className="size-8 text-accent" />

        <div>
          <span className="font-mono text-xs tracking-widest text-accent uppercase">
            Access — 02
          </span>
          <h1 className="mt-3 max-w-xs font-display text-4xl leading-[1.05] font-semibold tracking-tight">
            Every board has an owner.
          </h1>
          <p className="mt-4 max-w-xs text-sm text-paper/60">
            Rentors list the space. Renters book it. One account, one login.
          </p>
        </div>

        <span className="font-mono text-[11px] tracking-widest text-paper/40 uppercase">
          Billboard Renting System
        </span>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Log in
          </h2>
          <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
            Enter your details to continue.
          </p>

          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                Email
              </span>
              <input
                type="email"
                disabled
                placeholder="you@example.com"
                className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none disabled:cursor-not-allowed dark:border-paper/20 dark:placeholder:text-paper/30"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                Password
              </span>
              <input
                type="password"
                disabled
                placeholder="••••••••"
                className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none disabled:cursor-not-allowed dark:border-paper/20 dark:placeholder:text-paper/30"
              />
            </label>

            <Button disabled className="w-full">
              Log in
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-ink/50 dark:text-paper/50">
            No account?{' '}
            <Link to="/signup" className="text-accent hover:underline">
              Sign up
            </Link>
          </p>

          {import.meta.env.DEV && (
            <div className="mt-8 border-t border-dashed border-ink/20 pt-6 dark:border-paper/20">
              <div className="flex items-center gap-2">
                <Badge variant="accent">Preview</Badge>
                <span className="text-xs text-ink/50 dark:text-paper/50">
                  No Firebase project yet — continue as a role to preview it.
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {BYPASS_ROLES.map(({ role, label }) => (
                  <Button
                    key={role}
                    type="button"
                    variant="secondary"
                    className="w-full justify-between normal-case"
                    onClick={() => bypassAs(role)}
                  >
                    <span>Continue as {label}</span>
                    <span className="text-accent">→</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
