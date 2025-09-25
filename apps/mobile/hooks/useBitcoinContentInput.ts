import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { useAccountsStore } from '@/store/accounts'
import {
  isValidBitcoinContent,
  processBitcoinContent
} from '@/utils/bitcoinContent'
import { processBitcoinTransaction } from '@/utils/transactionProcessor'

export function useBitcoinContentInput(accountId: string) {
  const [content, setContent] = useState<string>('')

  const [clearTransaction, addOutput, addInput, setFeeRate] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.clearTransaction,
        state.addOutput,
        state.addInput,
        state.setFeeRate
      ])
    )

  const account = useAccountsStore(
    (state) => state.accounts.find((account) => account.id === accountId)!
  )

  const isValidContent = isValidBitcoinContent(content)

  function handleProcessContent(
    navigate: (options: { pathname: string; params: any }) => void
  ) {
    if (!content) return

    const processedContent = processBitcoinContent(content)
    if (!processedContent) return

    processBitcoinTransaction(processedContent, account, accountId, {
      clearTransaction,
      addOutput,
      addInput,
      setFeeRate,
      navigate
    })
  }

  return {
    content,
    setContent,
    isValidContent,
    handleProcessContent
  }
}
