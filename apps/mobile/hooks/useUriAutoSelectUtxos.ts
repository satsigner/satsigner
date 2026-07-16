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
  onApplyAlgorithm: (algorithm: AutoSelectUtxosAlgorithm) => boolean
  outputsLength: number
}

export function useUriAutoSelectUtxos({
  autoSelectFromUri,
  defaultAlgorithm,
  decoyAddress,
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

    if (onApplyAlgorithmRef.current(defaultAlgorithm)) {
      hasAppliedUriAutoSelectRef.current = true
      setUriAutoSelectPending(false)
    }
  }, [uriAutoSelectPending, outputsLength, defaultAlgorithm, decoyAddress])

  return { markUriAutoSelectPending, uriAutoSelectPending }
}
