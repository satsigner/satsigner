import type { ArkSendKind, ArkServer } from '@/types/models/Ark'
import type { ScriptVersionType } from '@/types/models/Script'
import type { Network } from '@/types/settings/blockchain'
import type { AddressScriptType } from '@/utils/bitcoin'

export const ARK_ADDRESS_MAX_SCAN = 1000
/** Thrown when JS calls boardFundingAddress/boardPsbt on a Bark build that lacks them. */
export const ARK_BOARD_PAYJOIN_NATIVE_MISSING =
  'Bark native module is missing boardFundingAddress. Rebuild with @secondts/bark-react-native 0.21 or newer.'
export const ARK_ADDRESS_SCAN_BATCH_SIZE = 20
/** Thrown by an open that finished after its wallet was released. */
export const ARK_WALLET_RELEASED_WHILE_OPENING =
  'Ark wallet was released while it was opening'
/** Thrown by an open asked for while the app is locked. */
export const ARK_WALLET_LOCKED =
  'Ark wallets stay closed while the app is locked'
export const ARK_WALLET_QUERY_KEY = ['ark', 'wallet']
export const ARK_CONFIRM_COUNTERPARTY_TRUNCATE_CHARS = 14
// Bounds a lock or wipe waiting on a daemon busy in a round, or on an open it
// cancelled.
export const ARK_DAEMON_STOP_TIMEOUT_MS = 5000
// A claim paying more than this multiple of the chosen fee rate over its
// signed size is refused before broadcast.
export const ARK_EXIT_CLAIM_MAX_FEE_RATE_MULTIPLIER = 1.25
// Live exits are re-read this often while one is visible; the wallet daemon
// does the actual work of moving them forward.
export const ARK_EXIT_POLL_INTERVAL_MS = 30_000
// Accounts with a live exit are checked this often for exits that became
// claimable, so the user hears about them anywhere in the app.
export const ARK_EXIT_WATCH_INTERVAL_MS = 120_000
export const ARK_EXIT_WATCH_QUERY_KEY = ['ark', 'exitWatcher']
export const ARK_KIND_LABEL_KEYS: Record<ArkSendKind, string> = {
  arkoor: 'ark.send.kind.arkoor',
  bolt11: 'ark.send.kind.bolt11',
  lnaddress: 'ark.send.kind.lnaddress',
  lnurl: 'ark.send.kind.lnurl',
  onchain: 'ark.send.kind.onchain'
}
export const ARK_LNURL_DETAILS_STALE_MS = 60_000
export const ARK_LIGHTNING_RECEIVE_SETTLED_STATE = 'settled'
export const ARK_LIGHTNING_RECEIVE_AWAITING_STATE = 'awaiting-payment'
export const ARK_VTXO_STATE = {
  exited: 'Exited',
  spendable: 'Spendable',
  spent: 'Spent'
} as const
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
// Sweep size bounds for the hidden on-chain wallet: P2WPKH inputs (the larger
// of the native-segwit spends) and a P2TR output, so the estimate never comes
// in under the real fee. The overshoot is smaller than the cost of a change
// output, so BDK folds it into the fee instead of leaving change behind.
export const ARK_ONCHAIN_SWEEP_OVERHEAD_VBYTES = 11
export const ARK_ONCHAIN_SWEEP_INPUT_VBYTES = 68
export const ARK_ONCHAIN_SWEEP_OUTPUT_VBYTES = 43
export const ARK_SWAP_POLL_INTERVAL_MS = 15_000
// A job that keeps throwing is retried with a doubling delay, capped so a
// recovered server is picked up again within minutes.
export const ARK_SWAP_RETRY_BASE_DELAY_MS = ARK_SWAP_POLL_INTERVAL_MS
export const ARK_SWAP_RETRY_MAX_DELAY_MS = 600_000
export const ARK_SWAP_RUNNER_QUERY_KEY = ['ark', 'swapRunner']
export const ARK_SWAP_BLOCK_INTERVAL_SECONDS = 600
// Rounds to settle a board amount that also covers its own amount-based fee.
export const ARK_SWAP_BOARD_FEE_MAX_ROUNDS = 4
// Blocks rarely arrive on schedule, so an up-front invoice is only held for a
// board when it would outlive twice the expected confirmation wait.
export const ARK_SWAP_BOARD_WAIT_SAFETY_FACTOR = 2
// An invoice with less time left than this is not paid: the payment could
// still be routing when it expires.
export const ARK_SWAP_INVOICE_MIN_REMAINING_SECONDS = 300
// A send that threw may still be running server side; its movement is only
// looked for once this long has passed, before the job is called failed.
export const ARK_SWAP_SEND_RECONCILE_GRACE_MS = 120_000
// An HTLC accepted just before the invoice expired can still settle after
// it, so an unpaid receive is only given up this long past expiry.
export const ARK_SWAP_UNPAID_INVOICE_GRACE_SECONDS = 600
// A board whose funding transaction never confirms leaves its swap in
// `boarding`; after this long the user may dismiss it.
export const ARK_SWAP_STALE_BOARDING_MS = 24 * 60 * 60 * 1000
export const ARK_SWAP_DISMISS_CHECK_INTERVAL_MS = 60_000
// With about a day of blocks left a VTXO should be refreshed, or the Ark
// server may sweep it once it expires.
export const ARK_VTXO_EXPIRY_WARNING_BLOCKS = 144
// Exit paths longer than this collapse to their first and last levels.
export const ARK_VTXO_LINEAGE_EDGE_STEPS = 2
