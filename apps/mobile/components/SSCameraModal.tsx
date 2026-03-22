import { CameraView, useCameraPermissions } from 'expo-camera/next'
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { decodeBBQRChunks, isBBQRFragment } from '@/utils/bbqr'
import { detectContentByContext } from '@/utils/contentDetector'
import type { DetectedContent } from '@/utils/contentDetector'
import { detectAndDecodeSeedQR } from '@/utils/seedqr'
import {
  decodeMultiPartURGeneric,
  decodeMultiPartURToPSBT,
  decodeURGeneric,
  decodeURToPSBT
} from '@/utils/ur'

interface SSCameraModalProps {
  visible: boolean
  onClose: () => void
  onContentScanned: (content: DetectedContent) => void
  context: 'bitcoin' | 'lightning' | 'ecash'
  title?: string
}

interface ScanProgress {
  type: 'raw' | 'ur' | 'bbqr' | null
  total: number
  scanned: Set<number>
  chunks: Map<number, string>
}

function detectQRType(data: string) {
  if (/^p\d+of\d+\s/.test(data)) {
    const match = data.match(/^p(\d+)of(\d+)\s/)
    if (match) {
      return {
        content: data.substring(match[0].length),
        current: Number.parseInt(match[1], 10) - 1,
        total: Number.parseInt(match[2], 10),
        type: 'raw' as const
      }
    }
  }

  if (isBBQRFragment(data)) {
    const total = Number.parseInt(data.slice(4, 6), 36)
    const current = Number.parseInt(data.slice(6, 8), 36)
    return {
      content: data,
      current,
      total,
      type: 'bbqr' as const
    }
  }

  if (data.toLowerCase().startsWith('ur:')) {
    const urMatch = data.match(/^ur:([^/]+)\/(?:(\d+)-(\d+)\/)?(.+)$/i)
    if (urMatch) {
      const [, , currentStr, totalStr] = urMatch

      if (currentStr && totalStr) {
        const current = Number.parseInt(currentStr, 10) - 1
        const total = Number.parseInt(totalStr, 10)
        return {
          content: data,
          current,
          total,
          type: 'ur' as const
        }
      }
      return {
        content: data,
        current: 0,
        total: 1,
        type: 'ur' as const
      }
    }
  }

  return {
    content: data,
    current: 0,
    total: 1,
    type: 'single' as const
  }
}

