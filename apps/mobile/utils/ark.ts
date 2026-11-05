import {
  ARK_EXIT_CLAIM_BASE_VBYTES,
  ARK_EXIT_CLAIM_VBYTES_PER_VTXO,
  ARK_EXIT_CPFP_CHILD_VBYTES_PER_LEVEL,
  ARK_EXIT_FEE_RATE_SAFETY_MULTIPLIER,
  ARK_EXIT_TX_VBYTES_PER_LEVEL,
  ARK_SERVERS,
  ARK_SUPPORTED_NETWORKS
} from '@/constants/ark'
import { t } from '@/locales'
import {
  type ArkBalance,
  type ArkDestinationDraft,
  type ArkFeeRequest,
  type ArkOnchainBalance,
  ArkServer,
  type ArkVtxo
} from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'

export function arkNetworkLabel(network: Network): string {
  if (network === 'bitcoin') {
    return t('ark.network.bitcoin')
  }
  return t('ark.network.signet')
}

/**
 * The Ark network tab to open on: the app's selected network when Ark runs on
 * it, otherwise the first supported one.
 */
export function getArkNetworkTabIndex(selectedNetwork: Network): number {
  return Math.max(ARK_SUPPORTED_NETWORKS.indexOf(selectedNetwork), 0)
}

export function getArkServer(
  network: Network,
  id: ArkServer['id']
): ArkServer | undefined {
  return ARK_SERVERS[network].find((server) => server.id === id)
}

export type ArkBalanceRowKey =
  | 'offchain'
  | 'needsRefresh'
  | 'onchain'
  | 'onchainPending'
  | 'pendingBoard'
  | 'pendingInRound'
  | 'pendingArkoorSend'
  | 'pendingLightningSend'
  | 'claimableLightningReceive'
  | 'pendingOffboard'
  | 'pendingExit'

export type ArkBalanceRow = {
  key: ArkBalanceRowKey
  amountSats: number
}

export type ArkBalanceBreakdown = {
  totalSats: number
  rows: ArkBalanceRow[]
  showBreakdown: boolean
}

/**
 * Every bucket bark reports is disjoint, so the total is their plain sum.
 * `spendableSats` excludes `needsRefreshSats`, and the hidden on-chain wallet
 * is a separate BDK wallet.
 */
export function getArkBalanceBreakdown(
  balance: ArkBalance | undefined,
  onchainBalance: ArkOnchainBalance | undefined
): ArkBalanceBreakdown {
  const allRows: ArkBalanceRow[] = [
    { amountSats: balance?.spendableSats ?? 0, key: 'offchain' },
    { amountSats: balance?.needsRefreshSats ?? 0, key: 'needsRefresh' },
    { amountSats: onchainBalance?.confirmedSats ?? 0, key: 'onchain' },
    { amountSats: onchainBalance?.pendingSats ?? 0, key: 'onchainPending' },
    { amountSats: balance?.pendingBoardSats ?? 0, key: 'pendingBoard' },
    { amountSats: balance?.pendingInRoundSats ?? 0, key: 'pendingInRound' },
    {
      amountSats: balance?.pendingArkoorSendSats ?? 0,
      key: 'pendingArkoorSend'
    },
    {
      amountSats: balance?.pendingLightningSendSats ?? 0,
      key: 'pendingLightningSend'
    },
    {
      amountSats: balance?.claimableLightningReceiveSats ?? 0,
      key: 'claimableLightningReceive'
    },
    { amountSats: balance?.pendingOffboardSats ?? 0, key: 'pendingOffboard' },
    { amountSats: balance?.pendingExitSats ?? 0, key: 'pendingExit' }
  ]
  const rows = allRows.filter((row) => row.amountSats > 0)
  return {
    rows,
    showBreakdown: rows.some((row) => row.key !== 'offchain'),
    totalSats: rows.reduce((total, row) => total + row.amountSats, 0)
  }
}

/**
 * A unilateral exit unrolls the VTXO tree as a chain of `exitDepth` zero-fee
 * txs, each broadcast in sequence and bumped by its own CPFP child. The fee
 * must cover both the exit tx and its CPFP child at every level, plus a final
 * claim tx. A safety multiplier absorbs fee-rate drift while the exit ripens.
 */
export function estimateArkExitFeeSats(
  vtxos: Pick<ArkVtxo, 'exitDepth'>[],
  feeRateSatPerVb: number
): number {
  if (vtxos.length === 0 || feeRateSatPerVb <= 0) {
    return 0
  }
  const vbytesPerLevel =
    ARK_EXIT_TX_VBYTES_PER_LEVEL + ARK_EXIT_CPFP_CHILD_VBYTES_PER_LEVEL
  const exitVbytes = vtxos.reduce(
    (total, vtxo) => total + Math.max(vtxo.exitDepth, 1) * vbytesPerLevel,
    0
  )
  const claimVbytes =
    ARK_EXIT_CLAIM_BASE_VBYTES + ARK_EXIT_CLAIM_VBYTES_PER_VTXO * vtxos.length
  const feeSats =
    (exitVbytes + claimVbytes) *
    feeRateSatPerVb *
    ARK_EXIT_FEE_RATE_SAFETY_MULTIPLIER
  return Math.ceil(feeSats)
}

export function normalizeArkFeeRequest(request: ArkFeeRequest): ArkFeeRequest {
  switch (request.kind) {
    case 'onchain': {
      return { ...request, address: request.address.trim() }
    }
    case 'offboard': {
      return {
        ...request,
        address: request.address.trim(),
        vtxoIds: request.vtxoIds.toSorted()
      }
    }
    case 'refresh': {
      return { ...request, vtxoIds: request.vtxoIds.toSorted() }
    }
    default: {
      return request
    }
  }
}

export function isArkFeeRequestReady(request: ArkFeeRequest): boolean {
  if ('address' in request && request.address.trim().length === 0) {
    return false
  }
  if ('vtxoIds' in request && request.vtxoIds.length === 0) {
    return false
  }
  if ('amountSats' in request && request.amountSats <= 0) {
    return false
  }
  return true
}

export function arkSendFeeRequest(
  draft: ArkDestinationDraft,
  amountSats: number
): ArkFeeRequest {
  if (draft.kind === 'arkoor') {
    return { amountSats, kind: 'arkoor' }
  }
  if (draft.kind === 'onchain') {
    return { address: draft.address, amountSats, kind: 'onchain' }
  }
  return { amountSats, kind: 'lightning' }
}
