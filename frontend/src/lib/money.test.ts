import { describe, expect, it } from 'vitest'
import { formatPaise, formatSignedPaise, parseRupeesToPaise } from './money'

describe('formatPaise', () => {
  it('formats a typical amount with the rupee symbol and two decimals', () => {
    expect(formatPaise(150000)).toBe('₹1,500.00')
  })

  it('formats small amounts under a rupee', () => {
    expect(formatPaise(5)).toBe('₹0.05')
  })

  it('formats zero', () => {
    expect(formatPaise(0)).toBe('₹0.00')
  })

  it('formats negative amounts with a leading minus before the symbol', () => {
    expect(formatPaise(-50000)).toBe('-₹500.00')
  })

  it('applies Indian digit grouping (lakhs) for large amounts', () => {
    expect(formatPaise(100_000_000)).toBe('₹10,00,000.00')
  })
})

describe('formatSignedPaise', () => {
  it('prefixes positive amounts with a plus sign', () => {
    expect(formatSignedPaise(50000)).toBe('+₹500.00')
  })

  it('keeps the minus sign for negative amounts', () => {
    expect(formatSignedPaise(-50000)).toBe('-₹500.00')
  })

  it('shows zero with no sign', () => {
    expect(formatSignedPaise(0)).toBe('₹0.00')
  })
})

describe('parseRupeesToPaise', () => {
  it('parses a whole-rupee amount', () => {
    expect(parseRupeesToPaise('1500')).toBe(150000)
  })

  it('parses a two-decimal amount', () => {
    expect(parseRupeesToPaise('450.50')).toBe(45050)
  })

  it('pads a single decimal digit', () => {
    expect(parseRupeesToPaise('10.5')).toBe(1050)
  })

  it('rejects more than two decimal places', () => {
    expect(parseRupeesToPaise('10.999')).toBeNull()
  })

  it('rejects non-numeric input', () => {
    expect(parseRupeesToPaise('abc')).toBeNull()
    expect(parseRupeesToPaise('')).toBeNull()
  })

  it('rejects negative amounts', () => {
    expect(parseRupeesToPaise('-100.00')).toBeNull()
  })
})
