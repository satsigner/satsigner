import {
  buildLightningBackupData,
  LIGHTNING_BACKUP_VERSION
} from '@/utils/lightningBackup'

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

describe('buildLightningBackupData', () => {
  it('puts node data under a lightning section', () => {
    const data = buildLightningBackupData(
      {
        channels: [],
        config: CONFIG,
        isConnected: true,
        lastSync: '2026-08-26T00:00:00.000Z',
        nodeInfo: NODE_INFO
      },
      {
        includeChannels: true,
        includeConnection: true,
        includeNodeInformation: true
      },
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
      {
        channels: [],
        config: CONFIG,
        isConnected: true,
        nodeInfo: NODE_INFO
      },
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
      lastSync: null
    })
  })
})
