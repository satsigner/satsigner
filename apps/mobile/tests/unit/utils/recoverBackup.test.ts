import { performRecoverOverwrite } from '@/utils/recoverBackup'

jest.mock<typeof import('@/utils/crypto')>('@/utils/crypto', () => ({
  aesEncrypt: jest.fn(),
  randomIv: jest.fn()
}))

jest.mock<Partial<typeof import('@/utils/pin')>>('@/utils/pin', () => ({
  getPin: jest.fn()
}))

jest.mock<typeof import('@/utils/nostrSyncService')>(
  '@/utils/nostrSyncService',
  () => ({
    resetInstance: jest.fn()
  })
)

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  deleteArkMnemonic: jest.fn().mockResolvedValue(undefined),
  deleteEcashMnemonic: jest.fn().mockResolvedValue(undefined),
  storeArkMnemonic: jest.fn().mockResolvedValue(undefined),
  storeEcashMnemonic: jest.fn().mockResolvedValue(undefined),
  storeKeySecret: jest.fn().mockResolvedValue(undefined)
}))

jest.mock<typeof import('@/utils/arkBackup')>('@/utils/arkBackup', () => ({
  prepareArkMnemonics: (
    mnemonics: Record<string, string | null> | undefined
  ) => {
    if (!mnemonics) {
      return []
    }
    return Object.entries(mnemonics)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([accountId, mnemonic]) => ({ accountId, mnemonic }))
  },
  restoreArkDatadirsFromBackup: jest.fn().mockResolvedValue(undefined),
  restoreArkLabelsFromBackup: jest.fn(),
  restoreArkStoreFromBackup: jest.fn()
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

const { getPin } = jest.requireMock('@/utils/pin') as {
  getPin: jest.Mock
}

function setPin(pin: string | null) {
  if (pin === null) {
    getPin.mockRejectedValue(new Error('PIN unavailable'))
    return
  }
  getPin.mockResolvedValue(pin)
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
      accounts: [],
      addAccount: jest.fn(),
      clearAllData: clearAllDataArk
    })
    useBlockchainStore.getState.mockReturnValue({
      addCustomServer,
      configs: {
        bitcoin: {
          config: {},
          server: { backend: 'esplora', network: 'bitcoin', url: '' }
        },
        signet: {
          config: {},
          server: { backend: 'electrum', network: 'signet', url: '' }
        },
        testnet: {
          config: {},
          server: { backend: 'esplora', network: 'testnet', url: '' }
        }
      },
      configsMempool: { bitcoin: '', signet: '', testnet: '' },
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
      setChannels: jest.fn(),
      setConfig: jest.fn(),
      setConnected: jest.fn(),
      setNodeInfo: jest.fn()
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
    expect(restored.nostr).toStrictEqual(
      expect.objectContaining({
        commonNsec: 'nsec1common',
        deviceMnemonic:
          'abandon ability able about above absent absorb abstract absurd abuse access accident',
        deviceNsec: 'nsec1device',
        relays: ['wss://relay.example']
      })
    )
    expect(setSelectedNetwork).toHaveBeenCalledWith('bitcoin')
    expect(updateServer).toHaveBeenCalledWith(
      'bitcoin',
      expect.objectContaining({
        url: 'ssl://default.example:50002'
      })
    )
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

  it('restores bitcoin backend data from serverSettings', async () => {
    const bitcoinServer = {
      backend: 'rpc' as const,
      name: 'Core',
      network: 'bitcoin' as const,
      rpcCredentials: { password: 'p', username: 'u' },
      url: 'http://127.0.0.1:8332'
    }
    const bitcoinConfig = {
      connectionMode: 'manual' as const,
      connectionTestInterval: 10,
      retries: 3,
      stopGap: 20,
      timeDiffBeforeAutoSync: 5,
      timeout: 8
    }

    const result = await performRecoverOverwrite(
      JSON.stringify({
        accounts: [],
        serverSettings: {
          configs: {
            bitcoin: { config: bitcoinConfig, server: bitcoinServer },
            signet: {
              config: {},
              server: { backend: 'electrum', network: 'signet', url: '' }
            },
            testnet: {
              config: {},
              server: { backend: 'esplora', network: 'testnet', url: '' }
            }
          },
          configsMempool: {
            bitcoin: 'https://mempool.example',
            signet: '',
            testnet: ''
          },
          customServers: [],
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
    expect(setSelectedNetwork).toHaveBeenCalledWith('bitcoin')
    expect(updateServer).toHaveBeenCalledWith(
      'bitcoin',
      expect.objectContaining(bitcoinServer)
    )
    expect(updateConfig).toHaveBeenCalledWith(
      'bitcoin',
      expect.objectContaining(bitcoinConfig)
    )
    expect(updateConfigMempool).toHaveBeenCalledWith(
      'bitcoin',
      'https://mempool.example'
    )
  })

  it('restores lightning node data from the lightning section', async () => {
    const { useLightningStore } = jest.requireMock('@/store/lightning') as {
      useLightningStore: { getState: jest.Mock }
    }
    const setConfig = jest.fn()
    const setChannels = jest.fn()
    const setConnected = jest.fn()
    const setNodeInfo = jest.fn()
    useLightningStore.getState.mockReturnValue({
      clearConfig: jest.fn(),
      setChannels,
      setConfig,
      setConnected,
      setNodeInfo
    })

    const config = {
      cert: 'cert',
      macaroon: 'mac',
      url: 'https://lnd.example:8080'
    }
    const nodeInfo = {
      alias: 'satsigner',
      best_header_timestamp: '1',
      block_hash: 'h',
      block_height: 1,
      chains: [{ chain: 'bitcoin', network: 'mainnet' }],
      commit_hash: 'abc',
      identity_pubkey: '02ab',
      num_active_channels: 0,
      num_peers: 0,
      synced_to_chain: true,
      uris: [],
      version: '0.18'
    }

    const result = await performRecoverOverwrite(
      JSON.stringify({
        accounts: [],
        lightning: {
          channels: [],
          config,
          isConnected: true,
          nodeInfo
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
    expect(setConfig).toHaveBeenCalledWith(config)
    expect(setNodeInfo).toHaveBeenCalledWith(nodeInfo)
    expect(setChannels).toHaveBeenCalledWith([])
    expect(setConnected).toHaveBeenCalledWith(true)
  })

  it('restores ark mnemonics, labels, store, and datadirs', async () => {
    const { storeArkMnemonic, deleteArkMnemonic } = jest.requireMock(
      '@/storage/encrypted'
    ) as {
      deleteArkMnemonic: jest.Mock
      storeArkMnemonic: jest.Mock
    }
    const {
      restoreArkStoreFromBackup,
      restoreArkLabelsFromBackup,
      restoreArkDatadirsFromBackup
    } = jest.requireMock('@/utils/arkBackup') as {
      restoreArkDatadirsFromBackup: jest.Mock
      restoreArkLabelsFromBackup: jest.Mock
      restoreArkStoreFromBackup: jest.Mock
    }
    const { useArkStore } = jest.requireMock('@/store/ark') as {
      useArkStore: { getState: jest.Mock }
    }
    useArkStore.getState.mockReturnValue({
      accounts: [{ id: 'old-ark' }],
      addAccount: jest.fn(),
      clearAllData: clearAllDataArk
    })

    const arkAccount = {
      bitcoinAccountId: 'acc-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      id: 'ark-1',
      name: 'Ark',
      network: 'signet',
      serverId: 'second'
    }
    const labels = {
      'ark-1': {
        'movement:7': { label: 'coffee', ref: 'movement:7', type: 'tx' }
      }
    }
    const datadirs = {
      'ark-1': { files: [{ base64: 'ZGI=', filename: 'bark.db' }] }
    }

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
        ark: {
          accounts: [arkAccount],
          datadirs,
          labels,
          mnemonics: { 'ark-1': 'ark seed words' }
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
    expect(restoreArkStoreFromBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        accounts: [arkAccount],
        labels,
        mnemonics: { 'ark-1': 'ark seed words' }
      })
    )
    expect(restoreArkLabelsFromBackup).toHaveBeenCalledWith(
      labels,
      ['old-ark'],
      ['ark-1']
    )
    expect(storeArkMnemonic).toHaveBeenCalledWith('ark-1', 'ark seed words')
    expect(deleteArkMnemonic).toHaveBeenCalledWith('old-ark')
    expect(restoreArkDatadirsFromBackup).toHaveBeenCalledWith(
      datadirs,
      ['old-ark'],
      ['ark-1']
    )
  })

  it('restores ark account metadata from old backups without mnemonics or datadirs', async () => {
    const { storeArkMnemonic } = jest.requireMock('@/storage/encrypted') as {
      storeArkMnemonic: jest.Mock
    }
    const {
      restoreArkStoreFromBackup,
      restoreArkLabelsFromBackup,
      restoreArkDatadirsFromBackup
    } = jest.requireMock('@/utils/arkBackup') as {
      restoreArkDatadirsFromBackup: jest.Mock
      restoreArkLabelsFromBackup: jest.Mock
      restoreArkStoreFromBackup: jest.Mock
    }

    const arkAccount = {
      bitcoinAccountId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      id: 'ark-1',
      name: 'Ark',
      network: 'signet',
      serverId: 'second'
    }

    const result = await performRecoverOverwrite(
      JSON.stringify({
        accounts: [],
        ark: { accounts: [arkAccount] },
        settings: {
          currencyUnit: 'sats',
          mnemonicWordList: 'english',
          useZeroPadding: false
        },
        version: 1
      })
    )

    expect(result).toStrictEqual({ success: true })
    expect(restoreArkStoreFromBackup).toHaveBeenCalledWith({
      accounts: [arkAccount]
    })
    expect(restoreArkLabelsFromBackup).toHaveBeenCalledWith(
      undefined,
      [],
      ['ark-1']
    )
    expect(storeArkMnemonic).not.toHaveBeenCalled()
    expect(restoreArkDatadirsFromBackup).toHaveBeenCalledWith(
      undefined,
      [],
      ['ark-1']
    )
  })
})
