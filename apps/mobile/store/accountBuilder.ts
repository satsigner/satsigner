import { Descriptor, DescriptorPublicKey, type Wallet } from 'bdk-rn'
import { KeychainKind, type Network } from 'bdk-rn/lib/lib/enums'
import { create } from 'zustand'

import {
  generateMnemonic,
  getFingerprint,
  getMultiSigWalletFromMnemonic,
  getParticipantInfo,
  getWalletFromMnemonic
} from '@/api/bdk'
import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { type Account, type MultisigParticipant } from '@/types/models/Account'
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
  participantName?: MultisigParticipant['keyName']
  currentParticipantIndex?: number
  participantCreationType?: MultisigParticipant['creationType']
}

type AccountBuilderAction = {
  clearAccount: () => void
  createAccountFromDescriptor: (
    name: string,
    externalDescriptor: string,
    internalDescriptor?: string
  ) => Promise<Account>
  createAccountFromXpub: (
    name: string,
    xpub: string,
    fingerprint: string,
    scriptVersion: Account['scriptVersion']
  ) => Promise<Account>
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
  setParticipant: (participants: string) => Promise<void>
  setParticipantWithSeedWord: () => Promise<void>
  setParticipantsCount: (
    participantsCount: Account['participantsCount']
  ) => void
  setRequiredParticipantsCount: (
    requiredParticipantsCount: Account['requiredParticipantsCount']
  ) => void
  setParticipantCreationType: (
    type: MultisigParticipant['creationType']
  ) => void
  setParticipantName: (name: MultisigParticipant['keyName']) => void
  generateMnemonic: (
    seedWordCount: NonNullable<Account['seedWordCount']>
  ) => Promise<void>
  setPassphrase: (passphrase: Account['passphrase']) => void
  setPolicyType: (policyType: Account['policyType']) => void
  setCurrentParticipantIndex: (index: number) => void
  updateFingerprint: () => Promise<void>
  loadWallet: () => Promise<Wallet>
  encryptSeed: () => Promise<void>
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
  createAccountFromDescriptor: async (
    name,
    externalDescriptor,
    internalDescriptor
  ) => {
    // TODO: derive both internal an external descriptors from the descriptor
    const network = useBlockchainStore.getState().network as Network

    const externalDescriptorObj = await new Descriptor().create(
      externalDescriptor,
      network
    )
    const externalDescriptorWithChecksum =
      await externalDescriptorObj.asString()

    let internalDescriptorWithChecksum: string | undefined
    if (internalDescriptor) {
      const internalDescriptorObj = await new Descriptor().create(
        internalDescriptor,
        network
      )
      internalDescriptorWithChecksum = await internalDescriptorObj.asString()
    }

    const account: Account = {
      name,
      createdAt: new Date(),
      accountCreationType: 'import',
      watchOnly: 'public-key',
      utxos: [],
      transactions: [],
      externalDescriptor: externalDescriptorWithChecksum,
      internalDescriptor: internalDescriptorWithChecksum,
      summary: {
        balance: 0,
        satsInMempool: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0
      }
    }
    return account
  },
  createAccountFromXpub: async (name, xpub, fingerprint, scriptVersion) => {
    const network = useBlockchainStore.getState().network as Network
    const key = await new DescriptorPublicKey().fromString(xpub)

    let externalDescriptorObj: Descriptor | undefined
    let internalDescriptorObj: Descriptor | undefined

    switch (scriptVersion) {
      case 'P2PKH':
        externalDescriptorObj = await new Descriptor().newBip44Public(
          key,
          fingerprint,
          KeychainKind.External,
          network
        )
        internalDescriptorObj = await new Descriptor().newBip44Public(
          key,
          fingerprint,
          KeychainKind.Internal,
          network
        )
        break
      case 'P2SH-P2WPKH':
        externalDescriptorObj = await new Descriptor().newBip49Public(
          key,
          fingerprint,
          KeychainKind.External,
          network
        )
        internalDescriptorObj = await new Descriptor().newBip49Public(
          key,
          fingerprint,
          KeychainKind.Internal,
          network
        )
        break
      case 'P2WPKH':
        externalDescriptorObj = await new Descriptor().newBip84Public(
          key,
          fingerprint,
          KeychainKind.External,
          network
        )
        internalDescriptorObj = await new Descriptor().newBip84Public(
          key,
          fingerprint,
          KeychainKind.Internal,
          network
        )
        break
      case 'P2TR':
        externalDescriptorObj = await new Descriptor().newBip86Public(
          key,
          fingerprint,
          KeychainKind.External,
          network
        )
        internalDescriptorObj = await new Descriptor().newBip86Public(
          key,
          fingerprint,
          KeychainKind.Internal,
          network
        )
        break
      default:
        throw new Error('invalid script version')
    }

    const externalDescriptor = await externalDescriptorObj.asString()
    const internalDescriptor = await internalDescriptorObj.asString()

    const account: Account = {
      name,
      createdAt: new Date(),
      watchOnly: 'public-key',
      accountCreationType: 'import',
      utxos: [],
      transactions: [],
      externalDescriptor,
      internalDescriptor,
      summary: {
        balance: 0,
        satsInMempool: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0
      }
    }
    return account
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
  setParticipant: async (participantSeedWords) => {
    const {
      participants,
      currentParticipantIndex: index,
      scriptVersion,
      seedWordCount,
      participantName,
      participantCreationType
    } = get()
    const { network } = useBlockchainStore.getState()
    if (index! >= 0 && index! < get().participantsCount!) {
      const p: MultisigParticipant = {
        seedWords: participantSeedWords,
        createdAt: new Date(),
        scriptVersion,
        seedWordCount,
        keyName: participantName,
        creationType: participantCreationType!
      }
      const {
        fingerprint,
        derivationPath,
        externalDescriptorString,
        internalDescriptorString,
        pubKey
      } = (await getParticipantInfo(p, network as Network))!
      participants![index!] = {
        ...p,
        fingerprint,
        derivationPath,
        publicKey: pubKey,
        externalDescriptor: externalDescriptorString,
        internalDescriptor: internalDescriptorString
      }
      set({ participants: [...participants!] })
    }
  },
  setParticipantWithSeedWord: async () => {
    const {
      seedWords,
      participants,
      currentParticipantIndex: index,
      scriptVersion,
      seedWordCount,
      participantName,
      participantCreationType
    } = get()
    const { network } = useBlockchainStore.getState()
    if (index! >= 0 && index! < get().participantsCount!) {
      const p: MultisigParticipant = {
        seedWords,
        createdAt: new Date(),
        scriptVersion,
        seedWordCount,
        keyName: participantName,
        creationType: participantCreationType!
      }
      const {
        fingerprint,
        derivationPath,
        externalDescriptorString,
        internalDescriptorString,
        pubKey
      } = (await getParticipantInfo(p, network as Network))!
      participants![index!] = {
        ...p,
        fingerprint,
        derivationPath,
        publicKey: pubKey,
        externalDescriptor: externalDescriptorString,
        internalDescriptor: internalDescriptorString
      }
      set({ participants: [...participants!] })
    }
  },
  setParticipantsCount: (participantsCount) => {
    set({ participantsCount })
  },
  setRequiredParticipantsCount: (requiredParticipantsCount) => {
    set({ requiredParticipantsCount })
  },
  setParticipantCreationType: (type) => {
    set({ participantCreationType: type })
  },
  setParticipantName: (name) => {
    set({ participantName: name })
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
  encryptSeed: async () => {
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
