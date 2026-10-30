import { getEventHash } from 'nostr-tools/pure'

import { countLeadingZeroBits, mineNostrPow } from '@/utils/nostrPow'

const PUBKEY = 'ab'.repeat(32)

describe('countLeadingZeroBits', () => {
  it('counts leading zero bits in a nostr event id', () => {
    expect(
      countLeadingZeroBits(
        '000000000e9d97a1ab09fc381030b346cdd7a142ad57e6df0b46dc9bef6c7e2d'
      )
    ).toBe(36)
    expect(countLeadingZeroBits('002f')).toBe(10)
    expect(
      countLeadingZeroBits(
        '000006d8c378af1779d2feebc7603a125d99eca0ccf1085959b307f64e5dd358'
      )
    ).toBe(21)
  })
})

describe('mineNostrPow', () => {
  it('commits the target difficulty in the nonce tag', async () => {
    const mined = await mineNostrPow({
      content: 'pow',
      createdAt: 1_700_000_000,
      difficulty: 8,
      kind: 1,
      pubkey: PUBKEY,
      tags: [['t', 'test']]
    })

    const nonceTag = mined.tags.find((tag) => tag[0] === 'nonce')
    expect(nonceTag?.[2]).toBe('8')
    expect(mined.tags.some((tag) => tag[0] === 't')).toBe(true)

    const id = getEventHash({
      content: 'pow',
      created_at: mined.createdAt,
      kind: 1,
      pubkey: PUBKEY,
      tags: mined.tags
    })
    expect(countLeadingZeroBits(id)).toBeGreaterThanOrEqual(8)
  })
})
