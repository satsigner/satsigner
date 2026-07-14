import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import {
  getFeePercentage,
  isElevatedFeeRate,
  isHighMinerFee
} from '@/utils/feeWarnings'
import { formatNumber } from '@/utils/format'

type UseTransactionFeeWarningsParams = {
  deferWarning: boolean
  feeRate: number
  fundingMinerFee: number
  inputsCount: number
  isFocused: boolean
  nextBlockFee: number | null
  totalInputSats: number
}

export function useTransactionFeeWarnings({
  deferWarning,
  feeRate,
  fundingMinerFee,
  inputsCount,
  isFocused,
  nextBlockFee,
  totalInputSats
}: UseTransactionFeeWarningsParams) {
  const hasShownFeeWarningRef = useRef(false)

  useFocusEffect(
    useCallback(() => {
      hasShownFeeWarningRef.current = false
    }, [])
  )

  useEffect(() => {
    if (!isFocused || hasShownFeeWarningRef.current) {
      return
    }

    if (deferWarning || inputsCount === 0) {
      return
    }

    const highMinerFee = isHighMinerFee({
      minerFeeSats: fundingMinerFee,
      totalInputSats
    })
    const elevatedFeeRate = isElevatedFeeRate(feeRate, nextBlockFee)

    if (!highMinerFee && !elevatedFeeRate) {
      return
    }

    hasShownFeeWarningRef.current = true

    if (highMinerFee) {
      toast.warning(
        t('transaction.warning.highMinerFee', {
          percentage: formatNumber(
            getFeePercentage({
              minerFeeSats: fundingMinerFee,
              totalInputSats
            }) * 100,
            2
          )
        })
      )
      return
    }

    if (nextBlockFee !== null) {
      toast.warning(
        t('transaction.warning.elevatedFeeRate', {
          rate: feeRate,
          recommended: nextBlockFee
        })
      )
    }
  }, [
    deferWarning,
    feeRate,
    fundingMinerFee,
    inputsCount,
    isFocused,
    nextBlockFee,
    totalInputSats
  ])
}
