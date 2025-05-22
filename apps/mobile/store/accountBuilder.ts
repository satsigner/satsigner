import { produce } from 'immer'
import uuid from 'react-native-uuid'
import { create } from 'zustand'

import { type EntropyType } from '@/types/logic/entropy'
import {
  type Account,
  type DM,
  type Key,
  type Secret
} from '@/types/models/Account'

type AccountBuilderState = {
  name: Account['name']
  network: Account['network']
  policyType: Account['policyType']
  keyName: NonNullable<Key['name']>
  creationType: Key['creationType']
  entropy: EntropyType
  mnemonicWordCount: NonNullable<Key['mnemonicWordCount']>
  mnemonic: NonNullable<Secret['mnemonic']>
  passphrase?: Secret['passphrase']
  externalDescriptor?: Secret['externalDescriptor']
  internalDescriptor?: Secret['internalDescriptor']
  extendedPublicKey?: Secret['extendedPublicKey']
  fingerprint?: Key['fingerprint']
  scriptVersion: NonNullable<Key['scriptVersion']>
  keys: Account['keys']
  keyCount: Account['keyCount']
  keysRequired: Account['keysRequired']
}

type AccountBuilderAction = {
  setName: (name: AccountBuilderState['name']) => void
  setNetwork: (network: AccountBuilderState['network']) => void
  setPolicyType: (policyType: AccountBuilderState['policyType']) => void
  setKeyName: (keyName: AccountBuilderState['keyName']) => void
  setCreationType: (creationType: Key['creationType']) => void
  setEntropy: (entropy: AccountBuilderState['entropy']) => void
  setMnemonicWordCount: (
    mnemonicWordCount: AccountBuilderState['mnemonicWordCount']
  ) => void
  setMnemonic: (mnemonic: AccountBuilderState['mnemonic']) => void
  setPassphrase: (passphrase: AccountBuilderState['passphrase']) => void
  setExternalDescriptor: (
    externalDescriptor: NonNullable<Secret['externalDescriptor']>
  ) => void
  setInternalDescriptor: (
    internalDescriptor: NonNullable<Secret['internalDescriptor']>
  ) => void
  setExtendedPublicKey: (
    extendedPublicKey: NonNullable<Secret['extendedPublicKey']>
  ) => void
  setFingerprint: (
    fingerprint: NonNullable<AccountBuilderState['fingerprint']>
  ) => void
  setScriptVersion: (
    scriptVersion: AccountBuilderState['scriptVersion']
  ) => void
  setKey: (index: Key['index']) => Key
  updateKeySecret: (index: Key['index'], newSecret: Key['secret']) => void
  updateKeyFingerprint: (
    index: Key['index'],
    fingerprint: NonNullable<Key['fingerprint']>
  ) => void
  setKeyDerivationPath: (
    index: Key['index'],
    derivationPath: NonNullable<Key['derivationPath']>
  ) => void
  setKeyCount: (keyCount: AccountBuilderState['keyCount']) => void
  setKeysRequired: (keysRequired: AccountBuilderState['keysRequired']) => void
  getAccountData: () => Account
  clearKeyState: () => void
  clearAccount: () => void
}

const initialState: AccountBuilderState = {
  name: '',
  network: 'signet',
  policyType: 'singlesig',
  keyName: '',
  creationType: 'importMnemonic',
  entropy: 'none',
  mnemonicWordCount: 24,
  mnemonic: '',
  passphrase: undefined,
  externalDescriptor: undefined,
  internalDescriptor: undefined,
  extendedPublicKey: undefined,
  fingerprint: undefined,
  scriptVersion: 'P2WPKH',
  keys: [],
  keyCount: 0,
  keysRequired: 0
}

const useAccountBuilderStore = create<
  AccountBuilderState & AccountBuilderAction
