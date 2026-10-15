import type { Payment } from '@/types'

export function PaymentStatus({ status }: { status: Payment['status'] }) {
  return <span className="text-sm text-gray-600">Payment: {status}</span>
}
