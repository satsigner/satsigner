import { getDecodedToken } from '@cashu/cashu-ts'
import {
  type BarcodeScanningResult,
  CameraView,
  useCameraPermissions
} from 'expo-camera'
import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { decodeBBQRChunks, isBBQRFragment } from '@/utils/bbqr'
import {
  type ContentContext,
  detectContentByContext,
  type DetectedContent
} from '@/utils/contentDetector'
import { detectAndDecodeSeedQR } from '@/utils/seedqr'
import {
  createURStreamDecoder,
  decodeURGeneric,
  decodeURToPSBT,
  type URStreamDecoder
} from '@/utils/ur'

type SSCameraModalProps = {
  visible: boolean
  onClose: () => void
  onContentScanned: (content: DetectedContent) => void
  context: ContentContext
  title?: string
}

type MultiPartType = 'raw' | 'bbqr' | 'ur'

type ProgressUI = {
  type: MultiPartType | null
  total: number
  received: number
  scannedIndices: number[]
  urExpected: number
}

type RawState = {
  type: 'raw' | 'bbqr'
  total: number
  chunks: Map<number, string>
  scanned: Set<number>
}

type QRInfo =
  | { type: 'raw' | 'bbqr'; content: string; current: number; total: number }
  | { type: 'ur'; content: string }
  | { type: 'single'; content: string }

const INITIAL_PROGRESS: ProgressUI = {
  received: 0,
  scannedIndices: [],
  total: 0,
  type: null,
  urExpected: 0
}

function detectQRType(data: string): QRInfo {
  const rawMatch = data.match(/^p(\d+)of(\d+)\s/i)
  if (rawMatch) {
    return {
      content: data.substring(rawMatch[0].length),
      current: parseInt(rawMatch[1], 10) - 1,
      total: parseInt(rawMatch[2], 10),
      type: 'raw'
    }
  }

  if (isBBQRFragment(data)) {
    const total = parseInt(data.slice(4, 6), 36)
    const current = parseInt(data.slice(6, 8), 36)
    return {
      content: data,
      current,
      total,
      type: 'bbqr'
    }
  }

  if (data.toLowerCase().startsWith('ur:')) {
    return { content: data, type: 'ur' }
  }

  return { content: data, type: 'single' }
}

function assembleRawMultiPart(
  type: 'raw' | 'bbqr',
  chunks: Map<number, string>,
  context: SSCameraModalProps['context']
): string | null {
  const sortedChunks = Array.from(chunks.entries())
    .toSorted(([a], [b]) => a - b)
    .map(([, content]) => content)

  if (type === 'raw') {
    const assembled = sortedChunks.join('')
    // p1ofN-style payloads for ecash/lightning/nostr are plain text joins
    // (e.g. Cashu token, BOLT11). Base64→hex is for bitcoin PSBT splits only.
    if (context !== 'bitcoin') {
      return assembled
    }
    try {
      return Buffer.from(assembled, 'base64').toString('hex')
    } catch {
      return assembled
    }
  }

  // bbqr
  try {
    const decoded = decodeBBQRChunks(sortedChunks)
    if (decoded) {
      return Buffer.from(decoded).toString('hex')
    }
  } catch {
    /* fallthrough */
  }
  return null
}

function decodeSingleUR(content: string): string | null {
  try {
    return decodeURGeneric(content)
  } catch {
    try {
      return decodeURToPSBT(content)
    } catch {
      return null
    }
  }
}

