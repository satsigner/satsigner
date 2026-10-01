import { useEffect, useRef, useState } from 'react'
import { type View } from 'react-native'

import {
  ANIMATION_SPEED_DEFAULT,
  QR_COMPLEXITY_DEFAULT,
  QR_COMPLEXITY_MAX,
  QR_MAX_DATA_SIZE,
  QRDisplayMode
} from '@/constants/qr'
import { t } from '@/locales'
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
 * cycling speed (`animationSpeed`) are user adjustable.
 */
export function usePsbtQrExport(psbtBase64: string | undefined) {
  const [displayMode, setDisplayModeState] = useState(QRDisplayMode.RAW)
  const [currentChunk, setCurrentChunk] = useState(0)
  const [chunks, setChunks] = useState<QrChunks>(EMPTY_CHUNKS)
  const [qrError, setQrError] = useState<string | null>(null)
  const [qrComplexity, setQrComplexity] = useState(QR_COMPLEXITY_DEFAULT)
  const [animationSpeed, setAnimationSpeed] = useState(ANIMATION_SPEED_DEFAULT)

  const qrRef = useRef<View>(null)

  const modeChunks = chunks[displayMode]
  const isMultiPartQR = modeChunks.length > 1

  useEffect(() => {
    if (!psbtBase64) {
      setQrError(t('error.psbt.notAvailable'))
      setChunks(EMPTY_CHUNKS)
      return
    }
    try {
      setChunks(createQrChunks(psbtBase64, qrComplexity))
      setCurrentChunk(0)
      setQrError(null)
    } catch {
      setQrError(t('error.qr.generation'))
      setChunks(EMPTY_CHUNKS)
    }
  }, [psbtBase64, qrComplexity])

  useEffect(() => {
    if (!isMultiPartQR) {
      return
    }

    const intervalMs = getQrAnimationIntervalMs(animationSpeed)
    const chunkCount = modeChunks.length
    const state = { frameId: 0, lastUpdate: 0 }

    function animate(timestamp: number) {
      if (timestamp - state.lastUpdate >= intervalMs) {
        setCurrentChunk((prev) => (prev + 1) % chunkCount)
        state.lastUpdate = timestamp
      }
      state.frameId = requestAnimationFrame(animate)
    }
    state.frameId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(state.frameId)
  }, [isMultiPartQR, modeChunks.length, animationSpeed])

  function setDisplayMode(mode: QRDisplayMode) {
    setDisplayModeState(mode)
    setCurrentChunk(0)
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

  function getDisplayModeDescription() {
    if (modeChunks.length === 0) {
      return t('error.psbt.notAvailable')
    }
    if (isMultiPartQR) {
      return t('transaction.preview.scanAllChunks', {
        current: currentChunk + 1,
        total: modeChunks.length
      })
    }
    if (qrComplexity !== QR_COMPLEXITY_MAX) {
      return t('transaction.preview.singleChunk')
    }
    return {
      [QRDisplayMode.BBQR]: t('transaction.preview.staticQrBbqr'),
      [QRDisplayMode.RAW]: t('transaction.preview.staticQrPsbt'),
      [QRDisplayMode.UR]: t('transaction.preview.staticQrUr')
    }[displayMode]
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
    qrError,
    qrRef,
    setAnimationSpeed,
    setDisplayMode,
    setQrComplexity
  }
}
