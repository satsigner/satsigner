import { performRecoverOverwrite } from '@/utils/recoverBackup'

jest.mock<typeof import('@/utils/crypto')>('@/utils/crypto', () => ({
  aesEncrypt: jest.fn(),
  getPinForDecryption: jest.fn(),
  randomIv: jest.fn()
}))

jest.mock<typeof import('@/utils/nostrSyncService')>(
  '@/utils/nostrSyncService',
  () => ({
    resetInstance: jest.fn()
  })
)

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  deleteEcashMnemonic: jest.fn(),
  storeEcashMnemonic: jest.fn(),
  storeKeySecret: jest.fn()
}))

jest.mock<typeof import('@/store/auth')>('@/store/auth', () => ({
  useAuthStore: { getState: jest.fn() }
}))

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/ark')>('@/store/ark', () => ({
  useArkStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/blockchain')>('@/store/blockchain', () => ({
  useBlockchainStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/ecash')>('@/store/ecash', () => ({
  useEcashStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/lightning')>('@/store/lightning', () => ({
  useLightningStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/nostr')>('@/store/nostr', () => ({
  useNostrStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/nostrIdentity')>(
  '@/store/nostrIdentity',
  () => ({
    useNostrIdentityStore: { getState: jest.fn(), setState: jest.fn() }
  })
)
jest.mock<typeof import('@/store/settings')>('@/store/settings', () => ({
  useSettingsStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/wallets')>('@/store/wallets', () => ({
  useWalletsStore: { getState: jest.fn(), setState: jest.fn() }
}))

const { getPinForDecryption } = jest.requireMock('@/utils/crypto') as {
  getPinForDecryption: jest.Mock
}
const { useAuthStore } = jest.requireMock('@/store/auth') as {
  useAuthStore: { getState: jest.Mock }
}

function setPin(pin: string | null) {
  useAuthStore.getState.mockReturnValue({ skipPin: false })
  getPinForDecryption.mockResolvedValue(pin)
}

describe('performRecoverOverwrite validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fails when PIN is unavailable', async () => {
    setPin(null)
    const result = await performRecoverOverwrite('{}')
    expect(result).toStrictEqual({ error: 'PIN unavailable', success: false })
  })

  it('fails when payload is not valid JSON', async () => {
    setPin('1234')
    const result = (await performRecoverOverwrite('{not json')) as Extract<
      Awaited<ReturnType<typeof performRecoverOverwrite>>,
      { success: false }
    >
    expect(result.success).toBe(false)
    expect(result.error.length).toBeGreaterThan(0)
  })

  it('fails when payload is a JSON primitive (not object)', async () => {
    setPin('1234')
    const result = await performRecoverOverwrite('"a string"')
    expect(result).toStrictEqual({
      error: 'Backup payload is not an object',
      success: false
    })
  })

  it('fails when accounts array is missing', async () => {
    setPin('1234')
    const result = await performRecoverOverwrite(JSON.stringify({}))
    expect(result).toStrictEqual({
      error: 'Backup missing accounts array',
      success: false
    })
  })

  it('fails when accounts is not an array', async () => {
    setPin('1234')
    const result = await performRecoverOverwrite(
      JSON.stringify({ accounts: 'not an array' })
    )
    expect(result).toStrictEqual({
      error: 'Backup missing accounts array',
      success: false
    })
  })

  it('fails when an account is missing its keys array', async () => {
    setPin('1234')
    const result = await performRecoverOverwrite(
      JSON.stringify({ accounts: [{ id: 'x', name: 'A' }] })
    )
    expect(result).toStrictEqual({
      error: 'Backup account missing keys array',
      success: false
    })
  })

  it('fails when a key is missing both seedWords and passphrase', async () => {
    setPin('1234')
    const result = await performRecoverOverwrite(
      JSON.stringify({
        accounts: [
          {
            id: 'x',
            keys: [{ index: 0, name: 'k1' }],
            name: 'A'
          }
        ]
      })
    )
    expect(result).toStrictEqual({
      error: 'Backup key missing seed data',
      success: false
    })
  })

  it('does not invoke encryption or store mutations on validation failure', async () => {
    setPin('1234')
    const { aesEncrypt } = jest.requireMock('@/utils/crypto') as {
      aesEncrypt: jest.Mock
    }
    const { storeKeySecret } = jest.requireMock('@/storage/encrypted') as {
      storeKeySecret: jest.Mock
    }
    await performRecoverOverwrite('{not json')
    expect(aesEncrypt).not.toHaveBeenCalled()
    expect(storeKeySecret).not.toHaveBeenCalled()
  })
})

