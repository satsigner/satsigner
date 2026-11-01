import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import useAccountNameValidation from '@/hooks/useAccountNameValidation'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    addresses: [],
    createdAt: new Date('2024-01-01'),
    id: 'acc-1',
    keyCount: 1,
    keys: [],
    keysRequired: 1,
    labels: {},
    name: 'Savings',
    network: 'signet',
    nostr: {
      autoSync: false,
      commonNpub: '',
      commonNsec: '',
      dms: [],
      lastUpdated: new Date(),
      relays: [],
      syncStart: new Date(),
      trustedMemberDevices: []
    },
    policyType: 'singlesig',
    summary: {
      balance: 0,
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions: [],
    utxos: [],
    ...overrides
  }
}

type Validation = ReturnType<typeof useAccountNameValidation>

let renderer: ReturnType<typeof create> | null = null

function renderValidation() {
  const result: { current: Validation | null } = { current: null }
  function Harness() {
    result.current = useAccountNameValidation({ network: 'signet' })
    return null
  }
  act(() => {
    renderer = create(createElement(Harness))
  })
  return result
}

function typeName(result: { current: Validation | null }, text: string) {
  act(() => {
    result.current?.handleSetAccountName(text)
  })
}

describe('useAccountNameValidation', () => {
  beforeEach(() => {
    act(() => {
      useAccountsStore.setState({ accounts: [makeAccount()] })
    })
  })

  afterEach(() => {
    act(() => {
      renderer?.unmount()
    })
    renderer = null
  })

  it('does not accept a name made only of spaces', () => {
    const result = renderValidation()
    typeName(result, '   ')
    expect(result.current?.isValidName).toBeUndefined()
    expect(result.current?.accountName).toBe('')
  })

  it('detects a duplicate that differs only by surrounding spaces', () => {
    const result = renderValidation()
    typeName(result, ' Savings ')
    expect(result.current?.isValidName).toBe('invalid')
  })

  it('returns the trimmed name to store', () => {
    const result = renderValidation()
    typeName(result, '  Spending  ')
    expect(result.current?.isValidName).toBe('valid')
    expect(result.current?.accountName).toBe('Spending')
    expect(result.current?.localAccountName).toBe('  Spending  ')
  })
})
