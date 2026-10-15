import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Booking } from '@/types'

export interface PendingPayment {
  id: string
  billboardTitle: string
  renterName: string
  priceQuoted: number
  createdAt: string
}

interface PendingPaymentRow {
  id: string
  price_quoted: number
  created_at: string
  status: Booking['status']
  billboards: { title: string } | null
  profiles: { display_name: string } | null
}

export function usePendingPayments() {
  return useQuery({
    queryKey: ['admin-pending-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, price_quoted, created_at, status, billboards(title), profiles!bookings_renter_id_fkey(display_name)')
        .eq('status', 'payment_pending')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data as unknown as PendingPaymentRow[]).map(
        (row): PendingPayment => ({
          id: row.id,
          billboardTitle: row.billboards?.title ?? 'Billboard',
          renterName: row.profiles?.display_name ?? 'Renter',
          priceQuoted: row.price_quoted,
          createdAt: row.created_at,
        }),
      )
    },
  })
}

export function useConfirmPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      bookingId: string
      amount: number
      reference?: string
    }) => {
      const { error } = await supabase.rpc('admin_confirm_payment', {
        p_booking_id: input.bookingId,
        p_amount: input.amount,
        p_reference: input.reference ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pending-payments'] })
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      qc.invalidateQueries({ queryKey: ['owner-bookings'] })
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      qc.invalidateQueries({ queryKey: ['admin-payable-bookings'] })
    },
  })
}
