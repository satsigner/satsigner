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

  const [
    clearTransaction,
    addOutput,
    addInput,
    setFeeRate,
    setRbf,
    setSignedPsbts,
    setTxBuilderResult
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.clearTransaction,
      state.addOutput,
      state.addInput,
      state.setFeeRate,
      state.setRbf,
      state.setSignedPsbts,
      state.setTxBuilderResult
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
            navigate: (
              path:
                | string
                | { pathname: string; params?: Record<string, unknown> }
            ) => {
              if (typeof path === 'string') {
                router.push(path as any)
              } else {
                router.push(path as any)
              }
            },
            clearTransaction,
            addOutput,
            addInput,
            setFeeRate,
            setRbf,
            setSignedPsbts,
            setTxBuilderResult
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
      router,
      clearTransaction,
      addOutput,
      addInput,
      setFeeRate,
      setRbf,
      setSignedPsbts,
      setTxBuilderResult
    ]
  )

  const handleSend = useCallback(() => {
    router.push(`/account/${accountId}/signAndSend/selectUtxoList`)
  }, [router, accountId])

  const handleReceive = useCallback(() => {
    router.push(`/account/${accountId}/receive`)
  }, [router, accountId])

  return {
    handleContentScanned,
    handleSend,
    handleReceive
  }
}
