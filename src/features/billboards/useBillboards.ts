import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import type { BillboardStatus, TrafficLevel } from '@/types'

export interface BillboardWithDetails {
  id: string
  ownerId: string
  ownerName: string
  title: string
  description: string
  category: string
  size: string
  location: { lat: number; lng: number; address: string; city: string }
  pricePerDay: number
  salePricePerDay: number | null
  adminPriceOverridePerDay: number | null
  images: string[]
  status: BillboardStatus
  district: string | null
  trafficLevel: TrafficLevel | null
  rating: { avg: number; count: number }
  createdAt: string
  updatedAt: string
}

export interface BillboardRow {
  id: string
  owner_id: string
  title: string
  description: string
  lat: number
  lng: number
  address: string
  city: string
  price_per_day: number
  sale_price_per_day: number | null
  admin_price_override_per_day: number | null
  images: string[]
  status: BillboardStatus
  district: string | null
  traffic_level: TrafficLevel | null
  rating_avg: number
  rating_count: number
  created_at: string
  updated_at: string
  categories: { name: string } | null
  sizes: { label: string } | null
  // Public profile columns only: email/phone are not readable (0030); the
  // counterparty contact comes from the get_booking_contact RPC.
  profiles: { display_name: string } | null
}

export function toBillboard(row: BillboardRow): BillboardWithDetails {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.profiles?.display_name ?? 'Unknown owner',
    title: row.title,
    description: row.description,
    category: row.categories?.name ?? 'Uncategorized',
    size: row.sizes?.label ?? '—',
    location: {
      lat: row.lat,
      lng: row.lng,
      address: row.address,
      city: row.city,
    },
    pricePerDay: row.price_per_day,
    salePricePerDay: row.sale_price_per_day,
    adminPriceOverridePerDay: row.admin_price_override_per_day,
    images: row.images,
    status: row.status,
    district: row.district,
    trafficLevel: row.traffic_level,
    rating: { avg: row.rating_avg, count: row.rating_count },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const BILLBOARD_SELECT =
  '*, categories(name), sizes(label), profiles(display_name)'
const SELECT = BILLBOARD_SELECT

export function useBillboards() {
  return useQuery({
    queryKey: queryKeys.billboards,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboards')
        .select(SELECT)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as BillboardRow[]).map(toBillboard)
    },
  })
}

export function useBillboardsNear(
  lat: number | null,
  lng: number | null,
  radiusKm: number,
) {
  return useQuery({
    queryKey: queryKeys.billboardsNear(lat, lng, radiusKm),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('billboards_near', {
          p_lat: lat,
          p_lng: lng,
          p_radius_km: radiusKm,
        })
        .select(SELECT)
      if (error) throw error
      return (data as unknown as BillboardRow[]).map(toBillboard)
    },
    enabled: lat !== null && lng !== null,
  })
}
