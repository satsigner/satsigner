import { useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { t } from '@/locales'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  type BitcoinUriExceedsBalancePromptInfo,
  extractPayjoinUriFromContent,
  processBitcoinContent
} from '@/utils/contentProcessor'

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
    setAccountId,
    setPayjoinUri
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.clearTransaction,
      state.addOutput,
      state.addInput,
      state.setFeeRate,
      state.setRbf,
      state.setSignedPsbts,
      state.setPsbt,
      state.setAccountId,
      state.setPayjoinUri
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
        toast.error(t('camera.invalidContent', { context: 'bitcoin' }))
        return
      }

      if (content.type === 'incompatible') {
        toast.error(t('paste.error.incompatibleContent'))
        return
      }

      if (
        content.type === 'bitcoin_descriptor' ||
        content.type === 'extended_public_key'
      ) {
        toast.info(t('watchonly.info.creatingWatchOnlyAccount'))
      }

      try {
        await processBitcoinContent(
          content,
          {
            addInput,
            addOutput,
            clearTransaction,
            navigate: (path) => router.navigate(path),
            promptBitcoinUriExceedsBalance,
            setAccountId,
            setFeeRate,
            setPayjoinUri,
            setPsbt,
            setRbf,
            setSignedPsbts
          },
          accountId,
          account
        )
        if (
          content.type === 'bitcoin_uri' &&
          extractPayjoinUriFromContent(content)
        ) {
          toast.success(t('transaction.build.payjoin.uriDetected'))
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown'
        toast.error(`${t('bitcoin.error.processFailed')}: ${reason}`)
      }
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
      setPayjoinUri,
      setPsbt,
      setRbf,
      setSignedPsbts
    ]
  )

  return {
    handleContentScanned,
    resolveUriExceedsBalancePrompt,
    uriExceedsBalanceModal
  }
}
