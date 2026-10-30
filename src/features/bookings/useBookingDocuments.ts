import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateBooking, queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import { uploadBookingCreative, uploadProofOfPosting } from './creativeStorage'

export type BookingDocumentKind =
  'creative' | 'brief' | 'logo' | 'other' | 'proof_of_posting'

// add_proof_of_posting (0033) caps proof photos per booking.
export const MAX_PROOF_PHOTOS = 10

export interface BookingDocument {
  id: string
  bookingId: string
  uploadedBy: string
  storagePath: string
  fileName: string
  fileSize: number
  kind: BookingDocumentKind
  createdAt: string
}

interface BookingDocumentRow {
  id: string
  booking_id: string
  uploaded_by: string
  storage_path: string
  file_name: string
  file_size: number
  kind: BookingDocumentKind
  created_at: string
}

function toBookingDocument(row: BookingDocumentRow): BookingDocument {
  return {
    id: row.id,
    bookingId: row.booking_id,
    uploadedBy: row.uploaded_by,
    storagePath: row.storage_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    kind: row.kind,
    createdAt: row.created_at,
  }
}

export function useBookingDocuments(bookingId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.bookingDocuments(bookingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_documents')
        .select('*')
        .eq('booking_id', bookingId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as BookingDocumentRow[]).map(toBookingDocument)
    },
    enabled: !!bookingId,
  })
}

// Uploads reuse the existing booking-creatives bucket/path convention
// (creativeStorage.ts) — it was already generic, just previously only ever
// called for the single `bookings.creative_url` field.
export function useAddBookingDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      bookingId,
      file,
      kind = 'other',
    }: {
      bookingId: string
      file: File
      kind?: Exclude<BookingDocumentKind, 'proof_of_posting'>
    }) => {
      const path = await uploadBookingCreative(file, bookingId)
      const { error } = await supabase.rpc('add_booking_document', {
        p_booking_id: bookingId,
        p_storage_path: path,
        p_file_name: file.name,
        p_file_size: file.size,
        p_kind: kind,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.bookingDocuments(vars.bookingId),
      })
      invalidateBooking(qc, vars.bookingId)
    },
  })
}

// Owner-only: uploads one proof-of-posting photo (confirmed/active bookings)
// and registers it via add_proof_of_posting, which also notifies the renter
// and logs a 'proof_posted' booking event. Callers show errors inline.
export function useAddProofOfPosting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      bookingId,
      file,
    }: {
      bookingId: string
      file: File
    }) => {
      const path = await uploadProofOfPosting(file, bookingId)
      const { error } = await supabase.rpc('add_proof_of_posting', {
        p_booking_id: bookingId,
        p_path: path,
        p_name: file.name,
        p_size: file.size,
        p_mime: file.type,
      })
      if (error) throw error
    },
    meta: { suppressErrorToast: true },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.bookingDocuments(vars.bookingId),
      })
      invalidateBooking(qc, vars.bookingId)
    },
  })
}

export function useRemoveBookingDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      documentId,
    }: {
      documentId: string
      bookingId: string
    }) => {
      const { error } = await supabase.rpc('remove_booking_document', {
        p_document_id: documentId,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.bookingDocuments(vars.bookingId),
      })
    },
  })
}
