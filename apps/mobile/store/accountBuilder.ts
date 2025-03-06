import { Descriptor, DescriptorPublicKey, type Wallet } from 'bdk-rn'
import { KeychainKind, type Network } from 'bdk-rn/lib/lib/enums'
import { produce } from 'immer'
import { v4 as uuid } from 'uuid'
import { create } from 'zustand'

import {
  extractPubKeyFromDescriptor,
  getFingerprint,
  getMultiSigWalletFromMnemonic,
  getParticipantInfo,
  getWalletFromMnemonic,
  parseDescriptor
} from '@/api/bdk'
import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { type Account, type Key, type Secret } from '@/types/models/Account'
import { aesEncrypt } from '@/utils/crypto'

import { useBlockchainStore } from './blockchain'

type AccountBuilderState = {
  name: Account['name']
  policyType: Account['policyType']
  mnemonic: NonNullable<Secret['mnemonic']>
  mnemonicWordCount: NonNullable<Key['mnemonicWordCount']>
  scriptVersion: NonNullable<Key['scriptVersion']>
  passphrase: Secret['passphrase']
  fingerprint: Account['fingerprint']
  keys: Account['keys']
  keyCount: Account['keyCount']
  keysRequired: Account['keysRequired']
  creationType: Key['creationType']
  keyName: NonNullable<Key['name']>
  // Below deprecated
  externalDescriptor?: Account['externalDescriptor']
  internalDescriptor?: Account['internalDescriptor']
  derivationPath?: Account['derivationPath'] // TODO: remove
  watchOnly?: Account['watchOnly']
  wallet?: Wallet
  participants?: Account['keys']
  participantsCount?: Account['participantsCount']
  requiredParticipantsCount?: Account['requiredParticipantsCount']
  participantName?: MultisigParticipant['keyName']
  currentParticipantIndex?: number
  participantCreationType?: MultisigParticipant['creationType']
}

type AccountBuilderAction = {
  setName: (name: AccountBuilderState['name']) => void
  setPolicyType: (policyType: AccountBuilderState['policyType']) => void
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
  appendKey: (index: NonNullable<Key['index']>) => void
  clearKeyState: () => void
  // Below is deprecated
  getAccount: () => Account
  clearAccount: () => void
  clearParticipants: () => void
  setExternalDescriptor: (descriptor: string) => Promise<void>
  setInternalDescriptor: (descriptor: string) => Promise<void>
  setDescriptorFromXpub: (xpub: string) => Promise<void>
  setDescriptorFromAddress: (address: string) => void
  setWatchOnly: (watchOnlyType: Account['watchOnly']) => void
  setType: (type: AccountBuilderState['creationType']) => void // TODO: Delete
  setScriptVersion: (
    scriptVersion: NonNullable<AccountBuilderState['scriptVersion']>
  ) => void
  setSeedWordCount: (
    seedWordCount: NonNullable<AccountBuilderState['mnemonicWordCount']>
  ) => void
  setSeedWords: (
    seedWords: NonNullable<AccountBuilderState['mnemonic']>
  ) => void
  setParticipant: (participants: string) => Promise<void>
  setParticipantWithSeedWord: () => Promise<void>
  setParticipantWithDescriptor: (descriptor: string) => Promise<void>
  setParticipantsCount: (
    participantsCount: Account['participantsCount']
  ) => void
  setRequiredParticipantsCount: (
    requiredParticipantsCount: Account['requiredParticipantsCount']
  ) => void
  setParticipantCreationType: (type: Key['creationType']) => void
  setParticipantName: (name: Key['keyName']) => void
  // generateMnemonic: (
  //   seedWordCount: NonNullable<Account['mnemonic']>
  // ) => Promise<void>
  setCurrentParticipantIndex: (index: number) => void
  updateFingerprint: () => Promise<void>
  loadWallet: () => Promise<Wallet>
  encryptSeed: () => Promise<void>
}

const useAccountBuilderStore = create<
  AccountBuilderState & AccountBuilderAction
