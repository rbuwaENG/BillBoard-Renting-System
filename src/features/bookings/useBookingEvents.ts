import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type BookingEventType = 'status_change' | 'document_requested' | 'document_uploaded'

export interface BookingEvent {
  id: string
  bookingId: string
  eventType: BookingEventType
  actorId: string | null
  fromStatus: string | null
  toStatus: string | null
  message: string | null
  createdAt: string
}

interface BookingEventRow {
  id: string
  booking_id: string
  event_type: BookingEventType
  actor_id: string | null
  from_status: string | null
  to_status: string | null
  message: string | null
  created_at: string
}

function toBookingEvent(row: BookingEventRow): BookingEvent {
  return {
    id: row.id,
    bookingId: row.booking_id,
    eventType: row.event_type,
    actorId: row.actor_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    message: row.message,
    createdAt: row.created_at,
  }
}

// Realtime-subscribed so a confirmed payment, an owner's document request, or
// a status change shows up in an already-open booking workspace without a
// manual refresh — mirrors useChatMessages in features/chat/useChat.ts.
export function useBookingEvents(bookingId: string | null | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!bookingId) return
    const channel = supabase
      .channel(`booking-events:${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_events',
          filter: `booking_id=eq.${bookingId}`,
        },
        () => qc.invalidateQueries({ queryKey: ['booking-events', bookingId] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [bookingId, qc])

  return useQuery({
    queryKey: ['booking-events', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_events')
        .select('*')
        .eq('booking_id', bookingId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data as BookingEventRow[]).map(toBookingEvent)
    },
    enabled: !!bookingId,
  })
}
