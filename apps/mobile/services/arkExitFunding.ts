import { newArkOnchainAddress } from '@/api/ark'
import { DUST_LIMIT } from '@/constants/btc'
import { t } from '@/locales'
import { ensureArkWalletOpen } from '@/services/arkWallet'
import { prefillSendFromAccount } from '@/services/transactionBuilderPrefill'
import { useAccountsStore } from '@/store/accounts'
import { getArkAccountOrThrow } from '@/store/ark'
import { canAccountReceiveArkSweep } from '@/utils/arkOnchainSweep'
import { outputScriptFor } from '@/utils/psbtInspection'

type PrepareArkExitFundingParams = {
  arkAccountId: string
  fundingAccountId: string
  amountSats: number
}

/**
 * Prefills a send from one of the user's wallets to the Ark account's
 * on-chain wallet, which pays the fees of the exit transactions.
 */
export async function prepareArkExitFunding({
  arkAccountId,
  fundingAccountId,
  amountSats
}: PrepareArkExitFundingParams): Promise<void> {
  const arkAccount = getArkAccountOrThrow(arkAccountId)
  const fundingAccount = useAccountsStore
    .getState()
    .accounts.find((account) => account.id === fundingAccountId)
  if (
    !fundingAccount ||
    !canAccountReceiveArkSweep(fundingAccount, arkAccount.network)
  ) {
    throw new Error(t('ark.exit.funding.error.ineligible'))
  }
  if (!Number.isSafeInteger(amountSats) || amountSats < DUST_LIMIT) {
    throw new Error(t('ark.exit.funding.error.invalidAmount'))
  }

  await ensureArkWalletOpen(arkAccountId)
  const address = await newArkOnchainAddress(arkAccount.serverId, arkAccountId)
  if (!outputScriptFor(address, arkAccount.network)) {
    throw new Error(t('ark.exit.funding.error.invalidAddress'))
  }

  prefillSendFromAccount({
    account: fundingAccount,
    address,
    amountSats,
    label: t('ark.exit.funding.outputLabel')
  })
}
