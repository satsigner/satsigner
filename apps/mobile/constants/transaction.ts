import { DUST_LIMIT } from '@/constants/btc'

export const MIN_RAW_TRANSACTION_HEX_LENGTH = 20
export const TRANSACTION_ID_PLACEHOLDER = '—'
export const BDK_DUST_ERROR_MARKER = 'dust'
export const BDK_UTXO_NOT_FOUND_ERROR_MARKER = 'UTXO not found'
export const BDK_FEE_BUMP_TARGET_NOT_FOUND_ERROR_MARKER =
  'FeeBumpTargetNotFound'
export const UNDECODABLE_OUTPUT_ADDRESS_PREFIX = 'Unknown Address'
export const SELF_SEND_TAG = 'selfsend'
export const CONSOLIDATION_TAG = 'consolidation'
export const PAYJOIN_TAG = 'payjoin'
export const DUST_TAG = 'dust'
export const RBF_TAG = 'rbf'
export const AUTOMATIC_TAGS: readonly string[] = [
  SELF_SEND_TAG,
  CONSOLIDATION_TAG,
  PAYJOIN_TAG,
  DUST_TAG,
  RBF_TAG
]
export const CONSOLIDATION_MIN_INPUTS = 3
// Unsolicited receives this small are almost always dust attacks.
export const DUST_ATTACK_MAX_SATS = DUST_LIMIT * 2
