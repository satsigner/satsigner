import { Descriptor, DescriptorPublicKey, Wallet } from 'bdk-rn'
import { KeychainKind, Network } from 'bdk-rn/lib/lib/enums'
import { create } from 'zustand'

import {
  generateMnemonic,
  getFingerprint,
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
}

type AccountBuilderAction = {
  clearAccount: () => void
  createAccountFromDescriptor: (
    name: string,
    descriptor: string
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
  generateMnemonic: (
    seedWordCount: NonNullable<Account['seedWordCount']>
  ) => Promise<void>
  setPassphrase: (passphrase: Account['passphrase']) => void
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
  seedWords: '',
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
  createAccountFromDescriptor: async (name, descriptor) => {
    // TODO: derive both internal an external descriptors from the descriptor
    // const network = useBlockchainStore.getState().network as Network
    // const descriptorObj = await new Descriptor().create(descriptor, network)
    // const externalDescriptor = await descriptorObj.asStringPrivate()
    // const internalDescriptor = await descriptorObj.asString()

    const account: Account = {
      name,
      createdAt: new Date(),
      accountCreationType: 'import',
      utxos: [],
      transactions: [],
      externalDescriptor: descriptor,
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
    const key = new DescriptorPublicKey().create(xpub)

    async function createDescriptors(callback: Descriptor['newBip44Public']) {
      const externalDescriptor = await callback(
        key,
        fingerprint,
        KeychainKind.External,
        network
      )
      const internalDescriptor = await callback(
        key,
        fingerprint,
        KeychainKind.Internal,
        network
      )
      return Promise.all([
        externalDescriptor.asString(),
        internalDescriptor.asString()
      ])
    }

    let externalDescriptor = ''
    let internalDescriptor = ''

    switch (scriptVersion) {
      case 'P2PKH':
        ;[externalDescriptor, internalDescriptor] = await createDescriptors(
          new Descriptor().newBip44Public
        )
        break
      case 'P2SH-P2WPKH':
        ;[externalDescriptor, internalDescriptor] = await createDescriptors(
          new Descriptor().newBip49Public
        )
        break
      case 'P2WPKH':
        ;[externalDescriptor, internalDescriptor] = await createDescriptors(
          new Descriptor().newBip84Public
        )
        break
      case 'P2TR':
        ;[externalDescriptor, internalDescriptor] = await createDescriptors(
          new Descriptor().newBip86Public
        )
        break
      default:
        throw new Error('invalid script version')
    }

    const account: Account = {
      name,
      createdAt: new Date(),
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
      internalDescriptor
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
      createdAt: new Date()
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
    const mnemonic = await generateMnemonic(seedWordCount)
    set({ seedWords: mnemonic })
    await get().updateFingerprint()
  },
  setPassphrase: (passphrase) => {
    set({ passphrase })
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
