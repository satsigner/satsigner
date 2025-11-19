import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { Alert } from 'react-native'
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

      if (content.type === 'incompatible') {
        Alert.alert(
          'Incompatible Content',
          'The content you scanned is not compatible with a Bitcoin wallet. Would you like to switch to a compatible wallet?',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Switch Wallet',
              onPress: () => router.push('/accountList')
            }
          ]
        )
        return
      }

      const processContent = () => {
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
      }

      if (
        content.type === 'bitcoin_descriptor' ||
        content.type === 'extended_public_key'
      ) {
        Alert.alert(
          'Create Watch-Only Account',
          'Do you want to create a new watch-only account with this content?',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'OK',
              onPress: processContent
            }
          ]
        )
      } else {
        processContent()
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
