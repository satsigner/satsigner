import { useArkStore } from '@/store/ark'
import type { ArkAccount, ArkBalance } from '@/types/models/Ark'

function buildAccount(id: string): ArkAccount {
  return {
    bitcoinAccountId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    id,
    name: `Account ${id}`,
    network: 'signet',
    serverId: 'second'
  }
}

function buildBalance(spendableSats: number): ArkBalance {
  return {
    claimableLightningReceiveSats: 0,
    pendingBoardSats: 0,
    pendingExitSats: 0,
    pendingInRoundSats: 0,
    pendingLightningSendSats: 0,
    spendableSats
  }
}

describe('useArkStore', () => {
  beforeEach(() => {
    useArkStore.getState().clearAllData()
  })

  it('addAccount stores the account and seeds an empty balance entry', () => {
    useArkStore.getState().addAccount(buildAccount('a1'))
    const state = useArkStore.getState()
    expect(state.accounts).toHaveLength(1)
    expect(state.accounts[0].id).toBe('a1')
    expect('a1' in state.balances).toBe(true)
    expect(state.balances.a1).toBeUndefined()
  })

  it('updateBalance stores the balance for the account', () => {
    useArkStore.getState().addAccount(buildAccount('a1'))
    useArkStore.getState().updateBalance('a1', buildBalance(1500))
    expect(useArkStore.getState().balances.a1?.spendableSats).toBe(1500)
  })

  it('updateStats merges partial stats over defaults', () => {
    useArkStore.getState().addAccount(buildAccount('a1'))
    useArkStore.getState().updateStats('a1', { numberOfTransactions: 3 })
    expect(useArkStore.getState().stats.a1).toStrictEqual({
      numberOfAddresses: 0,
      numberOfRefreshes: 0,
      numberOfTransactions: 3,
      numberOfVtxos: 0
    })

    useArkStore.getState().updateStats('a1', { numberOfVtxos: 5 })
    expect(useArkStore.getState().stats.a1).toStrictEqual({
      numberOfAddresses: 0,
      numberOfRefreshes: 0,
      numberOfTransactions: 3,
      numberOfVtxos: 5
    })
  })

  it('removeAccount removes the account, its balance and its stats', () => {
    useArkStore.getState().addAccount(buildAccount('a1'))
    useArkStore.getState().addAccount(buildAccount('a2'))
    useArkStore.getState().updateBalance('a1', buildBalance(1500))
    useArkStore.getState().updateBalance('a2', buildBalance(2500))
    useArkStore.getState().updateStats('a1', { numberOfTransactions: 3 })

    useArkStore.getState().removeAccount('a1')

    const state = useArkStore.getState()
    expect(state.accounts.map((a) => a.id)).toStrictEqual(['a2'])
    expect('a1' in state.balances).toBe(false)
    expect('a1' in state.stats).toBe(false)
    expect(state.balances.a2?.spendableSats).toBe(2500)
  })

  it('removeAccount of an unknown id leaves state intact', () => {
    useArkStore.getState().addAccount(buildAccount('a1'))
    useArkStore.getState().removeAccount('missing')
    expect(useArkStore.getState().accounts).toHaveLength(1)
  })

  it('clearAllData resets accounts, balances and stats', () => {
    useArkStore.getState().addAccount(buildAccount('a1'))
    useArkStore.getState().updateBalance('a1', buildBalance(1500))
    useArkStore.getState().updateStats('a1', { numberOfTransactions: 3 })
    useArkStore.getState().clearAllData()
    const state = useArkStore.getState()
    expect(state.accounts).toStrictEqual([])
    expect(state.balances).toStrictEqual({})
    expect(state.stats).toStrictEqual({})
  })
})