>()((set, get) => ({
  id: '',
  name: '',
  policyType: 'singlesig',
  mnemonic: '',
  mnemonicWordCount: 24,
  scriptVersion: 'P2WPKH',
  creationType: 'importMnemonic',
  keyName: '',
  keys: [],
  keysCount: 0,
  keyRequired: 0,
  // Bellow deprecated
  participants: [],
  participantsCount: 0,
  requiredParticipantsCount: 0,
  currentParticipantIndex: -1,
  // End deprecated
  setName: (name) => {
    set({ name })
  },
  setPolicyType: (policyType) => {
    set({ policyType })
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
      id: uuid(),
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
  appendKey: (index) => {
    const {
      keyName,
      creationType,
      mnemonicWordCount,
      mnemonic,
      passphrase,
      fingerprint,
      scriptVersion
    } = get()
    // TODO: change above to include descriptors and pubkey

    const key: Key = {
      index,
      name: keyName,
      creationType,
      mnemonicWordCount,
      secret: {
        mnemonic,
        passphrase
      },
      iv: uuid(),
      fingerprint,
      scriptVersion
    }

    set(
      produce((state) => {
        state.keys.push(key)
      })
    )

    get().clearKeyState()
  },
  clearKeyState: () => {
    set({
      keyName: '',
      creationType: 'importMnemonic',
      mnemonicWordCount: 24,
      mnemonic: '',
      passphrase: undefined,
      fingerprint: undefined,
      scriptVersion: 'P2WPKH'
      // TODO: Add descriptors and pubkey clear
    })
  },
  // Below is deprecated,
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
      watchOnly: undefined,
      wallet: undefined,
      participants: [],
      policyType: 'single',
      participantsCount: 0,
      requiredParticipantsCount: 0,
      currentParticipantIndex: -1
    })
  },
  clearParticipants: () => {
    set({
      participants: []
    })
  },
  setDescriptorFromXpub: async (xpub) => {
    const { fingerprint, scriptVersion } = get()
    const network = useBlockchainStore.getState().network as Network
    const key = await new DescriptorPublicKey().fromString(xpub)

    let externalDescriptorObj: Descriptor | undefined
    let internalDescriptorObj: Descriptor | undefined

    if (!fingerprint) return

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

    set({
      watchOnly: 'public-key',
      externalDescriptor,
      internalDescriptor
    })
  },
  setDescriptorFromAddress: (address) => {
    set({
      watchOnly: 'address',
      externalDescriptor: `addr(${address})`
    })
  },
  getAccount: () => {
    const {
      id,
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
      watchOnly,
      policyType,
      participants,
      participantsCount,
      requiredParticipantsCount
    } = get()

    return {
      id,
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
      watchOnly,
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
  setType: (type) => {
    set({ type })
  },
  setExternalDescriptor: async (externalDescriptor) => {
    const { network } = useBlockchainStore.getState()
    const externalDescriptorObj = await new Descriptor().create(
      externalDescriptor,
      network as Network
    )
    const externalDescriptorWithChecksum =
      await externalDescriptorObj.asString()
    set({
      // TODO: allow creation of signing wallets from descriptors
      // currently only watch-only wallets are created from descriptors
      watchOnly: 'public-key',
      externalDescriptor: externalDescriptorWithChecksum
    })
  },
  setInternalDescriptor: async (internalDescriptor) => {
    const { network } = useBlockchainStore.getState()
    const internalDescriptorObj = await new Descriptor().create(
      internalDescriptor,
      network as Network
    )
    const internalDescriptorWithChecksum =
      await internalDescriptorObj.asString()
    set({
      // TODO: allow creation of signing wallets from descriptors
      // currently only watch-only wallets are created from descriptors
      watchOnly: 'public-key',
      internalDescriptor: internalDescriptorWithChecksum
    })
  },
  setWatchOnly: (watchOnly) => {
    set({ watchOnly })
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
  // generateMnemonic: async (mnemonic) => {
  //   const mnemonic = await generateMnemonic(seedWordCount)
  //   set({ seedWords: mnemonic })
  //   await get().updateFingerprint()
  // },
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
        creationType: 'importseed',
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
        creationType: 'generate',
        internalDescriptor: internalDescriptorString
      }
      set({ participants: [...participants!] })
    }
  },
  setParticipantWithDescriptor: async (descriptor: string) => {
    try {
      const externalDescriptor = await new Descriptor().create(
        descriptor,
        useBlockchainStore.getState().network as Network
      )
      const { participants, currentParticipantIndex: index } = get()
      const { fingerprint, derivationPath } =
        await parseDescriptor(externalDescriptor)
      const pubKey = await extractPubKeyFromDescriptor(externalDescriptor)
      const p: MultisigParticipant = {
        externalDescriptor: descriptor,
        derivationPath,
        fingerprint,
        createdAt: new Date(),
        creationType: 'importdescriptor',
        publicKey: pubKey
      }
      participants![index!] = p
      set({ participants: [...participants!] })
    } catch {}
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
