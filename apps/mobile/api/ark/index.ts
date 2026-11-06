import { getArkProvider } from '@/api/ark/registry'
import type {
  ArkBalance,
  ArkBoardFundingInfo,
  ArkBolt11Invoice,
  ArkDerivedAddress,
  ArkEmergencyExitFee,
  ArkExit,
  ArkExitClaimDraft,
  ArkFeeEstimate,
  ArkFeeRequest,
  ArkLightningReceive,
  ArkLightningSendResult,
  ArkLightningSendState,
  ArkMovement,
  ArkNotificationListener,
  ArkNotificationUnsubscribe,
  ArkOnchainBalance,
  ArkOnchainFeeRates,
  ArkOnchainUtxo,
  ArkPendingBoard,
  ArkServerId,
  ArkServerInfo,
  ArkVtxo,
  ArkWalletArgs
} from '@/types/models/Ark'
import '@/api/ark/providers/bark'

export async function createArkWallet(args: ArkWalletArgs): Promise<void> {
  await getArkProvider(args.server.id).createWallet(args)
}

export async function openArkWallet(args: ArkWalletArgs): Promise<void> {
  await getArkProvider(args.server.id).openWallet(args)
}

export async function syncArkWallet(
  serverId: ArkServerId,
  accountId: string
): Promise<void> {
  await getArkProvider(serverId).syncWallet(accountId)
}

export function releaseArkWallet(
  serverId: ArkServerId,
  accountId: string
): void {
  getArkProvider(serverId).releaseWallet(accountId)
}

