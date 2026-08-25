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

export function buildLightningBackupData(
  input: LightningBackupInput,
  options: LightningBackupOptions,
  timestamp: string
): Record<string, unknown> {
  const lightning: Record<string, unknown> = {}

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
