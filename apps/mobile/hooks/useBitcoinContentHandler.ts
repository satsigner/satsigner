import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { type DetectedContent } from '@/utils/contentDetector'
import { processContentByContext } from '@/utils/contentProcessor'

type UseBitcoinContentHandlerProps = {
  accountId: string
  account: Account
}

export function useBitcoinContentHandler({
  accountId,
  account
}: UseBitcoinContentHandlerProps) {
  const router = useRouter()

  const [clearTransaction, addOutput, addInput, setFeeRate] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.clearTransaction,
        state.addOutput,
        state.addInput,
        state.setFeeRate
      ])
    )

  const handleContentScanned = useCallback(
    (content: DetectedContent) => {
      if (!content.isValid) {
        toast.error('Invalid Bitcoin content detected')
        return
      }

      try {
        processContentByContext(
          content,
          'bitcoin',
          {
            navigate: router.navigate,
            clearTransaction,
            addOutput,
            addInput,
            setFeeRate
          },
          accountId,
          account
        )
      } catch (error) {
        const errorMessage = (error as Error).message
        toast.error(errorMessage || 'Failed to process content')
      }
    },
    [
      accountId,
      account,
      router.navigate,
      clearTransaction,
      addOutput,
      addInput,
      setFeeRate
    ]
  )

  const handleSend = useCallback(() => {
    router.navigate(`/account/${accountId}/signAndSend/selectUtxoList`)
  }, [router, accountId])

  const handleReceive = useCallback(() => {
    router.navigate(`/account/${accountId}/receive`)
  }, [router, accountId])

  return {
    handleContentScanned,
    handleSend,
    handleReceive
  }
}
