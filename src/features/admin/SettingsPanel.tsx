import {
  CreditCard,
  ImageIcon,
  Mail,
  Percent,
  Settings as SettingsIcon,
} from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { Button, Card } from '@/components'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { ConfirmDialog, ErrorText, QueryState } from './AdminUi'
import {
  useCurrencySetting,
  useUpdateCurrency,
  useUpdatePlatformSettings,
} from './useCurrencySetting'
import {
  usePaymentGatewaySettings,
  useUpdatePaymentGatewaySettings,
} from './usePaymentGatewaySettings'
import { uploadSiteLogo } from './uploadSiteLogo'

function BrandingCard() {
  const { data } = useCurrencySetting()
  const updateSettings = useUpdatePlatformSettings()
  const [siteName, setSiteName] = useState(data?.siteName ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<unknown>(null)

  const name = siteName || data?.siteName || ''

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const url = await uploadSiteLogo(file)
      await updateSettings.mutateAsync({ siteLogoUrl: url })
    } catch (err) {
      setUploadError(err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <Card ticks className="max-w-sm p-5">
      <div className="flex items-center gap-2">
        <ImageIcon className="size-4 text-accent" />
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Branding
        </h3>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
          Site name
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="Billboard Renting System"
            className="w-full border-b border-ink/20 bg-transparent py-2 text-sm focus:border-accent focus:outline-none dark:border-paper/20"
          />
          <Button
            size="sm"
            disabled={!name.trim() || updateSettings.isPending}
            onClick={() => updateSettings.mutate({ siteName: name.trim() })}
          >
            Save
          </Button>
        </div>
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
          Logo
        </span>
        {data?.siteLogoUrl && (
          <img
            src={data.siteLogoUrl}
            alt="Site logo"
            className="mb-2 h-10 w-auto"
          />
        )}
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={handleLogoChange}
          className="block w-full text-sm"
        />
        {uploading && (
          <p
            role="status"
            className="mt-1 text-xs text-ink/50 dark:text-paper/50"
          >
            Uploading…
          </p>
        )}
      </label>
      <div className="mt-2">
        <ErrorText error={uploadError ?? updateSettings.error} />
      </div>
    </Card>
  )
}

function ServiceFeeCard() {
  const { data } = useCurrencySetting()
  const updateSettings = useUpdatePlatformSettings()
  const [fee, setFee] = useState('')

  const value = fee !== '' ? fee : (data?.platformFeePercent?.toString() ?? '0')
  const feeNumber = Number(value)
  const feeValid =
    value.trim() !== '' &&
    Number.isFinite(feeNumber) &&
    feeNumber >= 0 &&
    feeNumber <= 100

  return (
    <Card ticks className="max-w-sm p-5">
      <div className="flex items-center gap-2">
        <Percent className="size-4 text-accent" />
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Service fee
        </h3>
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
          Platform commission (%)
        </span>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={value}
            onChange={(e) => setFee(e.target.value)}
            className="w-full border-b border-ink/20 bg-transparent py-2 text-sm focus:border-accent focus:outline-none dark:border-paper/20"
          />
          <Button
            size="sm"
            disabled={updateSettings.isPending || !feeValid}
            onClick={() =>
              updateSettings.mutate({ platformFeePercent: feeNumber })
            }
          >
            Save
          </Button>
        </div>
      </label>
      <p className="mt-2 font-mono text-[11px] text-ink/50 dark:text-paper/50">
        Deducted from every rentor payout going forward.
      </p>
      {!feeValid && (
        <p className="mt-1 text-xs text-brand-error">
          Enter a percentage between 0 and 100.
        </p>
      )}
      <div className="mt-1">
        <ErrorText error={updateSettings.error} />
      </div>
    </Card>
  )
}

function NotificationSenderCard() {
  const { data } = useCurrencySetting()
  const updateSettings = useUpdatePlatformSettings()
  const [email, setEmail] = useState('')

  const value = email !== '' ? email : (data?.notificationSenderEmail ?? '')

  return (
    <Card ticks className="max-w-sm p-5">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-accent" />
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Notification sender
        </h3>
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
          From email
        </span>
        <div className="flex gap-2">
          <input
            type="email"
            value={value}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="noreply@yourdomain.com"
            className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
          />
          <Button
            size="sm"
            disabled={updateSettings.isPending}
            onClick={() =>
              updateSettings.mutate({ notificationSenderEmail: value.trim() })
            }
          >
            Save
          </Button>
        </div>
      </label>
      <p className="mt-2 font-mono text-[11px] text-ink/50 dark:text-paper/50">
        Must be a verified sender in your email provider, or notification emails
        (e.g. admin-promotion alerts) won't send.
      </p>
      <div className="mt-1">
        <ErrorText error={updateSettings.error} />
      </div>
    </Card>
  )
}

function PaymentGatewayCard() {
  const { data } = usePaymentGatewaySettings()
  const updateGateway = useUpdatePaymentGatewaySettings()
  const [provider, setProvider] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [secretKey, setSecretKey] = useState('')

  const providerValue = provider !== '' ? provider : (data?.provider ?? '')
  const publicKeyValue = publicKey !== '' ? publicKey : (data?.publicKey ?? '')

  function handleSave() {
    updateGateway.mutate(
      {
        provider: providerValue.trim() || undefined,
        publicKey: publicKeyValue.trim() || undefined,
        secretKey: secretKey.trim() || undefined,
      },
      { onSuccess: () => setSecretKey('') },
    )
  }

  return (
    <Card ticks className="max-w-sm p-5">
      <div className="flex items-center gap-2">
        <CreditCard className="size-4 text-accent" />
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Payment gateway
        </h3>
      </div>
      <p className="mt-1 text-xs text-ink/50 dark:text-paper/50">
        No live gateway is wired up yet — these are stored for when one is.
        Payments are currently confirmed manually by an admin.
      </p>

      <label className="mt-4 block">
        <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
          Provider
        </span>
        <input
          type="text"
          value={providerValue}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="stripe, payhere, …"
          className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
          Public key
        </span>
        <input
          type="text"
          value={publicKeyValue}
          onChange={(e) => setPublicKey(e.target.value)}
          className="w-full border-b border-ink/20 bg-transparent py-2 text-sm focus:border-accent focus:outline-none dark:border-paper/20"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
          Secret key
        </span>
        <input
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder={data?.hasSecretKey ? '•••••••• (configured)' : ''}
          className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
        />
      </label>

      <Button
        size="sm"
        className="mt-4"
        disabled={updateGateway.isPending}
        onClick={handleSave}
      >
        Save
      </Button>
      <div className="mt-2">
        <ErrorText error={updateGateway.error} />
      </div>
    </Card>
  )
}

export function SettingsPanel() {
  const settingsQuery = useCurrencySetting()
  const { data } = settingsQuery
  const updateCurrency = useUpdateCurrency()
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null)
  const currentCurrency = data?.currency ?? 'LKR'

  if (settingsQuery.isLoading || settingsQuery.error) {
    return (
      <QueryState
        isLoading={settingsQuery.isLoading}
        error={settingsQuery.error}
        onRetry={() => settingsQuery.refetch()}
        label="Loading settings…"
      />
    )
  }

  return (
    <div className="flex flex-wrap gap-5">
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
            value={currentCurrency}
            disabled={updateCurrency.isPending}
            onChange={(e) => {
              if (e.target.value !== currentCurrency)
                setPendingCurrency(e.target.value)
            }}
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
          Applies to every price shown across the platform. Stored amounts are
          relabelled, not converted.
        </p>
        <div className="mt-1">
          <ErrorText error={updateCurrency.error} />
        </div>
      </Card>

      <ConfirmDialog
        open={pendingCurrency !== null}
        onOpenChange={(open) => !open && setPendingCurrency(null)}
        title={`Switch currency to ${pendingCurrency ?? ''}?`}
        description={
          <>
            <p>
              Every stored price, booking quote, payment and payout keeps its
              number and is simply shown in {pendingCurrency} instead of{' '}
              {currentCurrency} — nothing is converted. A listing at 5,000{' '}
              {currentCurrency} will read 5,000 {pendingCurrency}.
            </p>
            <p className="mt-2">
              Only do this before prices are entered, or after re-pricing.
            </p>
          </>
        }
        confirmLabel={`Switch to ${pendingCurrency ?? ''}`}
        variant="danger"
        onConfirm={() => {
          if (pendingCurrency)
            return updateCurrency.mutateAsync(pendingCurrency)
        }}
      />

      <BrandingCard />
      <ServiceFeeCard />
      <NotificationSenderCard />
      <PaymentGatewayCard />
    </div>
  )
}
