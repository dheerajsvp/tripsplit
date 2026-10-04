import { describe, expect, it } from 'vitest'
import { splitEqually } from './split'

describe('splitEqually', () => {
  it('splits a divisible amount evenly', () => {
    expect(splitEqually(9000, [1, 2, 3])).toEqual({ 1: 3000, 2: 3000, 3: 3000 })
  })

  it('gives leftover paise to the lowest member ids', () => {
    // ₹100 split 3 ways -> 3334, 3333, 3333 paise.
    expect(splitEqually(10000, [1, 2, 3])).toEqual({ 1: 3334, 2: 3333, 3: 3333 })
  })

  it('is deterministic regardless of input order', () => {
    expect(splitEqually(10000, [3, 1, 2])).toEqual(splitEqually(10000, [1, 2, 3]))
  })

  it('shares always sum to the total', () => {
    const shares = splitEqually(10001, [4, 7, 9])
    expect(Object.values(shares).reduce((sum, share) => sum + share, 0)).toBe(10001)
  })

  it('returns an empty object for zero members or non-positive amounts', () => {
    expect(splitEqually(10000, [])).toEqual({})
    expect(splitEqually(0, [1, 2])).toEqual({})
    expect(splitEqually(-100, [1, 2])).toEqual({})
  })
})
