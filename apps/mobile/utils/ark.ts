import { t } from '@/locales'
import type { Network } from '@/types/settings/blockchain'

export function arkNetworkLabel(network: Network): string {
  if (network === 'bitcoin') {
    return t('ark.network.bitcoin')
  }
  return t('ark.network.signet')
}
