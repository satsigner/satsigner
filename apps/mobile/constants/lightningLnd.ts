/** LND REST paths and query strings used by the node dashboard. */
export const LND_REST = {
  BALANCE_BLOCKCHAIN: '/v1/balance/blockchain',
  BALANCE_CHANNELS: '/v1/balance/channels',
  /** ExportAllChannelBackups — JSON snapshot; store securely. */
  CHANNEL_BACKUP_ALL: '/v1/channels/backup',
  /** ListChannels: peer_alias is omitted unless this flag is set (LND default). */
  CHANNELS: '/v1/channels?peer_alias_lookup=true',
  CHANNELS_PENDING: '/v1/channels/pending',
  INVOICES: '/v1/invoices?num_max_invoices=250&reversed=true',
  PAYMENTS: '/v1/payments?include_incomplete=true&num_max_payments=250',
  PEERS: '/v1/peers',
  /** ForwardingHistory — POST JSON body (see `lndChannelHistory`). */
  SWITCH_FORWARDING: '/v1/switch',
  TRANSACTIONS:
    '/v1/transactions?start_height=0&end_height=-1&num_max_transactions=250'
} as const
