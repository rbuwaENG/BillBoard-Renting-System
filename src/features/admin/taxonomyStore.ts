import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BillboardSize, Category } from '@/types'

interface TaxonomyState {
  categories: Category[]
  sizes: BillboardSize[]
  addCategory: (name: string) => void
  removeCategory: (id: string) => void
  addSize: (input: { label: string; width: number; height: number }) => void
  removeSize: (id: string) => void
}

// Admin-managed taxonomy (PLAN.md section 1: "manage categories/sizes/pricing
// tiers") that feeds the category/size dropdowns on the Rentor billboard
// form — a local preview store until Phase 9 replaces it with the real
// `categories`/`sizes` Firestore collections.
export const useTaxonomyStore = create<TaxonomyState>()(
  persist(
    (set) => ({
      categories: [
        { id: 'cat-highway', name: 'Highway' },
        { id: 'cat-digital', name: 'Digital' },
        { id: 'cat-transit', name: 'Transit' },
        { id: 'cat-rooftop', name: 'Rooftop' },
        { id: 'cat-mall', name: 'Mall frontage' },
      ],
      sizes: [
        { id: 'size-sm', label: '6 × 10 ft', width: 6, height: 10 },
        { id: 'size-md', label: '20 × 50 ft', width: 20, height: 50 },
        { id: 'size-lg', label: '30 × 40 ft', width: 30, height: 40 },
        { id: 'size-led', label: 'LED 10 × 20 ft', width: 10, height: 20 },
      ],
      addCategory: (name) =>
        set((s) => ({
          categories: [...s.categories, { id: crypto.randomUUID(), name }],
        })),
      removeCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
        })),
      addSize: ({ label, width, height }) =>
        set((s) => ({
          sizes: [
            ...s.sizes,
            { id: crypto.randomUUID(), label, width, height },
          ],
        })),
      removeSize: (id) =>
        set((s) => ({ sizes: s.sizes.filter((sz) => sz.id !== id) })),
    }),
    { name: 'billboard-taxonomy-preview' },
  ),
)
