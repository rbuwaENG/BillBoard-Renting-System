import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import type { BillboardSize, Category } from '@/types'
import { getErrorCode, plural } from './adminUtils'

// Postgres foreign-key violation — the category/size is still referenced
// by billboards (`billboards.category_id` / `size_id` have no ON DELETE).
const FK_VIOLATION = '23503'

// Turns an FK violation on delete into an "In use by N billboards" message.
export async function explainDeleteError(
  error: unknown,
  column: 'category_id' | 'size_id',
  id: string,
  noun: string,
): Promise<Error | unknown> {
  if (getErrorCode(error) !== FK_VIOLATION) return error
  const { count } = await supabase
    .from('billboards')
    .select('id', { count: 'exact', head: true })
    .eq(column, id)
  const usage =
    typeof count === 'number' && count > 0
      ? plural(count, 'billboard')
      : 'existing billboards'
  return new Error(
    `Can't delete this ${noun} — it's in use by ${usage}. Reassign those listings first.`,
  )
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')
      if (error) throw error
      return data as Category[]
    },
  })
}

export function useSizes() {
  return useQuery({
    queryKey: queryKeys.sizes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sizes')
        .select('*')
        .order('label')
      if (error) throw error
      return data as BillboardSize[]
    },
  })
}

export function useAddCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('categories').insert({ name })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories }),
  })
}

export function useRemoveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error)
        throw await explainDeleteError(error, 'category_id', id, 'category')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories }),
  })
}

export function useAddSize() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      label: string
      width: number
      height: number
    }) => {
      const { error } = await supabase.from('sizes').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sizes }),
  })
}

export function useRemoveSize() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sizes').delete().eq('id', id)
      if (error) throw await explainDeleteError(error, 'size_id', id, 'size')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sizes }),
  })
}
