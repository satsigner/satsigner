const LAST_ROUTE_STORAGE_KEY = 'last_route'

const AUTHENTICATED_ROUTE_GROUP = '(authenticated)'

const HOME_ROUTE = '/'

const LAST_ROUTE_MAX_PATHNAME_LENGTH = 512
const LAST_ROUTE_MAX_PARAM_COUNT = 32
const LAST_ROUTE_MAX_PARAM_LENGTH = 2048

/**
 * Route templates (groups stripped) never reopened after unlock, together with
 * every route below them. They hold secrets on screen, run multi-step flows
 * whose state lives only in memory, or belong to the lock and PIN flow itself.
 */
const LAST_ROUTE_DENYLIST = [
  '/setPin',
  '/unlock',
  '/warning',
  '/settings/changePin',
  '/settings/duressPin',
  '/settings/developerRecover',
  '/signer/bitcoin/account/add',
  '/signer/bitcoin/account/[id]/signAndSend',
  '/signer/bitcoin/account/[id]/settings/export',
  '/signer/bitcoin/account/[id]/settings/import',
  '/signer/bitcoin/account/[id]/settings/nostr/nostrKey',
  '/signer/bitcoin/account/[id]/address/[addr]/signMessage',
  '/signer/bitcoin/account/[id]/transaction/[txid]/feeReplacement',
  '/signer/ark/account/add',
  '/signer/ark/account/[id]/send',
  '/signer/ark/account/[id]/pay-invoice',
  '/signer/ark/account/[id]/receive-lnurl-withdraw',
  '/signer/ark/account/[id]/swap',
  '/signer/ark/account/[id]/settings/board',
  '/signer/ark/account/[id]/settings/offboard',
  '/signer/ark/account/[id]/settings/onchain',
  '/signer/ecash/account/add',
  '/signer/ecash/send',
  '/signer/ecash/account/[id]/send',
  '/signer/ecash/account/[id]/settings/backup',
  '/signer/ecash/account/[id]/settings/recovery',
  '/signer/ecash/account/[id]/settings/seed',
  '/signer/lightning/LNDRest',
  '/signer/lightning/pay',
  '/signer/lightning/node/backup',
  '/signer/lightning/node/open-channel',
  '/signer/nostr/add',
  '/signer/nostr/create',
  '/signer/nostr/import',
  '/signer/nostr/account/[npub]/keys',
  '/signer/nostr/account/[npub]/send',
  '/signer/nostr/account/[npub]/compose'
] as const

const BITCOIN_ACCOUNT_ROUTE = '/signer/bitcoin/account/[id]'
const ARK_ACCOUNT_ROUTE = '/signer/ark/account/[id]'
const ECASH_ACCOUNT_ROUTE = '/signer/ecash/account/[id]'
const NOSTR_IDENTITY_ROUTE = '/signer/nostr/account/[npub]'

export {
  ARK_ACCOUNT_ROUTE,
  AUTHENTICATED_ROUTE_GROUP,
  BITCOIN_ACCOUNT_ROUTE,
  ECASH_ACCOUNT_ROUTE,
  HOME_ROUTE,
  LAST_ROUTE_DENYLIST,
  LAST_ROUTE_MAX_PARAM_COUNT,
  LAST_ROUTE_MAX_PARAM_LENGTH,
  LAST_ROUTE_MAX_PATHNAME_LENGTH,
  LAST_ROUTE_STORAGE_KEY,
  NOSTR_IDENTITY_ROUTE
}
