import { produce } from 'immer'
import uuid from 'react-native-uuid'
import { create } from 'zustand'

import { type Account, type Key, type Secret } from '@/types/models/Account'

type AccountBuilderState = {
  name: Account['name']
  policyType: Account['policyType']
  keyName: NonNullable<Key['name']>
  creationType: Key['creationType']
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
  setPolicyType: (policyType: AccountBuilderState['policyType']) => void
  setScriptVersion: (
    scriptVersion: NonNullable<AccountBuilderState['scriptVersion']>
  ) => void
  setMnemonic: (mnemonic: AccountBuilderState['mnemonic']) => void
  setMnemonicWordCount: (
    mnemonicWordCount: AccountBuilderState['mnemonicWordCount']
  ) => void
  setFingerprint: (fingerprint: AccountBuilderState['fingerprint']) => void
  setPassphrase: (passphrase: AccountBuilderState['passphrase']) => void
  setKeyCount: (keyCount: AccountBuilderState['keyCount']) => void
  setKeysRequired: (keysRequired: AccountBuilderState['keysRequired']) => void
  setKeyName: (keyName: AccountBuilderState['keyName']) => void
  getAccountData: () => Account
  setKey: (index: NonNullable<Key['index']>) => Key
  clearKeyState: () => void
  clearAccount: () => void
  updateKeySecret: (
    index: NonNullable<Key['index']>,
    newSecret: Key['secret']
  ) => void
  updateKeyFingerprint: (
    index: NonNullable<Key['index']>,
    fingerprint: NonNullable<Key['fingerprint']>
  ) => void
  setKeyDerivationPath: (
    index: NonNullable<Key['index']>,
    derivationPath: NonNullable<Key['derivationPath']>
  ) => void
  setCreationType: (creationType: NonNullable<Key['creationType']>) => void
  setExternalDescriptor: (
    externalDescriptor: NonNullable<Secret['externalDescriptor']>
  ) => void
  setExtendedPublicKey: (
    extendedPublicKey: NonNullable<Secret['extendedPublicKey']>
  ) => void
}

const initialState: AccountBuilderState = {
  name: '',
  policyType: 'singlesig',
  keyName: '',
  creationType: 'importMnemonic',
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
  setPolicyType: (policyType) => {
    set({ policyType })
  },
  setScriptVersion: (scriptVersion) => {
    set({ scriptVersion })
  },
  setMnemonic: (mnemonic) => {
    set({ mnemonic })
  },
  setMnemonicWordCount: (mnemonicWordCount) => {
    set({ mnemonicWordCount })
  },
  setFingerprint: (fingerprint) => {
    set({ fingerprint })
  },
  setPassphrase: (passphrase) => {
    set({ passphrase })
  },
  setKeyCount: (keyCount) => {
    set({ keyCount })
  },
  setKeysRequired: (keysRequired) => {
    set({ keysRequired })
  },
  setKeyName: (keyName) => {
    set({ keyName })
  },
  getAccountData: () => {
    const { name, policyType, keys, keyCount, keysRequired } = get()

    const account: Account = {
      id: uuid.v4(),
      name,
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
      createdAt: new Date()
    }

    return account
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
  clearKeyState: () => {
    set({
      keyName: '',
      creationType: 'importMnemonic',
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
  setCreationType: (creationType) => {
    set({ creationType })
  },
  setExternalDescriptor: (externalDescriptor) => {
    set({ externalDescriptor })
  },
  setExtendedPublicKey: (extendedPublicKey) => {
    set({ extendedPublicKey })
  }
}))

export { useAccountBuilderStore }
