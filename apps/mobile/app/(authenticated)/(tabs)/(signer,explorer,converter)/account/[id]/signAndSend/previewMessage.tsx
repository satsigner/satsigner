// React and React Native imports
// External dependencies
import { type Network } from 'bdk-rn/lib/lib/enums'
import * as bitcoinjs from 'bitcoinjs-lib'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

// Internal imports
import { buildTransaction } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Typography } from '@/styles'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import {
  createBBQRChunks,
  decodeBBQRChunks,
  FileType,
  isBBQRFragment
} from '@/utils/bbqr'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { parseHexToBytes } from '@/utils/parse'
import { estimateTransactionSize } from '@/utils/transaction'
import {
  decodeMultiPartURToPSBT,
  decodeURToPSBT,
  getURFragmentsFromPSBT
} from '@/utils/ur'

const tn = _tn('transaction.build.preview')

enum QRDisplayMode {
  RAW = 'RAW',
  UR = 'UR',
  BBQR = 'BBQR'
}

function PreviewMessage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [
    inputs,
    outputs,
    fee,
    rbf,
    setTxBuilderResult,
    txBuilderResult,
    setSignedTx
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.inputs,
      state.outputs,
      state.fee,
      state.rbf,
      state.setTxBuilderResult,
      state.txBuilderResult,
      state.setSignedTx
    ])
  )
  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
  )
  const wallet = useGetAccountWallet(id!)
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const [messageId, setMessageId] = useState('')

  const [noKeyModalVisible, setNoKeyModalVisible] = useState(false)
  const [currentChunk, setCurrentChunk] = useState(0)
  const [displayMode, setDisplayMode] = useState<QRDisplayMode>(
    QRDisplayMode.RAW
  )
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [signedPsbt, setSignedPsbt] = useState('')
  const [permission, requestPermission] = useCameraPermissions()

  const { isAvailable, isReading, readNFCTag, cancelNFCScan } = useNFCReader()
  const {
    isEmitting,
    emitNFCTag,
    cancelNFCScan: cancelNFCEmitterScan
  } = useNFCEmitter()
  const [nfcModalVisible, setNfcModalVisible] = useState(false)
  const [nfcScanModalVisible, setNfcScanModalVisible] = useState(false)
  const [nfcError, setNfcError] = useState<string | null>(null)

  // Animation for NFC pulsating effect
  const nfcPulseAnim = useRef(new Animated.Value(0)).current

  const [qrChunks, setQrChunks] = useState<string[]>([])
  const [qrError, setQrError] = useState<string | null>(null)
  const [serializedPsbt, setSerializedPsbt] = useState<string>('')
  const [urChunks, setUrChunks] = useState<string[]>([])
  const [currentUrChunk, setCurrentUrChunk] = useState(0)
  const [rawPsbtChunks, setRawPsbtChunks] = useState<string[]>([])
  const [currentRawChunk, setCurrentRawChunk] = useState(0)
  const [qrComplexity, setQrComplexity] = useState(8) // 1-12 scale, 8 is default (higher = simpler/larger QR codes)
  const [animationSpeed, setAnimationSpeed] = useState(6) // 1-12 scale for animation speed

  // Animation refs to prevent unnecessary re-renders
  const animationRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)

  // Multi-part QR scanning state
  const [scanProgress, setScanProgress] = useState<{
    type: 'raw' | 'ur' | 'bbqr' | null
    total: number
    scanned: Set<number>
    chunks: Map<number, string>
  }>({
    type: null,
    total: 0,
    scanned: new Set(),
    chunks: new Map()
  })

  // Helper functions for QR code detection and parsing
  const detectQRType = (data: string) => {
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
  }

  // Function to convert PSBT hex to final transaction hex
  const convertPsbtToFinalTransaction = (psbtHex: string): string => {
    try {
      // First, try to combine with original PSBT if available
      const originalPsbtBase64 = txBuilderResult?.psbt?.base64
      if (originalPsbtBase64) {
        try {
          // Convert hex PSBT to base64 for combination
          const signedPsbtBase64 = Buffer.from(psbtHex, 'hex').toString(
            'base64'
          )

          // Combine the PSBTs using bitcoinjs-lib
          const originalPsbt = bitcoinjs.Psbt.fromBase64(originalPsbtBase64)
          const signedPsbt = bitcoinjs.Psbt.fromBase64(signedPsbtBase64)

          // Combine the PSBTs - this merges the signatures from signed PSBT with the full data from original PSBT
          const combinedPsbt = originalPsbt.combine(signedPsbt)

          // Try to finalize the combined PSBT
          try {
            combinedPsbt.finalizeAllInputs()

            // Extract the final transaction
            const tx = combinedPsbt.extractTransaction()
            const finalTxHex = tx.toHex().toUpperCase()

            return finalTxHex
          } catch (_finalizeError) {
            // If finalization fails, return the combined PSBT as base64
            const combinedBase64 = combinedPsbt.toBase64()

            return combinedBase64
          }
        } catch (_combineError) {
          // Fall back to direct PSBT processing
        }
      }

      // Fallback: try direct PSBT processing without combination
      const psbt = bitcoinjs.Psbt.fromHex(psbtHex)

      // Check if inputs are already finalized
      let needsFinalization = false
      const inputDetails = []
      for (let i = 0; i < psbt.data.inputs.length; i++) {
        const input = psbt.data.inputs[i]
        const hasFinalScriptSig = !!input.finalScriptSig
        const hasFinalScriptWitness = !!input.finalScriptWitness
        const hasWitnessScript = !!input.witnessScript
        const hasRedeemScript = !!input.redeemScript
        const hasPartialSigs = input.partialSig && input.partialSig.length > 0

        inputDetails.push({
          index: i,
          hasFinalScriptSig,
          hasFinalScriptWitness,
          hasWitnessScript,
          hasRedeemScript,
          hasPartialSigs,
          partialSigCount: input.partialSig?.length || 0
        })

        if (!hasFinalScriptSig && !hasFinalScriptWitness) {
          needsFinalization = true
        }
      }

      // Try to finalize all inputs if needed
      if (needsFinalization) {
        try {
          psbt.finalizeAllInputs()
        } catch (finalizeError) {
          // Check if this is a "No script found" error - this means the PSBT is incomplete
          if (
            finalizeError instanceof Error &&
            finalizeError.message &&
            finalizeError.message.includes('No script found')
          ) {
            // For incomplete PSBTs, return the hex as-is since we can't finalize without the missing data
            return psbtHex
          }

          // For other finalization errors, try to extract what we can
          try {
            const tx = psbt.extractTransaction()
            const finalTxHex = tx.toHex().toUpperCase()
            return finalTxHex
          } catch (_extractError) {
            return psbtHex
          }
        }
      }

      // Extract the final transaction
      try {
        const tx = psbt.extractTransaction()
        const finalTxHex = tx.toHex().toUpperCase()

        return finalTxHex
      } catch (_extractError) {
        // If extraction fails, return the PSBT hex as-is
        return psbtHex
      }
    } catch (_error) {
      // Return original PSBT hex as fallback
      return psbtHex
    }
  }

  const resetScanProgress = () => {
    setScanProgress({
      type: null,
      total: 0,
      scanned: new Set(),
      chunks: new Map()
    })
  }

  // Helper function to convert PSBT to final transaction if needed
  const processScannedData = (data: string): string => {
    try {
      // Check if data is a PSBT and convert to final transaction
      if (data.toLowerCase().startsWith('70736274ff')) {
        const convertedResult = convertPsbtToFinalTransaction(data)
        return convertedResult
      }

      return data
    } catch (_error) {
      return data
    }
  }

  const assembleMultiPartQR = (
    type: 'raw' | 'ur' | 'bbqr',
    chunks: Map<number, string>
  ): string | null => {
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
              result = decodeMultiPartURToPSBT(sortedChunks)
            } catch (_error) {
              return null
            }
          }

          if (!result) {
            return null
          }

          // Check if result is a PSBT and convert to final transaction
          if (result.toLowerCase().startsWith('70736274ff')) {
            const convertedResult = convertPsbtToFinalTransaction(result)

            // Check if conversion returned a finalized transaction, PSBT hex, or PSBT base64
            if (
              convertedResult.toLowerCase().startsWith('70736274ff') ||
              convertedResult.startsWith('cHNidP')
            ) {
              return convertedResult
            } else {
              return convertedResult
            }
          } else {
            return result
          }
        }

        default:
          return null
      }
    } catch (error) {
      toast.error(String(error))
      return null
    }
  }

  // Function to split raw PSBT into chunks for animated display
  const createRawPsbtChunks = useCallback(
    (base64Psbt: string, complexity: number): string[] => {
      // Special case: complexity 12 = single static QR with all data
      if (complexity === 12) {
        // Check if the data would be too large for a single QR code
        if (base64Psbt.length > 1500) {
          // Fall back to the most dense possible configuration
          const baseChunkSize = 100
          const chunkSize = Math.max(100, baseChunkSize * 8) // Use maximum density (900 characters per chunk)

          const chunks: string[] = []
          const dataChunks: string[] = []
          for (let i = 0; i < base64Psbt.length; i += chunkSize) {
            dataChunks.push(base64Psbt.slice(i, i + chunkSize))
          }

          const totalChunks = dataChunks.length
          for (let i = 0; i < totalChunks; i++) {
            const header = `p${i + 1}of${totalChunks}`
            chunks.push(header + ' ' + dataChunks[i])
          }

          return chunks
        }
        return [base64Psbt] // No chunking, no header, just the full data
      }

      // Calculate chunk size based on complexity (higher complexity = larger chunks)
      // Invert the scale: complexity 1 = smallest chunks, complexity 11 = large chunks
      // Increase base chunk size significantly - QR codes can handle much more data
      const baseChunkSize = 100
      const chunkSize = Math.max(100, baseChunkSize * Math.min(complexity, 8)) // Cap at 8 to avoid too large chunks

      const chunks: string[] = []

      // First pass: split the data into chunks
      const dataChunks: string[] = []
      for (let i = 0; i < base64Psbt.length; i += chunkSize) {
        dataChunks.push(base64Psbt.slice(i, i + chunkSize))
      }

      // Second pass: add headers to each chunk
      const totalChunks = dataChunks.length
      for (let i = 0; i < totalChunks; i++) {
        const header = `p${i + 1}of${totalChunks}`
        chunks.push(header + ' ' + dataChunks[i])
      }

      return chunks
    },
    [] // Remove qrComplexity dependency to prevent unnecessary re-creation
  )

  const transactionHex = useMemo(() => {
    if (!account) return ''

    const transaction = new bitcoinjs.Transaction()
    const network = bitcoinjsNetwork(account.network)

    // Convert inputs to array once to avoid repeated Map iteration
    const inputArray = Array.from(inputs.values())

    for (const input of inputArray) {
      const hashBuffer = Buffer.from(parseHexToBytes(input.txid))
      transaction.addInput(hashBuffer, input.vout)
    }

    for (const output of outputs) {
      // Validate address format before creating output script
      try {
        const outputScript = bitcoinjs.address.toOutputScript(
          output.to,
          network
        )
        transaction.addOutput(outputScript, output.amount)
      } catch {
        // Don't call toast during render - this will be handled by validation elsewhere
        // Just return empty string to indicate invalid transaction
        return ''
      }
    }

    const hex = transaction.toHex()

    // Clear transaction data to help garbage collection
    transaction.ins = []
    transaction.outs = []

    return hex
  }, [account, inputs, outputs])

  const transaction = useMemo(() => {
    const { size, vsize } = estimateTransactionSize(inputs.size, outputs.length)

    const vin = [...inputs.values()].map((input: Utxo) => ({
      previousOutput: { txid: input.txid, vout: input.vout },
      value: input.value,
      label: input.label || ''
    }))

    const vout = outputs.map((output: Output) => ({
      address: output.to,
      value: output.amount,
      label: output.label || ''
    }))

    return { id: messageId, size, vsize, vin, vout } as never as Transaction
  }, [inputs, outputs, messageId])

  useEffect(() => {
    async function getTransactionMessage() {
      if (!wallet) {
        toast.error(t('error.notFound.wallet'))
        return
      }

      try {
        // Convert inputs and outputs to arrays once to avoid repeated conversions
        const inputArray = Array.from(inputs.values())
        const outputArray = Array.from(outputs.values())

        const transactionMessage = await buildTransaction(
          wallet,
          {
            inputs: inputArray,
            outputs: outputArray,
            fee,
            options: { rbf }
          },
          network as Network
        )

        setMessageId(transactionMessage.txDetails.txid)
        setTxBuilderResult(transactionMessage)
      } catch (err) {
        toast.error(String(err))
      }
    }

    getTransactionMessage()
  }, [wallet, inputs, outputs, fee, rbf, network, setTxBuilderResult])

  // Separate effect to validate addresses and show errors
  useEffect(() => {
    if (!account || !outputs.length) return

    const network = bitcoinjsNetwork(account.network)

    for (const output of outputs) {
      // Check if address is empty or invalid
      if (!output.to || output.to.trim() === '') {
        toast.error(
          'Invalid address format: Empty address. Please check your transaction configuration.'
        )
        break // Only show one error at a time
      }

      try {
        bitcoinjs.address.toOutputScript(output.to, network)
      } catch (_error) {
        // Show error toast for invalid address
        toast.error(
          `Invalid address format: ${output.to}. Please check your transaction configuration.`
        )
        break // Only show one error at a time
      }
    }
  }, [account, outputs])

  const getPsbtString = useCallback(async () => {
    if (!txBuilderResult?.psbt) {
      return null
    }

    try {
      const serializedPsbt = await txBuilderResult.psbt.serialize()

      // Check if serializedPsbt is already a string (base64) or binary data
      let psbtBuffer: Buffer
      if (typeof serializedPsbt === 'string') {
        // If it's a string, assume it's base64 and decode it to binary
        psbtBuffer = Buffer.from(serializedPsbt, 'base64')
      } else {
        // If it's binary data (Uint8Array or similar), convert directly
        psbtBuffer = Buffer.from(serializedPsbt)
      }

      // Store the hex representation for other uses
      const psbtHex = psbtBuffer.toString('hex')
      setSerializedPsbt(psbtHex)

      // Clear the buffer to help garbage collection
      psbtBuffer.fill(0)

      return psbtHex
    } catch (_error) {
      toast.error(t('error.psbt.serialization'))
      return null
    }
  }, [txBuilderResult])

  useEffect(() => {
    let isMounted = true
    let psbtBuffer: Buffer | null = null

    const updateQrChunks = async () => {
      try {
        const psbtHex = await getPsbtString()
        if (!psbtHex || !isMounted) {
          if (isMounted) {
            setQrError(t('error.psbt.notAvailable'))
            setQrChunks([])
            setUrChunks([])
            setRawPsbtChunks([])
          }
          return
        }

        try {
          // Create BBQR chunks using complexity setting
          psbtBuffer = Buffer.from(psbtHex, 'hex')
          let bbqrChunks: string[]

          try {
            if (qrComplexity === 12) {
              // Complexity 12: Create single static BBQR chunk
              // Check if the data would be too large for a single QR code
              const estimatedBBQRSize = psbtBuffer.length * 1.5 // BBQR encoding adds overhead
              if (estimatedBBQRSize > 1500) {
                // Fall back to the most dense possible configuration
                const bbqrChunkSize = Math.max(100, 30 * 12) // Use maximum density (460 characters per chunk)
                bbqrChunks = createBBQRChunks(
                  new Uint8Array(psbtBuffer),
                  FileType.PSBT,
                  bbqrChunkSize
                )
              } else {
                bbqrChunks = createBBQRChunks(
                  new Uint8Array(psbtBuffer),
                  FileType.PSBT,
                  psbtBuffer.length * 10
                )
              }
            } else {
              // Complexity 1-11: Create multiple chunks (higher = larger chunks)
              // Increase chunk size significantly - BBQR can handle much more data
              const bbqrChunkSize = Math.max(100, 30 * qrComplexity)

              bbqrChunks = createBBQRChunks(
                new Uint8Array(psbtBuffer),
                FileType.PSBT,
                bbqrChunkSize
              )
            }
          } catch (_bbqrError) {
            bbqrChunks = []
          }

          if (!isMounted) return

          // Clear the buffer to help garbage collection
          psbtBuffer.fill(0)
          psbtBuffer = null

          if (!txBuilderResult?.psbt?.base64) {
            throw new Error('PSBT data not available')
          }

          // Generate raw PSBT chunks using complexity setting
          const rawChunks = createRawPsbtChunks(
            txBuilderResult.psbt.base64,
            qrComplexity
          )

          // Generate UR fragments using complexity setting
          let urFragments: string[]

          if (qrComplexity === 12) {
            // Complexity 12: Create single static UR fragment
            // Check if the data would be too large for a single QR code
            const estimatedURSize = txBuilderResult.psbt.base64.length * 1.5 // UR encoding adds overhead
            if (estimatedURSize > 1500) {
              // Fall back to the most dense possible configuration
              const urFragmentSize = Math.max(50, 15 * 12) // Use maximum density (180 characters per fragment)
              urFragments = getURFragmentsFromPSBT(
                txBuilderResult.psbt.base64,
                'base64',
                urFragmentSize
              )
            } else {
              urFragments = getURFragmentsFromPSBT(
                txBuilderResult.psbt.base64,
                'base64',
                txBuilderResult.psbt.base64.length // Use full length for single fragment
              )
            }
          } else {
            // Complexity 1-11: Create multiple fragments (higher = larger fragments)
            // Increase the fragment size significantly - UR can handle much more data
            const urFragmentSize = Math.max(50, 15 * qrComplexity)
            urFragments = getURFragmentsFromPSBT(
              txBuilderResult.psbt.base64,
              'base64',
              urFragmentSize
            )
          }

          if (!isMounted) return

          setQrChunks(bbqrChunks)
          setUrChunks(urFragments)
          setRawPsbtChunks(rawChunks)
          setCurrentRawChunk(0)
          setCurrentUrChunk(0)
          setQrError(null)
        } catch (_error) {
          if (isMounted) {
            setQrError(t('error.qr.generation'))
            setQrChunks([])
            setUrChunks([])
            setRawPsbtChunks([])
          }
        }
      } catch (_error) {
        if (isMounted) {
          setQrError(t('error.psbt.notAvailable'))
          setQrChunks([])
          setUrChunks([])
          setRawPsbtChunks([])
        }
      }
    }

    updateQrChunks()

    // Cleanup function
    return () => {
      isMounted = false
      if (psbtBuffer) {
        psbtBuffer.fill(0)
        psbtBuffer = null
      }
    }
  }, [
    getPsbtString,
    txBuilderResult?.psbt?.base64,
    qrComplexity,
    createRawPsbtChunks
  ])

  // High-performance animation using requestAnimationFrame
  useEffect(() => {
    // Don't animate when complexity is 12 (static mode) - but only for single chunks
    if (qrComplexity === 12) {
      // Check if we actually have a single chunk or multiple chunks
      const hasMultipleChunks =
        (displayMode === QRDisplayMode.RAW && rawPsbtChunks.length > 1) ||
        (displayMode === QRDisplayMode.BBQR && qrChunks.length > 1) ||
        (displayMode === QRDisplayMode.UR && urChunks.length > 1)

      if (!hasMultipleChunks) {
        return // Don't animate if we have a single chunk
      }
    }

    const shouldAnimate =
      (displayMode === QRDisplayMode.RAW && rawPsbtChunks.length > 1) ||
      (displayMode === QRDisplayMode.BBQR && qrChunks.length > 1) ||
      (displayMode === QRDisplayMode.UR && urChunks.length > 1)

    if (shouldAnimate) {
      // Calculate animation interval based on speed (1 = slowest, 12 = fastest)
      // Speed 1 = 2000ms, Speed 12 = 100ms
      const maxInterval = 2000
      const minInterval = 200
      const interval =
        maxInterval - ((animationSpeed - 1) * (maxInterval - minInterval)) / 11

      // Cap minimum interval to prevent excessive updates
      const safeInterval = Math.max(interval, 100)

      const animate = (timestamp: number) => {
        if (timestamp - lastUpdateRef.current >= safeInterval) {
          if (displayMode === QRDisplayMode.RAW) {
            setCurrentRawChunk((prev) => (prev + 1) % rawPsbtChunks.length)
          } else if (displayMode === QRDisplayMode.UR) {
            setCurrentUrChunk((prev) => (prev + 1) % urChunks.length)
          } else {
            setCurrentChunk((prev) => (prev + 1) % qrChunks.length)
          }
          lastUpdateRef.current = timestamp
        }

        animationRef.current = requestAnimationFrame(animate)
      }

      animationRef.current = requestAnimationFrame(animate)

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }
      }
    }
  }, [
    displayMode,
    qrChunks.length,
    urChunks.length,
    rawPsbtChunks.length,
    qrComplexity,
    animationSpeed
  ])

  const handleQRCodeScanned = (data: string | undefined) => {
    if (!data) {
      toast.error('Failed to scan QR code')
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
            toast.error('Failed to decode BBQR QR code')
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
            toast.error('Failed to decode UR QR code')
            return
          }
        }

        // Process the data (convert PSBT to final transaction if needed)
        finalContent = processScannedData(finalContent)
      } catch (_error) {
        // Keep original content if conversion fails
      }

      setCameraModalVisible(false)
      setSignedPsbt(finalContent)
      resetScanProgress()
      toast.success('QR code scanned successfully')
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
      const maxFragmentNumber = Math.max(...newScanned)
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
        const assembledData = assembleMultiPartQR(type, newChunks)

        if (assembledData) {
          // Process the assembled data (convert PSBT to final transaction if needed)
          const finalData = processScannedData(assembledData)

          setSignedPsbt(finalData)

          setCameraModalVisible(false)
          resetScanProgress()

          // Check if the result is still a PSBT (not finalized)
          if (
            finalData.toLowerCase().startsWith('70736274ff') ||
            finalData.startsWith('cHNidP')
          ) {
            toast.success(
              `PSBT assembled successfully (${newScanned.size} fragments). Note: PSBT may need additional signatures to finalize.`
            )
          } else {
            toast.success(
              `Successfully assembled final transaction from ${newScanned.size} fragments`
            )
          }
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
          // Process the assembled data (convert PSBT to final transaction if needed)
          const finalData = processScannedData(assembledData)

          setCameraModalVisible(false)
          setSignedPsbt(finalData)
          resetScanProgress()

          // Check if the result is still a PSBT (not finalized)
          if (
            finalData.toLowerCase().startsWith('70736274ff') ||
            finalData.startsWith('cHNidP')
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
          toast.error('Failed to assemble multi-part QR code')
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
  }

  async function handleNFCExport() {
    if (isEmitting) {
      await cancelNFCEmitterScan()
      setNfcModalVisible(false)
      setNfcError(null)
      return
    }

    if (!serializedPsbt) {
      toast.error(t('error.psbt.notAvailable'))
      return
    }

    setNfcModalVisible(true)
    setNfcError(null)
    try {
      await emitNFCTag(serializedPsbt)
      toast.success(t('transaction.preview.nfcExported'))
    } catch (_error) {
      const errorMessage = (_error as Error).message
      if (errorMessage) {
        setNfcError(errorMessage)
        toast.error(errorMessage)
      }
    } finally {
      if (!nfcError) {
        setNfcModalVisible(false)
      }
    }
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await Clipboard.getStringAsync()
      if (!text) {
        toast.error('No data found in clipboard')
        return
      }

      // Process the pasted data similar to scanned data
      const processedData = processScannedData(text)
      setSignedPsbt(processedData)
      toast.success('Data pasted successfully')
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error('Failed to paste from clipboard')
      }
    }
  }

  async function handleNFCScan() {
    if (isReading) {
      await cancelNFCScan()
      setNfcScanModalVisible(false)
      return
    }

    setNfcScanModalVisible(true)
    try {
      const result = await readNFCTag()

      if (!result) {
        toast.error(t('watchonly.read.nfcErrorNoData'))
        return
      }

      if (result.txData) {
        const txHex = Array.from(result.txData)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        setSignedPsbt(txHex)
        toast.success(t('transaction.preview.nfcImported'))
      } else if (result.txId) {
        setSignedPsbt(result.txId)
        toast.success(t('transaction.preview.nfcImported'))
      } else {
        toast.error(t('watchonly.read.nfcErrorNoData'))
      }
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      }
    } finally {
      setNfcScanModalVisible(false)
    }
  }

  useEffect(() => {
    if (signedPsbt) {
      setSignedTx(signedPsbt)
    }
  }, [signedPsbt, setSignedTx])

  // NFC pulsating animation effect
  useEffect(() => {
    if (nfcModalVisible || nfcScanModalVisible) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(nfcPulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false
          }),
          Animated.timing(nfcPulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false
          })
        ])
      )

      pulseAnimation.start()

      return () => {
        pulseAnimation.stop()
        nfcPulseAnim.setValue(0)
      }
    }
  }, [nfcModalVisible, nfcScanModalVisible, nfcPulseAnim])

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      // Cancel any running animations
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      // Clear all QR-related state to free memory
      setQrChunks([])
      setUrChunks([])
      setRawPsbtChunks([])
    }
  }, [])

  const getQRValue = () => {
    switch (displayMode) {
      case QRDisplayMode.RAW: {
        // Always use chunks for RAW mode to ensure animation
        if (rawPsbtChunks.length > 0) {
          // Safety check for out-of-bounds access
          if (currentRawChunk >= rawPsbtChunks.length) {
            return 'NO_CHUNKS'
          }

          const value = rawPsbtChunks[currentRawChunk] || 'NO_CHUNKS'
          // Runtime safety check to prevent crashes
          if (value.length > 1500) {
            return 'DATA_TOO_LARGE_FOR_QR'
          }
          return value
        }
        // Fallback to full base64 PSBT if chunks not ready
        const base64Psbt = txBuilderResult?.psbt?.base64
        if (base64Psbt && base64Psbt.length > 1500) {
          return 'DATA_TOO_LARGE'
        }
        return base64Psbt || 'NO_DATA'
      }
      case QRDisplayMode.UR: {
        // Safety check for out-of-bounds access
        if (currentUrChunk >= urChunks.length) {
          return 'NO_CHUNKS'
        }

        const urValue = urChunks[currentUrChunk]
        // Runtime safety check to prevent crashes
        if (urValue && urValue.length > 1500) {
          return 'DATA_TOO_LARGE_FOR_QR'
        }
        return urValue || 'NO_CHUNKS'
      }
      case QRDisplayMode.BBQR: {
        // Safety check for out-of-bounds access
        if (currentChunk >= qrChunks.length) {
          return 'NO_CHUNKS'
        }

        const bbqrValue = qrChunks?.[currentChunk]
        // Runtime safety check to prevent crashes
        if (bbqrValue && bbqrValue.length > 1500) {
          return 'DATA_TOO_LARGE_FOR_QR'
        }
        return bbqrValue || 'NO_CHUNKS'
      }
    }
  }

  // Helper function to check if data would be too large for single QR code
  const isDataTooLargeForSingleQR = () => {
    const base64Psbt = txBuilderResult?.psbt?.base64
    if (!base64Psbt) return false

    // Check the actual chunk sizes for the current display mode
    let maxChunkSize = 0

    switch (displayMode) {
      case QRDisplayMode.RAW:
        if (rawPsbtChunks.length > 0) {
          maxChunkSize = Math.max(...rawPsbtChunks.map((c) => c.length))
        }
        break
      case QRDisplayMode.UR:
        if (urChunks.length > 0) {
          maxChunkSize = Math.max(...urChunks.map((c) => c.length))
        }
        break
      case QRDisplayMode.BBQR:
        if (qrChunks.length > 0) {
          maxChunkSize = Math.max(...qrChunks.map((c) => c.length))
        }
        break
    }

    // Use a more conservative limit to prevent QR code crashes
    const limit = 1500 // Reduced to prevent crashes

    return maxChunkSize > limit
  }

  const getDisplayModeDescription = () => {
    switch (displayMode) {
      case QRDisplayMode.RAW:
        if (rawPsbtChunks.length > 0) {
          // Only show "Static QR" if we actually have a single chunk at complexity 12
          if (qrComplexity === 12 && rawPsbtChunks.length === 1) {
            return 'Static QR - Complete PSBT in single code'
          }
          return rawPsbtChunks.length > 1
            ? t('transaction.preview.scanAllChunks', {
                current: currentRawChunk + 1,
                total: rawPsbtChunks.length
              })
            : t('transaction.preview.singleChunk')
        }
        if (serializedPsbt.length > 1500) {
          return t('error.qr.dataTooLarge')
        }
        if (!serializedPsbt) {
          return t('error.psbt.notAvailable')
        }
        return t('transaction.preview.rawPSBT')
      case QRDisplayMode.UR:
        if (!urChunks.length) {
          return t('error.psbt.notAvailable')
        }
        // Only show "Static QR" if we actually have a single chunk at complexity 12
        if (qrComplexity === 12 && urChunks.length === 1) {
          return 'Static QR - Complete UR in single code'
        }
        return urChunks.length > 1
          ? t('transaction.preview.scanAllChunks', {
              current: currentUrChunk + 1,
              total: urChunks.length
            })
          : t('transaction.preview.singleChunk')
      case QRDisplayMode.BBQR:
        if (!qrChunks.length) {
          return 'Loading BBQR chunks...'
        }
        // Only show "Static QR" if we actually have a single chunk at complexity 12
        if (qrComplexity === 12 && qrChunks.length === 1) {
          return 'Static QR - Complete BBQR in single code'
        }
        return qrChunks.length > 1
          ? t('transaction.preview.scanAllChunks', {
              current: currentChunk + 1,
              total: qrChunks.length
            })
          : t('transaction.preview.singleChunk')
    }
  }

  if (!id || !account) return <Redirect href="/" />

  // Calculate responsive dimensions
  const screenWidth = Dimensions.get('window').width
  const screenHeight = Dimensions.get('window').height
  const qrSize = Math.min(screenWidth * 0.9, screenHeight * 0.5, 700) // 80% of screen width, max 500px
  const containerPadding = screenWidth * 0.05 // 5% of screen width

  return (
    <>
      <SSMainLayout style={styles.mainLayout}>
        <SSVStack justifyBetween>
          <ScrollView>
            <SSVStack>
              <SSVStack gap="xxs">
                <SSText color="muted" size="sm" uppercase>
                  {t('transaction.id')}
                </SSText>
                <SSText size="lg" type="mono">
                  {messageId || `${t('common.loading')}...`}
                </SSText>
              </SSVStack>
              <SSVStack gap="xxs">
                <SSText color="muted" size="sm" uppercase>
                  {tn('contents')}
                </SSText>
                <SSTransactionChart transaction={transaction} />
              </SSVStack>
              <SSVStack gap="xxs">
                <SSText
                  uppercase
                  size="sm"
                  color="muted"
                  style={{ marginBottom: -22 }}
                >
                  {tn('decoded')}
                </SSText>
                {transactionHex !== '' && (
                  <SSTransactionDecoded txHex={transactionHex} />
                )}
              </SSVStack>
              {account.policyType !== 'watchonly' ? (
                <SSButton
                  variant="secondary"
                  disabled={!messageId}
                  label={t('sign.transaction')}
                  onPress={() =>
                    router.navigate(`/account/${id}/signAndSend/signMessage`)
                  }
                />
              ) : (
                (account.keys[0].creationType === 'importDescriptor' ||
                  account.keys[0].creationType === 'importExtendedPub') && (
                  <>
                    <SSText
                      center
                      color="muted"
                      size="sm"
                      uppercase
                      style={{ marginTop: 16 }}
                    >
                      {t('transaction.preview.exportUnsigned')}
                    </SSText>
                    <SSHStack gap="xxs" justifyBetween>
                      <SSButton
                        variant="outline"
                        disabled={!messageId}
                        label={t('common.copy')}
                        style={{ width: '48%' }}
                        onPress={() => {
                          if (txBuilderResult?.psbt?.base64) {
                            Clipboard.setStringAsync(
                              txBuilderResult.psbt.base64
                            )
                            toast(t('common.copiedToClipboard'))
                          }
                        }}
                      />
                      <SSButton
                        variant="outline"
                        disabled={!messageId}
                        label="Show QR"
                        style={{ width: '48%' }}
                        onPress={() => {
                          setNoKeyModalVisible(true)
                        }}
                      />
                    </SSHStack>
                    <SSHStack gap="xxs" justifyBetween>
                      <SSButton
                        label="USB"
                        style={{ width: '48%' }}
                        variant="outline"
                        disabled
                      />

                      <SSButton
                        label={
                          isEmitting
                            ? t('watchonly.read.scanning')
                            : t('watchonly.emit.nfc')
                        }
                        style={{ width: '48%' }}
                        variant="outline"
                        disabled={!isAvailable || !serializedPsbt}
                        onPress={handleNFCExport}
                      />
                    </SSHStack>
                    <SSText
                      center
                      color="muted"
                      size="sm"
                      uppercase
                      style={{ marginTop: 16 }}
                    >
                      {signedPsbt &&
                      (signedPsbt.toLowerCase().startsWith('70736274ff') ||
                        signedPsbt.startsWith('cHNidP'))
                        ? 'Imported PSBT (may need additional signatures)'
                        : t('transaction.preview.importSigned')}
                    </SSText>
                    <View
                      style={{
                        minHeight: 200,
                        maxHeight: 600,
                        paddingTop: 12,
                        paddingBottom: 12,
                        paddingHorizontal: 12,
                        backgroundColor: Colors.gray[900],
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: Colors.gray[700]
                      }}
                    >
                      <ScrollView
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator
                        nestedScrollEnabled
                      >
                        <SSText
                          style={{
                            fontFamily: Typography.sfProMono,
                            fontSize: 12,
                            color: Colors.white,
                            lineHeight: 18
                          }}
                        >
                          {signedPsbt || t('transaction.preview.signedPsbt')}
                        </SSText>
                      </ScrollView>
                    </View>
                    <SSHStack gap="xxs" justifyBetween>
                      <SSButton
                        label="Paste"
                        style={{ width: '48%' }}
                        variant="outline"
                        onPress={handlePasteFromClipboard}
                      />
                      <SSButton
                        label="Scan QR"
                        style={{ width: '48%' }}
                        variant="outline"
                        onPress={() => setCameraModalVisible(true)}
                      />
                    </SSHStack>
                    <SSHStack gap="xxs" justifyBetween>
                      <SSButton
                        label="USB"
                        style={{ width: '48%' }}
                        variant="outline"
                        disabled
                      />
                      <SSButton
                        label={
                          isReading
                            ? t('watchonly.read.scanning')
                            : t('watchonly.read.nfc')
                        }
                        style={{ width: '48%' }}
                        variant="outline"
                        disabled={!isAvailable}
                        onPress={handleNFCScan}
                      />
                    </SSHStack>
                    <SSButton
                      label="Check Signature"
                      style={{ marginTop: 26 }}
                      variant="secondary"
                      disabled={!signedPsbt}
                      onPress={() =>
                        router.navigate(
                          `/account/${id}/signAndSend/signMessage`
                        )
                      }
                    />
                  </>
                )
              )}
            </SSVStack>
          </ScrollView>
        </SSVStack>
        <SSModal
          visible={noKeyModalVisible}
          fullOpacity
          onClose={() => setNoKeyModalVisible(false)}
        >
          <SSVStack
            gap="xs"
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              padding: containerPadding
            }}
          >
            <SSText color="white" uppercase style={{ marginBottom: 5 }}>
              {t('transaction.preview.PSBT')}
            </SSText>
            {qrError ? (
              <SSText color="white" size="sm" style={{ marginTop: 16 }}>
                {qrError}
              </SSText>
            ) : qrChunks.length > 0 ? (
              <>
                <View
                  style={{
                    padding: 5,
                    backgroundColor: Colors.white,
                    alignItems: 'center',
                    marginBottom: 0,
                    width: qrSize + 10,
                    borderRadius: 2
                  }}
                >
                  <SSQRCode
                    value={getQRValue()}
                    color={Colors.black}
                    backgroundColor={Colors.white}
                    size={qrSize}
                  />
                </View>
                <SSHStack
                  gap="xs"
                  style={{ width: screenWidth * 0.92, marginBottom: 10 }}
                >
                  <SSButton
                    variant={
                      displayMode === QRDisplayMode.RAW
                        ? 'secondary'
                        : 'outline'
                    }
                    label="RAW"
                    onPress={() => {
                      setDisplayMode(QRDisplayMode.RAW)
                      // Reset chunk index when switching modes
                      setCurrentRawChunk(0)
                    }}
                    style={{ flex: 1 }}
                  />
                  <SSButton
                    variant={
                      displayMode === QRDisplayMode.UR ? 'secondary' : 'outline'
                    }
                    label="UR"
                    onPress={() => {
                      setDisplayMode(QRDisplayMode.UR)
                      // Reset chunk index when switching modes
                      setCurrentUrChunk(0)
                    }}
                    style={{ flex: 1 }}
                  />
                  <SSButton
                    variant={
                      displayMode === QRDisplayMode.BBQR
                        ? 'secondary'
                        : 'outline'
                    }
                    label="BBQR"
                    onPress={() => {
                      setDisplayMode(QRDisplayMode.BBQR)
                      // Reset chunk index when switching modes
                      setCurrentChunk(0)
                    }}
                    style={{ flex: 1 }}
                  />
                </SSHStack>
                <SSText
                  center
                  color="white"
                  size="sm"
                  style={{ maxWidth: screenWidth * 0.9 }}
                >
                  {getDisplayModeDescription()}
                </SSText>
                {isDataTooLargeForSingleQR() && qrComplexity >= 11 && (
                  <SSText
                    center
                    color="muted"
                    size="xs"
                    style={{ marginTop: 5 }}
                  >
                    Max density limited due to data size
                  </SSText>
                )}
                <SSText
                  center
                  color="white"
                  size="sm"
                  type="mono"
                  style={{
                    padding: 5,
                    width: screenWidth * 0.92,
                    height: 80,
                    backgroundColor: Colors.gray[900],
                    borderRadius: 2,
                    textAlignVertical: 'center',
                    paddingHorizontal: 20
                  }}
                >
                  {getQRValue().length > 100
                    ? `${getQRValue().slice(0, 100)}...`
                    : getQRValue()}
                </SSText>
                <SSHStack
                  justifyEvenly
                  style={{ width: screenWidth * 0.9, marginBottom: 20 }}
                >
                  <SSVStack gap="xs">
                    <SSText color="white" size="sm" center>
                      QR density: {qrComplexity}/12
                    </SSText>
                    <SSHStack gap="sm" style={{ justifyContent: 'center' }}>
                      <SSButton
                        variant="outline"
                        label="-"
                        onPress={() =>
                          setQrComplexity(Math.max(1, qrComplexity - 1))
                        }
                        style={{ height: 50, width: 50 }}
                      />
                      <SSButton
                        variant={
                          qrComplexity === 11 && isDataTooLargeForSingleQR()
                            ? 'ghost'
                            : 'outline'
                        }
                        label="+"
                        onPress={() => {
                          const newComplexity = qrComplexity + 1
                          // Check if the new complexity would create data too large for QR codes
                          if (
                            newComplexity === 12 &&
                            isDataTooLargeForSingleQR()
                          ) {
                            toast.error('Data too large for single QR code')
                            return
                          }
                          setQrComplexity(Math.min(12, newComplexity))
                        }}
                        style={{ height: 50, width: 50 }}
                      />
                    </SSHStack>
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText color="white" size="sm" center>
                      {t('common.speed')}: {animationSpeed}/12
                    </SSText>
                    <SSHStack gap="sm" style={{ justifyContent: 'center' }}>
                      <SSButton
                        variant="outline"
                        label="-"
                        onPress={() =>
                          setAnimationSpeed(Math.max(1, animationSpeed - 1))
                        }
                        style={{ height: 50, width: 50 }}
                      />
                      <SSButton
                        variant="outline"
                        label="+"
                        onPress={() =>
                          setAnimationSpeed(Math.min(12, animationSpeed + 1))
                        }
                        style={{ height: 50, width: 50 }}
                      />
                    </SSHStack>
                  </SSVStack>
                </SSHStack>
              </>
            ) : (
              <SSText color="white" size="sm" style={{ marginTop: 16 }}>
                {t('common.loading')}
              </SSText>
            )}
          </SSVStack>
        </SSModal>
        <SSModal
          visible={cameraModalVisible}
          fullOpacity
          onClose={() => {
            setCameraModalVisible(false)
            resetScanProgress()
          }}
        >
          <SSVStack itemsCenter gap="md">
            <SSText color="muted" uppercase>
              {scanProgress.type
                ? `Scanning ${scanProgress.type.toUpperCase()} QR Code`
                : t('camera.scanQRCode')}
            </SSText>

            <CameraView
              onBarcodeScanned={(res) => {
                handleQRCodeScanned(res.raw)
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
                      const maxFragment = Math.max(...scanProgress.scanned)
                      const actualTotal = maxFragment + 1
                      const conservativeTarget = Math.ceil(actualTotal * 1.1)
                      const theoreticalTarget = Math.ceil(
                        scanProgress.total * 1.5
                      )
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
                                  (scanProgress.scanned.size / displayTarget) *
                                  300,
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
                            (scanProgress.scanned.size / scanProgress.total) *
                            300,
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
              <SSHStack>
                <SSButton
                  label="Reset Scan"
                  variant="outline"
                  onPress={resetScanProgress}
                  style={{ marginTop: 10, width: 200 }}
                />
              </SSHStack>
            )}
          </SSVStack>
        </SSModal>
        <SSModal
          visible={nfcModalVisible}
          fullOpacity
          onClose={() => {
            setNfcModalVisible(false)
            setNfcError(null)
            if (isEmitting) cancelNFCEmitterScan()
          }}
        >
          <SSVStack itemsCenter gap="lg">
            <SSText center style={{ maxWidth: 300 }}>
              {nfcError ? t('common.error') : t('transaction.preview.nfcTip')}
            </SSText>
            {nfcError ? (
              <SSVStack itemsCenter gap="md">
                <SSText color="white" center>
                  {nfcError}
                </SSText>
              </SSVStack>
            ) : (
              <Animated.View
                style={{
                  width: 200,
                  height: 200,
                  backgroundColor: nfcPulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [Colors.gray[800], Colors.gray[400]]
                  }),
                  borderRadius: 100,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <SSText uppercase>Emitting NFC</SSText>
              </Animated.View>
            )}
          </SSVStack>
        </SSModal>
        <SSModal
          visible={nfcScanModalVisible}
          fullOpacity
          onClose={() => {
            setNfcScanModalVisible(false)
            if (isReading) cancelNFCScan()
          }}
        >
          <SSVStack itemsCenter gap="lg">
            <SSText center style={{ maxWidth: 300 }}>
              {nfcError ? t('common.error') : t('transaction.preview.nfcTip')}
            </SSText>
            <Animated.View
              style={{
                width: 200,
                height: 200,
                backgroundColor: nfcPulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [Colors.gray[800], Colors.gray[400]]
                }),
                borderRadius: 100,
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <SSText uppercase>{t('watchonly.read.scanning')}</SSText>
            </Animated.View>
          </SSVStack>
        </SSModal>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  mainLayout: { paddingTop: 0, paddingBottom: 20 },
  modalStack: { marginVertical: 32, width: '100%', paddingHorizontal: 32 }
})

export default PreviewMessage
