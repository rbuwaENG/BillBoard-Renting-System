import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { BillboardStatus, TrafficLevel } from '@/types'

export interface RentorBillboard {
  id: string
  ownerId: string
  title: string
  description: string
  categoryId: string
  sizeId: string
  category: string
  size: string
  location: { lat: number; lng: number; address: string; city: string }
  pricePerDay: number
  images: string[]
  status: BillboardStatus
  district: string | null
  trafficLevel: TrafficLevel | null
  rating: { avg: number; count: number }
  createdAt: string
  updatedAt: string
}

export interface RentorBillboardInput {
  title: string
  description: string
  categoryId: string
  sizeId: string
  address: string
  city: string
  lat: number
  lng: number
  pricePerDay: number
  images: string[]
  district: string | null
  trafficLevel: TrafficLevel | null
}

interface RentorBillboardRow {
  id: string
  owner_id: string
  title: string
  description: string
  category_id: string
  size_id: string
  lat: number
  lng: number
  address: string
  city: string
  price_per_day: number
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
}

function toRentorBillboard(row: RentorBillboardRow): RentorBillboard {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    sizeId: row.size_id,
    category: row.categories?.name ?? 'Uncategorized',
    size: row.sizes?.label ?? '—',
    location: { lat: row.lat, lng: row.lng, address: row.address, city: row.city },
    pricePerDay: row.price_per_day,
    images: row.images,
    status: row.status,
    district: row.district,
    trafficLevel: row.traffic_level,
    rating: { avg: row.rating_avg, count: row.rating_count },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const SELECT = '*, categories(name), sizes(label)'

export function useRentorBillboards() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['rentor-billboards', user?.uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboards')
        .select(SELECT)
        .eq('owner_id', user!.uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as RentorBillboardRow[]).map(toRentorBillboard)
    },
    enabled: !!user,
  })
}

export async function uploadBillboardImages(
  files: FileList | File[],
  ownerId: string,
): Promise<string[]> {
  const urls: string[] = []
  for (const file of Array.from(files)) {
    const path = `${ownerId}/${crypto.randomUUID()}-${file.name}`
    const { error } = await supabase.storage
      .from('billboard-images')
      .upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('billboard-images').getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}

function invalidateBillboardQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['rentor-billboards'] })
  qc.invalidateQueries({ queryKey: ['billboards'] })
  qc.invalidateQueries({ queryKey: ['billboards-near'] })
}

export function useCreateBillboard() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RentorBillboardInput) => {
      const { error } = await supabase.from('billboards').insert({
        owner_id: user!.uid,
        title: input.title,
        description: input.description,
        category_id: input.categoryId,
        size_id: input.sizeId,
        address: input.address,
        city: input.city,
        lat: input.lat,
        lng: input.lng,
        price_per_day: input.pricePerDay,
        images: input.images,
        district: input.district,
        traffic_level: input.trafficLevel,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateBillboardQueries(qc),
  })
}

export function useUpdateBillboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: RentorBillboardInput
    }) => {
      const { error } = await supabase
        .from('billboards')
        .update({
          title: input.title,
          description: input.description,
          category_id: input.categoryId,
          size_id: input.sizeId,
          address: input.address,
          city: input.city,
          lat: input.lat,
          lng: input.lng,
          price_per_day: input.pricePerDay,
          images: input.images,
          district: input.district,
          traffic_level: input.trafficLevel,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateBillboardQueries(qc),
  })
}

export function useSetBillboardStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BillboardStatus }) => {
      const { error } = await supabase
        .from('billboards')
        .update({ status })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateBillboardQueries(qc),
  })
}

export function useDeleteBillboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('billboards').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateBillboardQueries(qc),
  })
}
