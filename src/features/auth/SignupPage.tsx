import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, BillboardMark, Button } from '@/components'
import { useAuthStore } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

const ROLE_HOME: Record<UserRole, string> = {
  renter: '/',
  rentor: '/rentor',
  admin: '/admin',
}

const SIGNUP_ROLES: { role: UserRole; label: string; hint: string }[] = [
  { role: 'renter', label: 'Renter', hint: 'Rent billboard space to advertise' },
  { role: 'rentor', label: 'Rentor', hint: 'List and manage your own billboards' },
]

// Phase 2 replaces this with a real Firebase Auth createUserWithEmailAndPassword
// + Firestore profile write. Admin accounts aren't self-service (PLAN.md
// section 4: role is granted via an admin-only callable), so only
// renter/rentor are offered here.
export function SignupPage() {
  const navigate = useNavigate()
  const mockLogin = useAuthStore((s) => s.mockLogin)
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('renter')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    mockLogin(role, name.trim() || undefined)
    navigate(ROLE_HOME[role])
  }

  return (
    <div className="grid min-h-[calc(100svh-4rem)] sm:grid-cols-2">
      <div className="bg-grain relative hidden flex-col justify-between overflow-hidden bg-ink px-10 py-12 text-paper sm:flex">
        <BillboardMark className="size-8 text-accent" />

        <div>
          <span className="font-mono text-xs tracking-widest text-accent uppercase">
            Access — 01
          </span>
          <h1 className="mt-3 max-w-xs font-display text-4xl leading-[1.05] font-semibold tracking-tight">
            Put your board on the map.
          </h1>
          <p className="mt-4 max-w-xs text-sm text-paper/60">
            Create an account as a Renter to book space, or a Rentor to list
            your own billboards.
          </p>
        </div>

        <span className="font-mono text-[11px] tracking-widest text-paper/40 uppercase">
          Billboard Renting System
        </span>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-10">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Sign up
          </h2>
          <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
            Choose how you'll use the platform.
          </p>

          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
              />
            </label>

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

            <div>
              <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                I am a
              </span>
              <div className="grid grid-cols-2 gap-2">
                {SIGNUP_ROLES.map((opt) => (
                  <button
                    key={opt.role}
                    type="button"
                    onClick={() => setRole(opt.role)}
                    className={
                      'border px-3 py-2.5 text-left transition-colors ' +
                      (role === opt.role
                        ? 'border-accent bg-accent/10'
                        : 'border-ink/15 hover:border-ink/30 dark:border-paper/15 dark:hover:border-paper/30')
                    }
                  >
                    <span className="block text-sm font-medium">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink/50 dark:text-paper/50">
                      {opt.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full">
              Create account
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-ink/50 dark:text-paper/50">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline">
              Log in
            </Link>
          </p>

          {import.meta.env.DEV && (
            <div className="mt-6 flex items-center gap-2 border-t border-dashed border-ink/20 pt-5 dark:border-paper/20">
              <Badge variant="accent">Preview</Badge>
              <span className="text-xs text-ink/50 dark:text-paper/50">
                No Firebase project yet — this creates a local preview
                session only.
              </span>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
