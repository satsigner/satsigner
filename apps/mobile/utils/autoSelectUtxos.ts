import { AUTO_SELECT_FROM_URI_SEARCH_PARAM } from '@/constants/autoSelectUtxos'
import { DUST_LIMIT, SATS_PER_BITCOIN } from '@/constants/btc'
import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'
import { parseBitcoinUri } from '@/utils/bip321'

export function isUriPaymentAmount(amountSats: number): boolean {
  return amountSats >= DUST_LIMIT
}

export function isAutoSelectFromUriSearchParam(
  value: string | string[] | undefined
): boolean {
  if (Array.isArray(value)) {
    return value[0] === AUTO_SELECT_FROM_URI_SEARCH_PARAM
  }
  return value === AUTO_SELECT_FROM_URI_SEARCH_PARAM
}

export function bitcoinAmountBtcToSats(amountBtc: number): number {
  return Math.round(amountBtc * SATS_PER_BITCOIN)
}

export function shouldAutoSelectUtxosFromParsedAmount(
  amountBtc: number | undefined
): boolean {
  if (amountBtc === undefined || amountBtc <= 0) {
    return false
  }
  return isUriPaymentAmount(bitcoinAmountBtcToSats(amountBtc))
}

export function getBitcoinUriAmountSats(cleaned: string): number | null {
  let uriToDecode = cleaned.trim()
  if (!uriToDecode.toLowerCase().startsWith('bitcoin:')) {
    uriToDecode = `bitcoin:${uriToDecode}`
  }

  const parsed = parseBitcoinUri(uriToDecode)
  if (!parsed.isValid || !parsed.amount || parsed.amount <= 0) {
    return null
  }

  return bitcoinAmountBtcToSats(parsed.amount)
}

export function shouldAutoSelectUtxosFromBitcoinUri(cleaned: string): boolean {
  const amountSats = getBitcoinUriAmountSats(cleaned)
  return amountSats !== null && isUriPaymentAmount(amountSats)
}

export function shouldApplyDefaultAutoSelectFromUri({
  algorithm,
  decoyAddress,
  outputsLength
}: {
  algorithm: AutoSelectUtxosAlgorithm
  decoyAddress?: string
  outputsLength: number
}): boolean {
  if (outputsLength === 0) {
    return false
  }

  if (algorithm === 'user') {
    return false
  }

  if (algorithm === 'privacy' && !decoyAddress) {
    return false
  }

  return true
}

const AUTO_SELECT_UTXO_TITLE_KEYS = {
  efficiency: 'transaction.build.options.autoSelect.utxos.efficiency.title',
  privacy: 'transaction.build.options.autoSelect.utxos.privacy.title',
  user: 'transaction.build.options.autoSelect.utxos.user.title'
} as const satisfies Record<AutoSelectUtxosAlgorithm, string>

const AUTO_SELECT_UTXO_DESCRIPTION_KEYS = {
  efficiency:
    'transaction.build.options.autoSelect.utxos.efficiency.description',
  privacy: 'transaction.build.options.autoSelect.utxos.privacy.description',
  user: 'transaction.build.options.autoSelect.utxos.user.description'
} as const satisfies Record<AutoSelectUtxosAlgorithm, string>

export function autoSelectUtxosTitleKey(
  algorithm: AutoSelectUtxosAlgorithm
): (typeof AUTO_SELECT_UTXO_TITLE_KEYS)[AutoSelectUtxosAlgorithm] {
  return AUTO_SELECT_UTXO_TITLE_KEYS[algorithm]
}

export function autoSelectUtxosDescriptionKey(
  algorithm: AutoSelectUtxosAlgorithm
): (typeof AUTO_SELECT_UTXO_DESCRIPTION_KEYS)[AutoSelectUtxosAlgorithm] {
  return AUTO_SELECT_UTXO_DESCRIPTION_KEYS[algorithm]
}
