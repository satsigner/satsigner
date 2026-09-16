import { parseLndNodeInfo } from '@/utils/lndNodeInfo'

describe('parseLndNodeInfo', () => {
  it('copies validated chains from getinfo', () => {
    const info = parseLndNodeInfo({
      chains: [{ chain: 'bitcoin', network: 'testnet' }],
      identity_pubkey: '02ab'
    })

    expect(info?.chains).toStrictEqual([
      { chain: 'bitcoin', network: 'testnet' }
    ])
  })

  it('ignores malformed chain entries', () => {
    const info = parseLndNodeInfo({
      chains: [
        'bitcoin',
        { chain: 'bitcoin' },
        { chain: 'bitcoin', network: 'mainnet' }
      ],
      identity_pubkey: '02ab'
    })

    expect(info?.chains).toStrictEqual([
      { chain: 'bitcoin', network: 'mainnet' }
    ])
  })
})
