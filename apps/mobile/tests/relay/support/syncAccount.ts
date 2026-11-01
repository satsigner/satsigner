import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'

import { createTestIdentity, type TestIdentity } from './identities'

type SyncAccountKeys = {
  common: TestIdentity
  device: TestIdentity
  peerDevice: TestIdentity
}

function createSyncAccountKeys(): SyncAccountKeys {
  return {
    common: createTestIdentity(),
    device: createTestIdentity(),
    peerDevice: createTestIdentity()
  }
}

function buildSyncAccount(
  id: string,
  keys: SyncAccountKeys,
  relays: string[]
): Account {
  return {
    addresses: [],
    createdAt: new Date(),
    displayIndex: 0,
    id,
    keyCount: 1,
    keys: [],
    keysRequired: 1,
    labels: {},
    name: `Relay test ${id}`,
    network: 'signet',
    nostr: {
      autoSync: true,
      commonNpub: keys.common.npub,
      commonNsec: keys.common.nsec,
      deviceNpub: keys.device.npub,
      deviceNsec: keys.device.nsec,
      dms: [],
      lastUpdated: new Date(),
      relays,
      syncStart: new Date(0),
      trustedMemberDevices: [keys.peerDevice.npub]
    },
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
    utxos: []
  }
}

function installSyncAccount(
  id: string,
  keys: SyncAccountKeys,
  relays: string[]
): Account {
  const account = buildSyncAccount(id, keys, relays)
  useAccountsStore.getState().addAccount(account)
  return account
}

function storedDmIds(accountId: string): string[] {
  const account = useAccountsStore
    .getState()
    .accounts.find((candidate) => candidate.id === accountId)
  return account?.nostr.dms.map((dm) => dm.id) ?? []
}

export { createSyncAccountKeys, installSyncAccount, storedDmIds }
export type { SyncAccountKeys }
