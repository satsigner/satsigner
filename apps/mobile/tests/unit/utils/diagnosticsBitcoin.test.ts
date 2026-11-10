import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { BITCOIN_CHECKS } from '@/utils/diagnostics/checks/bitcoin'

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => {
  const { create: createStore } =
    jest.requireActual<typeof import('zustand')>('zustand')
  return {
    useAccountsStore: createStore<{
      accounts: Pick<
        Account,
        'lastSyncedAt' | 'network' | 'policyType' | 'syncStatus'
      >[]
    }>(() => ({ accounts: [] }))
  }
})

const CONTEXT = { identityRelays: [], isOnline: true, network: 'signet' }

function runAccountSyncCheck() {
  const check = BITCOIN_CHECKS.find(({ id }) => id === 'accountSync')
  return check?.run(CONTEXT)
}

function setRecentlySyncedAccount(syncStatus: Account['syncStatus']) {
  useAccountsStore.setState({
    accounts: [
      {
        lastSyncedAt: new Date(),
        network: 'signet',
        policyType: 'singlesig',
        syncStatus
      }
    ]
  })
}

describe('account sync diagnostic', () => {
  it('passes for a recently synced account', async () => {
    setRecentlySyncedAccount('synced')

    await expect(runAccountSyncCheck()).resolves.toMatchObject({
      status: 'ok'
    })
  })

  it('warns about a stalled sync even right after a successful one', async () => {
    setRecentlySyncedAccount('timeout')

    await expect(runAccountSyncCheck()).resolves.toMatchObject({
      status: 'warn'
    })
  })
})