async function assembleMultiPartQR(
  type: 'raw' | 'ur' | 'bbqr',
  chunks: Map<number, string>
): Promise<string | null> {
  try {
    switch (type) {
      case 'raw': {
        const sortedChunks = [...chunks.entries()]
          .toSorted(([a], [b]) => a - b)
          .map(([, content]) => content)
        const assembled = sortedChunks.join('')

        try {
          const hexResult = Buffer.from(assembled, 'base64').toString('hex')
          return hexResult
        } catch {
          return assembled
        }
      }

      case 'bbqr': {
        const sortedChunks = [...chunks.entries()]
          .toSorted(([a], [b]) => a - b)
          .map(([, content]) => content)

        const decoded = decodeBBQRChunks(sortedChunks)

        if (decoded) {
          const hexResult = Buffer.from(decoded).toString('hex')
          return hexResult
        }

        return null
      }

      case 'ur': {
        const sortedChunks = [...chunks.entries()]
          .toSorted(([a], [b]) => a - b)
          .map(([, content]) => content)

        let result: string
        if (sortedChunks.length === 1) {
          try {
            result = decodeURGeneric(sortedChunks[0])
          } catch {
            try {
              result = decodeURToPSBT(sortedChunks[0])
            } catch {
              return null
            }
          }
        } else {
          try {
            result = decodeMultiPartURGeneric(sortedChunks)
          } catch {
            try {
              result = await decodeMultiPartURToPSBT(sortedChunks)
            } catch {
              return null
            }
          }
        }

        return result
      }

      default: {
        return null
      }
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
    chunks: new Map(),
    scanned: new Set(),
    total: 0,
    type: null
  })

  const resetScanProgress = useCallback(() => {
    setScanProgress({
      chunks: new Map(),
      scanned: new Set(),
      total: 0,
      type: null
    })
  }, [])

  const handleQRCodeScanned = useCallback(
    async (data: string) => {
      if (!data) {
        toast.error(t('camera.error.scanFailed'))
        return
      }

      const qrInfo = detectQRType(data)

      if (qrInfo.type === 'single' || qrInfo.total === 1) {
        let finalContent = qrInfo.content

        try {
          if (isBBQRFragment(qrInfo.content)) {
            const decoded = decodeBBQRChunks([qrInfo.content])
            if (decoded) {
              const hexResult = Buffer.from(decoded).toString('hex')
              finalContent = hexResult
            } else {
              toast.error(t('camera.error.bbqrDecodeFailed'))
              return
            }
          } else if (qrInfo.content.startsWith('cHNidP')) {
            const hexResult = Buffer.from(qrInfo.content, 'base64').toString(
              'hex'
            )
            finalContent = hexResult
          } else if (qrInfo.content.toLowerCase().startsWith('ur:')) {
            let decoded: string | null = null
            try {
              decoded = decodeURGeneric(qrInfo.content)
            } catch {
              try {
                decoded = decodeURToPSBT(qrInfo.content)
              } catch {
                decoded = null
              }
            }

            if (decoded) {
              finalContent = decoded
            } else {
              toast.error(t('camera.error.urDecodeFailed'))
              return
            }
          } else {
            const decodedMnemonic = detectAndDecodeSeedQR(qrInfo.content)
            if (decodedMnemonic) {
              onContentScanned({
                cleaned: qrInfo.content,
                isValid: true,
                metadata: { mnemonic: decodedMnemonic },
                raw: data,
                type: 'seed_qr'
              })
              onClose()
              resetScanProgress()
              return
            }
          }
        } catch {
          toast.error(t('camera.error.processFailed'))
        }

        const detectedContent = await detectContentByContext(
          finalContent,
          context
        )

        onClose()
        resetScanProgress()

        if (!detectedContent.isValid) {
          setTimeout(() => {
            toast.error(t('camera.error.invalidContent'))
          }, 100)
          return
        }

        onContentScanned(detectedContent)

        return
      }

      const { type, current, total, content } = qrInfo

      if (
        scanProgress.type === null ||
        scanProgress.type !== type ||
        scanProgress.total !== total
      ) {
        const newScanned = new Set([current])
        const newChunks = new Map([[current, content]])

        setScanProgress({
          chunks: newChunks,
          scanned: newScanned,
          total,
          type
        })

        return
      }

      if (scanProgress.scanned.has(current)) {
        return
      }

      const newScanned = new Set(scanProgress.scanned).add(current)
      const newChunks = new Map(scanProgress.chunks).set(current, content)

      setScanProgress({
        chunks: newChunks,
        scanned: newScanned,
        total,
        type
      })

      if (type === 'ur') {
        const maxFragmentNumber = Math.max(...newScanned)
        const actualTotal = maxFragmentNumber + 1

        const conservativeTarget = Math.ceil(actualTotal * 1.1)
        const theoreticalTarget = Math.ceil(total * 1.5)
        const assemblyTarget = Math.min(conservativeTarget, theoreticalTarget)

        const fallbackTarget = Math.ceil(actualTotal * 0.8)
        const shouldTryAssembly =
          newScanned.size >= assemblyTarget || newScanned.size >= fallbackTarget

        if (shouldTryAssembly) {
          const assembledData = await assembleMultiPartQR(type, newChunks)

          if (assembledData) {
            const detectedContent = await detectContentByContext(
              assembledData,
              context
            )

            onClose()
            resetScanProgress()

            if (!detectedContent.isValid) {
              setTimeout(() => {
                toast.error(t('camera.error.invalidContent'))
              }, 100)
              return
            }

            onContentScanned(detectedContent)

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
        }
      } else {
        if (newScanned.size === total) {
          const assembledData = await assembleMultiPartQR(type, newChunks)

          if (assembledData) {
            const detectedContent = await detectContentByContext(
              assembledData,
              context
            )

            onClose()
            resetScanProgress()

            if (!detectedContent.isValid) {
              setTimeout(() => {
                toast.error(t('camera.error.invalidContent'))
              }, 100)
              return
            }

            onContentScanned(detectedContent)

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
          } else {
            toast.error(t('camera.error.assembleFailed'))
            resetScanProgress()
          }
        }
      }
    },
    [context, onContentScanned, onClose, resetScanProgress, scanProgress]
  )

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
              : t('transaction.build.options.importOutputs.qrcode'))}
        </SSText>

        <CameraView
          onBarcodeScanned={(res) => {
            if (res.raw) {
              handleQRCodeScanned(res.raw)
            }
          }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          style={{ height: 340, width: 340 }}
        />
        {scanProgress.type && scanProgress.total > 1 && (
          <SSVStack itemsCenter gap="xs" style={{ marginBottom: 10 }}>
            {scanProgress.type === 'ur' ? (
              <>
                {(() => {
                  const maxFragment = Math.max(...scanProgress.scanned)
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
                              (scanProgress.scanned.size / displayTarget) * 300
                          }}
                        />
                      </View>
                    </>
                  )
                })()}
              </>
            ) : (
              <>
                <SSText color="white" center>
                  {`${t('common.progress')}: ${scanProgress.scanned.size}/${
                    scanProgress.total
                  } chunks`}
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
                      maxWidth: scanProgress.total * 300,
                      width:
                        (scanProgress.scanned.size / scanProgress.total) * 300
                    }}
                  />
                </View>
                <SSText color="muted" size="sm" center>
                  {`Scanned parts: ${[...scanProgress.scanned]
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
        {scanProgress.type && (
          <SSButton
            label={t('qrcode.scan.reset')}
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
