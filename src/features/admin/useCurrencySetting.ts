import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatPrice } from '@/lib/currency'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

const DEFAULT_CURRENCY = 'LKR'

export interface PlatformSettings {
  currency: string
  siteName: string
  siteLogoUrl: string | null
  platformFeePercent: number
  notificationSenderEmail: string | null
}

interface PlatformSettingsRow {
  currency: string
  site_name: string
  site_logo_url: string | null
  platform_fee_percent: number
  notification_sender_email: string | null
}

function toPlatformSettings(row: PlatformSettingsRow): PlatformSettings {
  return {
    currency: row.currency,
    siteName: row.site_name,
    siteLogoUrl: row.site_logo_url,
    platformFeePercent: row.platform_fee_percent,
    notificationSenderEmail: row.notification_sender_email,
  }
}

export function useCurrencySetting() {
  return useQuery({
    queryKey: queryKeys.platformSettings,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select(
          'currency, site_name, site_logo_url, platform_fee_percent, notification_sender_email',
        )
        .single()
      if (error) throw error
      return toPlatformSettings(data as PlatformSettingsRow)
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
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.platformSettings }),
  })
}

export function useUpdatePlatformSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: {
      siteName?: string
      siteLogoUrl?: string
      platformFeePercent?: number
      notificationSenderEmail?: string
    }) => {
      const { error } = await supabase
        .from('platform_settings')
        .update({
          site_name: patch.siteName,
          site_logo_url: patch.siteLogoUrl,
          platform_fee_percent: patch.platformFeePercent,
          notification_sender_email: patch.notificationSenderEmail,
        })
        .eq('id', true)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.platformSettings }),
  })
}

export function useFormatPrice() {
  const { data } = useCurrencySetting()
  const currency = data?.currency ?? DEFAULT_CURRENCY
  return (amount: number) => formatPrice(amount, currency)
}
