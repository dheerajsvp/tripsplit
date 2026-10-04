import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildWhatsAppReminderLink, isMobileDevice } from './upi'

function stubDevice(options: {
  userAgent: string
  maxTouchPoints?: number
  hasOntouchstart?: boolean
  innerWidth?: number
}) {
  vi.stubGlobal('navigator', {
    userAgent: options.userAgent,
    maxTouchPoints: options.maxTouchPoints ?? 0,
  })

  if (options.hasOntouchstart) {
    Object.defineProperty(window, 'ontouchstart', { value: null, configurable: true })
  } else {
    delete (window as { ontouchstart?: unknown }).ontouchstart
  }

  Object.defineProperty(window, 'innerWidth', {
    value: options.innerWidth ?? 1920,
    configurable: true,
  })
}

describe('isMobileDevice', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false for a desktop browser with no touch support', () => {
    stubDevice({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      innerWidth: 1920,
    })
    expect(isMobileDevice()).toBe(false)
  })

  it('returns true for an iPhone user agent', () => {
    stubDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })
    expect(isMobileDevice()).toBe(true)
  })

  it('returns true for an Android user agent', () => {
    stubDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' })
    expect(isMobileDevice()).toBe(true)
  })

  it('returns true for a touch screen on a narrow viewport', () => {
    stubDevice({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      maxTouchPoints: 5,
      hasOntouchstart: true,
      innerWidth: 375,
    })
    expect(isMobileDevice()).toBe(true)
  })

  it('returns false for a touch screen on a wide viewport (e.g. a touchscreen laptop)', () => {
    stubDevice({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      maxTouchPoints: 5,
      hasOntouchstart: true,
      innerWidth: 1920,
    })
    expect(isMobileDevice()).toBe(false)
  })
})

describe('buildWhatsAppReminderLink', () => {
  it('builds a wa.me link whose decoded text matches the expected reminder message', () => {
    const link = buildWhatsAppReminderLink(
      'Arjun',
      50000,
      'Munnar Trip',
      'upi://pay?pa=dheeraj@okaxis&pn=Dheeraj&am=500.00&cu=INR',
    )

    expect(link.startsWith('https://wa.me/?text=')).toBe(true)

    const decoded = decodeURIComponent(link.replace('https://wa.me/?text=', ''))
    expect(decoded).toBe(
      'Hey Arjun, you owe ₹500.00 for Munnar Trip. ' +
        'Pay here: upi://pay?pa=dheeraj@okaxis&pn=Dheeraj&am=500.00&cu=INR',
    )
  })
})
