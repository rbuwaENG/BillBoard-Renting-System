import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { BillboardMark, Button } from '@/components'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'

const ROLE_HOME: Record<UserRole, string> = {
  renter: '/',
  rentor: '/rentor',
  admin: '/admin',
}

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginFormValues) {
    const { data, error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      setError('root', { message: error.message })
      return
    }

    const userId = data.user?.id
    const { data: profile } = userId
      ? await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()
      : { data: null }

    navigate(ROLE_HOME[(profile?.role as UserRole) ?? 'renter'])
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
        <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm">
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
                placeholder="you@example.com"
                {...register('email')}
                className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
              />
              {errors.email && (
                <span className="mt-1 block text-xs text-brand-error">
                  {errors.email.message}
                </span>
              )}
            </label>

            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                Password
              </span>
              <input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
              />
              {errors.password && (
                <span className="mt-1 block text-xs text-brand-error">
                  {errors.password.message}
                </span>
              )}
            </label>

            {errors.root && (
              <span className="block text-xs text-brand-error">
                {errors.root.message}
              </span>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Logging in…' : 'Log in'}
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-ink/50 dark:text-paper/50">
            No account?{' '}
            <Link to="/signup" className="text-accent hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