function SSCameraModal({
  visible,
  onClose,
  onContentScanned,
  context,
  title
}: SSCameraModalProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [progress, setProgress] = useState<ProgressUI>(INITIAL_PROGRESS)

  // Refs hold the hot-path scanner state so the async barcode handler can
  // read current values without being re-created on every setState. This is
  // the core fix for "Maximum update depth exceeded" under rapid frame
  // callbacks from CameraView.
  const rawStateRef = useRef<RawState | null>(null)
  const urDecoderRef = useRef<URStreamDecoder | null>(null)
  const processingRef = useRef(false)
  const lastDataRef = useRef<string | null>(null)
  const warnedPartialCashuRef = useRef(false)
  const finishedRef = useRef(false)

  // Mirror parent-provided callbacks into refs so the scan handlers never
  // depend on the callback identities. Parents typically pass inline arrows
  // (e.g. `onClose={() => setVisible(false)}`), which change on every render.
  // Without this indirection, every parent render would cascade into a brand
  // new `onBarcodeScanned` closure, re-register the native camera listener,
  // and — combined with the rapid frame rate — can push React into the
  // "Maximum update depth exceeded" guard. Keeping the refs stable lets us
  // build the scan pipeline once with an empty dep array.
  const contextRef = useRef(context)
  const onCloseRef = useRef(onClose)
  const onContentScannedRef = useRef(onContentScanned)

  useEffect(() => {
    contextRef.current = context
    onCloseRef.current = onClose
    onContentScannedRef.current = onContentScanned
  }, [context, onClose, onContentScanned])

  const resetScanState = useCallback(() => {
    rawStateRef.current = null
    if (urDecoderRef.current) {
      urDecoderRef.current.reset()
      urDecoderRef.current = null
    }
    processingRef.current = false
    lastDataRef.current = null
    warnedPartialCashuRef.current = false
    finishedRef.current = false
    setProgress(INITIAL_PROGRESS)
  }, [])

  const finalizeWithContent = useCallback(async (assembled: string) => {
    finishedRef.current = true
    const detected = await detectContentByContext(assembled, contextRef.current)
    onCloseRef.current()
    rawStateRef.current = null
    if (urDecoderRef.current) {
      urDecoderRef.current.reset()
      urDecoderRef.current = null
    }
    processingRef.current = false
    lastDataRef.current = null
    warnedPartialCashuRef.current = false
    setProgress(INITIAL_PROGRESS)
    if (!detected.isValid) {
      setTimeout(() => {
        toast.error(t('camera.error.invalidContent'))
      }, 100)
      return
    }
    onContentScannedRef.current(detected)
  }, [])

  const handleSinglePayload = useCallback(
    async (data: string) => {
      let finalContent = data

      try {
        if (isBBQRFragment(data)) {
          const decoded = decodeBBQRChunks([data])
          if (decoded) {
            finalContent = Buffer.from(decoded).toString('hex')
          } else {
            toast.error(t('camera.error.bbqrDecodeFailed'))
            return
          }
        } else if (data.startsWith('cHNidP')) {
          finalContent = Buffer.from(data, 'base64').toString('hex')
        } else if (data.toLowerCase().startsWith('ur:')) {
          const decoded = decodeSingleUR(data)
          if (decoded) {
            finalContent = decoded
          } else {
            toast.error(t('camera.error.urDecodeFailed'))
            return
          }
        } else {
          const decodedMnemonic = detectAndDecodeSeedQR(data)
          if (decodedMnemonic) {
            finishedRef.current = true
            onContentScannedRef.current({
              cleaned: data,
              isValid: true,
              metadata: { mnemonic: decodedMnemonic },
              raw: data,
              type: 'seed_qr'
            })
            onCloseRef.current()
            resetScanState()
            return
          }
        }
      } catch {
        toast.error(t('camera.error.processFailed'))
        return
      }

      await finalizeWithContent(finalContent)
    },
    [finalizeWithContent, resetScanState]
  )

  const warnPartialCashu = useCallback(() => {
    if (warnedPartialCashuRef.current) {
      return
    }
    warnedPartialCashuRef.current = true
    setTimeout(() => {
      toast.error(t('camera.error.partialCashuChunk'))
    }, 100)
  }, [])

  const isPartialCashuChunk = useCallback((data: string) => {
    const trimmed = data.trim()
    if (!/^cashu[AB]/i.test(trimmed)) {
      return false
    }
    // Length alone is ambiguous: small Cashu V4 (`cashuB...`) tokens with
    // few proofs can be under 300 chars, so a static QR of a valid token
    // would be wrongly rejected. Instead, ask the library to decode it —
    // if it parses into a complete token it's a real single QR; if decoding
    // throws, it's a raw slice from the legacy animated sender.
    try {
      const decoded = getDecodedToken(trimmed)
      if (decoded?.proofs && decoded.proofs.length > 0) {
        return false
      }
    } catch {
      return true
    }
    return true
  }, [])

  const handleURPart = useCallback(
    async (fragment: string) => {
      if (!urDecoderRef.current) {
        urDecoderRef.current = createURStreamDecoder()
        rawStateRef.current = null
      }
      const decoder = urDecoderRef.current
      decoder.receivePart(fragment)

      if (decoder.isComplete()) {
        const result = decoder.result()
        if (result) {
          await finalizeWithContent(result)
          return
        }
      }

      // Update UI progress; coerce into discrete integer counts to avoid
      // spurious re-renders on identical values.
      const received = decoder.receivedPartCount()
      const expected = decoder.expectedPartCount()
      setProgress((prev) => {
        if (
          prev.type === 'ur' &&
          prev.received === received &&
          prev.urExpected === expected
        ) {
          return prev
        }
        return {
          received,
          scannedIndices: [],
          total: expected,
          type: 'ur',
          urExpected: expected
        }
      })
    },
    [finalizeWithContent]
  )

  const handleRawOrBBQRPart = useCallback(
    async (
      type: 'raw' | 'bbqr',
      content: string,
      current: number,
      total: number
    ) => {
      // If a different multi-part type was previously in progress, reset.
      if (urDecoderRef.current) {
        urDecoderRef.current.reset()
        urDecoderRef.current = null
      }

      const state = rawStateRef.current
      if (!state || state.type !== type || state.total !== total) {
        rawStateRef.current = {
          chunks: new Map([[current, content]]),
          scanned: new Set([current]),
          total,
          type
        }
        setProgress((prev) => {
          if (
            prev.type === type &&
            prev.total === total &&
            prev.received === 1 &&
            prev.scannedIndices.length === 1 &&
            prev.scannedIndices[0] === current
          ) {
            return prev
          }
          return {
            received: 1,
            scannedIndices: [current],
            total,
            type,
            urExpected: 0
          }
        })
        return
      }

      if (state.scanned.has(current)) {
        return
      }

      state.scanned.add(current)
      state.chunks.set(current, content)
      const scannedIndices = Array.from(state.scanned)
      const receivedCount = state.scanned.size
      setProgress((prev) => {
        if (
          prev.type === type &&
          prev.total === total &&
          prev.received === receivedCount
        ) {
          return prev
        }
        return {
          received: receivedCount,
          scannedIndices,
          total,
          type,
          urExpected: 0
        }
      })

      if (state.scanned.size !== total) {
        return
      }

      const assembled = assembleRawMultiPart(
        type,
        state.chunks,
        contextRef.current
      )
      if (!assembled) {
        toast.error(t('camera.error.assembleFailed'))
        resetScanState()
        return
      }
      await finalizeWithContent(assembled)
    },
    [finalizeWithContent, resetScanState]
  )

  const handleQRCodeScanned = useCallback(
    async (data: string) => {
      if (!data) {
        return
      }
      if (finishedRef.current) {
        return
      }
      // Dedupe identical consecutive frames (animated senders emit the same
      // frame for ~500 ms, which is 15+ camera frames).
      if (data === lastDataRef.current) {
        return
      }
      if (processingRef.current) {
        return
      }
      processingRef.current = true
      lastDataRef.current = data

      try {
        const qrInfo = detectQRType(data)

        if (qrInfo.type === 'ur') {
          await handleURPart(qrInfo.content)
          return
        }

        if (qrInfo.type === 'raw' || qrInfo.type === 'bbqr') {
          if (qrInfo.total <= 1) {
            await handleSinglePayload(qrInfo.content)
            return
          }
          await handleRawOrBBQRPart(
            qrInfo.type,
            qrInfo.content,
            qrInfo.current,
            qrInfo.total
          )
          return
        }

        // Single, unenveloped QR. Detect legacy animated-ecash raw slices
        // and show a one-shot warning instead of spamming toasts on every
        // animation frame (which also contributed to the update-depth bug).
        if (isPartialCashuChunk(qrInfo.content)) {
          warnPartialCashu()
          return
        }

        await handleSinglePayload(qrInfo.content)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
      } finally {
        processingRef.current = false
      }
    },
    [
      handleRawOrBBQRPart,
      handleSinglePayload,
      handleURPart,
      isPartialCashuChunk,
      warnPartialCashu
    ]
  )

  // The scan entry point reads from a ref so `CameraView` sees the same
  // function reference across every render. Even if `handleQRCodeScanned`
  // changes identity, native listener registration is stable.
  const handleQRCodeScannedRef = useRef(handleQRCodeScanned)
  useEffect(() => {
    handleQRCodeScannedRef.current = handleQRCodeScanned
  }, [handleQRCodeScanned])

  const onBarcodeScanned = useCallback((res: BarcodeScanningResult) => {
    // expo-camera's `raw` field is only populated for certain barcode formats
    // and is frequently undefined for plain QR codes; `data` is the reliable
    // field for the decoded payload. Fall back to `raw` only as a last resort.
    const payload = res?.data ?? res?.raw
    if (!payload) {
      return
    }
    void handleQRCodeScannedRef.current(payload)
  }, [])

  useEffect(() => {
    if (!visible) {
      resetScanState()
    }
  }, [visible, resetScanState])

  const progressType = progress.type
  const progressReceived = progress.received
  const progressTotal = progress.total

  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack itemsCenter gap="md">
        <SSText color="muted" uppercase>
          {title ||
            (progressType
              ? `Scanning ${progressType.toUpperCase()} QR Code`
              : t('transaction.build.options.importOutputs.qrcode'))}
        </SSText>

        <CameraView
          onBarcodeScanned={onBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          style={{ height: 400, width: 400 }}
        />
        {progressType && (
          <SSVStack itemsCenter gap="xs" style={{ marginBottom: 10 }}>
            {progressType === 'ur' ? (
              <>
                <SSText color="white" center>
                  {progress.urExpected > 0
                    ? `UR fountain encoding: ${progressReceived}/${progress.urExpected} fragments`
                    : `UR fountain encoding: ${progressReceived} fragments`}
                </SSText>
                <View
                  style={{
                    backgroundColor: Colors.gray[700],
                    borderRadius: 2,
                    height: 4,
                    width: 300
                  }}
                >
                  <View
                    style={{
                      backgroundColor: Colors.white,
                      borderRadius: 2,
                      height: 4,
                      maxWidth: 300,
                      width:
                        progress.urExpected > 0
                          ? Math.min(
                              300,
                              (progressReceived / progress.urExpected) * 300
                            )
                          : 0
                    }}
                  />
                </View>
              </>
            ) : (
              <>
                <SSText color="white" center>
                  {`${t('common.progress')}: ${progressReceived}/${progressTotal} chunks`}
                </SSText>
                <View
                  style={{
                    backgroundColor: Colors.gray[700],
                    borderRadius: 2,
                    height: 4,
                    width: 300
                  }}
                >
                  <View
                    style={{
                      backgroundColor: Colors.white,
                      borderRadius: 2,
                      height: 4,
                      maxWidth: 300,
                      width:
                        progressTotal > 0
                          ? Math.min(
                              300,
                              (progressReceived / progressTotal) * 300
                            )
                          : 0
                    }}
                  />
                </View>
                <SSText color="muted" size="sm" center>
                  {`Scanned parts: ${progress.scannedIndices
                    .toSorted((a, b) => a - b)
                    .map((n) => n + 1)
                    .join(', ')}`}
                </SSText>
              </>
            )}
          </SSVStack>
        )}
        <SSVStack>
          {!permission?.granted && (
            <SSButton
              label={t('camera.enableCameraAccess')}
              onPress={requestPermission}
            />
          )}
        </SSVStack>
        {progressType && (
          <SSButton
            label={t('qrcode.scan.reset')}
            variant="outline"
            onPress={resetScanState}
            style={{ marginTop: 10, width: 200 }}
          />
        )}
      </SSVStack>
    </SSModal>
  )
}

export default SSCameraModal
