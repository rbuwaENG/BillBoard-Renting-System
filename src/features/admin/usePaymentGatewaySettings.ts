import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface PaymentGatewaySettings {
  provider: string | null
  publicKey: string | null
  hasSecretKey: boolean
  isEnabled: boolean
}

interface PaymentGatewaySettingsRow {
  provider: string | null
  public_key: string | null
  secret_key: string | null
  is_enabled: boolean
}

function toPaymentGatewaySettings(
  row: PaymentGatewaySettingsRow,
): PaymentGatewaySettings {
  return {
    provider: row.provider,
    publicKey: row.public_key,
    hasSecretKey: !!row.secret_key,
    isEnabled: row.is_enabled,
  }
}

export function usePaymentGatewaySettings() {
  return useQuery({
    queryKey: ['payment-gateway-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_gateway_settings')
        .select('provider, public_key, secret_key, is_enabled')
        .single()
      if (error) throw error
      return toPaymentGatewaySettings(data as PaymentGatewaySettingsRow)
    },
  })
}

export function useUpdatePaymentGatewaySettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: {
      provider?: string
      publicKey?: string
      secretKey?: string
      isEnabled?: boolean
    }) => {
      const { error } = await supabase
        .from('payment_gateway_settings')
        .update({
          provider: patch.provider,
          public_key: patch.publicKey,
          secret_key: patch.secretKey,
          is_enabled: patch.isEnabled,
        })
        .eq('id', true)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['payment-gateway-settings'] }),
  })
}
