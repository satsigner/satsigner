import { CameraView, useCameraPermissions } from 'expo-camera/next'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { decodeBBQRChunks, isBBQRFragment } from '@/utils/bbqr'
import { type DetectedContent } from '@/utils/contentDetector'
import { detectAndDecodeSeedQR } from '@/utils/seedqr'
import { decodeMultiPartURToPSBT, decodeURToPSBT } from '@/utils/ur'

type SSCameraModalProps = {
  visible: boolean
  onClose: () => void
  onContentScanned: (content: DetectedContent) => void
  context: 'bitcoin' | 'lightning' | 'ecash'
  title?: string
}

type ScanProgress = {
  type: 'raw' | 'ur' | 'bbqr' | null
  total: number
  scanned: Set<number>
  chunks: Map<number, string>
}

/**
 * Detect QR code type and extract metadata
 */
function detectQRType(data: string) {
  // Check for RAW format (pXofY header)
  if (/^p\d+of\d+\s/.test(data)) {
    const match = data.match(/^p(\d+)of(\d+)\s/)
    if (match) {
      return {
        type: 'raw' as const,
        current: parseInt(match[1], 10) - 1, // Convert to 0-based index
        total: parseInt(match[2], 10),
        content: data.substring(match[0].length)
      }
    }
  }

  // Check for BBQR format
  if (isBBQRFragment(data)) {
    const total = parseInt(data.slice(4, 6), 36)
    const current = parseInt(data.slice(6, 8), 36)
    return {
      type: 'bbqr' as const,
      current,
      total,
      content: data
    }
  }

  // Check for UR format
  if (data.toLowerCase().startsWith('ur:crypto-psbt/')) {
    const urMatch = data.match(/^ur:crypto-psbt\/(?:(\d+)-(\d+)\/)?(.+)$/i)
    if (urMatch) {
      const [, currentStr, totalStr] = urMatch

      if (currentStr && totalStr) {
        // Multi-part UR
        const current = parseInt(currentStr, 10) - 1 // Convert to 0-based index
        const total = parseInt(totalStr, 10)
        return {
          type: 'ur' as const,
          current,
          total,
          content: data
        }
      } else {
        // Single-part UR
        return {
          type: 'ur' as const,
          current: 0,
          total: 1,
          content: data
        }
      }
    }
  }

  // Single QR code (no multi-part format detected)
  return {
    type: 'single' as const,
    current: 0,
    total: 1,
    content: data
  }
}

/**
 * Assemble multi-part QR data
 */
