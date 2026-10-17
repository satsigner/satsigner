import type { Backend } from '@/types/settings/blockchain'

export const CONNECTION_TEST_TIMEOUT_MS = 10_000
export const CONNECTION_TEST_COOLDOWN_MS = 2000
export const ELECTRUM_HANDSHAKE_CLIENT_INFO = {
  client: 'satsigner',
  version: '1.4'
}
export const RPC_MEDIAN_FEE_TARGET_BLOCKS = 6
export const BTC_PER_KVB_TO_SAT_PER_VB = 1e5

export const SOFTWARE_LABELS: Record<Backend, string> = {
  electrum: 'Electrum',
  esplora: 'Esplora',
  rpc: 'Bitcoin Core'
}
