import { ARK_SERVERS } from '@/constants/ark'
import { t } from '@/locales'
import { ArkServer } from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'

export function arkNetworkLabel(network: Network): string {
  if (network === 'bitcoin') {
    return t('ark.network.bitcoin')
  }
  return t('ark.network.signet')
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
