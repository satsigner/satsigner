import type { MintQuote } from '@/types/models/Ecash'
import {
  activeAccountItems,
  activeAccountMintQuotes,
  getEcashMintLabel
} from '@/utils/ecashAccount'

const MINT_QUOTE: MintQuote = {
  expiry: 0,
  mintUrl: 'https://mint.example',
  paid: false,
  quote: 'q1',
  request: 'lnbc1'
}

describe('activeAccountItems', () => {
  it('returns the active account list', () => {
    const items = ['a', 'b']

    expect(activeAccountItems({ acc: items }, 'acc')).toBe(items)
  })

  it('returns the same empty list without an account or its entry', () => {
    const empty = activeAccountItems({}, null)

    expect(empty).toStrictEqual([])
    expect(activeAccountItems({}, 'missing')).toBe(empty)
  })
})

describe('activeAccountMintQuotes', () => {
  it('returns the active account mint quotes', () => {
    const mint = [MINT_QUOTE]

    expect(activeAccountMintQuotes({ acc: { mint } }, 'acc')).toBe(mint)
  })

  it('returns the shared empty list without quotes', () => {
    expect(activeAccountMintQuotes({}, 'acc')).toBe(
      activeAccountItems({}, null)
    )
  })
})

describe('getEcashMintLabel', () => {
  const MINT_URL = 'https://mint.example/path'

  it('returns the name of the matching mint', () => {
    const mints = [{ name: 'Example Mint', url: MINT_URL }]

    expect(getEcashMintLabel(mints, MINT_URL)).toBe('Example Mint')
  })

  it('returns the URL host when no mint matches', () => {
    expect(getEcashMintLabel([], MINT_URL)).toBe('mint.example')
  })

  it('returns the URL host when the matching mint has no name', () => {
    const mints = [{ url: 'http://mint.example:3338/v1' }]

    expect(getEcashMintLabel(mints, 'http://mint.example:3338/v1')).toBe(
      'mint.example:3338'
    )
  })
})
