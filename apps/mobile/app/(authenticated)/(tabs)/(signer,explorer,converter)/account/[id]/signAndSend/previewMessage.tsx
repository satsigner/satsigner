// React and React Native imports
// External dependencies
import { type Network } from 'bdk-rn/lib/lib/enums'
import * as bitcoinjs from 'bitcoinjs-lib'
import { color } from 'd3'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

// Internal imports
import { buildTransaction } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSGradientModal from '@/components/SSGradientModal'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
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
import { useWalletsStore } from '@/store/wallets'
import { Colors, Typography } from '@/styles'
import { gray } from '@/styles/colors'
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

interface NFCTagWithNDEF {
  ndefMessage?: { tnf: number; type: Uint8Array; payload: Uint8Array }[]
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

  const [qrChunks, setQrChunks] = useState<string[]>([])
  const [qrError, setQrError] = useState<string | null>(null)
  const [serializedPsbt, setSerializedPsbt] = useState<string>('')
  const [urChunks, setUrChunks] = useState<string[]>([])
  const [currentUrChunk, setCurrentUrChunk] = useState(0)
  const [rawPsbtChunks, setRawPsbtChunks] = useState<string[]>([])
  const [currentRawChunk, setCurrentRawChunk] = useState(0)
  const [qrComplexity, setQrComplexity] = useState(8) // 1-12 scale, 8 is default (higher = simpler/larger QR codes)
  const [animationSpeed, setAnimationSpeed] = useState(6) // 1-12 scale for animation speed

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
          current: parseInt(match[1]) - 1, // Convert to 0-based index
          total: parseInt(match[2]),
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
        const [, currentStr, totalStr, content] = urMatch

        if (currentStr && totalStr) {
          // Multi-part UR
          const current = parseInt(currentStr) - 1 // Convert to 0-based index
          const total = parseInt(totalStr)
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
            .map(([_, content]) => content)
          return sortedChunks.join('')
        }

        case 'bbqr': {
          // Assemble BBQR format chunks
          const sortedChunks = Array.from(chunks.entries())
            .sort(([a], [b]) => a - b)
            .map(([_, content]) => content)

          const decoded = decodeBBQRChunks(sortedChunks)

          if (decoded) {
            // Convert binary PSBT to base64 for compatibility
            const hexResult = Buffer.from(decoded).toString('hex')
            const base64Result = Buffer.from(decoded).toString('base64')

            return base64Result
          }

          return null
        }

        case 'ur': {
          // UR format assembly using proper UR decoder
          const sortedChunks = Array.from(chunks.entries())
            .sort(([a], [b]) => a - b)
            .map(([_, content]) => content)

          let result: string
          if (sortedChunks.length === 1) {
            // Single UR chunk
            result = decodeURToPSBT(sortedChunks[0])
          } else {
            // Multi-part UR
            result = decodeMultiPartURToPSBT(sortedChunks)
          }

          // Try to convert to base64 if it's valid hex
          try {
            const isValidHex = /^[a-fA-F0-9]+$/.test(result)
            if (isValidHex) {
              const base64Result = Buffer.from(result, 'hex').toString('base64')
            }
          } catch (error) {
            toast.error(String(error))
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

  // Function to split raw PSBT into chunks for animated display
  const createRawPsbtChunks = useCallback(
    (base64Psbt: string): string[] => {
      // Special case: complexity 12 = single static QR with all data
      if (qrComplexity === 12) {
        return [base64Psbt] // No chunking, no header, just the full data
      }

      // Calculate chunk size based on complexity (higher complexity = larger chunks)
      // Invert the scale: complexity 1 = smallest chunks, complexity 11 = large chunks
      const baseChunkSize = 50
      const chunkSize = Math.max(50, baseChunkSize * qrComplexity)

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
    [qrComplexity]
  )

  const transactionHex = useMemo(() => {
    if (!account) return ''

    const transaction = new bitcoinjs.Transaction()
    const network = bitcoinjsNetwork(account.network)

    for (const input of inputs.values()) {
      const hashBuffer = Buffer.from(parseHexToBytes(input.txid))
      transaction.addInput(hashBuffer, input.vout)
    }

    for (const output of outputs) {
      const outputScript = bitcoinjs.address.toOutputScript(output.to, network)
      transaction.addOutput(outputScript, output.amount)
    }

    return transaction.toHex()
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
        const transactionMessage = await buildTransaction(
          wallet,
          {
            inputs: Array.from(inputs.values()),
            outputs: Array.from(outputs.values()),
            fee,
            options: { rbf }
          },
          network as Network
        )

        // transactionMessage.txDetails.transaction.output()
        // transactionMessage.txDetails.transaction.input()

        setMessageId(transactionMessage.txDetails.txid)
        setTxBuilderResult(transactionMessage)
      } catch (err) {
        toast.error(String(err))
      }
    }

    getTransactionMessage()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

      return psbtHex
    } catch (_e) {
      toast.error(t('error.psbt.serialization'))
      return null
    }
  }, [txBuilderResult])

