import { Settings as SettingsIcon } from 'lucide-react'
import { Card } from '@/components'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { useCurrencySetting, useUpdateCurrency } from './useCurrencySetting'

export function SettingsPanel() {
  const { data } = useCurrencySetting()
  const updateCurrency = useUpdateCurrency()

  return (
    <Card ticks className="max-w-sm p-5">
      <div className="flex items-center gap-2">
        <SettingsIcon className="size-4 text-accent" />
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Platform settings
        </h3>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
          Currency
        </span>
        <select
          value={data?.currency ?? 'LKR'}
          onChange={(e) => updateCurrency.mutate(e.target.value)}
          className="w-full border-b border-ink/20 bg-transparent py-2 text-sm focus:border-accent focus:outline-none dark:border-paper/20"
        >
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 font-mono text-[11px] text-ink/50 dark:text-paper/50">
        Applies to every price shown across the platform.
      </p>
    </Card>
  )
}
