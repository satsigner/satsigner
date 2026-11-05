import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'expo-router'

import { t } from '@/locales'
import { prepareArkBoardFromAccount } from '@/services/arkBoardFunding'
import { useAccountsStore } from '@/store/accounts'
import { arkBoardIoPreviewHref } from '@/utils/arkBoardDeposit'

type ArkBoardFromAccountInput = {
  fundingAccountId: string
  amountSats: number
}

export function useArkBoardFromAccount(arkAccountId: string | undefined) {
  const router = useRouter()
  return useMutation({
    mutationFn: ({
      fundingAccountId,
      amountSats
    }: ArkBoardFromAccountInput) => {
      const fundingAccount = useAccountsStore
        .getState()
        .accounts.find((account) => account.id === fundingAccountId)
      if (!arkAccountId || !fundingAccount) {
        throw new Error(t('ark.board.fromWallet.error.missingAccount'))
      }
      return prepareArkBoardFromAccount({
        amountSats,
        arkAccountId,
        fundingAccount
      })
    },
    onSuccess: (_, { fundingAccountId }) => {
      router.navigate(arkBoardIoPreviewHref(fundingAccountId))
    }
  })
}
