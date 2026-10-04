const RUPEE_GROUPER = new Intl.NumberFormat('en-IN')

/** 150000 -> "₹1,500.00". Splits into rupees/paise with integer math only —
 * never divides paise by 100 as a float — so this stays exact at any amount.
 */
export function formatPaise(amountPaise: number): string {
  const sign = amountPaise < 0 ? '-' : ''
  const absPaise = Math.abs(amountPaise)
  const paise = absPaise % 100
  const rupees = (absPaise - paise) / 100
  return `${sign}₹${RUPEE_GROUPER.format(rupees)}.${String(paise).padStart(2, '0')}`
}

/** Same as formatPaise, but always shows a leading "+" for positive amounts
 * (for balance displays: "is owed" vs "owes" vs "settled up").
 */
export function formatSignedPaise(amountPaise: number): string {
  return amountPaise > 0 ? `+${formatPaise(amountPaise)}` : formatPaise(amountPaise)
}

const RUPEES_PATTERN = /^\d+(\.\d{1,2})?$/

/** "1500.50" -> 150050, or null if not a positive amount with at most 2
 * decimal places. Parses digit-by-digit (no string-to-float division) so
 * this can never introduce the rounding error float math would.
 */
export function parseRupeesToPaise(input: string): number | null {
  const trimmed = input.trim()
  if (!RUPEES_PATTERN.test(trimmed)) return null

  const [rupeesPart, decimalPart = ''] = trimmed.split('.')
  const paisePart = decimalPart.padEnd(2, '0')
  return Number(rupeesPart) * 100 + Number(paisePart)
}
