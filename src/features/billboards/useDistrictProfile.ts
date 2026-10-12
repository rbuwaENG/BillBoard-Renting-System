import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface DistrictProfile {
  district: string
  province: string
  population: number
  populationDensity: number
}

interface DistrictProfileRow {
  district: string
  province: string
  population: number
  population_density: number
}

// Static reference data (2012 census) seeded in supabase/migrations/0008 —
// audience/demographic context for the billboard's auto-detected district.
export function useDistrictProfile(district: string | null) {
  return useQuery({
    queryKey: ['district-profile', district],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('district_profiles')
        .select('district, province, population, population_density')
        .eq('district', district)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const row = data as DistrictProfileRow
      return {
        district: row.district,
        province: row.province,
        population: row.population,
        populationDensity: row.population_density,
      } satisfies DistrictProfile
    },
    enabled: !!district,
  })
}
