// Free, no-key reverse geocoding (OpenStreetMap Nominatim) to resolve a Sri
// Lankan district from a lat/lng — verified live: the district comes back as
// `address.state_district`, e.g. "Colombo District", which we normalize to
// "Colombo" to match `district_profiles.district`. No live traffic-count API
// covers Sri Lanka (checked RDA, TomTom, HERE), so traffic level is a manual
// Rentor pick guided by a direct link into Google Maps' live traffic layer.
export async function lookupDistrict(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=8&addressdetails=1`,
    )
    if (!res.ok) return null
    const data = await res.json()
    const raw: string | undefined = data?.address?.state_district
    if (!raw) return null
    return raw.replace(/\s+District$/i, '').trim()
  } catch {
    return null
  }
}

export function trafficMapUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@${lat},${lng},16z/data=!5m1!1e1`
}
