import { onCall } from 'firebase-functions/v2/https'

// Placeholder callable proving the Functions skeleton builds and deploys.
// Phase 2+ (PLAN.md section 4) adds the real callables here:
// requestBooking, respondToBooking, createCheckoutSession, setUserRole.
export const ping = onCall(() => {
  return { ok: true, message: 'pong' }
})
