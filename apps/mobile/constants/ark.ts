import type { ArkSendKind, ArkServer } from '@/types/models/Ark'
import type { ScriptVersionType } from '@/types/models/Script'
import type { Network } from '@/types/settings/blockchain'
import type { AddressScriptType } from '@/utils/bitcoin'

export const ARK_ADDRESS_MAX_SCAN = 1000
/** Thrown when JS calls boardFundingAddress/boardPsbt on a Bark build that lacks them. */
export const ARK_BOARD_PAYJOIN_NATIVE_MISSING =
  'Bark native module is missing boardFundingAddress. Rebuild with @secondts/bark-react-native 0.21 or newer.'
export const ARK_ADDRESS_SCAN_BATCH_SIZE = 20
export const ARK_CONFIRM_COUNTERPARTY_TRUNCATE_CHARS = 14
export const ARK_EXIT_TX_VBYTES_PER_LEVEL = 200
export const ARK_EXIT_CPFP_CHILD_VBYTES_PER_LEVEL = 175
export const ARK_EXIT_CLAIM_BASE_VBYTES = 50
export const ARK_EXIT_CLAIM_VBYTES_PER_VTXO = 70
export const ARK_EXIT_FEE_RATE_SAFETY_MULTIPLIER = 1.25
export const ARK_KIND_LABEL_KEYS: Record<ArkSendKind, string> = {
  arkoor: 'ark.send.kind.arkoor',
  bolt11: 'ark.send.kind.bolt11',
  lnaddress: 'ark.send.kind.lnaddress',
  lnurl: 'ark.send.kind.lnurl',
  onchain: 'ark.send.kind.onchain'
}
export const ARK_LNURL_DETAILS_STALE_MS = 60_000
export const ARK_LIGHTNING_RECEIVE_SETTLED_STATE = 'settled'
// bark's MAX_NB_BOARD_FUNDING_INPUTS: the server refuses to cosign a board
// funded by more inputs than this.
export const ARK_BOARD_MAX_FUNDING_INPUTS = 100
export const ARK_BOARDING_WALLET_SOURCE_ID = 'ark-boarding-wallet'
// Script versions whose inputs carry an empty scriptSig. Any other input gains
// a scriptSig when finalized, changing the txid the board VTXO commits to.
export const ARK_BOARD_NATIVE_SEGWIT_SCRIPT_VERSIONS: readonly ScriptVersionType[] =
  ['P2WPKH', 'P2WSH', 'P2TR']
// A board funding output is sweepable by the server alone once its expiry
// height passes, so a drafted board must still have at least this share of
// the VTXO lifetime left when it is cosigned and broadcast.
export const ARK_BOARD_INTENT_MIN_LIFETIME_RATIO = 0.5
export const ARK_BOARD_NATIVE_SEGWIT_OUTPUT_TYPES: readonly AddressScriptType[] =
  ['p2wpkh', 'p2wsh', 'p2tr']
// `false` disables waiting for lightning-send confirmation before returning.
export const ARK_LIGHTNING_SEND_WAIT = false
// `undefined` leaves how long the Ark server keeps retrying a lightning
// payment to the server (bark's `retry_for_secs: None`).
export const ARK_LIGHTNING_RETRY_FOR_SECS = undefined
export const ARK_NO_HTLC_VTXOS_LOCKED = 0
export const ARK_PENDING_RACE_TIMEOUT_MS = 30_000
export const ARK_PENDING_TXID = 'pending'
export const ARK_QUERY_STALE_TIME_MS = 30_000
// 0 for now; later allow users to change this in Ark settings.
export const ARK_ROUND_TX_REQUIRED_CONFIRMATIONS = 0
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
export const ARK_ONCHAIN_MIN_FEE_RATE_SAT_PER_VB = 1
// BDK reports fee rates per kilo weight unit; one vbyte is four weight units.
export const ARK_SAT_PER_KWU_PER_SAT_PER_VB = 250
