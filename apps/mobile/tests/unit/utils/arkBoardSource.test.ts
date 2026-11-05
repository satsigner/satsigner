import { ARK_BOARDING_WALLET_SOURCE_ID } from '@/constants/ark'
import { type Account } from '@/types/models/Account'
import { type ScriptVersionType } from '@/types/models/Script'
import { type Network } from '@/types/settings/blockchain'
import {
  getArkBoardSources,
  resolveArkBoardSource
} from '@/utils/arkBoardSource'

type FundingAccount = Parameters<typeof getArkBoardSources>[0]['accounts'][0]

function fundingAccount({
  id,
  balance,
  network = 'signet',
  scriptVersion = 'P2WPKH',
  policyType = 'singlesig'
}: {
  id: string
  balance: number
  network?: Network
  scriptVersion?: ScriptVersionType
  policyType?: Account['policyType']
}): FundingAccount {
  return {
    id,
    keys: [{ index: 0, iv: '', scriptVersion, secret: '' }],
    name: `Wallet ${id}`,
    network,
    policyType,
    summary: {
      balance,
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    }
  }
}

const MIN_AMOUNT_SATS = 10_000

describe('getArkBoardSources', () => {
  it('lists eligible accounts on the Ark network, richest first', () => {
    const sources = getArkBoardSources({
      accounts: [
        fundingAccount({ balance: 5000, id: 'small' }),
        fundingAccount({ balance: 90_000, id: 'big', scriptVersion: 'P2TR' }),
        fundingAccount({
          balance: 1_000_000,
          id: 'mainnet',
          network: 'bitcoin'
        }),
        fundingAccount({
          balance: 70_000,
          id: 'wrapped',
          scriptVersion: 'P2SH-P2WPKH'
        })
      ],
      boardingWalletSats: 0,
      network: 'signet'
    })

    expect(sources.map((source) => source.id)).toStrictEqual(['big', 'small'])
    expect(sources[0]).toMatchObject({
      availableSats: 90_000,
      kind: 'account',
      name: 'Wallet big',
      policyType: 'singlesig',
      scriptVersion: 'P2TR'
    })
  })

  it('puts the boarding wallet first when it holds coins', () => {
    const sources = getArkBoardSources({
      accounts: [fundingAccount({ balance: 90_000, id: 'big' })],
      boardingWalletSats: 20_000,
      network: 'signet'
    })

    expect(sources[0]).toStrictEqual({
      availableSats: 20_000,
      id: ARK_BOARDING_WALLET_SOURCE_ID,
      kind: 'boardingWallet'
    })
    expect(sources).toHaveLength(2)
  })
})

describe('resolveArkBoardSource', () => {
  const sources = getArkBoardSources({
    accounts: [
      fundingAccount({ balance: 5000, id: 'poor' }),
      fundingAccount({ balance: 3000, id: 'poorer' })
    ],
    boardingWalletSats: 0,
    network: 'signet'
  })

  it('returns the picked source', () => {
    expect(resolveArkBoardSource(sources, 'poorer', MIN_AMOUNT_SATS)?.id).toBe(
      'poorer'
    )
  })

  it('defaults to the first source covering the minimum', () => {
    const withRich = getArkBoardSources({
      accounts: [
        fundingAccount({ balance: 5000, id: 'poor' }),
        fundingAccount({ balance: 50_000, id: 'rich' })
      ],
      boardingWalletSats: 2000,
      network: 'signet'
    })

    expect(
      resolveArkBoardSource(withRich, undefined, MIN_AMOUNT_SATS)?.id
    ).toBe('rich')
    expect(resolveArkBoardSource(withRich, 'gone', MIN_AMOUNT_SATS)?.id).toBe(
      'rich'
    )
  })

  it('falls back to the first source when none covers the minimum', () => {
    expect(resolveArkBoardSource(sources, undefined, MIN_AMOUNT_SATS)?.id).toBe(
      'poor'
    )
  })

  it('returns undefined without sources', () => {
    expect(
      resolveArkBoardSource([], undefined, MIN_AMOUNT_SATS)
    ).toBeUndefined()
  })
})
