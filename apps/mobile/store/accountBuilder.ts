import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { INITIAL_DISPLAY_INDEX } from '@/constants/account'
import { UNKNOWN_MASTER_FINGERPRINT } from '@/constants/btc'
import { type EntropyType } from '@/types/logic/entropy'
import { type Account, type Key, type Secret } from '@/types/models/Account'
import { createResetKey, dropSeedFromKeyInMemory } from '@/utils/account'
import { randomIv, randomUuid } from '@/utils/crypto'

const DEFAULT_MNEMONIC_WORD_COUNT = 24

type AccountBuilderState = {
  name: Account['name']
  network: Account['network']
  policyType: Account['policyType']
  displayIndex: Account['displayIndex']

  keyName: NonNullable<Key['name']>
  creationType: Key['creationType']
  entropy: EntropyType
  mnemonicWordCount: NonNullable<Key['mnemonicWordCount']>
  mnemonicWordList: NonNullable<Key['mnemonicWordList']>
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

/**
 * Actions interface for account builder store
 */
type AccountBuilderAction = {
  setName: (name: AccountBuilderState['name']) => void
  setNetwork: (network: AccountBuilderState['network']) => void
  setPolicyType: (policyType: AccountBuilderState['policyType']) => void
  setDisplayIndex: (displayIndex: AccountBuilderState['displayIndex']) => void

  setKeyName: (keyName: AccountBuilderState['keyName']) => void
  setCreationType: (creationType: Key['creationType']) => void
  setEntropy: (entropy: AccountBuilderState['entropy']) => void
  setMnemonicWordCount: (
    mnemonicWordCount: AccountBuilderState['mnemonicWordCount']
  ) => void
  setMnemonicWordList: (
    mnemonicWordList: AccountBuilderState['mnemonicWordList']
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
  clearAllKeys: () => void
  dropSeedFromKey: (index: Key['index']) => {
    success: boolean
    message: string
  }
  resetKey: (index: Key['index']) => void
}

const initialState: AccountBuilderState = {
  creationType: 'importMnemonic',
  displayIndex: INITIAL_DISPLAY_INDEX,
  entropy: 'none',
  extendedPublicKey: undefined,
  externalDescriptor: undefined,
  fingerprint: undefined,
  internalDescriptor: undefined,
  keyCount: 0,
  keyName: '',
  keys: [],
  keysRequired: 0,
  mnemonic: '',
  mnemonicWordCount: DEFAULT_MNEMONIC_WORD_COUNT,
  mnemonicWordList: 'english',
  name: '',
  network: 'signet',
  passphrase: undefined,
  policyType: 'singlesig',
  scriptVersion: 'P2WPKH'
}

const useAccountBuilderStore = create<
  AccountBuilderState & AccountBuilderAction
>()(
  immer((set, get) => ({
    ...initialState,
    clearAccount: () => {
      set({ ...initialState })
    },
    clearAllKeys: () => {
      const {
        name,
        network,
        policyType,
        scriptVersion,
        keyCount,
        keysRequired
      } = get()
      set({
        creationType: 'importMnemonic',
        entropy: 'none',
        extendedPublicKey: undefined,
        externalDescriptor: undefined,
        fingerprint: undefined,
        internalDescriptor: undefined,
        keyCount,
        keyName: '',
        keys: [],
        keysRequired,
        mnemonic: '',
        mnemonicWordCount: DEFAULT_MNEMONIC_WORD_COUNT,
        name,
        network,
        passphrase: undefined,
        policyType,
        scriptVersion
      })
    },
    clearKeyState: () => {
      const { policyType, creationType, keys, scriptVersion } = get()
      const extendedPublicKey =
        keys[0]?.secret && typeof keys[0].secret === 'object'
          ? keys[0].secret.extendedPublicKey
          : undefined

      const externalDescriptor =
        keys[0]?.secret && typeof keys[0].secret === 'object'
          ? keys[0].secret.externalDescriptor
          : undefined

      const internalDescriptor =
        keys[0]?.secret && typeof keys[0].secret === 'object'
          ? keys[0].secret.internalDescriptor
          : undefined

      set({
        creationType,
        entropy: 'none',
        extendedPublicKey,
        externalDescriptor,
        fingerprint: undefined,
        internalDescriptor,
        keyName: '',
        mnemonic: '',
        mnemonicWordCount: DEFAULT_MNEMONIC_WORD_COUNT,
        passphrase: undefined,
        policyType,
        scriptVersion
      })
    },
    dropSeedFromKey: (index) => {
      // TODO: store should not be the one responsible for validation & error
      // handling, it should only care about updating current state. Also, ideally
      // this should be synchronous code and not async.
      const state = get()
      if (!state.keys[index] || !state.keys[index].secret) {
        return {
          message: 'Key not found or invalid',
          success: false
        }
      }

      try {
        const newKey = dropSeedFromKeyInMemory(state.keys[index])
        set((state) => {
          state.keys[index] = newKey
        })
        return {
          message: 'Seed dropped successfully',
          success: true
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown reason'
        return {
          message: `Failed to drop seed: ${reason}`,
          success: false
        }
      }
    },
    getAccountData: () => {
      const {
        name,
        network,
        policyType,
        displayIndex,
        keys,
        keyCount,
        keysRequired
      } = get()

      const account: Account = {
        addresses: [],
        createdAt: new Date(),
        displayIndex,
        id: randomUuid(),
        keyCount,
        keys,
        keysRequired,
        labels: {},
        lastSyncedAt: new Date(),
        name,
        network,
        nostr: {
          autoSync: false,
          commonNpub: '',
          commonNsec: '',
          deviceNpub: '',
          deviceNsec: '',
          dms: [],
          lastUpdated: new Date(),
          relays: [],
          syncStart: new Date(),
          trustedMemberDevices: []
        },
        policyType,
        summary: {
          balance: 0,
          numberOfAddresses: 0,
          numberOfTransactions: 0,
          numberOfUtxos: 0,
          satsInMempool: 0
        },
        syncProgress: {
          tasksDone: 0,
          totalTasks: 0
        },
        syncStatus: 'unsynced',
        transactions: [],
        utxos: []
      }

      return account
    },
    resetKey: (index) => {
      set((state) => {
        state.keys[index] = createResetKey(index)
      })
    },
    setCreationType: (creationType) => {
      set({ creationType })
    },
    setDisplayIndex: (displayIndex) => {
      set({ displayIndex })
    },
    setEntropy: (entropy) => {
      set({ entropy })
    },
    setExtendedPublicKey: (extendedPublicKey) => {
      set({ extendedPublicKey })
    },
    setExternalDescriptor: (externalDescriptor) => {
      set({ externalDescriptor })
    },
    setFingerprint: (fingerprint) => {
      set({ fingerprint })
    },
    setInternalDescriptor: (internalDescriptor) => {
      set({ internalDescriptor })
    },
    setKey: (index) => {
      const {
        keyName,
        creationType,
        mnemonicWordCount,
        mnemonicWordList,
        mnemonic,
        passphrase,
        fingerprint,
        scriptVersion,
        externalDescriptor,
        internalDescriptor,
        extendedPublicKey
      } = get()

      const isWatchOnlyAddress =
        creationType === 'importAddress' && externalDescriptor

      const isImportedPublicKey =
        creationType === 'importExtendedPub' ||
        creationType === 'importDescriptor'

      const resolvedFingerprint =
        fingerprint ||
        (isImportedPublicKey ? UNKNOWN_MASTER_FINGERPRINT : undefined)

      if (!resolvedFingerprint && !isWatchOnlyAddress) {
        throw new Error(
          'Fingerprint is required for all keys except watch-only addresses'
        )
      }

      const hasPublicKey = extendedPublicKey || externalDescriptor || mnemonic
      if (!hasPublicKey) {
        throw new Error(
          'Each key must have either a public key, descriptor, or mnemonic'
        )
      }

      const key: Key = {
        creationType,
        fingerprint: resolvedFingerprint,
        index,
        iv: randomIv(),
        mnemonicWordCount,
        mnemonicWordList,
        name: keyName,
        scriptVersion,
        secret: {
          ...(mnemonic && { mnemonic }),
          ...(passphrase && { passphrase }),
          ...(externalDescriptor && { externalDescriptor }),
          ...(internalDescriptor && { internalDescriptor }),
          ...(extendedPublicKey && { extendedPublicKey }),
          ...(resolvedFingerprint && { fingerprint: resolvedFingerprint })
        }
      }

      set((state) => {
        state.keys[index] = key
      })

      return key
    },
    setKeyCount: (keyCount) => {
      set({ keyCount })
    },
    setKeyDerivationPath: (index, derivationPath) => {
      set((state) => {
        if (state.keys[index]) {
          state.keys[index].derivationPath = derivationPath
        }
      })
    },
    setKeyName: (keyName) => {
      set({ keyName })
    },
    setKeysRequired: (keysRequired) => {
      set({ keysRequired })
    },
    setMnemonic: (mnemonic) => {
      set({ mnemonic })
    },
    setMnemonicWordCount: (mnemonicWordCount) => {
      set({ mnemonicWordCount })
    },
    setMnemonicWordList: (mnemonicWordList) => {
      set({ mnemonicWordList })
    },
    setName: (name) => {
      set({ name })
    },
    setNetwork: (network) => {
      set({ network })
    },
    setPassphrase: (passphrase) => {
      set({ passphrase })
    },
    setPolicyType: (policyType) => {
      set({ policyType })
    },
    setScriptVersion: (scriptVersion) => {
      set({ scriptVersion })
    },
    updateKeyFingerprint: (index, fingerprint) => {
      set((state) => {
        const key = state.keys[index]
        if (!key) {
          return
        }
        key.fingerprint = fingerprint
        if (key.secret && typeof key.secret === 'object') {
          key.secret.fingerprint = fingerprint
        }
      })
    },
    updateKeySecret: (index, newSecret) => {
      set((state) => {
        if (state.keys[index]) {
          state.keys[index].secret = newSecret
        }
      })
    }
  }))
)

export { useAccountBuilderStore }
