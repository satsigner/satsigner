import * as bitcoinjs from 'bitcoinjs-lib'
import { type Href } from 'expo-router'

import { AUTO_SELECT_FROM_URI_SEARCH_PARAM } from '@/constants/autoSelectUtxos'
import { t } from '@/locales'
import { extractTransactionIdFromPSBT } from '@/utils/psbt'

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

function arkBoardIoPreviewHref(accountId: string): Href {
  return `/signer/bitcoin/account/${accountId}/signAndSend/ioPreview?autoSelectFromUri=${AUTO_SELECT_FROM_URI_SEARCH_PARAM}`
}

export {
  arkBoardIoPreviewHref,
  isArkBoardPayjoinSend,
  matchingUnbroadcastBoardTxid,
  txidFromSignedDraft
}
