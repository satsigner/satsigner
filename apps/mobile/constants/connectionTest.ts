import type { Backend } from '@/types/settings/blockchain'

export const CONNECTION_TEST_TIMEOUT_MS = 10_000
// Minimum gap between two connection tests started by the user.
export const CONNECTION_TEST_COOLDOWN_MS = 2000
// Client name and protocol version sent in the Electrum handshake.
export const ELECTRUM_CLIENT_INFO = { client: 'satsigner', version: '1.4' }
// Fee target (blocks) for the median fee shown after an RPC test.
export const RPC_FEE_TARGET_BLOCKS = 6
// estimatesmartfee answers in BTC/kvB; this converts it to sat/vB.
export const BTC_PER_KVB_TO_SAT_PER_VB = 1e5

export const SOFTWARE_LABELS: Record<Backend, string> = {
  electrum: 'Electrum',
  esplora: 'Esplora',
  rpc: 'Bitcoin Core'
}
