import { Wallet } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import aes from 'react-native-aes-crypto'
import { create } from 'zustand'

import {
  generateMnemonic,
  getFingerprint,
  getWalletFromMnemonic
} from '@/api/bdk'
import { getItem } from '@/storage/encrypted'
import { PIN_KEY } from '@/store/auth'
import { type Account } from '@/types/models/Account'

import { useBlockchainStore } from './blockchain'

type AccountBuilderState = {
  name: Account['name']
  type: Account['accountCreationType']
  scriptVersion: NonNullable<Account['scriptVersion']>
  seedWordCount: NonNullable<Account['seedWordCount']>
  seedWords: NonNullable<Account['seedWords']>
  passphrase?: Account['passphrase']
  usedIndexes: Account['usedIndexes']
  currentIndex: Account['currentIndex']
  fingerprint?: Account['fingerprint']
  derivationPath: NonNullable<Account['derivationPath']>
  externalDescriptor: NonNullable<Account['externalDescriptor']>
  internalDescriptor: NonNullable<Account['internalDescriptor']>
  wallet?: Wallet
}

type AccountBuilderAction = {
  clearAccount: () => void
  getAccount: () => Account
  setName: (name: Account['name']) => void
  setType: (type: Account['accountCreationType']) => void
  setScriptVersion: (
    scriptVersion: NonNullable<Account['scriptVersion']>
  ) => void
  setSeedWordCount: (
    seedWordCount: NonNullable<Account['seedWordCount']>
  ) => void
  unlockSeed: () => Promise<void>
  lockSeed: () => Promise<void>
  setSeedWords: (seedWords: NonNullable<Account['seedWords']>) => void
  generateMnemonic: (
    seedWordCount: NonNullable<Account['seedWordCount']>
  ) => Promise<void>
  setPassphrase: (passphrase: Account['passphrase']) => void
  updateFingerprint: () => Promise<void>
  loadWallet: () => Promise<Wallet>
}

const useAccountBuilderStore = create<
  AccountBuilderState & AccountBuilderAction
>()((set, get) => ({
  name: '',
  type: null,
  scriptVersion: 'P2WPKH',
  seedWordCount: 24,
  seedWords: '',
  usedIndexes: [],
  currentIndex: 0,
  clearAccount: () => {
    set({
      name: '',
      type: null,
      scriptVersion: 'P2PKH',
      seedWordCount: 24,
      seedWords: '',
      usedIndexes: [],
      currentIndex: 0,
      passphrase: undefined,
      fingerprint: undefined,
      derivationPath: undefined,
      externalDescriptor: undefined,
      internalDescriptor: undefined,
      wallet: undefined
    })
  },
  getAccount: () => {
    const {
      name,
      type,
      scriptVersion,
      seedWordCount,
      usedIndexes,
      currentIndex,
      seedWords,
      passphrase,
      fingerprint,
      derivationPath,
      externalDescriptor,
      internalDescriptor
    } = get()

    return {
      name,
      accountCreationType: type,
      scriptVersion,
      seedWordCount,
      seedWords,
      passphrase,
      usedIndexes,
      currentIndex,
      fingerprint,
      derivationPath,
      externalDescriptor,
      internalDescriptor,
      transactions: [],
      utxos: [],
      summary: {
        balance: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0,
        satsInMempool: 0
      }
    }
  },
  setName: (name) => {
    set({ name })
  },
  setType: (type) => {
    set({ type })
  },
  setScriptVersion: (scriptVersion) => {
    set({ scriptVersion })
  },
  setSeedWordCount: (seedWordCount) => {
    set({ seedWordCount })
  },
  setSeedWords: (seedWords) => {
    set({ seedWords })
  },
  generateMnemonic: async (seedWordCount) => {
    const savedPin = await getItem(PIN_KEY)
    const mnemonic = await generateMnemonic(seedWordCount)
    const encryptedSeedWords = await aes.encrypt(
      mnemonic.join(','),
      savedPin!,
      'sat_signer',
      'aes-256-cbc'
    )
    set({ seedWords: encryptedSeedWords })
    await get().updateFingerprint()
  },
  setPassphrase: (passphrase) => {
    set({ passphrase })
  },
  lockSeed: async () => {
    const savedPin = await getItem(PIN_KEY)
    const encryptedSeedWords = await aes.encrypt(
      get().seedWords.join(','),
      savedPin!,
      'sat_signer',
      'aes-256-cbc'
    )
    set({ seedWords: encryptedSeedWords })
  },
  unlockSeed: async () => {
    const savedPin = await getItem(PIN_KEY)
    const decryptedSeed = await aes.decrypt(
      get().seedWords,
      savedPin!,
      'sat_signer',
      'aes-256-cbc'
    )
    set({ seedWords: decryptedSeed.split(',') })
  },

  updateFingerprint: async () => {
    const savedPin = await getItem(PIN_KEY)
    const { network } = useBlockchainStore.getState()
    const decryptedSeed = await aes.decrypt(
      get().seedWords,
      savedPin!,
      'sat_signer',
      'aes-256-cbc'
    )
    const fingerprint = await getFingerprint(
      decryptedSeed.split(','),
      get().passphrase,
      network as Network
    )
    set(() => ({ fingerprint }))
  },
  loadWallet: async () => {
    const { network } = useBlockchainStore.getState()
    const {
      fingerprint,
      derivationPath,
      externalDescriptor,
      internalDescriptor,
      wallet
    } = await getWalletFromMnemonic(
      get().seedWords,
      get().scriptVersion,
      get().passphrase,
      network
    )
    set(() => ({
      fingerprint,
      derivationPath,
      externalDescriptor,
      internalDescriptor,
      wallet
    }))
    return wallet
  }
}))

export { useAccountBuilderStore }
