import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

const THROTTLE_MS = 10 * 60 * 1000
const STORAGE_KEY = 'last-lifecycle-advance-at'

// Safety-net fallback for the pg_cron job (supabase/migrations/0016) that
// advances confirmed->active->completed bookings and releases due payouts —
// in case pg_cron isn't enabled on this Supabase project's plan, calling
// this RPC whenever a dashboard loads keeps things moving regardless.
export function useAdvanceBookingLifecycle() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const lastRun = Number(localStorage.getItem(STORAGE_KEY) ?? 0)
    if (Date.now() - lastRun < THROTTLE_MS) return
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    void supabase.rpc('advance_booking_lifecycle')
  }, [user])
}
