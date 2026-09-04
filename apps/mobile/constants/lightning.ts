// The LN payment maximum value depends which channels are connected.
//
// Payment Size      Expectation
// <100K sats        Almost always works
// 100K – 1M sats    Usually works, minor routing failures
// 1M – 5M sats      Needs good path, may require splits (MPP)
// 5M – 20M sats     Direct/wumbo channels or custodials only
// >20M sats         Very limited paths, likely need on-chain or exchange
//
// We are (temporarily) hardcoding the value.
// TODO: make it possible for users to configure the channel threshold.
export const LIGHTNING_CHANNEL_THRESHOLD = 1_000_000

/** Default LND `--minchansize` (sats) for new channel funding. */
export const LND_OPEN_CHANNEL_MIN_FUNDING_SAT = 20_000
export const LND_OPEN_CHANNEL_DEFAULT_MIN_CONFS = 1
export const LND_OPEN_CHANNEL_MAX_MIN_CONFS = 1_000
export const LND_OPEN_CHANNEL_MAX_SAT_PER_VBYTE = 10_000
/** LND `AddressType` unused p2wpkh — reuse until funded. */
export const LND_NEW_ADDRESS_TYPE_UNUSED_WITNESS_PUBKEY_HASH = 2
/** LND `AddressType` p2wpkh — always allocates a new address. */
export const LND_NEW_ADDRESS_TYPE_WITNESS_PUBKEY_HASH = 0
export const LND_NODE_PUBKEY_HEX_LENGTH = 66
/** Short pubkey shown as a card title when the node has no alias. */
export const LND_NODE_CARD_PUBKEY_HEAD_CHARS = 4
export const LND_NODE_CARD_PUBKEY_TAIL_CHARS = 4

export const LND_FORWARDING_MAX_EVENTS = 200
export const LND_FORWARDING_INDEX_OFFSET = 0
/** Default LND REST listen port in lndconnect URIs when none is given. */
export const LNDCONNECT_DEFAULT_REST_PORT = '8080'
/** Default LND gRPC listen port; pairing JSON is rewritten to REST (8080). */
export const LND_GRPC_LISTEN_PORT = '10009'
/** TLS + HTTP timeout for LND REST (self-signed pairing cert). */
export const LND_REST_TIMEOUT_MS = 30_000
export const LND_INVOICE_POLL_MS = 3_000
export const LND_PAYMENT_POLL_ATTEMPTS = 30
export const LND_PAYMENT_POLL_MS = 1_000
export const LND_SUCCESS_NAVIGATE_DELAY_MS = 2_000
export const LND_SETTINGS_PEERS_MAX = 32
export const LND_REST = {
  BALANCE_BLOCKCHAIN: '/v1/balance/blockchain',
  BALANCE_CHANNELS: '/v1/balance/channels',
  /** ListChannels: peer_alias is omitted unless this flag is set (LND default). */
  CHANNELS: '/v1/channels?peer_alias_lookup=true',
  /** OpenChannelSync — POST JSON body (see `lndOpenChannel`). */
  CHANNELS_OPEN: '/v1/channels',
  CHANNELS_PENDING: '/v1/channels/pending',
  /** ExportAllChannelBackups — JSON snapshot; store securely. */
  CHANNEL_BACKUP_ALL: '/v1/channels/backup',
  INVOICES: '/v1/invoices?num_max_invoices=250&reversed=true',
  /** NewAddress — unused p2wpkh. */
  NEW_ADDRESS: `/v1/newaddress?type=${LND_NEW_ADDRESS_TYPE_UNUSED_WITNESS_PUBKEY_HASH}`,
  PAYMENTS: '/v1/payments?include_incomplete=true&num_max_payments=250',
  PEERS: '/v1/peers',
  /** SendCoins — POST JSON body. List uses `TRANSACTIONS` with query params. */
  SEND_COINS: '/v1/transactions',
  /** ForwardingHistory — POST JSON body (see `lndChannelHistory`). */
  SWITCH_FORWARDING: '/v1/switch',
  TRANSACTIONS:
    '/v1/transactions?start_height=0&end_height=-1&num_max_transactions=250'
} as const

/** Layout / drawing constants for the Lightning channels bubble chart (no magic numbers in layout util). */
/**
 * Matches `Layout.mainContainer.paddingHorizontal` (each side). Used to estimate
 * inner content width: `screenWidth * (1 - 2 * frac)` under one `SSMainLayout`.
 */
export const LIGHTNING_BUBBLE_CHART_BLEED_MARGIN_FRAC = 0.06
export const LIGHTNING_BUBBLE_CHART_LAYOUT_MAX_SIZE_PX = 520
export const LIGHTNING_BUBBLE_CHART_LAYOUT_MIN_SIZE_PX = 280
export const LIGHTNING_BUBBLE_CHART_BUBBLE_FILL = '#4F4F4F'
export const LIGHTNING_BUBBLE_CHART_LOCAL_BUBBLE_FILL = '#949494'
export const LIGHTNING_BUBBLE_CHART_HUB_FILL = '#FFFFFF'
export const LIGHTNING_BUBBLE_CHART_PADDING_PX = 16
export const LIGHTNING_BUBBLE_CHART_SPOKE_GAP_PX = 10
export const LIGHTNING_BUBBLE_CHART_SPOKE_STROKE = '#A0A0A0'
export const LIGHTNING_BUBBLE_CHART_SPOKE_STROKE_WIDTH = 1
export const LIGHTNING_BUBBLE_CHART_HIT_PAD_PX = 12
export const LIGHTNING_BUBBLE_CHART_LABEL_OFFSET_PERP_PX = 12
export const LIGHTNING_BUBBLE_CHART_LABEL_OUTWARD_PAST_REMOTE_PX = 44
export const LIGHTNING_BUBBLE_CHART_LABEL_MAX_WIDTH_PX = 120
export const LIGHTNING_BUBBLE_CHART_HUB_RADIUS_FRAC_OF_MIN_HALF = 0.2
export const LIGHTNING_BUBBLE_CHART_HUB_RADIUS_MIN_PX = 52
export const LIGHTNING_BUBBLE_CHART_HUB_RADIUS_MAX_PX = 88
export const LIGHTNING_BUBBLE_CHART_MIN_LOCAL_BUBBLE_PX = 4
export const LIGHTNING_BUBBLE_CHART_MAX_LOCAL_BUBBLE_PX = 36
export const LIGHTNING_BUBBLE_CHART_MIN_REMOTE_BUBBLE_PX = 3
export const LIGHTNING_BUBBLE_CHART_MAX_REMOTE_BUBBLE_PX = 30
export const LIGHTNING_BUBBLE_CHART_FIT_MARGIN_FRAC = 0.92
export const LIGHTNING_BUBBLE_CHART_MIN_AVAILABLE_RADIUS_PX = 40
export const LIGHTNING_BUBBLE_CHART_AMOUNT_ON_BUBBLE_FONT_PX = 9
export const LIGHTNING_BUBBLE_CHART_PEER_LABEL_FONT_PX = 10 /** LND REST paths and query strings used by the node dashboard. */
