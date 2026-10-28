import { useMemo, useRef, useState } from 'react'
import { type ViewInstance } from 'react-native'

import {
  ANIMATION_SPEED_DEFAULT,
  ANIMATION_SPEED_MAX,
  ANIMATION_SPEED_MIN,
  QR_COMPLEXITY_DEFAULT,
  QR_COMPLEXITY_MAX,
  QR_COMPLEXITY_MIN,
  QRDisplayMode
} from '@/constants/qr'
import { useAnimatedQrFrameCycle } from '@/hooks/useAnimatedQrFrameCycle'
import { type PsbtQrChunks } from '@/types/models/Psbt'
import {
  createPsbtQrChunks,
  getQrAnimationIntervalMs,
  getQrDisplayModeDescription,
  getQrValue
} from '@/utils/qrExport'

const EMPTY_CHUNKS: PsbtQrChunks = {
  [QRDisplayMode.BBQR]: [],
  [QRDisplayMode.RAW]: [],
  [QRDisplayMode.UR]: []
}

function encodePsbtInEveryQrFormat(
  psbtBase64: string | undefined,
  complexity: number
) {
  if (!psbtBase64) {
    return { chunks: EMPTY_CHUNKS, errorKey: 'error.psbt.notAvailable' }
  }
  try {
    return {
      chunks: createPsbtQrChunks(psbtBase64, complexity),
      errorKey: null
    }
  } catch {
    return { chunks: EMPTY_CHUNKS, errorKey: 'error.qr.generation' }
  }
}

export function usePsbtQrExport(
  psbtBase64: string | undefined,
  initialDisplayMode = QRDisplayMode.RAW,
  isExportVisible = true
) {
  const [displayMode, setDisplayModeState] = useState(initialDisplayMode)
  const [frameIndex, setFrameIndex] = useState(0)
  const [qrComplexity, setQrComplexityState] = useState(QR_COMPLEXITY_DEFAULT)
  const [animationSpeed, setAnimationSpeed] = useState(ANIMATION_SPEED_DEFAULT)
  const [hasExportBeenVisible, setHasExportBeenVisible] =
    useState(isExportVisible)

  if (isExportVisible && !hasExportBeenVisible) {
    setHasExportBeenVisible(true)
  }

  const qrRef = useRef<ViewInstance>(null)

  const psbtToEncodeOnceVisible = hasExportBeenVisible ? psbtBase64 : undefined
  const { chunks, errorKey } = useMemo(
    () => encodePsbtInEveryQrFormat(psbtToEncodeOnceVisible, qrComplexity),
    [psbtToEncodeOnceVisible, qrComplexity]
  )
  const modeChunks = chunks[displayMode]
  const isMultiPartQR = modeChunks.length > 1
  const currentChunk =
    modeChunks.length > 0 ? frameIndex % modeChunks.length : 0

  useAnimatedQrFrameCycle(
    () => setFrameIndex((prev) => prev + 1),
    getQrAnimationIntervalMs(animationSpeed),
    isExportVisible && isMultiPartQR
  )

  function setDisplayMode(mode: QRDisplayMode) {
    setDisplayModeState(mode)
    setFrameIndex(0)
  }

  function setQrComplexity(complexity: number) {
    setQrComplexityState(complexity)
    setFrameIndex(0)
  }

  const qrValue = getQrValue(modeChunks[currentChunk])
  const displayModeDescription = getQrDisplayModeDescription({
    chunkCount: modeChunks.length,
    currentChunk,
    displayMode,
    qrComplexity
  })
  const isTooLargeForOneQrAtMaxDensity =
    qrComplexity === QR_COMPLEXITY_MAX && isMultiPartQR
  const hasSelectedModeFailedToEncode = modeChunks.length === 0
  const qrErrorKey =
    errorKey ?? (hasSelectedModeFailedToEncode ? 'error.qr.generation' : null)

  function decreaseComplexity() {
    setQrComplexity(Math.max(QR_COMPLEXITY_MIN, qrComplexity - 1))
  }

  function increaseComplexity() {
    setQrComplexity(Math.min(QR_COMPLEXITY_MAX, qrComplexity + 1))
  }

  function decreaseSpeed() {
    setAnimationSpeed(Math.max(ANIMATION_SPEED_MIN, animationSpeed - 1))
  }

  function increaseSpeed() {
    setAnimationSpeed(Math.min(ANIMATION_SPEED_MAX, animationSpeed + 1))
  }

  return {
    animationSpeed,
    decreaseComplexity,
    decreaseSpeed,
    displayMode,
    displayModeDescription,
    increaseComplexity,
    increaseSpeed,
    isMultiPartQR,
    qrComplexity,
    qrErrorKey,
    qrRef,
    qrValue,
    setDisplayMode,
    showMaxDensityNote: isTooLargeForOneQrAtMaxDensity
  }
}
