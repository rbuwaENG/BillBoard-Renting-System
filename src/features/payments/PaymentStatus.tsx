import type { Payment } from '@/types'

// Phase 7 ("Payments", PLAN.md section 7) wires this to a real Stripe
// Checkout session + webhook-confirmed status.
export function PaymentStatus({ status }: { status: Payment['status'] }) {
  return <span className="text-sm text-gray-600">Payment: {status}</span>
}
