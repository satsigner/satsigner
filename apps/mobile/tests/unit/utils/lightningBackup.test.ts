import {
  buildLightningBackupData,
  LIGHTNING_BACKUP_VERSION,
  restoreLightningFromBackup,
  serializeLightningBackup
} from '@/utils/lightningBackup'

jest.mock<typeof import('@/store/lightning')>('@/store/lightning', () => ({
  useLightningStore: { getState: jest.fn() }
}))

const CONFIG = {
  cert: 'cert',
  macaroon: 'mac',
  url: 'https://lnd.example:8080'
}

const NODE_INFO = {
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

const INPUT = {
  channels: [],
  config: CONFIG,
  isConnected: true,
  lastSync: '2026-08-26T00:00:00.000Z',
  nodeInfo: NODE_INFO
}

const OPTIONS = {
  includeChannels: true,
  includeConnection: true,
  includeNodeInformation: true
}

describe('buildLightningBackupData', () => {
  it('puts node data under a lightning section', () => {
    const data = buildLightningBackupData(
      INPUT,
      OPTIONS,
      '2026-08-26T00:00:00.000Z'
    )

    expect(data.version).toBe(LIGHTNING_BACKUP_VERSION)
    expect(data.lightning).toStrictEqual({
      channels: [],
      config: CONFIG,
      isConnected: true,
      lastSync: '2026-08-26T00:00:00.000Z',
      nodeInfo: NODE_INFO
    })
  })

  it('omits unchecked fields', () => {
    const data = buildLightningBackupData(
      INPUT,
      {
        includeChannels: false,
        includeConnection: true,
        includeNodeInformation: false
      },
      '2026-08-26T00:00:00.000Z'
    )

    expect(data.lightning).toStrictEqual({
      config: CONFIG,
      isConnected: true,
      lastSync: '2026-08-26T00:00:00.000Z'
    })
  })
})

describe('serializeLightningBackup', () => {
  it('returns pretty-printed json', () => {
    const json = serializeLightningBackup(
      INPUT,
      OPTIONS,
      '2026-08-26T00:00:00.000Z'
    )

    expect(JSON.parse(json)).toStrictEqual(
      buildLightningBackupData(INPUT, OPTIONS, '2026-08-26T00:00:00.000Z')
    )
  })
})

describe('restoreLightningFromBackup', () => {
  it('restores config, node info, channels, and connection state', () => {
    const setConfig = jest.fn()
    const setNodeInfo = jest.fn()
    const setChannels = jest.fn()
    const setConnected = jest.fn()
    const clearConfig = jest.fn()

    restoreLightningFromBackup(
      {
        lightning: {
          channels: [],
          config: CONFIG,
          isConnected: true,
          nodeInfo: NODE_INFO
        }
      },
      { clearConfig, setChannels, setConfig, setConnected, setNodeInfo }
    )

    expect(setConfig).toHaveBeenCalledWith(CONFIG)
    expect(setNodeInfo).toHaveBeenCalledWith(NODE_INFO)
    expect(setChannels).toHaveBeenCalledWith([])
    expect(setConnected).toHaveBeenCalledWith(true)
    expect(clearConfig).not.toHaveBeenCalled()
  })

  it('falls back to the legacy lnd field', () => {
    const setConfig = jest.fn()
    const clearConfig = jest.fn()

    restoreLightningFromBackup(
      { lnd: CONFIG },
      {
        clearConfig,
        setChannels: jest.fn(),
        setConfig,
        setConnected: jest.fn(),
        setNodeInfo: jest.fn()
      }
    )

    expect(setConfig).toHaveBeenCalledWith(CONFIG)
    expect(clearConfig).not.toHaveBeenCalled()
  })

  it('clears config when lightning config is explicitly null', () => {
    const clearConfig = jest.fn()

    restoreLightningFromBackup(
      { lightning: { config: null } },
      {
        clearConfig,
        setChannels: jest.fn(),
        setConfig: jest.fn(),
        setConnected: jest.fn(),
        setNodeInfo: jest.fn()
      }
    )

    expect(clearConfig).toHaveBeenCalledTimes(1)
  })
})
