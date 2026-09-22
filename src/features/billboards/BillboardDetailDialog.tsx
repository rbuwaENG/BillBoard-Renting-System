import * as Dialog from '@radix-ui/react-dialog'
import { Check, MessageCircle, Plus, Star, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, BillboardMark, Button } from '@/components'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { ChatPanel } from '@/features/chat/ChatPanel'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { MockBillboard } from './mockBillboards'

interface BillboardDetailDialogProps {
  billboard: MockBillboard | null
  onClose: () => void
}

// Rough day/week/month packages computed from the daily rate — Phase 4
// ("Public browse & map") replaces this with real pricing tiers stored per
// billboard once the categories/sizes/pricing admin panel (Phase 9) exists.
function pricingPackages(pricePerDay: number) {
  return [
    { label: 'Day', price: pricePerDay },
    { label: 'Week', price: Math.round(pricePerDay * 7 * 0.9) },
    { label: 'Month', price: Math.round(pricePerDay * 30 * 0.75) },
  ]
}

export function BillboardDetailDialog({
  billboard,
  onClose,
}: BillboardDetailDialogProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showChat, setShowChat] = useState(false)
  const inDraft = useCampaignStore((s) =>
    billboard ? s.draftIds.includes(billboard.id) : false,
  )
  const toggleDraft = useCampaignStore((s) => s.toggleDraft)

  useEffect(() => {
    setShowChat(false)
  }, [billboard?.id])

  function requireLogin(action: () => void) {
    if (!user) {
      onClose()
      navigate('/login')
      return
    }
    action()
  }

  return (
    <Dialog.Root
      open={billboard !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1900] bg-ink/50 backdrop-blur-[2px] dark:bg-ink/70" />
        <Dialog.Content
          className="fixed inset-0 z-[2000] flex flex-col overflow-y-auto border-ink/10 bg-paper shadow-xl focus:outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[85svh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:border dark:border-paper/15 dark:bg-ink-soft"
          aria-describedby={undefined}
        >
          {billboard && (
            <>
              <div className="relative flex h-40 shrink-0 items-center justify-center bg-paper-dim dark:bg-ink">
                <BillboardMark className="size-14 text-ink/10 dark:text-paper/10" />
                <span className="absolute top-3 left-3 bg-ink px-2 py-1 font-mono text-[11px] tracking-widest text-paper uppercase dark:bg-paper dark:text-ink">
                  {billboard.category}
                </span>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    title="Close"
                    className="absolute top-3 right-3 flex size-8 items-center justify-center border border-ink/10 bg-paper/90 text-ink shadow-md hover:border-ink/30 dark:border-paper/15 dark:bg-ink-soft/90 dark:text-paper dark:hover:border-paper/30"
                  >
                    <X className="size-4" />
                  </button>
                </Dialog.Close>
              </div>

              {showChat ? (
                <div className="flex-1 p-5 sm:p-6">
                  <ChatPanel
                    billboardId={billboard.id}
                    ownerName={billboard.ownerName}
                    onBack={() => setShowChat(false)}
                  />
                </div>
              ) : (
                <div className="flex-1 space-y-6 p-5 sm:p-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Dialog.Title className="font-display text-xl font-semibold tracking-tight">
                        {billboard.title}
                      </Dialog.Title>
                      <Badge
                        variant="accent"
                        className="border-brand-success/40 text-brand-success"
                      >
                        {billboard.status === 'active'
                          ? 'Available'
                          : billboard.status}
                      </Badge>
                      <button
                        type="button"
                        onClick={() =>
                          requireLogin(() => toggleDraft(billboard.id))
                        }
                        className={cn(
                          'flex items-center gap-1 border px-2 py-0.5 font-mono text-[11px] uppercase transition-colors',
                          inDraft
                            ? 'border-accent bg-accent text-paper'
                            : 'border-ink/20 text-ink/60 hover:border-ink/40 dark:border-paper/20 dark:text-paper/60 dark:hover:border-paper/40',
                        )}
                      >
                        {inDraft ? (
                          <Check className="size-3" />
                        ) : (
                          <Plus className="size-3" />
                        )}
                        {inDraft ? 'In campaign' : 'Add to campaign'}
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
                      {billboard.description}
                    </p>
                    <div className="mt-2 flex items-center gap-1 font-mono text-xs text-ink/60 dark:text-paper/60">
                      <Star className="size-3.5 fill-accent text-accent" />
                      {billboard.rating.avg.toFixed(1)}
                      <span className="text-ink/40 dark:text-paper/40">
                        ({billboard.rating.count} reviews)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-ink/10 pt-4 font-mono text-xs dark:border-paper/10">
                    <div>
                      <span className="tracking-widest text-ink/40 uppercase dark:text-paper/40">
                        Location
                      </span>
                      <p className="mt-1 text-sm text-ink dark:text-paper">
                        {billboard.location.address}, {billboard.location.city}
                      </p>
                    </div>
                    <div>
                      <span className="tracking-widest text-ink/40 uppercase dark:text-paper/40">
                        Size
                      </span>
                      <p className="mt-1 text-sm text-ink dark:text-paper">
                        {billboard.size}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-ink/10 pt-4 dark:border-paper/10">
                    <span className="font-mono text-xs tracking-widest text-ink/40 uppercase dark:text-paper/40">
                      Packages
                    </span>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {pricingPackages(billboard.pricePerDay).map((pkg) => (
                        <div
                          key={pkg.label}
                          className="border border-ink/10 p-3 text-center dark:border-paper/15"
                        >
                          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
                            {pkg.label}
                          </span>
                          <p className="mt-1 font-mono text-sm font-semibold text-accent">
                            ${pkg.price}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-ink/10 pt-4 dark:border-paper/10">
                    <span className="font-mono text-xs tracking-widest text-ink/40 uppercase dark:text-paper/40">
                      Owner
                    </span>

                    {user ? (
                      <div className="mt-2 space-y-3">
                        <p className="text-sm font-medium text-ink dark:text-paper">
                          {billboard.ownerName}
                        </p>
                        <Button
                          onClick={() => setShowChat(true)}
                          className="w-full"
                        >
                          <MessageCircle className="size-4" />
                          Message {billboard.ownerName.split(' ')[0]}
                        </Button>
                        <p className="text-xs text-ink/40 dark:text-paper/40">
                          In-app chat — owner inbox + booking requests land in
                          Phase 6.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-3">
                        <p className="text-sm text-ink/50 blur-[3px] select-none dark:text-paper/50">
                          {billboard.ownerName} · +__ ____ ______ ·
                          owner@example.com
                        </p>
                        <Button
                          onClick={() => {
                            onClose()
                            navigate('/login')
                          }}
                          className="w-full"
                        >
                          Log in to contact owner
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
