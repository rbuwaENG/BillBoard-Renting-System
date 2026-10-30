import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { BillboardMark, Button } from '@/components'
import { supabase } from '@/lib/supabase'

const forgotSchema = z.object({
  email: z.email('Enter a valid email address'),
})

type ForgotFormValues = z.infer<typeof forgotSchema>

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({ resolver: zodResolver(forgotSchema) })

  async function onSubmit(values: ForgotFormValues) {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError('root', { message: error.message })
      return
    }
    setSentTo(values.email)
  }

  if (sentTo) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-sm flex-col items-center justify-center px-4 text-center">
        <BillboardMark className="size-8 text-accent" />
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
          Check your email
        </h2>
        <p className="mt-2 text-sm text-ink/60 dark:text-paper/60">
          If an account exists for {sentTo}, we've sent a link to reset your
          password. The link opens a page where you can choose a new one.
        </p>
        <Link to="/login" className="mt-6 text-sm text-accent hover:underline">
          Back to log in
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
          Reset your password
        </h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
          Enter the email you signed up with and we'll send you a reset link.
        </p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
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

          {errors.root && (
            <span role="alert" className="block text-xs text-brand-error">
              {errors.root.message}
            </span>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Sending link…' : 'Send reset link'}
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-ink/50 dark:text-paper/50">
          Remembered it?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  )
}
