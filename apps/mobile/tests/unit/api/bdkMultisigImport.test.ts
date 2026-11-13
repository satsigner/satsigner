import * as FileSystem from 'expo-file-system/legacy'
import { BdkWallet, Network } from 'react-native-bdk-sdk'

import { getWalletData } from '@/api/bdk'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { parseMultisigDescriptor } from '@/utils/multisigDescriptor'

import {
  COSIGNERS,
  P2SH_MULTISIG_DESCRIPTOR,
  P2SH_P2WSH_MULTISIG_DESCRIPTOR,
  P2WSH_MULTISIG_DESCRIPTOR
} from '../utils/multisigDescriptorSamples'

jest.mock<typeof import('expo-file-system/legacy')>(
  'expo-file-system/legacy',
  () => ({
    ...jest.requireActual<typeof import('expo-file-system/legacy')>(
      'expo-file-system/legacy'
    ),
    documentDirectory: 'file:///doc/',
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn()
  })
)

jest.mock<typeof import('react-native-bdk-sdk')>('react-native-bdk-sdk', () => {
  const actual = jest.requireActual<typeof import('react-native-bdk-sdk')>(
    'react-native-bdk-sdk'
  )
  return {
    ...actual,
    BdkWallet: Object.assign(jest.fn(), {
      prototype: actual.BdkWallet.prototype
    })
  }
})

const MockBdkWallet = jest.mocked(BdkWallet)

type CosignerKey = 'p2sh' | 'p2shP2wsh' | 'p2wsh'

type WrapperCase = {
  descriptor: string
  keyType: CosignerKey
  origin: string
  prefix: string
  suffix: string
}

const WRAPPER_CASES: WrapperCase[] = [
  {
    descriptor: P2SH_MULTISIG_DESCRIPTOR,
    keyType: 'p2sh',
    origin: '45h/1h/0h',
    prefix: 'sh(sortedmulti(2,',
    suffix: '))'
  },
  {
    descriptor: P2SH_P2WSH_MULTISIG_DESCRIPTOR,
    keyType: 'p2shP2wsh',
    origin: '48h/1h/0h/1h',
    prefix: 'sh(wsh(sortedmulti(2,',
    suffix: ')))'
  },
  {
    descriptor: P2WSH_MULTISIG_DESCRIPTOR,
    keyType: 'p2wsh',
    origin: '48h/1h/0h/2h',
    prefix: 'wsh(sortedmulti(2,',
    suffix: '))'
  }
]

// Same builder writes as the multisig Import Descriptor screen.
function importDescriptorIntoBuilder(descriptor: string) {
  const parsed = parseMultisigDescriptor(descriptor)
  const builder = useAccountBuilderStore.getState()
  builder.clearAccount()
  builder.setName('Imported multisig')
  builder.setPolicyType('multisig')
  builder.setScriptVersion(parsed.scriptVersion)
  builder.setKeyCount(parsed.keyCount)
  builder.setKeysRequired(parsed.keysRequired)
  for (const [index, key] of parsed.keyData.entries()) {
    builder.setCreationType('importDescriptor')
    builder.setFingerprint(key.fingerprint)
    builder.setExtendedPublicKey(key.extendedPublicKey)
    builder.setKey(index)
  }
  return useAccountBuilderStore.getState().getAccountData()
}

describe('wallet built from an imported multisig descriptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: false,
      isDirectory: false,
      uri: ''
    })
  })

  it.each(WRAPPER_CASES)(
    'keeps the script, threshold and keys of $prefix',
    async ({ descriptor, keyType, origin, prefix, suffix }) => {
      const account = importDescriptorIntoBuilder(descriptor)

      await getWalletData(account, Network.Signet)

      expect(MockBdkWallet).toHaveBeenCalledTimes(1)
      const [[receive, change]] = MockBdkWallet.mock.calls
      for (const [chain, walletDescriptor] of [
        ['0', receive],
        ['1', change]
      ]) {
        expect(walletDescriptor?.startsWith(prefix)).toBe(true)
        expect(walletDescriptor?.endsWith(suffix)).toBe(true)
        expect(walletDescriptor?.match(/\[/g)).toHaveLength(COSIGNERS.length)
        for (const cosigner of COSIGNERS) {
          expect(walletDescriptor).toContain(
            `[${cosigner.fingerprint}/${origin}]${cosigner[keyType]}/${chain}/*`
          )
        }
      }
    }
  )
})

describe('multisig key origins', () => {
  const DEFAULT_ORIGIN = "m/48'/1'/0'/2'"
  const OWN_ORIGIN = "m/48'/1'/3'/2'"

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: false,
      isDirectory: false,
      uri: ''
    })
  })

  function importWithKeyPaths(paths: (string | undefined)[]) {
    importDescriptorIntoBuilder(P2WSH_MULTISIG_DESCRIPTOR)
    const builder = useAccountBuilderStore.getState()
    for (const [index, path] of paths.entries()) {
      if (path) {
        builder.setKeyDerivationPath(index, path)
      }
    }
    return useAccountBuilderStore.getState().getAccountData()
  }

  async function receiveDescriptorFor(paths: (string | undefined)[]) {
    MockBdkWallet.mockClear()
    const data = await getWalletData(importWithKeyPaths(paths), Network.Signet)
    const [[receive]] = MockBdkWallet.mock.calls
    return { data, receive }
  }

  it('writes a key with the origin it was imported at', async () => {
    const [own, ...others] = COSIGNERS
    const { data, receive } = await receiveDescriptorFor([OWN_ORIGIN])

    expect(receive).toContain(`[${own.fingerprint}/48h/1h/3h/2h]${own.p2wsh}`)
    for (const cosigner of others) {
      expect(receive).toContain(
        `[${cosigner.fingerprint}/48h/1h/0h/2h]${cosigner.p2wsh}`
      )
    }
    expect(data?.keyDerivationPaths?.[0]).toBe(OWN_ORIGIN)
    expect(data?.keyDerivationPaths?.[1]).toBe(DEFAULT_ORIGIN)
  })

  it('keeps the descriptor of keys stored at the default origin', async () => {
    const { receive: withoutPaths } = await receiveDescriptorFor([])
    const { receive: withDefaultPaths } = await receiveDescriptorFor(
      COSIGNERS.map(() => DEFAULT_ORIGIN)
    )

    expect(withDefaultPaths).toBe(withoutPaths)
  })

  it('falls back to the default origin for a malformed path', async () => {
    const [first] = COSIGNERS
    const { receive } = await receiveDescriptorFor(['m//0'])

    expect(receive).toContain(
      `[${first.fingerprint}/48h/1h/0h/2h]${first.p2wsh}`
    )
  })
})
