import { getEventHash } from 'nostr-tools/pure'

import {
  countLeadingZeroBits,
  expectedPowHashes,
  getCommittedPow,
  mineEventWithinDeadline,
  mineNostrPow,
  NostrPowAbortedError,
  POW_LEVELS
} from '@/utils/nostrPow'

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

describe('expectedPowHashes', () => {
  it('formats the average hash count for each level', () => {
    expect(POW_LEVELS).toHaveLength(17)
    expect(expectedPowHashes(8)).toBe('256')
    expect(expectedPowHashes(16)).toBe('65,536')
    expect(expectedPowHashes(24)).toBe('16,777,216')
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

describe('mineNostrPow cancellation', () => {
  it('stops mining once its signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      mineNostrPow({
        content: 'abandoned note',
        createdAt: 0,
        difficulty: 64,
        kind: 1,
        pubkey: 'a'.repeat(64),
        signal: controller.signal,
        tags: []
      })
    ).rejects.toBeInstanceOf(NostrPowAbortedError)
  })
})

describe('getCommittedPow', () => {
  const ZERO_20 = `00000${'f'.repeat(59)}`

  it('credits the leading zero bits up to the committed target', () => {
    expect(getCommittedPow({ id: ZERO_20, tags: [['nonce', '1', '16']] })).toBe(
      16
    )
    expect(getCommittedPow({ id: ZERO_20, tags: [['nonce', '1', '24']] })).toBe(
      20
    )
  })

  it('credits nothing to a lucky id without a commitment', () => {
    expect(getCommittedPow({ id: ZERO_20, tags: [] })).toBe(0)
    expect(getCommittedPow({ id: ZERO_20, tags: [['nonce', '1']] })).toBe(0)
  })

  it('credits nothing to a malformed id', () => {
    expect(getCommittedPow({ id: 'zz', tags: [['nonce', '1', '8']] })).toBe(0)
  })
})

describe('mineEventWithinDeadline', () => {
  const template = {
    content: 'hi',
    created_at: 1_600_000_000,
    kind: 1059,
    pubkey: PUBKEY,
    tags: [['p', PUBKEY]]
  }

  it('mines without touching a fixed created_at', async () => {
    const mined = await mineEventWithinDeadline(template, 6, {
      fixedCreatedAt: true
    })

    expect(mined.created_at).toBe(template.created_at)
    expect(mined.tags[0]).toStrictEqual(['p', PUBKEY])
    expect(
      getCommittedPow({ id: getEventHash(mined), tags: mined.tags })
    ).toBeGreaterThanOrEqual(6)
  })

  it('returns the event untouched when no work is asked', async () => {
    await expect(mineEventWithinDeadline(template, 0)).resolves.toBe(template)
  })
})
