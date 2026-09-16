import * as bitcoinjs from 'bitcoinjs-lib'

import { DUST_LIMIT, SATS_PER_BITCOIN } from '@/constants/btc'
import { t } from '@/locales'
import { hasPayjoinParam, parsePayjoinUri } from '@/utils/payjoinUri'
import { extractTransactionIdFromPSBT } from '@/utils/psbt'

function toBitcoinUri(value: string): string {
  return value.toLowerCase().startsWith('bitcoin:') ? value : `bitcoin:${value}`
}

function addressFromBitcoinUri(value: string): string {
  const withoutScheme = value.replace(/^bitcoin:/i, '')
  const qIndex = withoutScheme.indexOf('?')
  const address = qIndex === -1 ? withoutScheme : withoutScheme.slice(0, qIndex)
  return address.trim()
}

function fallbackBoardAmountSats(preferredAmountSats?: number): number {
  if (
    typeof preferredAmountSats === 'number' &&
    preferredAmountSats >= DUST_LIMIT
  ) {
    return preferredAmountSats
  }
  return DUST_LIMIT
}

/**
 * Turns a board deposit address or a live Payjoin URI into the transaction
 * builder fields used by "Send from {linked wallet}".
 * Prefers an invoice amount, then a caller amount (e.g. min board), then dust
 * — never 1 sat, which skips fee-aware coin selection and lands underfunded.
 */
function resolveArkBoardFundDestination(
  destination: string,
  preferredAmountSats?: number
): {
  address: string
  amountSats: number
  payjoinUri?: string
} {
  const fallbackAmountSats = fallbackBoardAmountSats(preferredAmountSats)
  const uri = toBitcoinUri(destination)
  const parsed = parsePayjoinUri(uri)
  if (parsed.isValid && parsed.params?.address) {
    const { amountBtc } = parsed.params
    const invoiceAmountSats =
      amountBtc && amountBtc > 0
        ? Math.round(amountBtc * SATS_PER_BITCOIN)
        : undefined
    return {
      address: parsed.params.address,
      amountSats:
        invoiceAmountSats && invoiceAmountSats >= DUST_LIMIT
          ? invoiceAmountSats
          : fallbackAmountSats,
      payjoinUri: hasPayjoinParam(uri) ? uri : undefined
    }
  }

  const address = addressFromBitcoinUri(destination)
  return {
    address: address || destination,
    amountSats: fallbackAmountSats
  }
}

function txidFromSignedDraft(
  signedPsbtBase64: string | undefined,
  signedTxHex: string | undefined
): string | undefined {
  if (signedPsbtBase64) {
    const fromPsbt = extractTransactionIdFromPSBT(signedPsbtBase64)
    if (fromPsbt) {
      return fromPsbt
    }
  }
  if (!signedTxHex) {
    return undefined
  }
  try {
    return bitcoinjs.Transaction.fromHex(signedTxHex).getId()
  } catch {
    return undefined
  }
}

function matchingUnbroadcastBoardTxid(params: {
  pendingTxids: string[]
  linkedAccountId: string | undefined
  activeAccountId: string | undefined
  activeBroadcasted: boolean
  activeTxid: string | undefined
  savedDraftTxid: string | undefined
}): string | undefined {
  const { linkedAccountId, pendingTxids } = params
  if (!linkedAccountId || pendingTxids.length === 0) {
    return undefined
  }
  const pending = new Set(pendingTxids)
  if (
    params.activeAccountId === linkedAccountId &&
    !params.activeBroadcasted &&
    params.activeTxid &&
    pending.has(params.activeTxid)
  ) {
    return params.activeTxid
  }
  if (
    params.activeAccountId !== linkedAccountId &&
    params.savedDraftTxid &&
    pending.has(params.savedDraftTxid)
  ) {
    return params.savedDraftTxid
  }
  return undefined
}

function isArkBoardPayjoinSend(
  outputs: { label: string }[],
  payjoinUri: string | undefined
): boolean {
  if (!payjoinUri) {
    return false
  }
  const payjoinLabel = t('ark.board.payjoinFundLabel')
  return outputs.some((output) => output.label === payjoinLabel)
}

export {
  isArkBoardPayjoinSend,
  matchingUnbroadcastBoardTxid,
  resolveArkBoardFundDestination,
  txidFromSignedDraft
}
