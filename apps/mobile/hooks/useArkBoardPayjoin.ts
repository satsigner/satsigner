import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner-native'

import { isNativeAvailable } from '@/api/payjoinNative'
import { ARK_BOARD_PAYJOIN_NATIVE_MISSING } from '@/constants/ark'
import { PAYJOIN_BOARD_SESSION_TTL_MS } from '@/constants/payjoin'
import {
  invalidateArkBoardQueries,
  useArkBoardFundingInfo
} from '@/hooks/useArkBoard'
import { usePayjoinReceiver } from '@/hooks/usePayjoinReceiver'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { type ArkAccount } from '@/types/models/Ark'
import { isPayjoinSuccess } from '@/utils/payjoinSessionStatus'

const PENDING_STATUS_LABEL_KEYS = new Set([
  'receive.payjoin.status.contributing',
  'receive.payjoin.status.initializing',
  'receive.payjoin.status.negotiating',
  'receive.payjoin.status.polling',
  'receive.payjoin.status.receivedOriginal',
  'receive.payjoin.status.waiting'
])

function displayBoardPayjoinError(error: string | undefined) {
  if (!error) {
    return undefined
  }
  if (error === ARK_BOARD_PAYJOIN_NATIVE_MISSING) {
    return t('ark.board.error.payjoinNative')
  }
  return error
}

/**
 * Payjoin boarding: a BIP77 receiver session whose destination is the ark
 * board funding address. The sender's payjoin transaction funds the board
 * directly — no separate deposit + board step.
 *
 * The funding address is only spendable through the boardPsbt cosign path, so
 * this hook only ever exposes the live payjoin URI, never the bare address:
 * paying it with a plain (non-payjoin) send would strand the funds.
 */
export function useArkBoardPayjoin(account: ArkAccount | undefined) {
  const queryClient = useQueryClient()
  const payjoinEnabled = useSettingsStore((s) => s.payjoinEnabled)
  const payjoinCoordinationMode = useSettingsStore(
    (s) => s.payjoinCoordinationMode
  )
  const payjoinArmed =
    payjoinEnabled && payjoinCoordinationMode === 'directory' && !!account

  const fundingInfoQuery = useArkBoardFundingInfo(account?.id, payjoinArmed)
  const fundingInfo = fundingInfoQuery.data

  const receiver = usePayjoinReceiver({
    accountId: account?.id ?? '',
    address: fundingInfo?.address,
    board:
      account && fundingInfo
        ? {
            expiryHeight: fundingInfo.expiryHeight,
            keypairIndex: fundingInfo.keypairIndex,
            serverId: account.serverId
          }
        : undefined,
    // A board QR is paid from another wallet — scan, build, review, sign — so
    // the general receive TTL expires mid-flow and kills the mailbox.
    ttlMs: PAYJOIN_BOARD_SESSION_TTL_MS,
    utxos: []
  })

  const { session } = receiver
  const accountId = account?.id
  const completed = !!session && isPayjoinSuccess(session.status)
  const expired = session?.status === 'expired'
  const sessionError = session?.status === 'error' ? session.error : undefined
  const error = displayBoardPayjoinError(
    fundingInfoQuery.error?.message ?? sessionError
  )
  const statusLabelKey = completed
    ? 'ark.board.payjoinWaitingBroadcast'
    : expired
      ? 'ark.board.payjoinExpired'
      : (receiver.statusLabelKey ??
        (fundingInfoQuery.isLoading
          ? 'receive.payjoin.status.initializing'
          : null))
  const busy =
    receiver.negotiating ||
    (!!statusLabelKey && PENDING_STATUS_LABEL_KEYS.has(statusLabelKey))

  // Handshake complete is not a broadcast. Tell the sender to finish sending.
  const notifiedSessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!completed || !session?.id || !accountId) {
      return
    }
    if (notifiedSessionIdRef.current === session.id) {
      return
    }
    notifiedSessionIdRef.current = session.id
    toast.info(t('ark.board.payjoinWaitingBroadcast'))
    void invalidateArkBoardQueries(queryClient, accountId)
  }, [accountId, completed, queryClient, session?.id])

  function restart() {
    if (fundingInfoQuery.error) {
      void fundingInfoQuery.refetch()
      return
    }
    void receiver.restartSession()
  }

  return {
    available: payjoinArmed && isNativeAvailable(),
    busy,
    completed,
    error,
    expired,
    payjoinUri: receiver.payjoinUri,
    restart,
    statusLabelKey,
    txid: session?.txid
  }
}
