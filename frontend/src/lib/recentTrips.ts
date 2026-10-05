const STORAGE_KEY = 'tripsplit:recent-trips'
const MAX_RECENT_TRIPS = 10

export interface RecentTrip {
  shareCode: string
  name: string
}

export function getRecentTrips(): RecentTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addRecentTrip(trip: RecentTrip): void {
  try {
    const rest = getRecentTrips().filter((existing) => existing.shareCode !== trip.shareCode)
    const updated = [trip, ...rest].slice(0, MAX_RECENT_TRIPS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // localStorage can be unavailable (private browsing, quota); this is a convenience, not critical.
  }
}

export function removeRecentTrip(shareCode: string): void {
  try {
    const updated = getRecentTrips().filter((existing) => existing.shareCode !== shareCode)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // localStorage can be unavailable (private browsing, quota); this is a convenience, not critical.
  }
}
