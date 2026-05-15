import type { ArkSendKind, ArkServer } from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'

export function getArkServer(
  network: Network,
  id: ArkServer['id']
): ArkServer | undefined {
  return ARK_SERVERS[network].find((server) => server.id === id)
}

export function getDefaultArkServer(network: Network): ArkServer | undefined {
  return ARK_SERVERS[network][0]
}

export const ARK_CONFIRM_COUNTERPARTY_TRUNCATE_CHARS = 14
export const ARK_COUNTERPARTY_TRUNCATE_CHARS = 8
export const ARK_INVALIDATED_QUERY_KINDS = [
  'wallet',
  'balance',
  'address'
] as const
export const ARK_KIND_LABEL_KEYS: Record<ArkSendKind, string> = {
  arkoor: 'ark.send.kind.arkoor',
  bolt11: 'ark.send.kind.bolt11',
  lnaddress: 'ark.send.kind.lnaddress',
  lnurl: 'ark.send.kind.lnurl',
  onchain: 'ark.send.kind.onchain'
}
export const ARK_LIGHTNING_SUBSYSTEM_KINDS = new Set([
  'invoice',
  'offer',
  'lightning_address'
])
export const ARK_LNURL_DETAILS_STALE_MS = 60000
export const ARK_MUTED_STATUSES = new Set(['failed', 'canceled'])
export const ARK_REFRESH_SUBSYSTEM_KEYWORD = 'refresh'
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
export const ARK_SUPPORTED_NETWORKS: Network[] = ['bitcoin', 'signet']
export const ARK_STALE_EXIT_SUBSYSTEM_KIND = 'start'
export const ARK_STALE_EXIT_SUBSYSTEM_NAME = 'bark.exit'
export const BARK_ACCESS_TOKEN_NETWORK: Network = 'bitcoin'
export const BARK_ACCESS_TOKEN_PARAM = 'bark_access_token'
