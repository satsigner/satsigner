import { Wallet } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import { create } from 'zustand'

import {
  generateMnemonic,
  getFingerprint,
  getMultiSigWalletFromMnemonic,
  getWalletFromMnemonic
} from '@/api/bdk'
import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { type Account } from '@/types/models/Account'
import { aesEncrypt } from '@/utils/crypto'

import { useBlockchainStore } from './blockchain'

type AccountBuilderState = {
  name: Account['name']
  type: Account['accountCreationType']
  scriptVersion: NonNullable<Account['scriptVersion']>
  seedWordCount: NonNullable<Account['seedWordCount']>
  seedWords: NonNullable<Account['seedWords']>
  passphrase?: Account['passphrase']
  fingerprint?: Account['fingerprint']
  derivationPath?: Account['derivationPath']
  externalDescriptor?: Account['externalDescriptor']
  internalDescriptor?: Account['internalDescriptor']
  wallet?: Wallet
  policyType?: Account['policyType']
  participants?: Account['participants']
  participantsCount?: Account['participantsCount']
  requiredParticipantsCount?: Account['requiredParticipantsCount']
  currentParticipantIndex?: number
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
  setSeedWords: (seedWords: NonNullable<Account['seedWords']>) => void
  setParticipant: (participants: string) => void
  setParticipantWithSeedWord: () => void
  setParticipantsCount: (
    participantsCount: Account['participantsCount']
  ) => void
  setRequiredParticipantsCount: (
    requiredParticipantsCount: Account['requiredParticipantsCount']
  ) => void
  generateMnemonic: (
    seedWordCount: NonNullable<Account['seedWordCount']>
  ) => Promise<void>
  setPassphrase: (passphrase: Account['passphrase']) => void
  setPolicyType: (policyType: Account['policyType']) => void
  setCurrentParticipantIndex: (index: number) => void
  updateFingerprint: () => Promise<void>
  loadWallet: () => Promise<Wallet>
  lockSeed: () => Promise<void>
}

const useAccountBuilderStore = create<
  AccountBuilderState & AccountBuilderAction
>()((set, get) => ({
  name: '',
  type: null,
  scriptVersion: 'P2WPKH',
  seedWordCount: 24,
  policyType: 'single',
  seedWords: '',
  participants: [],
  participantsCount: 0,
  requiredParticipantsCount: 0,
  currentParticipantIndex: -1,
  clearAccount: () => {
    set({
      name: '',
      type: null,
      scriptVersion: 'P2PKH',
      seedWordCount: 24,
      seedWords: '',
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
      seedWords,
      passphrase,
      fingerprint,
      derivationPath,
      externalDescriptor,
      internalDescriptor,
      policyType,
      participants,
      participantsCount,
      requiredParticipantsCount
    } = get()

    return {
      name,
      accountCreationType: type,
      scriptVersion,
      seedWordCount,
      seedWords,
      passphrase,
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
      },
      createdAt: new Date(),
      policyType,
      participants,
      participantsCount,
      requiredParticipantsCount
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
  setCurrentParticipantIndex: (index) => {
    set({ currentParticipantIndex: index })
  },
  generateMnemonic: async (seedWordCount) => {
    const mnemonic = await generateMnemonic(seedWordCount)
    set({ seedWords: mnemonic })
    await get().updateFingerprint()
  },
  setPassphrase: (passphrase) => {
    set({ passphrase })
  },
  setPolicyType: (policyType) => {
    set({ policyType })
  },
  setParticipant: (participants) => {
    const p = get().participants!
    const index = get().currentParticipantIndex!
    if (index >= 0 && index < get().participantsCount!) {
      p[index] = participants
      set({ participants: [...p] })
    }
  },
  setParticipantWithSeedWord: () => {
    const seedWord = get().seedWords!
    const p = get().participants!
    const index = get().currentParticipantIndex!
    if (index >= 0 && index < get().participantsCount!) {
      p[index] = seedWord
      set({ participants: [...p] })
    }
  },
  setParticipantsCount: (participantsCount) => {
    set({ participantsCount })
  },
  setRequiredParticipantsCount: (requiredParticipantsCount) => {
    set({ requiredParticipantsCount })
  },
  updateFingerprint: async () => {
    const { network } = useBlockchainStore.getState()
    const fingerprint = await getFingerprint(
      get().seedWords,
      get().passphrase,
      network as Network
    )
    set(() => ({ fingerprint }))
  },
  loadWallet: async () => {
    const { network } = useBlockchainStore.getState()
    const policyType = get().policyType
    if (policyType === 'single') {
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
        network as Network
      )
      set(() => ({
        fingerprint,
        derivationPath,
        externalDescriptor,
        internalDescriptor,
        wallet
      }))
      return wallet
    } else {
      const result = await getMultiSigWalletFromMnemonic(
        get().participants!,
        get().scriptVersion,
        get().passphrase,
        network as Network,
        get().participantsCount!,
        get().requiredParticipantsCount!
      )
      set(() => ({
        wallet: result?.wallet!
      }))
      return result?.wallet!
    }
  },
  lockSeed: async () => {
    const savedPin = await getItem(PIN_KEY)
    if (!savedPin) return

    const encryptedSeedWords = await aesEncrypt(
      get().seedWords.replace(/\s+/g, ','),
      savedPin
    )
    set({ seedWords: encryptedSeedWords })
  }
}))

export { useAccountBuilderStore }
