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

import { buildTransaction } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSSeedWordsInput from '@/components/SSSeedWordsInput'
import SSSignatureDropdown from '@/components/SSSignatureDropdown'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import { PIN_KEY } from '@/config/auth'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { useNFCReader } from '@/hooks/useNFCReader'
import { usePSBTManagement } from '@/hooks/usePSBTManagement'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Typography } from '@/styles'
import {
  type Key,
  type MnemonicWordCount,
  type Secret
} from '@/types/models/Account'
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
import { aesDecrypt } from '@/utils/crypto'
import { parseHexToBytes } from '@/utils/parse'
import { validateSignedPSBTForCosigner } from '@/utils/psbtValidator'
import { detectAndDecodeSeedQR } from '@/utils/seedqr'
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

/**
 * Check if a multisig input has enough signatures to finalize
 */
function hasEnoughSignatures(input: any): boolean {
  // Early return if not a multisig input
  if (!input.witnessScript) {
    return true
  }

  try {
    const script = bitcoinjs.script.decompile(input.witnessScript)

    // Early return if script is invalid
    if (!script || script.length < 3) {
      return false
    }

    const op = script[0]

    // Early return if op code is invalid
    if (typeof op !== 'number' || op < 81 || op > 96) {
      return false
    }

    const threshold = op - 80 // Convert OP_M to actual threshold (OP_2 = 82 -> threshold = 2)
    const signatureCount = input.partialSig ? input.partialSig.length : 0

    return signatureCount >= threshold
  } catch {
    toast.error('Error checking if input has enough signatures')
    return false
  }
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
  const [currentCosignerIndex, setCurrentCosignerIndex] = useState<
    number | null
  >(null)

  // Seed words modal state
  const [seedWordsModalVisible, setSeedWordsModalVisible] = useState(false)
  const [wordCountModalVisible, setWordCountModalVisible] = useState(false)
  const [selectedWordCount, setSelectedWordCount] =
    useState<MnemonicWordCount>(24)
  const [currentMnemonic, setCurrentMnemonic] = useState('')
  const [_currentFingerprint, _setCurrentFingerprint] = useState('')

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
  const [decryptedKeys, setDecryptedKeys] = useState<Key[]>([])

  // Animation for NFC pulsating effect
  const nfcPulseAnim = useRef(new Animated.Value(0)).current

  // PSBT Management Hook
  const psbtManagement = usePSBTManagement({
    txBuilderResult,
    account,
    decryptedKeys
  })

  // Destructure hook values for easier access
  const {
    signedPsbt,
    signedPsbts,
    updateSignedPsbt,
    convertPsbtToFinalTransaction,
    handleSignWithLocalKey,
    handleSignWithSeedQR
  } = psbtManagement

  // Calculate validation results for each cosigner
  const validationResults = useMemo(() => {
    const results = new Map<number, boolean>()

    if (!account) {
      return results
    }

    for (const [cosignerIndex, signedPsbt] of signedPsbts.entries()) {
      if (signedPsbt && signedPsbt.trim()) {
        try {
          const isValid = validateSignedPSBTForCosigner(
            signedPsbt,
            account,
            cosignerIndex,
            decryptedKeys[cosignerIndex]
          )
          results.set(cosignerIndex, isValid)
        } catch {
          toast.error('Failed in validating cosigner signature')
          results.set(cosignerIndex, false)
        }
      }
    }

    return results
  }, [signedPsbts, account, decryptedKeys])

  // Clipboard paste hook
  useClipboardPaste({
    onPaste: (content: string) => {
      const processedData = processScannedData(content)
      updateSignedPsbt(-1, processedData) // -1 for watch-only mode
    }
  })

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
        // Only attempt conversion if we have the original PSBT context
        if (txBuilderResult?.psbt?.base64) {
          const convertedResult = convertPsbtToFinalTransaction(data)
          return convertedResult
        } else {
          // If no original PSBT context, return as-is to avoid UTXO errors
          return data
        }
      }

      return data
    } catch (_error) {
      // If conversion fails, return original data to prevent app crashes
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

    const vin = Array.from(inputs.values()).map((input: Utxo) => ({
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
        // Handle specific UTXO errors
        const errorMessage = String(err)
        if (errorMessage.includes('UTXO not found')) {
          toast.error(
            'UTXO not found in wallet database. Please sync your wallet or check your inputs.'
          )
        } else {
          toast.error(errorMessage)
        }
      }
    }

    getTransactionMessage()
  }, [wallet, inputs, outputs, fee, rbf, network, setTxBuilderResult])

  // Separate effect to validate addresses and show errors
  // Only validate when we have a complete transaction (not during editing)
  useEffect(() => {
    if (!account || !outputs.length || !txBuilderResult) return

    const network = bitcoinjsNetwork(account.network)

    for (const output of outputs) {
      // Check if address is empty or invalid
      if (!output.to || output.to.trim() === '') {
        // Don't show error for empty addresses during editing
        continue
      }

      try {
        bitcoinjs.address.toOutputScript(output.to, network)
      } catch (_error) {
        // Only show error for clearly invalid addresses, not during editing
        // Check if the address looks like it might be incomplete (too short)
        if (output.to.length < 10) {
          continue // Skip validation for very short addresses (likely incomplete)
        }

        // Show error toast for invalid address
        toast.error(
          `Invalid address format: ${output.to}. Please check your transaction configuration.`
        )
        break // Only show one error at a time
      }
    }
  }, [account, outputs, txBuilderResult])

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

  const handleQRCodeScanned = async (
    data: string | undefined,
    index?: number
  ) => {
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
        // Check if it's a seed QR code (for dropped seeds)
        else if (index !== undefined) {
          const decodedMnemonic = detectAndDecodeSeedQR(qrInfo.content)
          if (decodedMnemonic) {
            // Sign the PSBT with the scanned seed
            await handleSignWithSeedQR(index, decodedMnemonic)
            setCameraModalVisible(false)
            resetScanProgress()
            return
          }
        }

        // Process the data (convert PSBT to final transaction if needed)
        finalContent = processScannedData(finalContent)
      } catch {
        toast.error('Failed to process scanned data')
      }

      // Use hook's updateSignedPsbt function
      updateSignedPsbt(index ?? -1, finalContent)

      setCameraModalVisible(false)
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
        const assembledData = assembleMultiPartQR(type, newChunks)

        if (assembledData) {
          // Process the assembled data (convert PSBT to final transaction if needed)
          const finalData = processScannedData(assembledData)

          // Use hook's updateSignedPsbt function
          updateSignedPsbt(index ?? -1, finalData)

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

          // Use hook's updateSignedPsbt function
          updateSignedPsbt(index ?? -1, finalData)

          setCameraModalVisible(false)
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

  // Create a wrapper function for cosigner-specific paste
  const handlePasteFromClipboard = async (index: number) => {
    try {
      const text = await Clipboard.getStringAsync()
      if (!text) {
        toast.error('No data found in clipboard')
        return
      }

      // Process the pasted data similar to scanned data
      const processedData = processScannedData(text)

      // Use hook's updateSignedPsbt function
      updateSignedPsbt(index, processedData)

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

  async function handleNFCScan(index: number) {
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

        // Use hook's updateSignedPsbt function
        updateSignedPsbt(index, txHex)

        toast.success(t('transaction.preview.nfcImported'))
      } else if (result.txId) {
        // Use hook's updateSignedPsbt function
        updateSignedPsbt(index, result.txId || '')

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

  // Wrapper functions for cosigner-specific actions
  const handleCosignerPasteFromClipboard = (index: number) => {
    handlePasteFromClipboard(index)
  }

  const handleCosignerCameraScan = (index: number) => {
    setCameraModalVisible(true)
    // Store the current cosigner index for QR scanning
    setCurrentCosignerIndex(index)
  }

  const handleCosignerNFCScan = (index: number) => {
    handleNFCScan(index)
  }

  // Handle seed QR scanning for dropped seeds
  const handleSeedQRScanned = async (index: number) => {
    setCameraModalVisible(true)
    setCurrentCosignerIndex(index)
  }

  // Handle seed words modal for dropped seeds
  const handleSeedWordsScanned = async (index: number) => {
    setCurrentCosignerIndex(index)
    setWordCountModalVisible(true)
  }

  // Handle word count selection
  const handleWordCountSelect = (wordCount: MnemonicWordCount) => {
    setSelectedWordCount(wordCount)
    setWordCountModalVisible(false)
    setSeedWordsModalVisible(true)
  }

  // Handle mnemonic validation from the component
  const handleMnemonicValid = (mnemonic: string, fingerprint: string) => {
    setCurrentMnemonic(mnemonic)
    _setCurrentFingerprint(fingerprint)
  }

  const handleMnemonicInvalid = () => {
    setCurrentMnemonic('')
    _setCurrentFingerprint('')
  }

  // Handle seed words form submission
  const handleSeedWordsSubmit = async () => {
    if (!currentMnemonic || currentCosignerIndex === null) {
      toast.error('Please enter a valid mnemonic')
      return
    }

    await handleSignWithSeedQR(currentCosignerIndex, currentMnemonic)

    // Clear the form and close modals
    setSeedWordsModalVisible(false)
    setCurrentMnemonic('')
    _setCurrentFingerprint('')
    setCurrentCosignerIndex(null)
  }

  // Wrapper functions for watch-only section (no parameters needed)
  const handleWatchOnlyPasteFromClipboard = () => {
    handlePasteFromClipboard(-1) // Use -1 to indicate watch-only
  }

  const handleWatchOnlyNFCScan = () => {
    handleNFCScan(-1) // Use -1 to indicate watch-only
  }

  const hasAllRequiredSignatures = () => {
    if (!account || account.policyType !== 'multisig' || !account.keys) {
      return false
    }

    const requiredSignatures = account.keysRequired || account.keys.length

    const validSignatures = Array.from(validationResults.values()).filter(
      (isValid) => isValid === true
    ).length

    const hasEnough = validSignatures >= requiredSignatures
    return hasEnough
  }

  const combineAndFinalizeMultisigPSBTs = async () => {
    try {
      const originalPsbtBase64 = txBuilderResult?.psbt?.base64
      if (!originalPsbtBase64) {
        toast.error('No original PSBT found')
        return null
      }

      // Get all collected signed PSBTs
      const collectedSignedPsbts = Array.from(signedPsbts.values()).filter(
        (psbt) => psbt && psbt.trim().length > 0
      )

      if (collectedSignedPsbts.length === 0) {
        toast.error('No signed PSBTs collected')
        return null
      }

      // Step 1: Parse the original PSBT
      const originalPsbt = bitcoinjs.Psbt.fromBase64(originalPsbtBase64)

      // Step 2: Combine all signed PSBTs with the original
      const combinedPsbt = originalPsbt

      for (let i = 0; i < collectedSignedPsbts.length; i++) {
        const signedPsbtBase64 = collectedSignedPsbts[i]

        try {
          const signedPsbt = bitcoinjs.Psbt.fromBase64(signedPsbtBase64)

          // Combine this signed PSBT with the accumulated result
          combinedPsbt.combine(signedPsbt)
        } catch (_error) {
          toast.error(`Error combining signed PSBT ${i + 1}`)
          return null
        }
      }

      // Step 3: Finalize the combined PSBT

      // Check if all inputs have enough signatures before attempting finalization
      const allInputsReady = combinedPsbt.data.inputs.every(hasEnoughSignatures)

      if (!allInputsReady) {
        toast.error(
          'Not all inputs have enough signatures to finalize the transaction'
        )
        return null
      }
      try {
        combinedPsbt.finalizeAllInputs()
      } catch {
        for (let i = 0; i < combinedPsbt.data.inputs.length; i++) {
          try {
            combinedPsbt.finalizeInput(i)
          } catch {
            toast.error('Failed to finalize input')
          }
        }

        toast.error('Failed to finalize transaction - insufficient signatures')
        return null
      }

      // Step 4: Extract the final transaction
      try {
        const finalTransaction = combinedPsbt.extractTransaction()
        const transactionHex = finalTransaction.toHex()

        setSignedTx(transactionHex)

        toast.success('Multisig transaction finalized successfully!')
        return transactionHex
      } catch {
        toast.error('Failed to extract final transaction')
        return null
      }
    } catch {
      toast.error('Failed to combine and finalize PSBTs')
      return null
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

  // Close expanded signatures when navigating away
  useEffect(() => {
    // No longer needed - each dropdown manages its own state
  }, [messageId])

  // Decrypt keys to check for seed existence
  useEffect(() => {
    async function decryptKeys() {
      if (!account || !account.keys || account.keys.length === 0) return

      const pin = await getItem(PIN_KEY)
      if (!pin) return

      try {
        const decryptedKeysData = await Promise.all(
          account.keys.map(async (key) => {
            if (typeof key.secret === 'string') {
              // Decrypt the key's secret
              const decryptedSecretString = await aesDecrypt(
                key.secret,
                pin,
                key.iv
              )
              const decryptedSecret = JSON.parse(
                decryptedSecretString
              ) as Secret

              return {
                ...key,
                secret: decryptedSecret
              }
            } else {
              return key
            }
          })
        )

        setDecryptedKeys(decryptedKeysData)
      } catch (_error) {
        // Handle error silently - keys remain encrypted
        setDecryptedKeys([])
      }
    }
    decryptKeys()
  }, [account])

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

              {/* Multisig Signature Required Display */}
              {account.policyType === 'multisig' &&
                account.keys &&
                account.keys.length > 0 && (
                  <SSVStack gap="md" style={{ marginTop: 16 }}>
                    <SSText center color="muted" size="sm" uppercase>
                      {t('transaction.preview.multisigSignatureRequired')}
                    </SSText>

                    {/* N of M Component */}
                    <SSText
                      style={{
                        alignSelf: 'center',
                        fontSize: 55,
                        textTransform: 'lowercase'
                      }}
                    >
                      {account.keysRequired || 1} {t('common.of')}{' '}
                      {account.keyCount || 1}
                    </SSText>

                    <SSSignatureRequiredDisplay
                      requiredNumber={account.keysRequired || 1}
                      totalNumber={account.keyCount || 1}
                      collectedSignatures={Array.from(signedPsbts.entries())
                        .filter(([, psbt]) => psbt && psbt.trim().length > 0)
                        .map(([index]) => index)}
                      validationResults={validationResults}
                    />

                    {/* Individual Signature Buttons - Dynamic based on number of cosigners */}
                    <SSVStack gap="none">
                      {account.keys?.map((key, index) => (
                        <SSSignatureDropdown
                          key={index}
                          index={index}
                          totalKeys={account.keys?.length || 0}
                          keyDetails={key}
                          messageId={messageId}
                          txBuilderResult={txBuilderResult}
                          serializedPsbt={serializedPsbt}
                          signedPsbt={signedPsbts.get(index) || ''}
                          setSignedPsbt={(psbt: string) =>
                            updateSignedPsbt(index, psbt)
                          }
                          isAvailable={isAvailable}
                          isEmitting={isEmitting}
                          isReading={isReading}
                          decryptedKey={decryptedKeys[index]}
                          account={account}
                          accountId={id!}
                          onShowQR={() => setNoKeyModalVisible(true)}
                          onNFCExport={handleNFCExport}
                          onPasteFromClipboard={
                            handleCosignerPasteFromClipboard
                          }
                          onCameraScan={handleCosignerCameraScan}
                          onNFCScan={handleCosignerNFCScan}
                          onSignWithLocalKey={() =>
                            handleSignWithLocalKey(index)
                          }
                          onSignWithSeedQR={() => handleSeedQRScanned(index)}
                          onSignWithSeedWords={() =>
                            handleSeedWordsScanned(index)
                          }
                          validationResult={validationResults.get(index)}
                        />
                      ))}
                    </SSVStack>
                  </SSVStack>
                )}

              {account.policyType !== 'watchonly' &&
              account.keys &&
              account.keys.length > 0 ? (
                <>
                  {account.policyType === 'multisig' && (
                    <SSText
                      center
                      color="muted"
                      size="sm"
                      style={{ marginBottom: 8 }}
                    >
                      {t('transaction.preview.signaturesCollected')}:{' '}
                      {
                        Array.from(signedPsbts.values()).filter(
                          (psbt) => psbt && psbt.trim().length > 0
                        ).length
                      }{' '}
                      / {account.keysRequired || account.keys.length}
                    </SSText>
                  )}
                  <SSButton
                    variant="secondary"
                    disabled={
                      !messageId ||
                      (account.policyType === 'multisig' &&
                        !hasAllRequiredSignatures())
                    }
                    label={
                      account.policyType === 'multisig'
                        ? t('transaction.preview.checkAllSignatures')
                        : t('sign.transaction')
                    }
                    onPress={async () => {
                      // For multisig accounts, combine and finalize PSBTs first
                      if (account?.policyType === 'multisig') {
                        const finalTransactionHex =
                          await combineAndFinalizeMultisigPSBTs()

                        if (finalTransactionHex) {
                          router.navigate(
                            `/account/${id}/signAndSend/signMessage`
                          )
                        } else {
                          // Don't navigate if finalization failed
                        }
                      } else {
                        // For non-multisig accounts, navigate directly
                        router.navigate(
                          `/account/${id}/signAndSend/signMessage`
                        )
                      }
                    }}
                  />
                </>
              ) : (
                account.keys &&
                account.keys.length > 0 &&
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
                            : 'Export NFC'
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
                        onPress={handleWatchOnlyPasteFromClipboard}
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
                        onPress={handleWatchOnlyNFCScan}
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
          onClose={() => {
            setNoKeyModalVisible(false)
          }}
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
            setCurrentCosignerIndex(null)
          }}
        >
          <SSVStack itemsCenter gap="md">
            <SSText color="muted" uppercase>
              {scanProgress.type
                ? `Scanning ${scanProgress.type.toUpperCase()} QR Code`
                : currentCosignerIndex !== null &&
                    (() => {
                      const secret = decryptedKeys[currentCosignerIndex]?.secret
                      return !(
                        secret &&
                        typeof secret === 'object' &&
                        'mnemonic' in secret &&
                        (secret as Secret)?.mnemonic
                      )
                    })()
                  ? 'Scan Seed QR Code'
                  : t('camera.scanQRCode')}
            </SSText>

            <CameraView
              onBarcodeScanned={(res) => {
                handleQRCodeScanned(res.raw, currentCosignerIndex ?? undefined)
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

        {/* Word Count Selection Modal */}
        <SSModal
          visible={wordCountModalVisible}
          fullOpacity
          onClose={() => {
            setWordCountModalVisible(false)
            setCurrentCosignerIndex(null)
          }}
        >
          <SSVStack gap="lg">
            <SSText center uppercase>
              Select Seed Word Count
            </SSText>
            <SSText center color="muted" size="sm">
              Choose the number of words in your mnemonic seed
            </SSText>

            <SSVStack gap="sm">
              {[12, 15, 18, 21, 24].map((wordCount) => (
                <SSButton
                  key={wordCount}
                  label={`${wordCount} words`}
                  variant={
                    selectedWordCount === wordCount ? 'outline' : 'ghost'
                  }
                  onPress={() =>
                    setSelectedWordCount(wordCount as MnemonicWordCount)
                  }
                />
              ))}
            </SSVStack>
          </SSVStack>
          <SSHStack gap="sm">
            <SSButton
              label="Continue"
              variant="secondary"
              onPress={() => handleWordCountSelect(selectedWordCount)}
            />
          </SSHStack>
        </SSModal>

        {/* Seed Words Input Modal */}
        <SSModal
          visible={seedWordsModalVisible}
          fullOpacity
          onClose={() => {
            setSeedWordsModalVisible(false)
            setCurrentMnemonic('')
            _setCurrentFingerprint('')
            setCurrentCosignerIndex(null)
          }}
        >
          <ScrollView style={{ width: '100%', maxWidth: 400, maxHeight: 600 }}>
            <View style={{ paddingHorizontal: 16 }}>
              <SSVStack gap="lg">
                <SSText center uppercase>
                  Enter Seed Words
                </SSText>
                <SSText center color="muted" size="sm">
                  Enter your {selectedWordCount}-word mnemonic seed phrase
                </SSText>
              </SSVStack>

              <SSSeedWordsInput
                wordCount={selectedWordCount}
                network={network as Network}
                onMnemonicValid={handleMnemonicValid}
                onMnemonicInvalid={handleMnemonicInvalid}
                showPassphrase
                showChecksum
                showFingerprint
                showPasteButton
                showActionButton
                actionButtonLabel="Sign with Seed Words"
                actionButtonVariant="secondary"
                onActionButtonPress={handleSeedWordsSubmit}
                actionButtonDisabled={false}
                actionButtonLoading={false}
                showCancelButton={false}
                autoCheckClipboard
              />
            </View>
          </ScrollView>
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