  useEffect(() => {
    const updateQrChunks = async () => {
      try {
        const psbtHex = await getPsbtString()
        if (!psbtHex) {
          setQrError(t('error.psbt.notAvailable'))
          setQrChunks([])
          setUrChunks([])
          return
        }

        try {
          // Create BBQR chunks using complexity setting
          const psbtBuffer = Buffer.from(psbtHex, 'hex')
          let bbqrChunks: string[]

          try {
            if (qrComplexity === 12) {
              // Complexity 12: Create single static BBQR chunk
              bbqrChunks = createBBQRChunks(
                new Uint8Array(psbtBuffer),
                FileType.PSBT,
                psbtBuffer.length * 10
              )
            } else {
              // Complexity 1-11: Create multiple chunks (higher = larger chunks)
              const bbqrChunkSize = Math.max(50, 25 * qrComplexity)

              bbqrChunks = createBBQRChunks(
                new Uint8Array(psbtBuffer),
                FileType.PSBT,
                bbqrChunkSize
              )
            }
          } catch (bbqrError) {
            bbqrChunks = []
          }
          setQrChunks(bbqrChunks)

          if (!txBuilderResult?.psbt?.base64) {
            throw new Error('PSBT data not available')
          }

          // Generate raw PSBT chunks using complexity setting
          const rawChunks = createRawPsbtChunks(txBuilderResult.psbt.base64)
          setRawPsbtChunks(rawChunks)
          setCurrentRawChunk(0)

          // Generate UR fragments using complexity setting
          let urFragments: string[]

          if (qrComplexity === 12) {
            // Complexity 12: Create single static UR fragment
            urFragments = getURFragmentsFromPSBT(
              txBuilderResult.psbt.base64,
              'base64',
              txBuilderResult.psbt.base64.length // Use full length for single fragment
            )
          } else {
            // Complexity 1-11: Create multiple fragments (higher = larger fragments)
            const urFragmentSize = Math.max(10, 5 * qrComplexity)
            urFragments = getURFragmentsFromPSBT(
              txBuilderResult.psbt.base64,
              'base64',
              urFragmentSize
            )
          }

          setUrChunks(urFragments)
          setCurrentUrChunk(0) // Reset to 0 when new chunks are set
          setQrError(null)
        } catch (_e) {
          setQrError(t('error.qr.generation'))
          setQrChunks([])
          setUrChunks([])
          setRawPsbtChunks([])
        }
      } catch (_e) {
        setQrError(t('error.psbt.notAvailable'))
        setQrChunks([])
        setUrChunks([])
        setRawPsbtChunks([])
      }
    }

    updateQrChunks()
  }, [
    getPsbtString,
    txBuilderResult?.psbt?.base64,
    qrComplexity,
    createRawPsbtChunks
  ])

