import { useRef, useState } from 'react'
import { type View } from 'react-native'

import {
  ANIMATION_SPEED_DEFAULT,
  ANIMATION_SPEED_MAX,
  ANIMATION_SPEED_MIN,
  QR_COMPLEXITY_DEFAULT,
  QR_COMPLEXITY_MAX,
  QR_COMPLEXITY_MIN,
  QR_MAX_DATA_SIZE,
  QRDisplayMode
} from '@/constants/qr'
import { useAnimationFrameInterval } from '@/hooks/useAnimationFrameInterval'
import { type Message } from '@/types/ui/notice'
import {
  createPsbtQrChunks,
  getQrAnimationIntervalMs,
  type PsbtQrChunks
} from '@/utils/qrExport'

// Placeholder values shown in the QR when there is nothing valid to encode.
const QR_VALUE_NO_DATA = 'NO_DATA'
const QR_VALUE_TOO_LARGE = 'DATA_TOO_LARGE_FOR_QR'

const STATIC_QR_DESCRIPTION_KEYS: Record<QRDisplayMode, string> = {
  [QRDisplayMode.BBQR]: 'transaction.preview.staticQrBbqr',
  [QRDisplayMode.RAW]: 'transaction.preview.staticQrPsbt',
  [QRDisplayMode.UR]: 'transaction.preview.staticQrUr'
}

const EMPTY_CHUNKS: PsbtQrChunks = {
  [QRDisplayMode.BBQR]: [],
  [QRDisplayMode.RAW]: [],
  [QRDisplayMode.UR]: []
}

// Encodes the PSBT in every format, or returns the i18n key of the error.
function generateQrChunks(psbtBase64: string | undefined, complexity: number) {
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

/**
 * Encodes a PSBT as RAW, UR or BBQR QR frames and cycles through them when
 * the selected format needs more than one QR. Density (`qrComplexity`) and
 * cycling speed (`animationSpeed`) are user adjustable. Nothing is encoded
 * until `active` first turns true (e.g. the export modal opens), and frames
 * only cycle while it is true. The frames are kept once encoded, so a closing
 * modal keeps showing them while it fades out.
 */
export function usePsbtQrExport(
  psbtBase64: string | undefined,
  initialDisplayMode = QRDisplayMode.RAW,
  active = true
) {
  const [displayMode, setDisplayModeState] = useState(initialDisplayMode)
  const [frameIndex, setFrameIndex] = useState(0)
  const [qrComplexity, setQrComplexityState] = useState(QR_COMPLEXITY_DEFAULT)
  const [animationSpeed, setAnimationSpeed] = useState(ANIMATION_SPEED_DEFAULT)
  const [hasBeenActive, setHasBeenActive] = useState(active)

  if (active && !hasBeenActive) {
    setHasBeenActive(true)
  }

  const qrRef = useRef<View>(null)

  const { chunks, errorKey } = generateQrChunks(
    hasBeenActive ? psbtBase64 : undefined,
    qrComplexity
  )
  const modeChunks = chunks[displayMode]
  const isMultiPartQR = modeChunks.length > 1
  const currentChunk =
    modeChunks.length > 0 ? frameIndex % modeChunks.length : 0

  useAnimationFrameInterval(
    () => setFrameIndex((prev) => prev + 1),
    getQrAnimationIntervalMs(animationSpeed),
    active && isMultiPartQR
  )

  function setDisplayMode(mode: QRDisplayMode) {
    setDisplayModeState(mode)
    setFrameIndex(0)
  }

  function setQrComplexity(complexity: number) {
    setQrComplexityState(complexity)
    setFrameIndex(0)
  }

  function getQRValue() {
    const value = modeChunks[currentChunk]
    if (!value) {
      return QR_VALUE_NO_DATA
    }
    return value.length > QR_MAX_DATA_SIZE ? QR_VALUE_TOO_LARGE : value
  }

  // Max density asks for one static QR; the data was too large for one.
  const showMaxDensityNote = qrComplexity === QR_COMPLEXITY_MAX && isMultiPartQR
  // A format can fail to encode on its own (e.g. BBQR) while others work.
  const qrErrorKey =
    errorKey ?? (modeChunks.length === 0 ? 'error.qr.generation' : null)

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

  function getDisplayModeDescription(): Message {
    if (modeChunks.length === 0) {
      return { key: 'error.psbt.notAvailable' }
    }
    if (isMultiPartQR) {
      return {
        key: 'transaction.preview.scanAllChunks',
        params: { current: currentChunk + 1, total: modeChunks.length }
      }
    }
    if (qrComplexity !== QR_COMPLEXITY_MAX) {
      return { key: 'transaction.preview.singleChunk' }
    }
    return { key: STATIC_QR_DESCRIPTION_KEYS[displayMode] }
  }

  return {
    animationSpeed,
    decreaseComplexity,
    decreaseSpeed,
    displayMode,
    getDisplayModeDescription,
    getQRValue,
    increaseComplexity,
    increaseSpeed,
    isMultiPartQR,
    qrComplexity,
    qrErrorKey,
    qrRef,
    setDisplayMode,
    showMaxDensityNote
  }
}