describe('performRecoverOverwrite restore', () => {
  const addAccount = jest.fn()
  const addCustomServer = jest.fn()
  const removeCustomServer = jest.fn()
  const setSelectedNetwork = jest.fn()
  const updateServer = jest.fn()
  const updateConfig = jest.fn()
  const updateConfigMempool = jest.fn()
  const clearAllNostrState = jest.fn()
  const clearAllDataEcash = jest.fn()
  const clearAllDataArk = jest.fn()
  const deleteAccounts = jest.fn()
  const deleteWallets = jest.fn()
  const clearAllIdentities = jest.fn()
  const addIdentity = jest.fn()
  const setActiveIdentity = jest.fn()
  const setRelays = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    setPin('1234')

    const { aesEncrypt, randomIv } = jest.requireMock('@/utils/crypto') as {
      aesEncrypt: jest.Mock
      randomIv: jest.Mock
    }
    aesEncrypt.mockResolvedValue('encrypted-secret')
    randomIv.mockReturnValue('iv')

    const { useAccountsStore } = jest.requireMock('@/store/accounts') as {
      useAccountsStore: { getState: jest.Mock }
    }
    const { useArkStore } = jest.requireMock('@/store/ark') as {
      useArkStore: { getState: jest.Mock }
    }
    const { useBlockchainStore } = jest.requireMock('@/store/blockchain') as {
      useBlockchainStore: { getState: jest.Mock }
    }
    const { useEcashStore } = jest.requireMock('@/store/ecash') as {
      useEcashStore: { getState: jest.Mock }
    }
    const { useLightningStore } = jest.requireMock('@/store/lightning') as {
      useLightningStore: { getState: jest.Mock }
    }
    const { useNostrStore } = jest.requireMock('@/store/nostr') as {
      useNostrStore: { getState: jest.Mock }
    }
    const { useNostrIdentityStore } = jest.requireMock(
      '@/store/nostrIdentity'
    ) as {
      useNostrIdentityStore: { getState: jest.Mock }
    }
    const { useSettingsStore } = jest.requireMock('@/store/settings') as {
      useSettingsStore: { getState: jest.Mock }
    }
    const { useWalletsStore } = jest.requireMock('@/store/wallets') as {
      useWalletsStore: { getState: jest.Mock }
    }

    useAccountsStore.getState.mockReturnValue({
      addAccount,
      deleteAccounts
    })
    useArkStore.getState.mockReturnValue({
      addAccount: jest.fn(),
      clearAllData: clearAllDataArk
    })
    useBlockchainStore.getState.mockReturnValue({
      addCustomServer,
      customServers: [],
      removeCustomServer,
      setSelectedNetwork,
      updateConfig,
      updateConfigMempool,
      updateServer
    })
    useEcashStore.getState.mockReturnValue({
      accounts: [],
      clearAllData: clearAllDataEcash
    })
    useLightningStore.getState.mockReturnValue({
      clearConfig: jest.fn(),
      setConfig: jest.fn()
    })
    useNostrStore.getState.mockReturnValue({
      clearAllNostrState
    })
    useNostrIdentityStore.getState.mockReturnValue({
      addIdentity,
      clearAll: clearAllIdentities,
      setActiveIdentity,
      setRelays
    })
    useSettingsStore.getState.mockReturnValue({
      setCurrencyUnit: jest.fn(),
      setMnemonicWordList: jest.fn(),
      setUseZeroPadding: jest.fn()
    })
    useWalletsStore.getState.mockReturnValue({
      deleteWallets
    })
  })

  it('restores labels, nostr sync credentials, and custom backends', async () => {
    const labels = {
      'txid:0': {
        label: 'coffee',
        ref: 'txid:0',
        type: 'output' as const
      }
    }
    const nostr = {
      autoSync: true,
      commonNpub: 'npub1common',
      commonNsec: 'nsec1common',
      deviceMnemonic:
        'abandon ability able about above absent absorb abstract absurd abuse access accident',
      deviceNpub: 'npub1device',
      deviceNsec: 'nsec1device',
      dms: [],
      lastUpdated: '2024-01-01T00:00:00.000Z',
      relays: ['wss://relay.example'],
      syncStart: '2024-01-01T00:00:00.000Z',
      trustedMemberDevices: []
    }
    const customServer = {
      name: 'My Electrum',
      network: 'bitcoin' as const,
      url: 'ssl://electrum.example:50002'
    }

    const result = await performRecoverOverwrite(
      JSON.stringify({
        accounts: [
          {
            id: 'acc-1',
            keys: [{ index: 0, name: 'k1', seedWords: 'abandon abandon' }],
            labels,
            name: 'Wallet',
            network: 'bitcoin',
            nostr,
            policyType: 'singlesig'
          }
        ],
        nostrIdentities: {
          activeIdentityNpub: null,
          identities: [],
          relays: ['wss://identity-relay.example']
        },
        serverSettings: {
          configs: {
            bitcoin: {
              config: {},
              server: { network: 'bitcoin', url: 'ssl://default.example:50002' }
            },
            signet: { config: {}, server: { network: 'signet', url: '' } },
            testnet: { config: {}, server: { network: 'testnet', url: '' } }
          },
          configsMempool: {
            bitcoin: 'https://mempool.example',
            signet: '',
            testnet: ''
          },
          customServers: [customServer],
          selectedNetwork: 'bitcoin'
        },
        settings: {
          currencyUnit: 'sats',
          mnemonicWordList: 'english',
          useZeroPadding: false
        },
        version: 1
      })
    )

    expect(result).toStrictEqual({ success: true })
    expect(addAccount).toHaveBeenCalledTimes(1)
    const restored = addAccount.mock.calls[0][0] as {
      labels: typeof labels
      nostr: {
        commonNsec: string
        deviceMnemonic?: string
        deviceNsec?: string
        relays: string[]
      }
    }
    expect(restored.labels).toStrictEqual(labels)
    expect(restored.nostr.commonNsec).toBe('nsec1common')
    expect(restored.nostr.deviceNsec).toBe('nsec1device')
    expect(restored.nostr.deviceMnemonic).toBe(
      'abandon ability able about above absent absorb abstract absurd abuse access accident'
    )
    expect(restored.nostr.relays).toStrictEqual(['wss://relay.example'])
    expect(setSelectedNetwork).toHaveBeenCalledWith('bitcoin')
    expect(addCustomServer).toHaveBeenCalledWith(customServer)
    expect(setRelays).toHaveBeenCalledWith(['wss://identity-relay.example'])
  })

  it('defaults missing labels to an empty record', async () => {
    const result = await performRecoverOverwrite(
      JSON.stringify({
        accounts: [
          {
            id: 'acc-1',
            keys: [{ index: 0, name: 'k1', seedWords: 'abandon abandon' }],
            name: 'Wallet',
            network: 'bitcoin',
            policyType: 'singlesig'
          }
        ],
        settings: {
          currencyUnit: 'sats',
          mnemonicWordList: 'english',
          useZeroPadding: false
        },
        version: 1
      })
    )

    expect(result).toStrictEqual({ success: true })
    const restored = addAccount.mock.calls[0][0] as { labels: object }
    expect(restored.labels).toStrictEqual({})
  })
})
