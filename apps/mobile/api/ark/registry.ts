import type { ArkServerId } from '@/types/models/Ark'

import type { ArkWalletProvider } from './provider'

const providers = new Map<ArkServerId, ArkWalletProvider>()

export function registerArkProvider(provider: ArkWalletProvider): void {
  providers.set(provider.serverId, provider)
}

export function getArkProvider(serverId: ArkServerId): ArkWalletProvider {
  const provider = providers.get(serverId)
  if (!provider) {
    throw new Error(`No Ark provider registered for '${serverId}'`)
  }
  return provider
}
