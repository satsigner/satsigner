import { useArkBoardFundingInfo } from '@/hooks/useArkBoard'
import { usePayjoinReceiver } from '@/hooks/usePayjoinReceiver'
import { useSettingsStore } from '@/store/settings'
import { type ArkAccount } from '@/types/models/Ark'

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

  return {
    available: payjoinArmed,
    fundingError: fundingInfoQuery.error,
    payjoinUri: receiver.payjoinUri,
    retryFundingInfo: fundingInfoQuery.refetch,
    session: receiver.session,
    starting: receiver.starting || fundingInfoQuery.isLoading,
    statusLabelKey: receiver.statusLabelKey
  }
}
