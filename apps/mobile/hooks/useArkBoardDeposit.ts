import { useRouter } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import type { ArkAccount } from '@/types/models/Ark'

const DEPOSIT_PLACEHOLDER_AMOUNT_SATS = 1

/**
 * Funding the Ark board wallet from the linked on-chain Bitcoin account:
 * prefills the transaction builder with the deposit address and hands the
 * user over to the regular sign-and-send flow.
 */
export function useArkBoardDeposit(arkAccount: ArkAccount | undefined) {
  const router = useRouter()
  const linkedAccount = useAccountsStore(
    useShallow((state) =>
      state.accounts.find(
        (account) => account.id === arkAccount?.bitcoinAccountId
      )
    )
  )
  const [clearTransaction, setAccountId, addOutput] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.clearTransaction,
        state.setAccountId,
        state.addOutput
      ])
    )

  function fundFromLinkedAccount(depositAddress: string) {
    if (!linkedAccount) {
      return
    }
    clearTransaction()
    setAccountId(linkedAccount.id)
    addOutput({
      amount: DEPOSIT_PLACEHOLDER_AMOUNT_SATS,
      label: t('ark.board.depositLabel'),
      to: depositAddress
    })
    router.navigate({
      params: { id: linkedAccount.id },
      pathname: '/signer/bitcoin/account/[id]/signAndSend/ioPreview'
    })
  }

  return { fundFromLinkedAccount, linkedAccount }
}
