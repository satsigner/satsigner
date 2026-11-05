import {
  fetchArkBalance,
  listArkOnchainUtxos,
  sendArkOnchainWalletFunds
} from '@/api/ark'
import { t } from '@/locales'
import { reserveFreshReceiveAddress } from '@/services/accountReceiveAddress'
import { ensureArkWalletOpen } from '@/services/arkWallet'
import { useAccountsStore } from '@/store/accounts'
import { getArkAccountOrThrow } from '@/store/ark'
import {
  canAccountReceiveArkSweep,
  computeArkOnchainSweep,
  isValidArkOnchainFeeRate
} from '@/utils/arkOnchainSweep'

type SweepArkOnchainWalletParams = {
  arkAccountId: string
  destinationAccountId: string
  feeRateSatPerVb: number
}

type ArkOnchainSweepResult = {
  txid: string
  amountSats: number
  destinationName: string
}

/**
 * Sends everything in the Ark account's hidden on-chain wallet to a fresh
 * receive address of one of the user's Satsigner wallets. The fee rate is the
 * one the user saw in the preview, never a fresh server estimate.
 */
export async function sweepArkOnchainWallet({
  arkAccountId,
  destinationAccountId,
  feeRateSatPerVb
}: SweepArkOnchainWalletParams): Promise<ArkOnchainSweepResult> {
  if (!isValidArkOnchainFeeRate(feeRateSatPerVb)) {
    throw new Error(t('ark.onchain.sweep.error.invalidFeeRate'))
  }
  const arkAccount = getArkAccountOrThrow(arkAccountId)
  const destination = useAccountsStore
    .getState()
    .accounts.find((account) => account.id === destinationAccountId)
  if (
    !destination ||
    !canAccountReceiveArkSweep(destination, arkAccount.network)
  ) {
    throw new Error(t('ark.onchain.sweep.error.ineligible'))
  }

  await ensureArkWalletOpen(arkAccountId)
  const balance = await fetchArkBalance(arkAccount.serverId, arkAccountId)
  // Exits pay their CPFP fees from this wallet.
  if (balance.pendingExitSats > 0) {
    throw new Error(t('ark.onchain.sweep.error.exitInProgress'))
  }

  const [address, utxos] = await Promise.all([
    reserveFreshReceiveAddress(destination),
    listArkOnchainUtxos(arkAccount.serverId, arkAccountId)
  ])
  const sweep = computeArkOnchainSweep({ feeRateSatPerVb, utxos })
  if (!sweep.ok) {
    throw new Error(t(`ark.onchain.sweep.error.${sweep.reason}`))
  }

  const txid = await sendArkOnchainWalletFunds(
    arkAccount.serverId,
    arkAccountId,
    address,
    sweep.amountSats,
    feeRateSatPerVb
  )
  return {
    amountSats: sweep.amountSats,
    destinationName: destination.name,
    txid
  }
}
