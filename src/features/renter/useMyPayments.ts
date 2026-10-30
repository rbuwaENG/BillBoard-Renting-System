import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

export interface MyPayment {
  id: string
  bookingId: string
  billboardTitle: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  reference: string | null
  createdAt: string
  confirmedAt: string | null
}

interface PaymentRow {
  id: string
  booking_id: string
  amount: number
  currency: string
  status: MyPayment['status']
  reference: string | null
  created_at: string
  confirmed_at: string | null
  bookings: { billboards: { title: string } | null } | null
}

function toMyPayment(row: PaymentRow): MyPayment {
  return {
    id: row.id,
    bookingId: row.booking_id,
    billboardTitle: row.bookings?.billboards?.title ?? 'Billboard',
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    reference: row.reference,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  }
}

export function useMyPayments() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.myPayments(user?.uid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, bookings!payments_booking_id_fkey(billboards(title))')
        .eq('renter_id', user!.uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as PaymentRow[]).map(toMyPayment)
    },
    enabled: !!user,
  })
}
