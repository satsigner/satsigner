import { useCallback, useState } from 'react'
import { toast } from 'sonner-native'

import { decodeBBQRChunks, isBBQRFragment } from '@/utils/bbqr'
import { detectAndDecodeSeedQR } from '@/utils/seedqr'
import { decodeMultiPartURToPSBT, decodeURToPSBT } from '@/utils/ur'

type QRCodeType = 'raw' | 'ur' | 'bbqr' | 'single'

type QRCodeInfo = {
  type: QRCodeType
  current: number
  total: number
  content: string
}

type ScanProgress = {
  type: QRCodeType | null
  total: number
  scanned: Set<number>
  chunks: Map<number, string>
}

type UseQRCodeHandlerParams = {
  onSingleQRScanned?: (content: string) => void
  onMultiPartQRScanned?: (content: string) => void
  onSeedQRScanned?: (mnemonic: string) => void
  onError?: (error: string) => void
  onSuccess?: (message: string) => void
  showToast?: boolean
}

type UseQRCodeHandlerReturn = {
  scanProgress: ScanProgress
  handleQRCodeScanned: (
    data: string | undefined,
    index?: number
  ) => Promise<void>
  resetScanProgress: () => void
  detectQRType: (data: string) => QRCodeInfo
  assembleMultiPartQR: (
    type: QRCodeType,
    chunks: Map<number, string>
  ) => Promise<string | null>
}

export function useQRCodeHandler({
  onSingleQRScanned,
  onMultiPartQRScanned,
  onSeedQRScanned,
  onError,
  onSuccess,
  showToast = true
}: UseQRCodeHandlerParams = {}): UseQRCodeHandlerReturn {
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    type: null,
    total: 0,
    scanned: new Set(),
    chunks: new Map()
  })

  const detectQRType = useCallback((data: string): QRCodeInfo => {
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
      // UR format: ur:crypto-psbt/[sequence]/[data] for multi-part
      // or ur:crypto-psbt/[data] for single part
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
  }, [])

  const assembleMultiPartQR = useCallback(
    async (
      type: QRCodeType,
      chunks: Map<number, string>
    ): Promise<string | null> => {
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
            } catch (_error) {
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
                result = await decodeMultiPartURToPSBT(sortedChunks)
              } catch {
                return null
              }
            }

            if (!result) {
              return null
            }

            return result
          }

          default:
            return null
        }
      } catch (error) {
        if (showToast) {
          toast.error(String(error))
        }
        onError?.(String(error))
        return null
      }
    },
    [showToast, onError]
  )

  const resetScanProgress = useCallback(() => {
    setScanProgress({
      type: null,
      total: 0,
      scanned: new Set(),
      chunks: new Map()
    })
  }, [])

  const handleQRCodeScanned = useCallback(
    async (data: string | undefined, index?: number) => {
      if (!data) {
        const errorMessage = 'Failed to scan QR code'
        if (showToast) {
          toast.error(errorMessage)
        }
        onError?.(errorMessage)
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
              const errorMessage = 'Failed to decode BBQR QR code'
              if (showToast) {
                toast.error(errorMessage)
              }
              onError?.(errorMessage)
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
              const errorMessage = 'Failed to decode UR QR code'
              if (showToast) {
                toast.error(errorMessage)
              }
              onError?.(errorMessage)
              return
            }
          }
          // Check if it's a seed QR code (for dropped seeds)
          else if (index !== undefined && onSeedQRScanned) {
            const decodedMnemonic = detectAndDecodeSeedQR(qrInfo.content)
            if (decodedMnemonic) {
              onSeedQRScanned(decodedMnemonic)
              return
            }
          }
        } catch (_error) {
          // Keep original content if conversion fails
        }

        // Call the single QR handler
        onSingleQRScanned?.(finalContent)

        if (showToast) {
          toast.success('QR code scanned successfully')
        }
        onSuccess?.('QR code scanned successfully')
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
        if (showToast) {
          toast.info(`Part ${current + 1} already scanned`)
        }
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
        // Be more aggressive - try when we have enough fragments to potentially succeed
        // Use either 1.1x the actual range or the theoretical minimum, whichever is lower
        const conservativeTarget = Math.ceil(actualTotal * 1.1)
        const theoreticalTarget = Math.ceil(total * 1.5)
        const assemblyTarget = Math.min(conservativeTarget, theoreticalTarget)

        // Also try assembly if we have most of the available fragments (80% of actual range)
        const fallbackTarget = Math.ceil(actualTotal * 0.8)
        const shouldTryAssembly =
          newScanned.size >= assemblyTarget || newScanned.size >= fallbackTarget

        if (shouldTryAssembly) {
          const assembledData = await assembleMultiPartQR(type, newChunks)

          if (assembledData) {
            // Call the multi-part QR handler
            onMultiPartQRScanned?.(assembledData)

            if (showToast) {
              toast.success(
                `Successfully assembled final transaction from ${newScanned.size} fragments`
              )
            }
            onSuccess?.(
              `Successfully assembled final transaction from ${newScanned.size} fragments`
            )
            return
          }
        }

        // Continue scanning for fountain encoding
        const targetForDisplay = Math.min(
          Math.ceil(actualTotal * 1.1),
          Math.ceil(total * 1.5)
        )
        if (showToast) {
          toast.success(
            `UR: Collected ${newScanned.size} fragments (need ~${targetForDisplay})`
          )
        }
      } else {
        // For RAW and BBQR, wait for all chunks as before
        if (newScanned.size === total) {
          // All chunks collected, assemble the final result
          const assembledData = await assembleMultiPartQR(type, newChunks)

          if (assembledData) {
            // Call the multi-part QR handler
            onMultiPartQRScanned?.(assembledData)

            if (showToast) {
              toast.success(
                `Successfully assembled final transaction from ${total} parts`
              )
            }
            onSuccess?.(
              `Successfully assembled final transaction from ${total} parts`
            )
          } else {
            const errorMessage = 'Failed to assemble multi-part QR code'
            if (showToast) {
              toast.error(errorMessage)
            }
            onError?.(errorMessage)
          }
        } else {
          if (showToast) {
            toast.success(
              `Scanned part ${current + 1} of ${total} (${
                newScanned.size
              }/${total} complete)`
            )
          }
        }
      }
    },
    [
      detectQRType,
      assembleMultiPartQR,
      scanProgress,
      onSingleQRScanned,
      onMultiPartQRScanned,
      onSeedQRScanned,
      onError,
      onSuccess,
      showToast
    ]
  )

  return {
    scanProgress,
    handleQRCodeScanned,
    resetScanProgress,
    detectQRType,
    assembleMultiPartQR
  }
}
