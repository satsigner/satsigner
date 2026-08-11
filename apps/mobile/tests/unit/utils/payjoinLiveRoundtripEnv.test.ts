import {
  CLOWN_ACCOUNT_NAME,
  SAMPLE_SEGWIT_ACCOUNT_NAME,
  sampleSignetXpubFingerprint
} from '@/constants/samples'
import { type Account } from '@/types/models/Account'
import {
  findClownAccount,
  findSampleAccount
} from '@/utils/payjoinLiveRoundtripAccounts'

function stubAccount(overrides: Partial<Account>): Account {
  return {
    addresses: [],
    createdAt: new Date(0),
    id: overrides.id ?? 'id',
    keyCount: 1,
    keys: overrides.keys ?? [
      {
        creationType: 'importMnemonic',
        fingerprint: sampleSignetXpubFingerprint,
        index: 0,
        iv: '',
        secret: ''
      }
    ],
    keysRequired: 1,
    labels: {},
    name: overrides.name ?? 'Account',
    network: 'signet',
    nostr: undefined,
    policyType: 'singlesig',
    summary: {
      balance: 0,
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'unsynced',
    transactions: [],
    utxos: [],
    ...overrides
  } as Account
}

describe('payjoinLiveRoundtripEnv account matchers', () => {
  it('finds Sample by exact name', () => {
    const sample = stubAccount({
      id: 'sample',
      name: SAMPLE_SEGWIT_ACCOUNT_NAME
    })
    expect(findSampleAccount([sample])).toBe(sample)
  })

  it('finds Sample by fingerprint when name differs', () => {
    const sample = stubAccount({
      id: 'sample-fp',
      name: 'My sample wallet'
    })
    expect(findSampleAccount([sample])).toBe(sample)
  })

  it('finds Clown by exact name (case-insensitive)', () => {
    const clown = stubAccount({
      id: 'clown',
      keys: [
        {
          creationType: 'importMnemonic',
          fingerprint: 'deadbeef',
          index: 0,
          iv: '',
          secret: ''
        }
      ],
      name: CLOWN_ACCOUNT_NAME.toLowerCase()
    })
    expect(findClownAccount([clown])).toBe(clown)
  })

  it('ignores mainnet accounts', () => {
    const sample = stubAccount({
      id: 'main',
      name: SAMPLE_SEGWIT_ACCOUNT_NAME,
      network: 'bitcoin'
    })
    expect(findSampleAccount([sample])).toBeUndefined()
  })
})