>()((set, get) => ({
  ...initialState,
  setName: (name) => {
    set({ name })
  },
  setNetwork: (network) => {
    set({ network })
  },
  setPolicyType: (policyType) => {
    set({ policyType })
  },
  setKeyName: (keyName) => {
    set({ keyName })
  },
  setCreationType: (creationType) => {
    set({ creationType })
  },
  setEntropy: (entropy) => {
    set({ entropy })
  },
  setMnemonicWordCount: (mnemonicWordCount) => {
    set({ mnemonicWordCount })
  },
  setMnemonic: (mnemonic) => {
    set({ mnemonic })
  },
  setPassphrase: (passphrase) => {
    set({ passphrase })
  },
  setExternalDescriptor: (externalDescriptor) => {
    set({ externalDescriptor })
  },
  setInternalDescriptor: (internalDescriptor) => {
    set({ internalDescriptor })
  },
  setExtendedPublicKey: (extendedPublicKey) => {
    set({ extendedPublicKey })
  },
  setFingerprint: (fingerprint) => {
    set({ fingerprint })
  },
  setScriptVersion: (scriptVersion) => {
    set({ scriptVersion })
  },
  setKey: (index) => {
    const {
      keyName,
      creationType,
      mnemonicWordCount,
      mnemonic,
      passphrase,
      fingerprint,
      scriptVersion,
      externalDescriptor,
      internalDescriptor,
      extendedPublicKey
    } = get()
    const key: Key = {
      index,
      name: keyName,
      creationType,
      mnemonicWordCount,
      secret: {
        ...(mnemonic && { mnemonic }),
        ...(passphrase && { passphrase }),
        ...(externalDescriptor && { externalDescriptor }),
        ...(internalDescriptor && { internalDescriptor }),
        ...(extendedPublicKey && { extendedPublicKey })
      },
      iv: uuid.v4().replace(/-/g, ''),
      fingerprint,
      scriptVersion
    }

    set(
      produce((state: AccountBuilderState) => {
        state.keys[index] = key
      })
    )

    return key
  },
  updateKeySecret: (index, newSecret) => {
    set(
      produce((state: AccountBuilderState) => {
        if (state.keys[index]) {
          state.keys[index].secret = newSecret
        }
      })
    )
  },
  updateKeyFingerprint: (index, fingerprint) => {
    set(
      produce((state: AccountBuilderState) => {
        if (state.keys[index]) {
          state.keys[index].fingerprint = fingerprint
        }
      })
    )
  },
  setKeyDerivationPath: (index, derivationPath) => {
    set(
      produce((state: AccountBuilderState) => {
        if (state.keys[index]) {
          state.keys[index].derivationPath = derivationPath
        }
      })
    )
  },
  setKeyCount: (keyCount) => {
    set({ keyCount })
  },
  setKeysRequired: (keysRequired) => {
    set({ keysRequired })
  },
  getAccountData: () => {
    const { name, network, policyType, keys, keyCount, keysRequired } = get()

    const account: Account = {
      id: uuid.v4(),
      name,
      network,
      policyType,
      keys,
      keyCount,
      keysRequired,
      summary: {
        balance: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0,
        satsInMempool: 0
      },
      transactions: [],
      utxos: [],
      addresses: [],
      createdAt: new Date(),
      lastSyncedAt: new Date(),
      syncStatus: 'unsynced',
      syncProgress: {
        tasksDone: 0,
        totalTasks: 0
      },
      nostr: {
        commonNpub: '',
        commonNsec: '',
        relays: [],
        autoSync: false,
        deviceNpub: '',
        deviceNsec: '',
        trustedMemberDevices: [],
        dms: [] as DM[],
        lastUpdated: new Date(),
        syncStart: new Date()
      }
    }

    return account
  },
  clearKeyState: () => {
    set({
      keyName: '',
      creationType: 'importMnemonic',
      entropy: 'none',
      mnemonicWordCount: 24,
      mnemonic: '',
      passphrase: undefined,
      fingerprint: undefined,
      scriptVersion: 'P2WPKH',
      externalDescriptor: undefined,
      extendedPublicKey: undefined
    })
  },
  clearAccount: () => {
    set({ ...initialState })
  }
}))

export { useAccountBuilderStore }
