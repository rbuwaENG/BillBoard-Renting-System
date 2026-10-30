import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { invalidateBooking } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

const THROTTLE_MS = 10 * 60 * 1000
const STORAGE_KEY = 'last-lifecycle-advance-at'

// localStorage can be unavailable (privacy mode, blocked site data) or throw
// on access; the throttle is only an optimisation, so fail open.
function readLastRun(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

function writeLastRun(at: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(at))
  } catch {
    // ignore — see readLastRun
  }
}

// Shared across every mounted dashboard (and StrictMode's double effect run)
// so only one RPC is ever in flight.
let inFlight = false

// Safety-net fallback for the pg_cron job (supabase/migrations/0016, 0027)
// that runs `advance_booking_lifecycle` (confirmed -> active -> completed).
// Payout release and reminders stay with the cron job only. If pg_cron isn't
// enabled on this Supabase project's plan, calling the RPC whenever a
// dashboard loads keeps bookings moving regardless.
export function useAdvanceBookingLifecycle() {
  const { user } = useAuth()
  const uid = user?.uid
  const qc = useQueryClient()

  useEffect(() => {
    if (!uid || inFlight) return
    if (Date.now() - readLastRun() < THROTTLE_MS) return

    inFlight = true
    void (async () => {
      try {
        const { error } = await supabase.rpc('advance_booking_lifecycle')
        if (error) throw error
        // Only throttle after a successful run, so a transient failure is
        // retried on the next dashboard load instead of 10 minutes later.
        writeLastRun(Date.now())
        // Bookings may have moved status: refresh everything derived from them.
        await invalidateBooking(qc)
      } catch (error) {
        console.warn('advance_booking_lifecycle failed', error)
      } finally {
        inFlight = false
      }
    })()
  }, [uid, qc])
}
