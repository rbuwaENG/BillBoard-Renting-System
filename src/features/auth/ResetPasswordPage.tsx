import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { BillboardMark, Button } from '@/components'
import { supabase } from '@/lib/supabase'

const resetSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ['confirm'],
  })

type ResetFormValues = z.infer<typeof resetSchema>

// Landing page for the link sent by ForgotPasswordPage. supabase-js picks
// the recovery session up from the URL, so updateUser can set the password
// directly; without that session (expired/used link) it errors and we point
// back to the request page.
export function ResetPasswordPage() {
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({ resolver: zodResolver(resetSchema) })

  async function onSubmit(values: ResetFormValues) {
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    })
    if (error) {
      setError('root', {
        message: /session/i.test(error.message)
          ? 'This reset link is invalid or has expired. Request a new one.'
          : error.message,
      })
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-sm flex-col items-center justify-center px-4 text-center">
        <BillboardMark className="size-8 text-accent" />
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
          Password updated
        </h2>
        <p className="mt-2 text-sm text-ink/60 dark:text-paper/60">
          Your new password is set and you're signed in.
        </p>
        <Link to="/" className="mt-6 text-sm text-accent hover:underline">
          Continue
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-4 py-12">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm"
        noValidate
      >
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Choose a new password
        </h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
          Pick something you haven't used here before.
        </p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
              New password
            </span>
            <input
              type="password"
              autoComplete="new-password"
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

          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
              Confirm password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              {...register('confirm')}
              className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
            />
            {errors.confirm && (
              <span className="mt-1 block text-xs text-brand-error">
                {errors.confirm.message}
              </span>
            )}
          </label>

          {errors.root && (
            <span role="alert" className="block text-xs text-brand-error">
              {errors.root.message}{' '}
              <Link
                to="/forgot-password"
                className="text-accent hover:underline"
              >
                Request a new link
              </Link>
            </span>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Saving…' : 'Set new password'}
          </Button>
        </div>
      </form>
    </div>
  )
}
