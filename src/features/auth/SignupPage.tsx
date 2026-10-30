import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { BillboardMark, Button } from '@/components'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'
import { loginPath, sanitizeNext } from './redirect'

const ROLE_HOME: Record<UserRole, string> = {
  renter: '/',
  rentor: '/rentor',
  admin: '/admin',
}

const SIGNUP_ROLES: { role: UserRole; label: string; hint: string }[] = [
  { role: 'renter', label: 'Renter', hint: 'Rent billboard space to advertise' },
  { role: 'rentor', label: 'Owner', hint: 'List and manage your own billboards' },
]

const signupSchema = z.object({
  name: z.string().min(1, 'Enter your name'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['renter', 'rentor']),
})

type SignupFormValues = z.infer<typeof signupSchema>

// Admin accounts aren't self-service (PLAN.md section 4: role is granted by
// direct admin SQL), so only renter/rentor are offered here.
export function SignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = sanitizeNext(searchParams.get('next'))
  const [confirmationSent, setConfirmationSent] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: 'renter' },
  })
  const role = watch('role')

  async function onSubmit(values: SignupFormValues) {
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.name, role: values.role },
        emailRedirectTo: `${window.location.origin}${loginPath(next)}`,
      },
    })
    if (error) {
      setError('root', { message: error.message })
      return
    }

    if (data.session) {
      // `next` only makes sense for renters (it points at a renter action).
      navigate(values.role === 'renter' && next ? next : ROLE_HOME[values.role], {
        replace: true,
      })
    } else {
      setConfirmationSent(true)
    }
  }

  if (confirmationSent) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-sm flex-col items-center justify-center px-4 text-center">
        <BillboardMark className="size-8 text-accent" />
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
          Check your email
        </h2>
        <p className="mt-2 text-sm text-ink/60 dark:text-paper/60">
          We sent a confirmation link to finish creating your account. Once
          confirmed, log in to continue.
        </p>
        <Link to={loginPath(next)} className="mt-6 text-sm text-accent hover:underline">
          Go to log in
        </Link>
      </div>
    )
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
            Create an account as a Renter to book space, or an Owner to list
            your own billboards.
          </p>
        </div>

        <span className="font-mono text-[11px] tracking-widest text-paper/40 uppercase">
          Billboard Renting System
        </span>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-10">
        <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm">
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
                placeholder="Jane Doe"
                {...register('name')}
                className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
              />
              {errors.name && (
                <span className="mt-1 block text-xs text-brand-error">
                  {errors.name.message}
                </span>
              )}
            </label>

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

            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <div>
                  <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                    I am a
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {SIGNUP_ROLES.map((opt) => (
                      <button
                        key={opt.role}
                        type="button"
                        onClick={() => field.onChange(opt.role)}
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
              )}
            />

            {errors.root && (
              <span className="block text-xs text-brand-error">
                {errors.root.message}
              </span>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-ink/50 dark:text-paper/50">
            Already have an account?{' '}
            <Link to={loginPath(next)} className="text-accent hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
