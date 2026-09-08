import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner-native'

import { isNativeAvailable } from '@/api/payjoinNative'
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
  'receive.payjoin.status.initializing',
  'receive.payjoin.status.negotiating',
  'receive.payjoin.status.polling',
  'receive.payjoin.status.waiting'
])

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
    utxos: []
  })

  const { session } = receiver
  const accountId = account?.id
  const completed = !!session && isPayjoinSuccess(session.status)
  const sessionError = session?.status === 'error' ? session.error : undefined
  const error = fundingInfoQuery.error?.message ?? sessionError
  const statusLabelKey =
    receiver.statusLabelKey ??
    (fundingInfoQuery.isLoading ? 'receive.payjoin.status.initializing' : null)
  const busy =
    receiver.negotiating ||
    (!!statusLabelKey && PENDING_STATUS_LABEL_KEYS.has(statusLabelKey))

  // Completion toast/haptics/query refresh are external side effects — keep a
  // narrow effect, fired once per session.
  const celebratedSessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!completed || !session?.id || !accountId) {
      return
    }
    if (celebratedSessionIdRef.current === session.id) {
      return
    }
    celebratedSessionIdRef.current = session.id
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    toast.success(t('ark.board.success'))
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
    payjoinUri: receiver.payjoinUri,
    restart,
    statusLabelKey,
    txid: session?.txid
  }
}
