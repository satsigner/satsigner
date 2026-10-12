import { useRef, useState } from 'react'
import { type View } from 'react-native'

import {
  ANIMATION_SPEED_DEFAULT,
  QR_COMPLEXITY_DEFAULT,
  QR_COMPLEXITY_MAX,
  QR_MAX_DATA_SIZE,
  QRDisplayMode
} from '@/constants/qr'
import { useAnimationFrameInterval } from '@/hooks/useAnimationFrameInterval'
import {
  createBbqrPsbtChunks,
  createRawQrChunks,
  createUrPsbtFragments,
  getQrAnimationIntervalMs
} from '@/utils/qrExport'

// Placeholder values shown in the QR when there is nothing valid to encode.
const QR_VALUE_NO_DATA = 'NO_DATA'
const QR_VALUE_TOO_LARGE = 'DATA_TOO_LARGE_FOR_QR'

type QrChunks = Record<QRDisplayMode, string[]>

// An i18n key plus its interpolation params, translated by the caller.
type I18nMessage = { key: string; params?: Record<string, number> }

const STATIC_QR_DESCRIPTION_KEYS: Record<QRDisplayMode, string> = {
  [QRDisplayMode.BBQR]: 'transaction.preview.staticQrBbqr',
  [QRDisplayMode.RAW]: 'transaction.preview.staticQrPsbt',
  [QRDisplayMode.UR]: 'transaction.preview.staticQrUr'
}

const EMPTY_CHUNKS: QrChunks = {
  [QRDisplayMode.BBQR]: [],
  [QRDisplayMode.RAW]: [],
  [QRDisplayMode.UR]: []
}

function createQrChunks(psbtBase64: string, complexity: number): QrChunks {
  const psbtBytes = new Uint8Array(Buffer.from(psbtBase64, 'base64'))
  const bbqrChunks = createBbqrPsbtChunksOrEmpty(psbtBytes, complexity)
  psbtBytes.fill(0)
  return {
    [QRDisplayMode.BBQR]: bbqrChunks,
    [QRDisplayMode.RAW]: createRawQrChunks(psbtBase64, complexity),
    [QRDisplayMode.UR]: createUrPsbtFragments(psbtBase64, complexity)
  }
}

// Encodes the PSBT in every format, or returns the i18n key of the error.
function generateQrChunks(psbtBase64: string | undefined, complexity: number) {
  if (!psbtBase64) {
    return { chunks: EMPTY_CHUNKS, errorKey: 'error.psbt.notAvailable' }
  }
  try {
    return { chunks: createQrChunks(psbtBase64, complexity), errorKey: null }
  } catch {
    return { chunks: EMPTY_CHUNKS, errorKey: 'error.qr.generation' }
  }
}

function createBbqrPsbtChunksOrEmpty(
  psbtBytes: Uint8Array,
  complexity: number
) {
  try {
    return createBbqrPsbtChunks(psbtBytes, complexity)
  } catch {
    return []
  }
}

/**
 * Encodes a PSBT as RAW, UR or BBQR QR frames and cycles through them when
 * the selected format needs more than one QR. Density (`qrComplexity`) and
 * cycling speed (`animationSpeed`) are user adjustable. Nothing is encoded or
 * animated while `active` is false (e.g. the export modal is closed).
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

  const qrRef = useRef<View>(null)

  const { chunks, errorKey } = generateQrChunks(
    active ? psbtBase64 : undefined,
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

  function isDataTooLargeForSingleQR() {
    return modeChunks.some((chunk) => chunk.length > QR_MAX_DATA_SIZE)
  }

  function getDisplayModeDescription(): I18nMessage {
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
    displayMode,
    getDisplayModeDescription,
    getQRValue,
    hasChunks: modeChunks.length > 0,
    isDataTooLargeForSingleQR,
    isMultiPartQR,
    qrComplexity,
    qrErrorKey: errorKey,
    qrRef,
    setAnimationSpeed,
    setDisplayMode,
    setQrComplexity
  }
}
