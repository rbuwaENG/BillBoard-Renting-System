// Client-side (camelCase) domain types for the Supabase tables defined in
// supabase/migrations. Hooks map snake_case rows into these shapes.

export type UserRole = 'renter' | 'rentor' | 'admin'

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  phone?: string
  photoURL?: string
  role: UserRole
  status: 'active' | 'suspended'
  createdAt: string
}

export type BillboardStatus = 'active' | 'inactive' | 'flagged' | 'archived'

export type TrafficLevel = 'light' | 'moderate' | 'heavy'

export interface BillboardLocation {
  lat: number
  lng: number
  address: string
  city: string
}

export interface Billboard {
  id: string
  ownerId: string
  title: string
  description: string
  categoryId: string
  sizeId: string
  location: BillboardLocation
  pricePerDay: number
  salePricePerDay?: number | null
  adminPriceOverridePerDay?: number | null
  images: string[]
  status: BillboardStatus
  district?: string
  trafficLevel?: TrafficLevel
  rating: { avg: number; count: number }
  createdAt: string
  updatedAt: string
}

export interface PricingTier {
  id: string
  billboardId: string
  minDays: number
  maxDays: number | null
  pricePerDay: number
}

export type BookingStatus =
  | 'pending_owner_review'
  | 'approved'
  | 'rejected'
  | 'payment_pending'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired'

export interface Booking {
  id: string
  billboardId: string
  ownerId: string
  renterId: string
  startDate: string
  endDate: string
  creativeUrl?: string
  priceQuoted: number
  status: BookingStatus
  paymentId?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
  decisionAt?: string
}

export interface Payment {
  id: string
  bookingId: string
  renterId: string
  ownerId: string
  stripePaymentIntentId?: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  reference?: string
  confirmedBy?: string
  confirmedAt?: string
  createdAt: string
}

export interface Category {
  id: string
  name: string
  description?: string
}

export interface BillboardSize {
  id: string
  label: string
  width: number
  height: number
}

export interface Review {
  id: string
  bookingId: string
  billboardId: string
  renterId: string
  rating: number
  comment?: string
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  type: string
  message: string
  read: boolean
  refId?: string
  createdAt: string
}

export type PayoutStatus = 'approved' | 'paid' | 'cancelled'

export interface Payout {
  id: string
  ownerId: string
  amount: number
  grossAmount: number
  feeAmount: number
  currency: string
  status: PayoutStatus
  scheduledReleaseDate: string
  approvedBy: string
  approvedAt: string
  releasedAt?: string
  createdAt: string
}