  // Keep animation speed the same but with smaller chunks
  useEffect(() => {
    // Don't animate when complexity is 12 (static mode)
    if (qrComplexity === 12) {
      return
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

      const animationInterval = setInterval(() => {
        if (displayMode === QRDisplayMode.RAW) {
          setCurrentRawChunk((prev) => (prev + 1) % rawPsbtChunks.length)
        } else if (displayMode === QRDisplayMode.UR) {
          setCurrentUrChunk((prev) => (prev + 1) % urChunks.length)
        } else {
          setCurrentChunk((prev) => (prev + 1) % qrChunks.length)
        }
      }, interval)
      return () => clearInterval(animationInterval)
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
      setCameraModalVisible(false)
      setSignedPsbt(qrInfo.content)
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

      toast.success(`Scanned part ${current + 1} of ${total}`)
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

    // Check if we have all chunks
    if (newScanned.size === total) {
      // All chunks collected, assemble the final result
      const assembledData = assembleMultiPartQR(type, newChunks)

      if (assembledData) {
        setCameraModalVisible(false)
        setSignedPsbt(assembledData)
        resetScanProgress()
        toast.success(
          `Successfully assembled ${type.toUpperCase()} transaction from ${total} parts`
        )
      } else {
        toast.error('Failed to assemble multi-part QR code')
        resetScanProgress()
      }
    } else {
      toast.success(
        `Scanned part ${current + 1} of ${total} (${newScanned.size}/${total} complete)`
      )
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
    } catch (error) {
      const errorMessage = (error as Error).message
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
        toast.success(t('watchonly.read.success'))
      } else if (result.txId) {
        setSignedPsbt(result.txId)
        toast.success(t('watchonly.read.success'))
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

  const getQRValue = () => {
    switch (displayMode) {
      case QRDisplayMode.RAW: {
        // Always use chunks for RAW mode to ensure animation
        if (rawPsbtChunks.length > 0) {
          return rawPsbtChunks[currentRawChunk] || 'NO_CHUNKS'
        }
        // Fallback to full base64 PSBT if chunks not ready
        const base64Psbt = txBuilderResult?.psbt?.base64
        if (base64Psbt && base64Psbt.length > 1852) {
          return 'DATA_TOO_LARGE'
        }
        return base64Psbt || 'NO_DATA'
      }
      case QRDisplayMode.UR: {
        const urValue = urChunks[currentUrChunk]
        return urValue || 'NO_CHUNKS'
      }
      case QRDisplayMode.BBQR: {
        const bbqrValue = qrChunks?.[currentChunk] || 'NO_CHUNKS'

        return bbqrValue
      }
    }
  }

  const getDisplayModeDescription = () => {
    switch (displayMode) {
      case QRDisplayMode.RAW:
        if (rawPsbtChunks.length > 0) {
          if (qrComplexity === 12) {
            return 'Static QR - Complete PSBT in single code'
          }
          return rawPsbtChunks.length > 1
            ? t('transaction.preview.scanAllChunks', {
                current: currentRawChunk + 1,
                total: rawPsbtChunks.length
              })
            : t('transaction.preview.singleChunk')
        }
        if (serializedPsbt.length > 1852) {
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
        if (qrComplexity === 12) {
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
          return t('error.psbt.notAvailable')
        }
        if (qrComplexity === 12) {
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
                            toast(t('common.copied'))
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
                          isEmitting ? t('watchonly.read.scanning') : 'Emit NFC'
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
                      {t('transaction.preview.importSigned')}
                    </SSText>
                    <SSTextInput
                      placeholder={t('transaction.preview.signedPsbt')}
                      editable={false}
                      style={{
                        fontFamily: Typography.sfProMono,
                        fontSize: 12,
                        height: 200,
                        textAlignVertical: 'top',
                        paddingTop: 12,
                        paddingBottom: 12
                      }}
                      value={signedPsbt}
                      multiline
                      numberOfLines={18}
                    />
                    <SSHStack gap="xxs" justifyBetween>
                      <SSButton
                        label="Paste"
                        style={{ width: '48%' }}
                        variant="outline"
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
                    onPress={() => setDisplayMode(QRDisplayMode.RAW)}
                    style={{ flex: 1 }}
                  />
                  <SSButton
                    variant={
                      displayMode === QRDisplayMode.UR ? 'secondary' : 'outline'
                    }
                    label="UR"
                    onPress={() => setDisplayMode(QRDisplayMode.UR)}
                    style={{ flex: 1 }}
                  />
                  <SSButton
                    variant={
                      displayMode === QRDisplayMode.BBQR
                        ? 'secondary'
                        : 'outline'
                    }
                    label="BBQR"
                    onPress={() => setDisplayMode(QRDisplayMode.BBQR)}
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
                        variant="outline"
                        label="+"
                        onPress={() =>
                          setQrComplexity(Math.min(12, qrComplexity + 1))
                        }
                        style={{ height: 50, width: 50 }}
                      />
                    </SSHStack>
                  </SSVStack>

                  <SSVStack gap="xs">
                    <SSText color="white" size="sm" center>
                      Speed: {animationSpeed}/12
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

            {/* Show progress if scanning multi-part QR */}
            {scanProgress.type && scanProgress.total > 1 && (
              <SSVStack itemsCenter gap="xs" style={{ marginBottom: 10 }}>
                <SSText color="white" center>
                  {`Progress: ${scanProgress.scanned.size}/${scanProgress.total} chunks`}
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
                      backgroundColor: Colors.warning,
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
              </SSVStack>
            )}

            <CameraView
              onBarcodeScanned={(res) => handleQRCodeScanned(res.raw)}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              style={{ width: 340, height: 340 }}
            />

            {!permission?.granted && (
              <SSButton
                label={t('camera.enableCameraAccess')}
                onPress={requestPermission}
              />
            )}

            {/* Reset button for multi-part scans */}
            {scanProgress.type && (
              <SSButton
                label="Reset Scan"
                variant="outline"
                onPress={resetScanProgress}
                style={{ marginTop: 10 }}
              />
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
            <SSText color="muted" uppercase>
              {nfcError
                ? t('common.error')
                : t('transaction.preview.exportingNFC')}
            </SSText>
            {nfcError ? (
              <SSVStack itemsCenter gap="md">
                <SSText color="white" center>
                  {nfcError}
                </SSText>
                <SSText color="muted" center size="sm">
                  {t('transaction.preview.nfcExportTip')}
                </SSText>
              </SSVStack>
            ) : (
              <View
                style={{
                  width: 200,
                  height: 200,
                  backgroundColor: Colors.gray[800],
                  borderRadius: 100,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <SSText size="lg" color="muted">
                  {isEmitting ? '...' : 'NFC'}
                </SSText>
              </View>
            )}
            <SSButton
              label={nfcError ? t('common.close') : t('common.cancel')}
              variant="ghost"
              onPress={() => {
                setNfcModalVisible(false)
                setNfcError(null)
                if (isEmitting) cancelNFCEmitterScan()
              }}
            />
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
            <SSText color="muted" uppercase>
              {t('watchonly.read.scanning')}
            </SSText>
            <View
              style={{
                width: 200,
                height: 200,
                backgroundColor: Colors.gray[800],
                borderRadius: 100,
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <SSText size="lg" color="muted">
                {isReading ? '...' : 'NFC'}
              </SSText>
            </View>
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => {
                setNfcScanModalVisible(false)
                if (isReading) cancelNFCScan()
              }}
            />
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
