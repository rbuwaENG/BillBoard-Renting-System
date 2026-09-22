import { useState, type FormEvent } from 'react'
import { Badge, Button, Card } from '@/components'
import { useAuthStore } from '@/hooks/useAuth'

function fieldLabelClass() {
  return 'mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50'
}

function inputClass() {
  return 'w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/20 dark:placeholder:text-paper/30'
}

// Phase 2 ("Auth & roles") replaces `updateProfile` with a real Firestore
// `users/{uid}` write; email stays read-only here since it's Firebase
// Auth-managed, not a plain profile field.
export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [photoURL, setPhotoURL] = useState(user?.photoURL ?? '')
  const [saved, setSaved] = useState(false)

  if (!user) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    updateProfile({
      displayName: displayName.trim() || user!.displayName,
      phone: phone.trim() || undefined,
      photoURL: photoURL.trim() || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Profile
        </h1>
        <Badge variant="accent">{user.role}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
        Manage your account details.
      </p>

      <Card ticks className="mt-6 p-6">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden border border-ink/10 bg-paper-dim font-display text-xl font-semibold dark:border-paper/15 dark:bg-ink">
            {photoURL ? (
              <img src={photoURL} alt="" className="size-full object-cover" />
            ) : (
              user.displayName.slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">
              {user.displayName}
            </p>
            <p className="text-xs text-ink/50 dark:text-paper/50">
              Member since{' '}
              {new Date(user.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <label className="block">
            <span className={fieldLabelClass()}>Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass()}
            />
          </label>

          <label className="block">
            <span className={fieldLabelClass()}>Email</span>
            <input value={user.email} disabled className={inputClass()} />
          </label>

          <label className="block">
            <span className={fieldLabelClass()}>Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className={inputClass()}
            />
          </label>

          <label className="block">
            <span className={fieldLabelClass()}>Photo URL</span>
            <input
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://…"
              className={inputClass()}
            />
          </label>

          <label className="block">
            <span className={fieldLabelClass()}>Status</span>
            <input value={user.status} disabled className={inputClass()} />
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit">Save changes</Button>
            {saved && (
              <span className="text-xs text-brand-success">Saved.</span>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
