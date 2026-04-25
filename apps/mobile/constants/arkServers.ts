import type { ArkServer } from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'

export const ARK_SUPPORTED_NETWORKS: Network[] = ['bitcoin', 'signet']

export const ARK_SERVERS: Record<Network, ArkServer[]> = {
  bitcoin: [
    {
      arkUrl: 'https://ark.second.tech',
      esploraUrl: 'https://mempool.second.tech/api',
      id: 'second',
      name: 'Second',
      network: 'bitcoin'
    }
  ],
  signet: [
    {
      arkUrl: 'https://ark.signet.2nd.dev',
      esploraUrl: 'https://esplora.signet.2nd.dev',
      id: 'second',
      name: 'Second',
      network: 'signet'
    }
  ],
  testnet: []
}

export function getArkServer(
  network: Network,
  id: ArkServer['id']
): ArkServer | undefined {
  return ARK_SERVERS[network].find((server) => server.id === id)
}

export function getDefaultArkServer(network: Network): ArkServer | undefined {
  return ARK_SERVERS[network][0]
}