function assembleMultiPartQR(
  type: 'raw' | 'ur' | 'bbqr',
  chunks: Map<number, string>
): string | null {
  try {
    switch (type) {
      case 'raw': {
        // Assemble RAW format chunks
        const sortedChunks = Array.from(chunks.entries())
          .sort(([a], [b]) => a - b)
          .map(([, content]) => content)
        const assembled = sortedChunks.join('')

        // Convert base64 to hex for RAW format
        try {
          const hexResult = Buffer.from(assembled, 'base64').toString('hex')
          return hexResult
        } catch {
          return assembled
        }
      }

      case 'bbqr': {
        // Assemble BBQR format chunks
        const sortedChunks = Array.from(chunks.entries())
          .sort(([a], [b]) => a - b)
          .map(([, content]) => content)

        const decoded = decodeBBQRChunks(sortedChunks)

        if (decoded) {
          // Convert binary PSBT to hex for consistency with RAW format
          const hexResult = Buffer.from(decoded).toString('hex')
          return hexResult
        }

        return null
      }

      case 'ur': {
        // UR format assembly using proper UR decoder
        const sortedChunks = Array.from(chunks.entries())
          .sort(([a], [b]) => a - b)
          .map(([, content]) => content)

        let result: string
        if (sortedChunks.length === 1) {
          // Single UR chunk
          result = decodeURToPSBT(sortedChunks[0])
        } else {
          // Multi-part UR
          try {
            result = decodeMultiPartURToPSBT(sortedChunks)
          } catch {
            return null
          }
        }

        return result
      }

      default:
        return null
    }
  } catch (error) {
    toast.error(String(error))
    return null
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
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    type: null,
    total: 0,
    scanned: new Set(),
    chunks: new Map()
  })

  const resetScanProgress = useCallback(() => {
    setScanProgress({
      type: null,
      total: 0,
      scanned: new Set(),
      chunks: new Map()
    })
  }, [])

  const handleQRCodeScanned = useCallback(
    (data: string) => {
      if (!data) {
        toast.error(t('camera.error.scanFailed'))
        return
      }

      // Detect QR code type and format
      const qrInfo = detectQRType(data)

      // Handle single QR codes (complete data in one scan)
      if (qrInfo.type === 'single' || qrInfo.total === 1) {
        let finalContent = qrInfo.content

        try {
          // Check if it's a single BBQR QR code
          if (isBBQRFragment(qrInfo.content)) {
            const decoded = decodeBBQRChunks([qrInfo.content])
            if (decoded) {
              // Convert binary PSBT to hex for consistency
              const hexResult = Buffer.from(decoded).toString('hex')
              finalContent = hexResult
            } else {
              toast.error(t('camera.error.bbqrDecodeFailed'))
              return
            }
          }
          // Check if it looks like base64 PSBT (starts with cHNidP)
          else if (qrInfo.content.startsWith('cHNidP')) {
            const hexResult = Buffer.from(qrInfo.content, 'base64').toString(
              'hex'
            )
            finalContent = hexResult
          }
          // Check if it's a single UR QR code
          else if (qrInfo.content.toLowerCase().startsWith('ur:crypto-psbt/')) {
            const decoded = decodeURToPSBT(qrInfo.content)
            if (decoded) {
              finalContent = decoded
            } else {
              toast.error(t('camera.error.urDecodeFailed'))
              return
            }
          }
          // Check if it's a seed QR code
          else {
            const decodedMnemonic = detectAndDecodeSeedQR(qrInfo.content)
            if (decodedMnemonic) {
              // For seed QR codes, we'll pass the mnemonic as metadata
              onContentScanned({
                type: 'seed_qr',
                raw: data,
                cleaned: qrInfo.content,
                metadata: { mnemonic: decodedMnemonic },
                isValid: true
              })
              onClose()
              resetScanProgress()
              return
            }
          }
        } catch {
          toast.error(t('camera.error.processFailed'))
        }

        // Process the content using the content detector
        import('@/utils/contentDetector').then(({ detectContentByContext }) => {
          const detectedContent = detectContentByContext(finalContent, context)
          onContentScanned(detectedContent)
          onClose()
          resetScanProgress()
          toast.success('QR code scanned successfully')
        })

        return
      }

      // Handle multi-part QR codes
      const { type, current, total, content } = qrInfo

      // Check if this is the start of a new scan session or continuation
      if (
        scanProgress.type === null ||
        scanProgress.type !== type ||
        scanProgress.total !== total
      ) {
        // Start new scan session
        const newScanned = new Set([current])
        const newChunks = new Map([[current, content]])

        setScanProgress({
          type,
          total,
          scanned: newScanned,
          chunks: newChunks
        })

        return
      }

      // Continue existing scan session
      if (scanProgress.scanned.has(current)) {
        toast.info(`Part ${current + 1} already scanned`)
        return
      }

      // Add new chunk
      const newScanned = new Set(scanProgress.scanned).add(current)
      const newChunks = new Map(scanProgress.chunks).set(current, content)

      setScanProgress({
        type,
        total,
        scanned: newScanned,
        chunks: newChunks
      })

      // For UR format, use fountain encoding logic
      if (type === 'ur') {
        // For fountain encoding, we need to find the highest fragment number to determine the actual range
        const maxFragmentNumber = Math.max(...Array.from(newScanned))
        const actualTotal = maxFragmentNumber + 1 // Convert from 0-based to 1-based

        // For fountain encoding, try assembly after collecting enough fragments
        const conservativeTarget = Math.ceil(actualTotal * 1.1)
        const theoreticalTarget = Math.ceil(total * 1.5)
        const assemblyTarget = Math.min(conservativeTarget, theoreticalTarget)

        // Also try assembly if we have most of the available fragments (80% of actual range)
        const fallbackTarget = Math.ceil(actualTotal * 0.8)
        const shouldTryAssembly =
          newScanned.size >= assemblyTarget || newScanned.size >= fallbackTarget

        if (shouldTryAssembly) {
          const assembledData = assembleMultiPartQR(type, newChunks)

          if (assembledData) {
            // Process the assembled data using content detector
            import('@/utils/contentDetector').then(
              ({ detectContentByContext }) => {
                const detectedContent = detectContentByContext(
                  assembledData,
                  context
                )
                onContentScanned(detectedContent)
                onClose()
                resetScanProgress()

                if (
                  assembledData.toLowerCase().startsWith('70736274ff') ||
                  assembledData.startsWith('cHNidP')
                ) {
                  toast.success(
                    `PSBT assembled successfully (${newScanned.size} fragments). Note: PSBT may need additional signatures to finalize.`
                  )
                } else {
                  toast.success(
                    `Successfully assembled final transaction from ${newScanned.size} fragments`
                  )
                }
              }
            )
            return
          }
        }

        // Continue scanning for fountain encoding
        const targetForDisplay = Math.min(
          Math.ceil(actualTotal * 1.1),
          Math.ceil(total * 1.5)
        )
        toast.success(
          `UR: Collected ${newScanned.size} fragments (need ~${targetForDisplay})`
        )
      } else {
        // For RAW and BBQR, wait for all chunks as before
        if (newScanned.size === total) {
          // All chunks collected, assemble the final result
          const assembledData = assembleMultiPartQR(type, newChunks)

          if (assembledData) {
            // Process the assembled data using content detector
            import('@/utils/contentDetector').then(
              ({ detectContentByContext }) => {
                const detectedContent = detectContentByContext(
                  assembledData,
                  context
                )
                onContentScanned(detectedContent)
                onClose()
                resetScanProgress()

                if (
                  assembledData.toLowerCase().startsWith('70736274ff') ||
                  assembledData.startsWith('cHNidP')
                ) {
                  toast.success(
                    `PSBT assembled successfully (${total} parts). Note: PSBT may need additional signatures to finalize.`
                  )
                } else {
                  toast.success(
                    `Successfully assembled final transaction from ${total} parts`
                  )
                }
              }
            )
          } else {
            toast.error(t('camera.error.assembleFailed'))
            resetScanProgress()
          }
        } else {
          toast.success(
            `Scanned part ${current + 1} of ${total} (${
              newScanned.size
            }/${total} complete)`
          )
        }
      }
    },
    [context, onContentScanned, onClose, resetScanProgress, scanProgress]
  )

  // Reset scan progress when modal closes
  useEffect(() => {
    if (!visible) {
      resetScanProgress()
    }
  }, [visible, resetScanProgress])

  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack itemsCenter gap="md">
        <SSText color="muted" uppercase>
          {title ||
            (scanProgress.type
              ? `Scanning ${scanProgress.type.toUpperCase()} QR Code`
              : t('camera.scanQRCode'))}
        </SSText>

        <CameraView
          onBarcodeScanned={(res) => {
            if (res.raw) {
              handleQRCodeScanned(res.raw)
            }
          }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          style={{ width: 340, height: 340 }}
        />

        {/* Show progress if scanning multi-part QR */}
        {scanProgress.type && scanProgress.total > 1 && (
          <SSVStack itemsCenter gap="xs" style={{ marginBottom: 10 }}>
            {scanProgress.type === 'ur' ? (
              // For UR fountain encoding, show the actual target
              <>
                {(() => {
                  const maxFragment = Math.max(
                    ...Array.from(scanProgress.scanned)
                  )
                  const actualTotal = maxFragment + 1
                  const conservativeTarget = Math.ceil(actualTotal * 1.1)
                  const theoreticalTarget = Math.ceil(scanProgress.total * 1.5)
                  const displayTarget = Math.min(
                    conservativeTarget,
                    theoreticalTarget
                  )

                  return (
                    <>
                      <SSText color="white" center>
                        {`UR fountain encoding: ${scanProgress.scanned.size}/${displayTarget} fragments`}
                      </SSText>
                      <View
                        style={{
                          width: 300,
                          height: 4,
                          backgroundColor: Colors.gray[700],
                          borderRadius: 2
                        }}
                      >
                        <View
                          style={{
                            width:
                              (scanProgress.scanned.size / displayTarget) * 300,
                            height: 4,
                            maxWidth: 300,
                            backgroundColor: Colors.white,
                            borderRadius: 2
                          }}
                        />
                      </View>
                    </>
                  )
                })()}
              </>
            ) : (
              // For RAW and BBQR, show normal progress
              <>
                <SSText color="white" center>
                  {`${t('common.progress')}: ${scanProgress.scanned.size}/${
                    scanProgress.total
                  } chunks`}
                </SSText>
                <View
                  style={{
                    width: 300,
                    height: 4,
                    backgroundColor: Colors.gray[700],
                    borderRadius: 2
                  }}
                >
                  <View
                    style={{
                      width:
                        (scanProgress.scanned.size / scanProgress.total) * 300,
                      height: 4,
                      maxWidth: scanProgress.total * 300,
                      backgroundColor: Colors.white,
                      borderRadius: 2
                    }}
                  />
                </View>
                <SSText color="muted" size="sm" center>
                  {`Scanned parts: ${Array.from(scanProgress.scanned)
                    .sort((a, b) => a - b)
                    .map((n) => n + 1)
                    .join(', ')}`}
                </SSText>
              </>
            )}
          </SSVStack>
        )}

        {!permission?.granted && (
          <SSButton
            label={t('camera.enableCameraAccess')}
            onPress={requestPermission}
          />
        )}

        {/* Reset button for multi-part scans */}
        {scanProgress.type && (
          <SSButton
            label={t('camera.button.resetScan')}
            variant="outline"
            onPress={resetScanProgress}
            style={{ marginTop: 10, width: 200 }}
          />
        )}
      </SSVStack>
    </SSModal>
  )
}

export default SSCameraModal
