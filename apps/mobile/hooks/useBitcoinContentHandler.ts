import { useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  type BitcoinUriExceedsBalancePromptInfo,
  processContentByContext
} from '@/hooks/useContentProcessor'
import { t } from '@/locales'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { type DetectedContent } from '@/utils/contentDetector'

type NavigatePath = Parameters<ReturnType<typeof useRouter>['navigate']>[0]

type UseBitcoinContentHandlerProps = {
  accountId: string
  account: Account
  closePasteModal?: () => void
}

export function useBitcoinContentHandler({
  accountId,
  account,
  closePasteModal
}: UseBitcoinContentHandlerProps) {
  const router = useRouter()

  const [
    clearTransaction,
    addOutput,
    addInput,
    setFeeRate,
    setRbf,
    setSignedPsbts,
    setPsbt,
    setAccountId
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.clearTransaction,
      state.addOutput,
      state.addInput,
      state.setFeeRate,
      state.setRbf,
      state.setSignedPsbts,
      state.setPsbt,
      state.setAccountId
    ])
  )

  const [uriExceedsBalanceModal, setUriExceedsBalanceModal] =
    useState<BitcoinUriExceedsBalancePromptInfo | null>(null)
  const uriBalanceResolverRef = useRef<
    ((choice: 'cancel' | 'without_amount') => void) | null
  >(null)

  const promptBitcoinUriExceedsBalance = useCallback(
    (info: BitcoinUriExceedsBalancePromptInfo) => {
      closePasteModal?.()
      return new Promise<'cancel' | 'without_amount'>((resolve) => {
        uriBalanceResolverRef.current = resolve
        setUriExceedsBalanceModal(info)
      })
    },
    [closePasteModal]
  )

  const resolveUriExceedsBalancePrompt = useCallback(
    (choice: 'cancel' | 'without_amount') => {
      setUriExceedsBalanceModal(null)
      uriBalanceResolverRef.current?.(choice)
      uriBalanceResolverRef.current = null
    },
    []
  )

  const handleContentScanned = useCallback(
    async (content: DetectedContent) => {
      if (!content.isValid) {
        toast.error('Invalid Bitcoin content detected')
        return
      }

      if (content.type === 'incompatible') {
        toast.error(t('paste.error.incompatibleContent'))
        return
      }

      const runProcess = async () => {
        try {
          await processContentByContext(
            content,
            'bitcoin',
            {
              addInput,
              addOutput,
              clearTransaction,
              navigate: (path: NavigatePath) => {
                router.navigate(path)
              },
              promptBitcoinUriExceedsBalance,
              setAccountId,
              setFeeRate,
              setPsbt,
              setRbf,
              setSignedPsbts
            },
            accountId,
            account
          )
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'unknown'
          toast.error(`${t('bitcoin.error.processFailed')}: ${reason}`)
        }
      }

      if (
        content.type !== 'bitcoin_descriptor' &&
        content.type !== 'extended_public_key'
      ) {
        await runProcess()
        return
      }

      toast.info(t('watchonly.info.creatingWatchOnlyAccount'))
      await runProcess()
    },
    [
      account,
      accountId,
      addInput,
      addOutput,
      clearTransaction,
      promptBitcoinUriExceedsBalance,
      router,
      setAccountId,
      setFeeRate,
      setPsbt,
      setRbf,
      setSignedPsbts
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
    handleSend,
    resolveUriExceedsBalancePrompt,
    uriExceedsBalanceModal
  }
}
