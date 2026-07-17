import {
  ARK_EXIT_CLAIM_BASE_VBYTES,
  ARK_EXIT_CLAIM_VBYTES_PER_VTXO,
  ARK_EXIT_CPFP_CHILD_VBYTES_PER_LEVEL,
  ARK_EXIT_FEE_RATE_SAFETY_MULTIPLIER,
  ARK_EXIT_TX_VBYTES_PER_LEVEL,
  ARK_SERVERS
} from '@/constants/ark'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import {
  type ArkAccount,
  type ArkBalance,
  ArkServer,
  type ArkVtxo
} from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'

export function getArkAccountOrThrow(accountId: string): ArkAccount {
  const account = useArkStore
    .getState()
    .accounts.find((a) => a.id === accountId)
  if (!account) {
    throw new Error('Ark account not found')
  }
  return account
}

export function arkNetworkLabel(network: Network): string {
  if (network === 'bitcoin') {
    return t('ark.network.bitcoin')
  }
  return t('ark.network.signet')
}

export function getArkServer(
  network: Network,
  id: ArkServer['id']
): ArkServer | undefined {
  return ARK_SERVERS[network].find((server) => server.id === id)
}

export function getDefaultArkServer(network: Network): ArkServer | undefined {
  return ARK_SERVERS[network][0]
}

export function getArkPendingSats(balance: ArkBalance): number {
  return (
    balance.pendingInRoundSats +
    balance.pendingBoardSats +
    balance.claimableLightningReceiveSats
  )
}

export function getArkTotalSats(balance: ArkBalance): number {
  return balance.spendableSats + getArkPendingSats(balance)
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
