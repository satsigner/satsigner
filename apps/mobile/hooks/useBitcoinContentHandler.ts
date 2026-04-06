import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { processContentByContext } from '@/hooks/useContentProcessor'
import { t } from '@/locales'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { type DetectedContent } from '@/utils/contentDetector'

type NavigatePath = Parameters<ReturnType<typeof useRouter>['navigate']>[0]

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
    setPsbt
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.clearTransaction,
      state.addOutput,
      state.addInput,
      state.setFeeRate,
      state.setRbf,
      state.setSignedPsbts,
      state.setPsbt
    ])
  )

  const handleContentScanned = useCallback(
    (content: DetectedContent) => {
      if (!content.isValid) {
        toast.error('Invalid Bitcoin content detected')
        return
      }

      if (content.type === 'incompatible') {
        toast.error(t('paste.error.incompatibleContent'))
        return
      }

      const processContent = () => {
        try {
          processContentByContext(
            content,
            'bitcoin',
            {
              addInput,
              addOutput,
              clearTransaction,
              navigate: (path: NavigatePath) => {
                router.navigate(path)
              },
              setFeeRate,
              setPsbt,
              setRbf,
              setSignedPsbts
            },
            accountId,
            account
          )
        } catch {
          toast.error(t('bitcoin.error.processFailed'))
        }
      }

      if (
        content.type !== 'bitcoin_descriptor' &&
        content.type !== 'extended_public_key'
      ) {
        processContent()
        return
      }

      toast.info(t('watchonly.info.creatingWatchOnlyAccount'))
      processContent()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      accountId,
      account,
      clearTransaction,
      addOutput,
      addInput,
      setFeeRate,
      setRbf,
      setSignedPsbts,
      setPsbt
    ]
  )

  const handleSend = useCallback(() => {
    router.push(
      `/signer/bitcoin/account/${accountId}/signAndSend/selectUtxoList`
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  const handleReceive = useCallback(() => {
    router.push(`/signer/bitcoin/account/${accountId}/receive`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  return {
    handleContentScanned,
    handleReceive,
    handleSend
  }
}