export function fetchArkBalance(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkBalance> {
  return getArkProvider(serverId).fetchBalance(accountId)
}

export function newArkAddress(
  serverId: ArkServerId,
  accountId: string
): Promise<string> {
  return getArkProvider(serverId).newAddress(accountId)
}

export function createArkBolt11Invoice(
  serverId: ArkServerId,
  accountId: string,
  amountSats: number,
  description?: string
): Promise<ArkBolt11Invoice> {
  return getArkProvider(serverId).createBolt11Invoice(
    accountId,
    amountSats,
    description
  )
}

export function fetchArkMovements(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkMovement[]> {
  return getArkProvider(serverId).fetchMovements(accountId)
}

export function subscribeArkNotifications(
  serverId: ArkServerId,
  accountId: string,
  listener: ArkNotificationListener
): ArkNotificationUnsubscribe {
  return getArkProvider(serverId).subscribeNotifications(accountId, listener)
}

export function sendArkArkoor(
  serverId: ArkServerId,
  accountId: string,
  arkAddress: string,
  amountSats: number
): Promise<void> {
  return getArkProvider(serverId).sendArkoor(accountId, arkAddress, amountSats)
}

export function payArkBolt11(
  serverId: ArkServerId,
  accountId: string,
  invoice: string,
  amountSats?: number
): Promise<ArkLightningSendResult> {
  return getArkProvider(serverId).payBolt11(accountId, invoice, amountSats)
}

export function payArkLightningAddress(
  serverId: ArkServerId,
  accountId: string,
  address: string,
  amountSats: number,
  comment?: string
): Promise<ArkLightningSendResult> {
  return getArkProvider(serverId).payLightningAddress(
    accountId,
    address,
    amountSats,
    comment
  )
}

export function estimateArkArkoorFee(
  serverId: ArkServerId,
  accountId: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  return getArkProvider(serverId).estimateArkoorFee(accountId, amountSats)
}

export function estimateArkLightningSendFee(
  serverId: ArkServerId,
  accountId: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  return getArkProvider(serverId).estimateLightningSendFee(
    accountId,
    amountSats
  )
}

export function estimateArkLightningReceiveFee(
  serverId: ArkServerId,
  accountId: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  return getArkProvider(serverId).estimateLightningReceiveFee(
    accountId,
    amountSats
  )
}

export function listArkVtxos(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkVtxo[]> {
  return getArkProvider(serverId).listAllVtxos(accountId)
}

export function offboardArkVtxos(
  serverId: ArkServerId,
  accountId: string,
  vtxoIds: string[],
  bitcoinAddress: string
): Promise<string> {
  return getArkProvider(serverId).offboardVtxos(
    accountId,
    vtxoIds,
    bitcoinAddress
  )
}

export function estimateArkOffboardFee(
  serverId: ArkServerId,
  accountId: string,
  bitcoinAddress: string,
  vtxoIds: string[]
): Promise<ArkFeeEstimate> {
  return getArkProvider(serverId).estimateOffboardFee(
    accountId,
    bitcoinAddress,
    vtxoIds
  )
}

export function startArkExit(
  serverId: ArkServerId,
  accountId: string,
  vtxoIds?: string[]
): Promise<void> {
  return getArkProvider(serverId).startExit(accountId, vtxoIds)
}

export function listArkExits(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkExit[]> {
  return getArkProvider(serverId).listExits(accountId)
}

export function syncArkExits(
  serverId: ArkServerId,
  accountId: string
): Promise<void> {
  return getArkProvider(serverId).syncExits(accountId)
}

export function estimateArkEmergencyExitFee(
  serverId: ArkServerId,
  accountId: string,
  vtxoIds: string[]
): Promise<ArkEmergencyExitFee> {
  return getArkProvider(serverId).estimateEmergencyExitFee(accountId, vtxoIds)
}

export function buildArkExitClaim(
  serverId: ArkServerId,
  accountId: string,
  vtxoIds: string[],
  bitcoinAddress: string,
  feeRateSatPerVb: number
): Promise<ArkExitClaimDraft> {
  return getArkProvider(serverId).buildExitClaim(
    accountId,
    vtxoIds,
    bitcoinAddress,
    feeRateSatPerVb
  )
}

export function signArkExitClaim(
  serverId: ArkServerId,
  accountId: string,
  psbtBase64: string
): Promise<string> {
  return getArkProvider(serverId).signExitClaim(accountId, psbtBase64)
}

export function refreshArkVtxos(
  serverId: ArkServerId,
  accountId: string,
  vtxoIds: string[]
): Promise<string> {
  return getArkProvider(serverId).refreshVtxos(accountId, vtxoIds)
}

export function deriveArkAddresses(
  serverId: ArkServerId,
  accountId: string,
  startIndex: number,
  count: number
): Promise<ArkDerivedAddress[]> {
  return getArkProvider(serverId).deriveAddresses(accountId, startIndex, count)
}

export function estimateArkRefreshFee(
  serverId: ArkServerId,
  accountId: string,
  vtxoIds: string[]
): Promise<ArkFeeEstimate> {
  return getArkProvider(serverId).estimateRefreshFee(accountId, vtxoIds)
}

export function sendArkOnchain(
  serverId: ArkServerId,
  accountId: string,
  bitcoinAddress: string,
  amountSats: number
): Promise<string> {
  return getArkProvider(serverId).sendOnchain(
    accountId,
    bitcoinAddress,
    amountSats
  )
}

export function estimateArkSendOnchainFee(
  serverId: ArkServerId,
  accountId: string,
  bitcoinAddress: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  return getArkProvider(serverId).estimateSendOnchainFee(
    accountId,
    bitcoinAddress,
    amountSats
  )
}

export function fetchArkOnchainBalance(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkOnchainBalance> {
  return getArkProvider(serverId).fetchOnchainBalance(accountId)
}

export function fetchArkOnchainFeeRate(
  serverId: ArkServerId,
  accountId: string
): Promise<number> {
  return getArkProvider(serverId).fetchOnchainFeeRate(accountId)
}

export function fetchArkOnchainFeeRates(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkOnchainFeeRates> {
  return getArkProvider(serverId).fetchOnchainFeeRates(accountId)
}

export function newArkOnchainAddress(
  serverId: ArkServerId,
  accountId: string
): Promise<string> {
  return getArkProvider(serverId).newOnchainAddress(accountId)
}

export function boardArk(
  serverId: ArkServerId,
  accountId: string,
  amountSats?: number
): Promise<ArkPendingBoard> {
  return getArkProvider(serverId).board(accountId, amountSats)
}

export function getArkBoardFundingAddress(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkBoardFundingInfo> {
  return getArkProvider(serverId).boardFundingAddress(accountId)
}

export function boardArkPsbt(
  serverId: ArkServerId,
  accountId: string,
  psbtBase64: string,
  keypairIndex: number,
  expiryHeight: number
): Promise<ArkPendingBoard> {
  return getArkProvider(serverId).boardPsbt(
    accountId,
    psbtBase64,
    keypairIndex,
    expiryHeight
  )
}

export function estimateArkBoardFee(
  serverId: ArkServerId,
  accountId: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  return getArkProvider(serverId).estimateBoardFee(accountId, amountSats)
}

export function listArkPendingBoards(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkPendingBoard[]> {
  return getArkProvider(serverId).listPendingBoards(accountId)
}

export function fetchArkServerInfo(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkServerInfo | null> {
  return getArkProvider(serverId).fetchServerInfo(accountId)
}

export function fetchArkTipHeight(
  serverId: ArkServerId,
  accountId: string
): Promise<number> {
  return getArkProvider(serverId).fetchTipHeight(accountId)
}

export function fetchArkVtxoEncoded(
  serverId: ArkServerId,
  accountId: string,
  vtxoId: string
): Promise<string> {
  return getArkProvider(serverId).fetchVtxoEncoded(accountId, vtxoId)
}

export function fetchArkVtxoState(
  serverId: ArkServerId,
  accountId: string,
  vtxoId: string
): Promise<string> {
  return getArkProvider(serverId).fetchVtxoState(accountId, vtxoId)
}

export function fetchArkLightningReceive(
  serverId: ArkServerId,
  accountId: string,
  paymentHash: string
): Promise<ArkLightningReceive> {
  return getArkProvider(serverId).fetchLightningReceive(accountId, paymentHash)
}

export function checkArkLightningSend(
  serverId: ArkServerId,
  accountId: string,
  paymentHash: string
): Promise<ArkLightningSendState> {
  return getArkProvider(serverId).checkLightningSend(accountId, paymentHash)
}

export function claimArkLightningReceive(
  serverId: ArkServerId,
  accountId: string,
  paymentHash: string
): Promise<ArkLightningReceive> {
  return getArkProvider(serverId).claimLightningReceive(accountId, paymentHash)
}

export function listArkOnchainUtxos(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkOnchainUtxo[]> {
  return getArkProvider(serverId).listOnchainUtxos(accountId)
}

export function sendArkOnchainWalletFunds(
  serverId: ArkServerId,
  accountId: string,
  bitcoinAddress: string,
  amountSats: number,
  feeRateSatPerVb: number
): Promise<string> {
  return getArkProvider(serverId).sendFromOnchain(
    accountId,
    bitcoinAddress,
    amountSats,
    feeRateSatPerVb
  )
}

export function estimateArkFee(
  serverId: ArkServerId,
  accountId: string,
  request: ArkFeeRequest
): Promise<ArkFeeEstimate> {
  switch (request.kind) {
    case 'arkoor': {
      return estimateArkArkoorFee(serverId, accountId, request.amountSats)
    }
    case 'lightning': {
      return estimateArkLightningSendFee(
        serverId,
        accountId,
        request.amountSats
      )
    }
    case 'board': {
      return estimateArkBoardFee(serverId, accountId, request.amountSats)
    }
    case 'onchain': {
      return estimateArkSendOnchainFee(
        serverId,
        accountId,
        request.address,
        request.amountSats
      )
    }
    case 'offboard': {
      return estimateArkOffboardFee(
        serverId,
        accountId,
        request.address,
        request.vtxoIds
      )
    }
    case 'refresh': {
      return estimateArkRefreshFee(serverId, accountId, request.vtxoIds)
    }
    default: {
      throw new Error('Unsupported Ark fee request')
    }
  }
}
