import { formatPaise } from './money'

/** Heuristic for choosing a UPI deep-link button (mobile) vs a QR code
 * (desktop): a mobile user agent, or a touch screen on a narrow viewport.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false

  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const narrowScreen = window.innerWidth <= 768

  return mobileUserAgent || (hasTouch && narrowScreen)
}

/** Builds a wa.me link pre-filled with a payment reminder. */
export function buildWhatsAppReminderLink(
  memberName: string,
  amountPaise: number,
  groupName: string,
  upiLink: string,
): string {
  const message =
    `Hey ${memberName}, you owe ${formatPaise(amountPaise)} for ${groupName}. ` +
    `Pay here: ${upiLink}`
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
