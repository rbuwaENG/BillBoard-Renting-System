// TODO(phase 4 - Public browse & map, PLAN.md section 3/8): compute and query
// geohash bounding boxes (e.g. via `geofire-common`) once billboards live in
// Firestore, so "near me" can be a server-side query instead of the
// client-side haversine filter below (fine at 7 mock billboards, not at
// marketplace scale).
export function distanceKm(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6371
  const [lat1, lng1] = a
  const [lat2, lng2] = b
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
