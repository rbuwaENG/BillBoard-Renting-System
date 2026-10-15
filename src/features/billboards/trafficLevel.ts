import type { TrafficLevel } from '@/types'

export const TRAFFIC_COLORS: Record<TrafficLevel, string> = {
  light: '#22c55e',
  moderate: '#f59e0b',
  heavy: '#ef4444',
}

export const TRAFFIC_LABELS: Record<TrafficLevel, string> = {
  light: 'Light traffic',
  moderate: 'Moderate traffic',
  heavy: 'Heavy traffic',
}
