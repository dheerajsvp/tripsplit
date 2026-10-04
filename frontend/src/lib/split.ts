/** Client-side mirror of the backend's split_equally, for a live preview
 * before submitting. The backend remains authoritative — this exists only
 * so the Add Expense form can show each member's share as the user types,
 * without a round trip per keystroke. Same rule: leftover paise go one each
 * to the lowest member ids, so the preview matches what the server returns.
 */
export function splitEqually(totalPaise: number, memberIds: number[]): Record<number, number> {
  if (memberIds.length === 0 || totalPaise <= 0) return {}

  const sortedIds = [...memberIds].sort((a, b) => a - b)
  const base = Math.floor(totalPaise / sortedIds.length)
  const remainder = totalPaise - base * sortedIds.length

  const shares: Record<number, number> = {}
  sortedIds.forEach((id, index) => {
    shares[id] = index < remainder ? base + 1 : base
  })
  return shares
}
