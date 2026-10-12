const CURRENCY_SYMBOLS: Record<string, string> = {
  LKR: 'Rs.',
  USD: '$',
  EUR: '€',
  INR: '₹',
  GBP: '£',
}

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_SYMBOLS)

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency
}

export function formatPrice(amount: number, currency: string): string {
  return `${currencySymbol(currency)} ${amount.toLocaleString()}`
}
