import { useLightningStore } from '@/store/lightning'
import type {
  LNDChannel,
  LNDConfig,
  LNDNodeInfo
} from '@/types/models/Lightning'

export const LIGHTNING_BACKUP_VERSION = '1.0'

export type LightningBackupInput = {
  channels?: LNDChannel[]
  config: LNDConfig | null
  isConnected: boolean
  lastSync?: string
  nodeInfo?: LNDNodeInfo
}

export type LightningBackupOptions = {
  includeChannels: boolean
  includeConnection: boolean
  includeNodeInformation: boolean
}

export type LightningBackupPayload = {
  lightning: {
    channels?: LNDChannel[]
    config?: LNDConfig | null
    isConnected?: boolean
    lastSync?: string | null
    nodeInfo?: LNDNodeInfo | null
  }
  timestamp: string
  version: string
}

export type LightningRestoreInput = {
  lightning?: {
    channels?: LNDChannel[]
    config?: LNDConfig | null
    isConnected?: boolean
    nodeInfo?: LNDNodeInfo | null
  }
  lnd?: LNDConfig | null
}

type LightningStoreSlice = {
  clearConfig: () => void
  setChannels: (channels: LNDChannel[]) => void
  setConfig: (config: LNDConfig) => void
  setConnected: (isConnected: boolean) => void
  setNodeInfo: (info: LNDNodeInfo) => void
}

export function buildLightningBackupData(
  input: LightningBackupInput,
  options: LightningBackupOptions,
  timestamp: string
): LightningBackupPayload {
  const lightning: LightningBackupPayload['lightning'] = {}

  if (options.includeConnection) {
    lightning.config = input.config
    lightning.isConnected = input.isConnected
    lightning.lastSync = input.lastSync ?? null
  }

  if (options.includeNodeInformation) {
    lightning.nodeInfo = input.nodeInfo ?? null
  }

  if (options.includeChannels) {
    lightning.channels = input.channels ?? []
  }

  return {
    lightning,
    timestamp,
    version: LIGHTNING_BACKUP_VERSION
  }
}

export function serializeLightningBackup(
  input: LightningBackupInput,
  options: LightningBackupOptions,
  timestamp: string
): string {
  return JSON.stringify(
    buildLightningBackupData(input, options, timestamp),
    null,
    2
  )
}

export function restoreLightningFromBackup(
  data: LightningRestoreInput,
  store: LightningStoreSlice = useLightningStore.getState()
): void {
  const config = data.lightning?.config ?? data.lnd
  if (config) {
    store.setConfig(config)
    if (data.lightning?.nodeInfo) {
      store.setNodeInfo(data.lightning.nodeInfo)
    }
    if (data.lightning?.channels) {
      store.setChannels(data.lightning.channels)
    }
    if (typeof data.lightning?.isConnected === 'boolean') {
      store.setConnected(data.lightning.isConnected)
    }
    return
  }
  if (
    ('lightning' in data && data.lightning?.config === null) ||
    ('lnd' in data && data.lnd === null)
  ) {
    store.clearConfig()
  }
}
