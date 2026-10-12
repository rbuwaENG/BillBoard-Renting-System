import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatPrice } from '@/lib/currency'
import { supabase } from '@/lib/supabase'

const DEFAULT_CURRENCY = 'LKR'

export function useCurrencySetting() {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('currency')
        .single()
      if (error) throw error
      return data as { currency: string }
    },
    staleTime: Infinity,
  })
}

export function useUpdateCurrency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (currency: string) => {
      const { error } = await supabase
        .from('platform_settings')
        .update({ currency })
        .eq('id', true)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-settings'] }),
  })
}

export function useFormatPrice() {
  const { data } = useCurrencySetting()
  const currency = data?.currency ?? DEFAULT_CURRENCY
  return (amount: number) => formatPrice(amount, currency)
}
