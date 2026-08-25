import { useEffect, useRef, useState } from 'react'

import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'
import {
  isAutoSelectFromUriSearchParam,
  shouldApplyDefaultAutoSelectFromUri
} from '@/utils/autoSelectUtxos'

type UseUriAutoSelectUtxosParams = {
  autoSelectFromUri?: string | string[]
  defaultAlgorithm: AutoSelectUtxosAlgorithm
  decoyAddress?: string
  /** When set, wait until a network fee estimate exists before selecting. */
  nextBlockFee?: number | null
  onApplyAlgorithm: (algorithm: AutoSelectUtxosAlgorithm) => boolean
  outputsLength: number
}

export function useUriAutoSelectUtxos({
  autoSelectFromUri,
  defaultAlgorithm,
  decoyAddress,
  nextBlockFee,
  onApplyAlgorithm,
  outputsLength
}: UseUriAutoSelectUtxosParams) {
  const [uriAutoSelectPending, setUriAutoSelectPending] = useState(() =>
    isAutoSelectFromUriSearchParam(autoSelectFromUri)
  )
  const hasAppliedUriAutoSelectRef = useRef(false)
  const onApplyAlgorithmRef = useRef(onApplyAlgorithm)
  onApplyAlgorithmRef.current = onApplyAlgorithm

  function markUriAutoSelectPending() {
    if (hasAppliedUriAutoSelectRef.current) {
      return
    }
    setUriAutoSelectPending(true)
  }

  useEffect(() => {
    if (!uriAutoSelectPending || hasAppliedUriAutoSelectRef.current) {
      return
    }

    if (
      !shouldApplyDefaultAutoSelectFromUri({
        algorithm: defaultAlgorithm,
        decoyAddress,
        outputsLength
      })
    ) {
      if (defaultAlgorithm === 'user' && outputsLength > 0) {
        hasAppliedUriAutoSelectRef.current = true
        setUriAutoSelectPending(false)
      }
      return
    }

    // Efficiency/privacy selection uses nextBlockFee when local fee is still 1.
    // Wait so we do not underfund and then hydrate the rate without reselecting.
    if (
      (defaultAlgorithm === 'efficiency' || defaultAlgorithm === 'privacy') &&
      (nextBlockFee === null || nextBlockFee === undefined || nextBlockFee < 1)
    ) {
      return
    }

    if (onApplyAlgorithmRef.current(defaultAlgorithm)) {
      hasAppliedUriAutoSelectRef.current = true
      setUriAutoSelectPending(false)
    }
  }, [
    uriAutoSelectPending,
    outputsLength,
    defaultAlgorithm,
    decoyAddress,
    nextBlockFee
  ])

  return { markUriAutoSelectPending, uriAutoSelectPending }
}
