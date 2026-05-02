import * as bitcoinjs from 'bitcoinjs-lib'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Clipboard from 'expo-clipboard'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { buildTransaction } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSDustWarningBanner from '@/components/SSDustWarningBanner'
import SSKeyboardWordSelector from '@/components/SSKeyboardWordSelector'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSSeedWordsInput from '@/components/SSSeedWordsInput'
import SSSignatureDropdown from '@/components/SSSignatureDropdown'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import SSTransactionIdFormatted from '@/components/SSTransactionIdFormatted'
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
import { getItem, getKeySecret } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useNostrStore } from '@/store/nostr'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Sizes, Typography } from '@/styles'
import {
  type Key,
  type MnemonicWordCount,
  type Secret
} from '@/types/models/Account'
import { type Output } from '@/types/models/Output'
import {
  type MockPsbt,
  type PsbtInputWithSignatures
} from '@/types/models/Psbt'
import { type Utxo } from '@/types/models/Utxo'
import { type PreviewTransactionSearchParams } from '@/types/navigation/searchParams'
import { getKeyFingerprint } from '@/utils/account'
import {
  BBQRFileTypes,
  createBBQRChunks,
  decodeBBQRChunks,
  isBBQRFragment
} from '@/utils/bbqr'
import { appNetworkToBdkNetwork, bitcoinjsNetwork } from '@/utils/bitcoin'
import { aesDecrypt } from '@/utils/crypto'
import { parseHexToBytes } from '@/utils/parse'
import {
  type ExtractedTransactionData,
  extractIndividualSignedPsbts,
  extractOriginalPsbt,
  extractTransactionDataFromPSBTEnhanced,
  extractTransactionIdFromPSBT,
  getCollectedSignerPubkeys,
  matchSignedPsbtsToCosigners,
  validateSignedPSBTForCosigner
} from '@/utils/psbt'
import { detectAndDecodeSeedQR } from '@/utils/seedqr'
import {
  estimateTransactionSize,
  legacyEstimateTransactionSize
} from '@/utils/transaction'
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

type QrFormatModeTabProps = {
  label: string
  onPress: () => void
  selected: boolean
}

function QrFormatModeTab({ label, onPress, selected }: QrFormatModeTabProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: selected ? Colors.white : 'transparent',
        borderRadius: Sizes.button.borderRadius,
        flex: 1,
        height: Sizes.button.height - 6,
        justifyContent: 'center',
        opacity: pressed ? 0.88 : 1
      })}
    >
      <SSText center color={selected ? 'black' : 'white'} size="sm" uppercase>
        {label}
      </SSText>
    </Pressable>
  )
}

function hasEnoughSignatures(input: PsbtInputWithSignatures) {
  if (!input.witnessScript) {
    return true
  }

  try {
    const script = bitcoinjs.script.decompile(input.witnessScript)

    if (!script || script.length < 3) {
      return false
    }

    const [op] = script

    if (typeof op !== 'number' || op < 81 || op > 96) {
      return false
    }

    const threshold = op - 80
    const signatureCount = input.partialSig ? input.partialSig.length : 0

    return signatureCount >= threshold
  } catch {
    toast.error(t('common.error.checkingInputSignatures'))
    return false
  }
}

function createMockPsbt(
  psbtBase64: string,
  txid: string,
  txFee: number
): MockPsbt {
  return {
    extractTxHex: () => '',
    feeAmount: () => BigInt(txFee),
    feeRate: () => undefined,
    getUtxoFor: () => undefined,
    toBase64: () => psbtBase64,
    txid: () => txid
  }
}

function generateTransactionId(psbtBase64: string): string {
  const extractedTxid = extractTransactionIdFromPSBT(psbtBase64)
  return extractedTxid || `PSBT-${Date.now().toString(36)}`
}

function mapBuildTransactionError(error: unknown): {
  message: string
  isDust: boolean
} {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const lower = errorMessage.toLowerCase()
  if (lower.includes('dust')) {
    return {
      isDust: true,
      message: t('transaction.error.previewBuildFailedDust')
    }
  }
  return { isDust: false, message: errorMessage }
}

function handlePsbtExtractionError(error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'

  if (
    errorMessage.includes('fingerprint') ||
    errorMessage.includes('derivation') ||
    errorMessage.includes('not match')
  ) {
    toast.warning(
      'This PSBT does not match the current account. Using basic processing.'
    )
  } else if (
    errorMessage.includes('Invalid PSBT') ||
    errorMessage.includes('malformed')
  ) {
    toast.error('Invalid PSBT format. Please check the PSBT data.')
  } else {
    toast.warning(
      'Failed to process PSBT with enhanced features. Using basic processing.'
    )
  }
}

function PreviewTransaction() {
  const router = useRouter()
  const { id, psbt } = useLocalSearchParams<PreviewTransactionSearchParams>()

  const [
    inputs,
    outputs,
    fee,
    rbf,
    setPsbt,
    txBuilderResult,
    setSignedTx,
    addInput,
    addOutput,
    setFee,
    setRbf,
    signedPsbtsFromStore,
    clearTransaction,
    clearPsbt
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.inputs,
      state.outputs,
      state.fee,
      state.rbf,
      state.setPsbt,
      state.psbt,
      state.setSignedTx,
      state.addInput,
      state.addOutput,
      state.setFee,
      state.setRbf,
      state.signedPsbts,
      state.clearTransaction,
      state.clearPsbt
    ])
  )

  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
  )
  const ownAddresses = useMemo(
    () => new Set(account?.addresses?.map((a) => a.address)),
    [account]
  )
  const setTransactionToShare = useNostrStore(
    (state) => state.setTransactionToShare
  )
  const wallet = useGetAccountWallet(id!)
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const [transactionId, setTransactionId] = useState('')
  const [isLoadingPSBT, setIsLoadingPSBT] = useState(false)
  const [psbtBuildStatus, setPsbtBuildStatus] = useState<
    'building' | 'error' | 'idle'
  >('idle')
  const [psbtBuildErrorMessage, setPsbtBuildErrorMessage] = useState('')
  const [isDustError, setIsDustError] = useState(false)

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

  const [wordSelectorState, setWordSelectorState] = useState({
    onWordSelected: () => {
      // noop
    },
    visible: false,
    wordStart: ''
  })

  const [permission, requestPermission] = useCameraPermissions()

  const {
    isHardwareSupported: nfcHardwareSupported,
    isReading,
    readNFCTag,
    cancelNFCScan
  } = useNFCReader()
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
  const nfcPulseAnim = useSharedValue(0)

  const nfcPulseStyle = useAnimatedStyle(() => ({
    alignItems: 'center' as const,
    backgroundColor: interpolateColor(
      nfcPulseAnim.value,
      [0, 1],
      [Colors.gray[800], Colors.gray[400]]
    ),
    borderRadius: 100,
    height: 200,
    justifyContent: 'center' as const,
    width: 200
  }))

  // PSBT Management Hook
  const psbtManagement = usePSBTManagement({
    account,
    decryptedKeys,
    psbt: txBuilderResult
  })

  // Destructure hook values for easier access
  const {
    signedPsbt,
    signedPsbts,
    setSignedPsbts,
    updateSignedPsbt,
    convertPsbtToFinalTransaction,
    handleSignWithLocalKey,
    handleSignWithSeedQR
  } = psbtManagement

  function processExtractedPsbtData(extractedData: ExtractedTransactionData) {
    for (const input of extractedData.inputs) {
      addInput({
        addressTo: input.address,
        keychain: input.keychain || 'external',
        label: input.label,
        script: Buffer.from(input.script, 'hex').toJSON().data,
        txid: input.txid,
        value: input.value,
        vout: input.vout
      })
    }

    for (const output of extractedData.outputs) {
      addOutput({
        amount: output.value,
        label: output.label || '',
        to: output.address
      })
    }

    if (extractedData.fee) {
      setFee(extractedData.fee)
    }

    setRbf(true)
  }

  function processBasicPsbt(psbtBase64: string) {
    const txid = generateTransactionId(psbtBase64)
    setTransactionId(txid)
    const mockResult = createMockPsbt(psbtBase64, txid, 0)
    setPsbt(mockResult)
    setIsLoadingPSBT(false)
  }

  function processPsbtWithAccount(
    psbtBase64: string,
    accountData: NonNullable<typeof account>
  ) {
    try {
      const extractedData = extractTransactionDataFromPSBTEnhanced(
        psbtBase64,
        accountData
      )

      if (!extractedData) {
        throw new Error(
          'Failed to extract transaction data from PSBT. This PSBT may not match the current account.'
        )
      }

      processExtractedPsbtData(extractedData)

      const txid = generateTransactionId(psbtBase64)
      setTransactionId(txid)
      const mockResult = createMockPsbt(psbtBase64, txid, extractedData.fee)
      setPsbt(mockResult)
      setIsLoadingPSBT(false)
    } catch (error) {
      handlePsbtExtractionError(error)

      try {
        processBasicPsbt(psbtBase64)
        toast.info(
          'PSBT loaded with basic processing. Some features may be limited.'
        )
      } catch {
        setIsLoadingPSBT(false)
        toast.error(t('common.error.processPSBT'))
        setTransactionId(`PSBT-ERROR-${Date.now().toString(36)}`)
      }
    }
  }

  function processPsbtWithoutAccount(psbtBase64: string) {
    try {
      processBasicPsbt(psbtBase64)
      toast.info('PSBT loaded. Some features may be limited.')
    } catch {
      setIsLoadingPSBT(false)
      toast.error(t('common.error.processPSBT'))
      setTransactionId(`PSBT-ERROR-${Date.now().toString(36)}`)
    }
  }

  useEffect(() => {
    if (!psbt) {
      return
    }

    setIsLoadingPSBT(true)
    clearTransaction()
    setSignedTx('')

    if (account) {
      processPsbtWithAccount(psbt, account)
    } else {
      processPsbtWithoutAccount(psbt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [psbt, account])

  // Separate effect to detect existing signatures - runs when both PSBT and decryptedKeys are ready
  useEffect(() => {
    if (!psbt || !account || decryptedKeys.length === 0 || !account.keys) {
      return
    }

    const currentAccount = account
    const currentPsbt = psbt

    async function detectSignatures() {
      if (!currentAccount || !currentAccount.keys || !currentPsbt) {
        return
      }

      const combinedPsbtBase64: string = currentPsbt

      // Check if PSBT can be parsed
      let psbtObj: bitcoinjs.Psbt
      try {
        psbtObj = bitcoinjs.Psbt.fromBase64(combinedPsbtBase64)
      } catch {
        return
      }

      // Check if PSBT has any partial signatures
      const psbtHasSignatures = psbtObj.data.inputs.some(
        (input) => input.partialSig && input.partialSig.length > 0
      )
      if (!psbtHasSignatures) {
        return
      }

      // Extract original PSBT - if this fails, the PSBT structure is invalid
      let originalPsbtBase64: string
      try {
        originalPsbtBase64 = extractOriginalPsbt(combinedPsbtBase64)
      } catch {
        return
      }

      // Build a map of fingerprint to cosigner index
      const keyFingerprintToCosignerIndex = new Map<string, number>()
      await Promise.all(
        currentAccount.keys.map(async (key, index) => {
          const fp = await getKeyFingerprint(key)
          if (fp) {
            keyFingerprintToCosignerIndex.set(fp, index)
          }
        })
      )

      // Build a map of pubkey to cosigner index from BIP32 derivations
      const pubkeyToCosignerIndex = new Map<string, number>()
      for (const input of psbtObj.data.inputs) {
        if (!input.bip32Derivation) {
          continue
        }
        for (const derivation of input.bip32Derivation) {
          const fingerprint = derivation.masterFingerprint.toString('hex')
          const pubkey = derivation.pubkey.toString('hex')
          const cosignerIndex = keyFingerprintToCosignerIndex.get(fingerprint)
          if (cosignerIndex === undefined) {
            continue
          }
          pubkeyToCosignerIndex.set(pubkey, cosignerIndex)
        }
      }

      // Get all pubkeys that have signatures in the PSBT
      const signerPubkeys = getCollectedSignerPubkeys(combinedPsbtBase64)
      if (signerPubkeys.size === 0) {
        return
      }

      // Split combined PSBT into per-signer PSBTs (by pubkey)
      const bySigner = extractIndividualSignedPsbts(
        combinedPsbtBase64,
        originalPsbtBase64
      ) as Record<number, string>
      if (Object.keys(bySigner).length === 0) {
        return
      }

      // Match signed PSBTs to cosigners using the utility function
      const matches = matchSignedPsbtsToCosigners(
        bySigner,
        pubkeyToCosignerIndex,
        currentAccount,
        decryptedKeys,
        signedPsbts
      )

      // Apply matches and show notifications
      for (const match of matches) {
        updateSignedPsbt(match.cosignerIndex, match.signedPsbtBase64)
        toast.success(
          t('transaction.build.preview.detectedSignature', {
            cosigner: match.cosignerIndex + 1
          })
        )
      }
    }

    detectSignatures()
  }, [psbt, account, decryptedKeys, updateSignedPsbt, signedPsbts])

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
          toast.error(t('common.error.validatingCosignerSignature'))
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
    chunks: new Map(),
    scanned: new Set(),
    total: 0,
    type: null
  })

  // Helper functions for QR code detection and parsing
  const detectQRType = (data: string) => {
    // Check for RAW format (pXofY header)
    if (/^p\d+of\d+\s/.test(data)) {
      const match = data.match(/^p(\d+)of(\d+)\s/)
      if (match) {
        return {
          content: data.substring(match[0].length),
          current: parseInt(match[1], 10) - 1, // Convert to 0-based index
          total: parseInt(match[2], 10),
          type: 'raw' as const
        }
      }
    }

    // Check for BBQR format
    if (isBBQRFragment(data)) {
      const total = parseInt(data.slice(4, 6), 36)
      const current = parseInt(data.slice(6, 8), 36)
      return {
        content: data,
        current,
        total,
        type: 'bbqr' as const
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
            content: data,
            current,
            total,
            type: 'ur' as const
          }
        }
        // Single-part UR
        return {
          content: data,
          current: 0,
          total: 1,
          type: 'ur' as const
        }
      }
    }

    // Single QR code (no multi-part format detected)
    return {
      content: data,
      current: 0,
      total: 1,
      type: 'single' as const
    }
  }

  const resetScanProgress = () => {
    setScanProgress({
      chunks: new Map(),
      scanned: new Set(),
      total: 0,
      type: null
    })
  }

  // Helper function to convert PSBT to final transaction if needed
  const processScannedData = (data: string): string => {
    try {
      // Strip "bitcoin:" prefix if present (case-insensitive)
      let processedData = data
      if (processedData.toLowerCase().startsWith('bitcoin:')) {
        processedData = processedData.substring(8)
      }

      // Check if data is a PSBT and convert to final transaction
      if (processedData.toLowerCase().startsWith('70736274ff')) {
        // Only attempt conversion if we have the original PSBT context
        if (txBuilderResult?.toBase64()) {
          const convertedResult = convertPsbtToFinalTransaction(processedData)
          return convertedResult
        }
        return processedData
      }
      return processedData
    } catch {
      return data
    }
  }

  const assembleMultiPartQR = async (
    type: 'raw' | 'ur' | 'bbqr',
    chunks: Map<number, string>
  ) => {
    try {
      switch (type) {
        case 'raw': {
          const sortedChunks = Array.from(chunks.entries())
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
          // Assemble BBQR format chunks
          const sortedChunks = Array.from(chunks.entries())
            .toSorted(([a], [b]) => a - b)
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
            .toSorted(([a], [b]) => a - b)
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

          // Check if result is a PSBT and convert to final transaction
          if (result.toLowerCase().startsWith('70736274ff')) {
            const convertedResult = convertPsbtToFinalTransaction(result)

            // Check if conversion returned a finalized transaction, PSBT hex, or PSBT base64
            if (
              convertedResult.toLowerCase().startsWith('70736274ff') ||
              convertedResult.startsWith('cHNidP')
            ) {
              return convertedResult
            }
            return convertedResult
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
          for (let i = 0; i < totalChunks; i += 1) {
            const header = `p${i + 1}of${totalChunks}`
            chunks.push(`${header} ${dataChunks[i]}`)
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
      for (let i = 0; i < totalChunks; i += 1) {
        const header = `p${i + 1}of${totalChunks}`
        chunks.push(`${header} ${dataChunks[i]}`)
      }

      return chunks
    },
    [] // Remove qrComplexity dependency to prevent unnecessary re-creation
  )

  const transactionHex = useMemo(() => {
    if (!account) {
      return ''
    }

    const transaction = new bitcoinjs.Transaction()
    const network = bitcoinjsNetwork(account.network)

    const inputArray = Array.from(inputs.values())

    for (const input of inputArray) {
      if (
        !input.txid ||
        input.txid.length !== 64 ||
        !/^[0-9a-fA-F]+$/.test(input.txid)
      ) {
        continue
      }

      const hashBuffer = Buffer.from(parseHexToBytes(input.txid))
      if (hashBuffer.length !== 32) {
        continue
      }

      transaction.addInput(hashBuffer, input.vout)
    }

    for (const output of outputs) {
      try {
        const outputScript = bitcoinjs.address.toOutputScript(
          output.to,
          network
        )
        transaction.addOutput(outputScript, output.amount)
      } catch {
        return ''
      }
    }

    const hex = transaction.toHex()

    transaction.ins = []
    transaction.outs = []

    return hex
  }, [account, inputs, outputs])

  const transaction = useMemo(() => {
    const inputArray = Array.from(inputs.values())
    const { size, vsize } =
      inputArray.length > 0
        ? estimateTransactionSize(inputArray, outputs)
        : legacyEstimateTransactionSize(inputs.size, outputs.length)

    const vin = Array.from(inputs.values()).map((input: Utxo) => ({
      label: input.label || '',
      previousOutput: { txid: input.txid, vout: input.vout },
      scriptSig: '' as string | number[],
      sequence: 0,
      value: input.value,
      witness: [] as number[][]
    }))

    const vout = outputs.map((output: Output) => ({
      address: output.to,
      label: output.label || '',
      script: '' as string | number[],
      value: output.amount
    }))

    function resolveId(): string {
      if (!txBuilderResult) {
        return transactionId
      }
      try {
        return txBuilderResult.txid() || transactionId
      } catch {
        return transactionId
      }
    }
    const id = resolveId()

    return {
      id,
      lockTimeEnabled: false,
      prices: {},
      received: 0,
      sent: 0,
      size,
      type: 'send' as const,
      vin,
      vout,
      vsize
    }
  }, [inputs, outputs, transactionId, txBuilderResult])

  useEffect(() => {
    if (signedPsbtsFromStore && signedPsbtsFromStore.size > 0) {
      setSignedPsbts(signedPsbtsFromStore)
    }
  }, [signedPsbtsFromStore, setSignedPsbts])

  useEffect(() => {
    if (psbt) {
      setPsbtBuildStatus('idle')
      setPsbtBuildErrorMessage('')
      if (txBuilderResult?.txid()) {
        setTransactionId(txBuilderResult.txid())
      }
      return
    }

    let cancelled = false

    async function getTransaction() {
      clearPsbt()
      setTransactionId('')
      setPsbtBuildStatus('building')
      setPsbtBuildErrorMessage('')

      if (!wallet) {
        if (!cancelled) {
          setPsbtBuildStatus('error')
          setPsbtBuildErrorMessage(t('transaction.error.previewMissingWallet'))
          toast.error(t('error.notFound.wallet'))
        }
        return
      }

      if (inputs.size === 0) {
        if (!cancelled) {
          setPsbtBuildStatus('error')
          setPsbtBuildErrorMessage(t('transaction.error.previewMissingInputs'))
        }
        return
      }

      if (outputs.length === 0) {
        if (!cancelled) {
          setPsbtBuildStatus('error')
          setPsbtBuildErrorMessage(t('transaction.error.previewMissingOutputs'))
        }
        return
      }

      try {
        const inputArray = Array.from(inputs.values())
        const outputArray = Array.from(outputs.values())

        const transaction = await buildTransaction(wallet, {
          fee,
          inputs: inputArray,
          options: { rbf },
          outputs: outputArray
        })

        if (cancelled) {
          return
        }

        setTransactionId(transaction.txid())
        setPsbt(transaction)
        setPsbtBuildStatus('idle')
        setPsbtBuildErrorMessage('')
        setIsDustError(false)
      } catch (error) {
        if (cancelled) {
          return
        }

        const { message, isDust } = mapBuildTransactionError(error)
        setPsbtBuildStatus('error')
        setPsbtBuildErrorMessage(message)
        setIsDustError(isDust)

        if (isDust) {
          return
        }

        if (String(error).includes('UTXO not found')) {
          toast.error(
            'UTXO not found in wallet database. Please sync your wallet or check your inputs.'
          )
        } else {
          toast.error(message)
        }
      }
    }

    void getTransaction()

    return () => {
      cancelled = true
    }
  }, [wallet, inputs, outputs, fee, rbf, network, setPsbt, clearPsbt, psbt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Separate effect to validate addresses and show errors
  // Only validate when we have a complete transaction (not during editing)
  useEffect(() => {
    if (!account || !outputs.length || !txBuilderResult) {
      return
    }

    const network = bitcoinjsNetwork(account.network)

    for (const output of outputs) {
      // Check if address is empty or invalid
      if (!output.to || output.to.trim() === '') {
        // Don't show error for empty addresses during editing
        continue
      }

      try {
        bitcoinjs.address.toOutputScript(output.to, network)
      } catch {
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

  const getPsbtString = useCallback(() => {
    if (!txBuilderResult) {
      return null
    }

    try {
      const base64 = txBuilderResult.toBase64()
      const psbtBuffer = Buffer.from(base64, 'base64')

      // Store the hex representation for other uses
      const psbtHex = psbtBuffer.toString('hex')
      setSerializedPsbt(psbtHex)

      // Clear the buffer to help garbage collection
      psbtBuffer.fill(0)

      return psbtHex
    } catch {
      toast.error(t('error.psbt.serialization'))
      return null
    }
  }, [txBuilderResult])

  useEffect(() => {
    let isMounted = true
    let psbtBuffer: Buffer | null = null

    const updateQrChunks = () => {
      try {
        const psbtHex = getPsbtString()
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
                  BBQRFileTypes.PSBT,
                  bbqrChunkSize
                )
              } else {
                bbqrChunks = createBBQRChunks(
                  new Uint8Array(psbtBuffer),
                  BBQRFileTypes.PSBT,
                  psbtBuffer.length * 10
                )
              }
            } else {
              // Complexity 1-11: Create multiple chunks (higher = larger chunks)
              // Increase chunk size significantly - BBQR can handle much more data
              const bbqrChunkSize = Math.max(100, 30 * qrComplexity)

              bbqrChunks = createBBQRChunks(
                new Uint8Array(psbtBuffer),
                BBQRFileTypes.PSBT,
                bbqrChunkSize
              )
            }
          } catch {
            bbqrChunks = []
          }

          if (!isMounted) {
            return
          }

          // Clear the buffer to help garbage collection
          psbtBuffer.fill(0)
          psbtBuffer = null

          if (!txBuilderResult?.toBase64()) {
            throw new Error('PSBT data not available')
          }

          // Generate raw PSBT chunks using complexity setting
          const rawChunks = createRawPsbtChunks(
            txBuilderResult.toBase64(),
            qrComplexity
          )

          // Generate UR fragments using complexity setting
          let urFragments: string[]

          if (qrComplexity === 12) {
            // Complexity 12: Create single static UR fragment
            // Check if the data would be too large for a single QR code
            const estimatedURSize = txBuilderResult.toBase64().length * 1.5 // UR encoding adds overhead
            if (estimatedURSize > 1500) {
              // Fall back to the most dense possible configuration
              const urFragmentSize = Math.max(50, 15 * 12) // Use maximum density (180 characters per fragment)
              urFragments = getURFragmentsFromPSBT(
                txBuilderResult.toBase64(),
                'base64',
                urFragmentSize
              )
            } else {
              urFragments = getURFragmentsFromPSBT(
                txBuilderResult.toBase64(),
                'base64',
                txBuilderResult.toBase64().length // Use full length for single fragment
              )
            }
          } else {
            // Complexity 1-11: Create multiple fragments (higher = larger fragments)
            // Increase the fragment size significantly - UR can handle much more data
            const urFragmentSize = Math.max(50, 15 * qrComplexity)
            urFragments = getURFragmentsFromPSBT(
              txBuilderResult.toBase64(),
              'base64',
              urFragmentSize
            )
          }

          if (!isMounted) {
            return
          }

          setQrChunks(bbqrChunks)
          setUrChunks(urFragments)
          setRawPsbtChunks(rawChunks)
          setCurrentRawChunk(0)
          setCurrentUrChunk(0)
          setQrError(null)
        } catch {
          if (isMounted) {
            setQrError(t('error.qr.generation'))
            setQrChunks([])
            setUrChunks([])
            setRawPsbtChunks([])
          }
        }
      } catch {
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
  }, [getPsbtString, txBuilderResult, qrComplexity, createRawPsbtChunks])

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
      toast.error(t('common.error.scanQRCode'))
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
        toast.error(t('common.error.processScannedData'))
      }

      // Use hook's updateSignedPsbt function
      updateSignedPsbt(index ?? -1, finalContent)

      setCameraModalVisible(false)
      resetScanProgress()
      toast.success(t('common.success.qrScanned'))
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
        chunks: newChunks,
        scanned: newScanned,
        total,
        type
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
      chunks: newChunks,
      scanned: newScanned,
      total,
      type
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
    } else if (newScanned.size === total) {
      // All chunks collected, assemble the final result
      const assembledData = await assembleMultiPartQR(type, newChunks)

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
      const errorMessage =
        error instanceof Error ? error.message : String(error)
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
        toast.error(t('common.error.noClipboardData'))
        return
      }

      // Process the pasted data similar to scanned data
      const processedData = processScannedData(text)

      // Use hook's updateSignedPsbt function
      updateSignedPsbt(index, processedData)

      toast.success(t('common.success.dataPasted'))
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error(t('common.error.pasteFromClipboard'))
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
        const txHex = Array.from(result.txData as Uint8Array)
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
  const handleSeedQRScanned = (index: number) => {
    setCameraModalVisible(true)
    setCurrentCosignerIndex(index)
  }

  // Handle seed words modal for dropped seeds
  const handleSeedWordsScanned = (index: number) => {
    setCurrentCosignerIndex(index)
    setWordCountModalVisible(true)
  }

  // Handle word count selection
  const handleWordCountSelect = (wordCount: MnemonicWordCount) => {
    setSelectedWordCount(wordCount)
    setWordCountModalVisible(false)
    setSeedWordsModalVisible(true)
  }

  // eslint-disable-next-line
  const handleMnemonicValid = (mnemonic: string, _fingerprint: string) => {
    setCurrentMnemonic(mnemonic)
  }

  const handleMnemonicInvalid = () => {
    setCurrentMnemonic('')
  }

  // Handle seed words form submission
  const handleSeedWordsSubmit = async () => {
    if (!currentMnemonic || currentCosignerIndex === null) {
      toast.error(t('common.error.validMnemonic'))
      return
    }

    await handleSignWithSeedQR(currentCosignerIndex, currentMnemonic)

    // Clear the form and close modals
    setSeedWordsModalVisible(false)
    setCurrentMnemonic('')
    setCurrentCosignerIndex(null)
  }

  // Wrapper functions for watch-only section (no parameters needed)
  const handleWatchOnlyPasteFromClipboard = () => {
    handlePasteFromClipboard(-1) // Use -1 to indicate watch-only
  }

  const handleWatchOnlyNFCScan = () => {
    handleNFCScan(-1) // Use -1 to indicate watch-only
  }

  const handleShareWithNostrGroup = () => {
    if (!account?.nostr?.autoSync) {
      toast.error(t('account.nostrSync.autoSyncMustBeEnabled'))
      return
    }
    const base64 = txBuilderResult?.toBase64()
    if (!base64) {
      toast.error(t('account.nostrSync.transactionDataNotAvailable'))
      return
    }
    setTransactionToShare({
      transaction: base64,
      transactionData: { combinedPsbt: base64 }
    })
    router.push({
      params: { id },
      pathname: '/signer/bitcoin/account/[id]/settings/nostr/devicesGroupChat'
    })
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

  const combineAndFinalizeMultisigPSBTs = () => {
    try {
      const originalPsbtBase64 = txBuilderResult?.toBase64()
      if (!originalPsbtBase64) {
        toast.error(t('common.error.noOriginalPSBT'))
        return null
      }

      // Get all collected signed PSBTs
      const collectedSignedPsbts = Array.from(signedPsbts.values()).filter(
        (psbt) => psbt && psbt.trim().length > 0
      )

      if (collectedSignedPsbts.length === 0) {
        toast.error(t('common.error.noSignedPSBTs'))
        return null
      }

      // Step 1: Parse the original PSBT
      const originalPsbt = bitcoinjs.Psbt.fromBase64(originalPsbtBase64)

      // Step 2: Combine all signed PSBTs with the original
      const combinedPsbt = originalPsbt

      for (let i = 0; i < collectedSignedPsbts.length; i += 1) {
        const signedPsbtBase64 = collectedSignedPsbts[i]

        try {
          const signedPsbt = bitcoinjs.Psbt.fromBase64(signedPsbtBase64)

          // Combine this signed PSBT with the accumulated result
          combinedPsbt.combine(signedPsbt)
        } catch {
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
        for (let i = 0; i < combinedPsbt.data.inputs.length; i += 1) {
          try {
            combinedPsbt.finalizeInput(i)
          } catch {
            toast.error(t('common.error.finalizeInput'))
          }
        }

        toast.error(t('common.error.finalizeTransaction'))
        return null
      }

      // Step 4: Extract the final transaction
      try {
        const finalTransaction = combinedPsbt.extractTransaction()
        const transactionHex = finalTransaction.toHex()

        setSignedTx(transactionHex)

        toast.success(t('transaction.finalizedSuccessfully'))
        return transactionHex
      } catch {
        toast.error(t('common.error.extractTransaction'))
        return null
      }
    } catch {
      toast.error(t('common.error.combinePSBTs'))
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
      nfcPulseAnim.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1000 }),
            withTiming(0, { duration: 1000 })
          ),
          -1
        )
      )

      return () => {
        cancelAnimation(nfcPulseAnim)
        nfcPulseAnim.set(0)
      }
    }
  }, [nfcModalVisible, nfcScanModalVisible, nfcPulseAnim])

  // Cleanup effect when component unmounts
  useEffect(
    () => () => {
      // Cancel any running animations
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      // Clear all QR-related state to free memory
      setQrChunks([])
      setUrChunks([])
      setRawPsbtChunks([])
    },
    []
  )

  // Decrypt keys to check for seed existence
  useEffect(() => {
    async function decryptKeys() {
      if (!account || !account.keys || account.keys.length === 0) {
        return
      }

      const pin = await getItem(PIN_KEY)
      if (!pin) {
        return
      }

      try {
        const decryptedKeysData = await Promise.all(
          account.keys.map(async (key, index) => {
            const stored = await getKeySecret(account.id, index)
            if (!stored) {
              return key
            }

            const decryptedSecretString = await aesDecrypt(
              stored.secret,
              pin,
              stored.iv
            )
            const decryptedSecret = JSON.parse(decryptedSecretString) as Secret

            return {
              ...key,
              secret: decryptedSecret
            }
          })
        )

        setDecryptedKeys(decryptedKeysData)
      } catch {
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
        const base64Psbt = txBuilderResult?.toBase64()
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
      default:
        return 'NO_DATA'
    }
  }

  // Helper function to check if data would be too large for single QR code
  const isDataTooLargeForSingleQR = () => {
    const base64Psbt = txBuilderResult?.toBase64()
    if (!base64Psbt) {
      return false
    }

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
      default:
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
      default:
        return ''
    }
  }

  if (!id || !account) {
    return <Redirect href="/" />
  }

  // Calculate responsive dimensions
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
                <SSTransactionIdFormatted
                  size="lg"
                  value={
                    isLoadingPSBT
                      ? t('common.loading')
                      : psbtBuildStatus === 'building'
                        ? t('transaction.preview.buildingTransaction')
                        : psbtBuildStatus === 'error'
                          ? '—'
                          : transactionId || '—'
                  }
                />
                {isLoadingPSBT && (
                  <SSText color="muted" size="sm" style={{ marginTop: 8 }}>
                    {t('transaction.preview.processingPsbt')}
                  </SSText>
                )}
                {psbtBuildStatus === 'building' && !isLoadingPSBT && (
                  <SSText color="muted" size="sm" style={{ marginTop: 8 }}>
                    {t('transaction.preview.buildingTransaction')}
                  </SSText>
                )}
                {psbtBuildStatus === 'error' &&
                  psbtBuildErrorMessage !== '' &&
                  (isDustError ? (
                    <SSDustWarningBanner message={psbtBuildErrorMessage} />
                  ) : (
                    <SSText color="muted" size="sm" style={{ marginTop: 8 }}>
                      {psbtBuildErrorMessage}
                    </SSText>
                  ))}
              </SSVStack>
              <SSVStack gap="xxs">
                <SSText color="muted" size="sm" uppercase>
                  {tn('contents')}
                </SSText>
                <View style={{ overflow: 'hidden' }}>
                  <SSTransactionChart
                    transaction={transaction}
                    ownAddresses={ownAddresses}
                    scale={0.9}
                  />
                </View>
              </SSVStack>
              <SSVStack gap="xxs">
                <SSText uppercase size="sm" color="muted">
                  {tn('decoded')}
                </SSText>
                {transactionHex !== '' && (
                  <SSTransactionDecoded txHex={transactionHex} />
                )}
              </SSVStack>

              {/* Multisig Signature Required Display */}
              {account.policyType === 'multisig' &&
                account.keys &&
                account.keys.length > 0 &&
                txBuilderResult && (
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
                          key={key.fingerprint ?? index}
                          index={index}
                          totalKeys={account.keys?.length || 0}
                          keyDetails={key}
                          transactionId={transactionId}
                          txBuilderResult={txBuilderResult!}
                          serializedPsbt={serializedPsbt}
                          signedPsbt={signedPsbts.get(index) || ''}
                          setSignedPsbt={(psbt: string) =>
                            updateSignedPsbt(index, psbt)
                          }
                          isAvailable={nfcHardwareSupported}
                          isEmitting={isEmitting}
                          isReading={isReading}
                          decryptedKey={decryptedKeys[index]}
                          account={account}
                          accountId={id}
                          signedPsbts={signedPsbts}
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
                      !transactionId ||
                      psbtBuildStatus === 'building' ||
                      psbtBuildStatus === 'error' ||
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
                            `/signer/bitcoin/account/${id}/signAndSend/signTransaction`
                          )
                        }
                      } else {
                        // For non-multisig accounts, navigate directly
                        router.navigate(
                          `/signer/bitcoin/account/${id}/signAndSend/signTransaction`
                        )
                      }
                    }}
                  />
                  {account?.nostr?.autoSync && txBuilderResult?.toBase64() && (
                    <SSButton
                      variant="ghost"
                      label={t('account.nostrSync.shareWithGroup')}
                      onPress={handleShareWithNostrGroup}
                    />
                  )}
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
                        disabled={!transactionId}
                        label={t('common.copy')}
                        style={{ width: '48%' }}
                        onPress={() => {
                          if (txBuilderResult?.toBase64()) {
                            Clipboard.setStringAsync(txBuilderResult.toBase64())
                            toast(t('common.copiedToClipboard'))
                          }
                        }}
                      />
                      <SSButton
                        variant="outline"
                        disabled={!transactionId}
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
                        disabled={!nfcHardwareSupported || !serializedPsbt}
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
                        backgroundColor: Colors.gray[900],
                        borderColor: Colors.gray[700],
                        borderRadius: 8,
                        borderWidth: 1,
                        maxHeight: 600,
                        minHeight: 200,
                        paddingBottom: 12,
                        paddingHorizontal: 12,
                        paddingTop: 12
                      }}
                    >
                      <ScrollView
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator
                        nestedScrollEnabled
                      >
                        <SSText
                          style={{
                            color: Colors.white,
                            fontFamily: Typography.sfProMono,
                            fontSize: 12,
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
                        disabled={!nfcHardwareSupported}
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
                          `/signer/bitcoin/account/${id}/signAndSend/signTransaction`
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
              alignItems: 'center',
              flex: 1,
              justifyContent: 'center',
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
                    alignItems: 'center',
                    backgroundColor: Colors.white,
                    borderRadius: 2,
                    marginBottom: 0,
                    padding: 5,
                    width: qrSize + 10
                  }}
                >
                  <SSQRCode
                    value={getQRValue()}
                    color={Colors.black}
                    backgroundColor={Colors.white}
                    size={qrSize}
                  />
                </View>
                <View
                  style={[
                    styles.qrFormatSegmentTrack,
                    { width: screenWidth * 0.92 }
                  ]}
                >
                  <QrFormatModeTab
                    label="RAW"
                    onPress={() => {
                      setDisplayMode(QRDisplayMode.RAW)
                      setCurrentRawChunk(0)
                    }}
                    selected={displayMode === QRDisplayMode.RAW}
                  />
                  <QrFormatModeTab
                    label="UR"
                    onPress={() => {
                      setDisplayMode(QRDisplayMode.UR)
                      setCurrentUrChunk(0)
                    }}
                    selected={displayMode === QRDisplayMode.UR}
                  />
                  <QrFormatModeTab
                    label="BBQR"
                    onPress={() => {
                      setDisplayMode(QRDisplayMode.BBQR)
                      setCurrentChunk(0)
                    }}
                    selected={displayMode === QRDisplayMode.BBQR}
                  />
                </View>
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
                    backgroundColor: Colors.gray[900],
                    borderRadius: 2,
                    height: 80,
                    padding: 5,
                    paddingHorizontal: 20,
                    textAlignVertical: 'center',
                    width: screenWidth * 0.92
                  }}
                >
                  {getQRValue().length > 100
                    ? `${getQRValue().slice(0, 100)}...`
                    : getQRValue()}
                </SSText>
                <SSHStack
                  justifyEvenly
                  style={{ marginBottom: 20, width: screenWidth * 0.9 }}
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
                            toast.error(t('common.error.dataTooLarge'))
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
              style={{ height: 340, width: 340 }}
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
                                  (scanProgress.scanned.size / displayTarget) *
                                  300
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
                            (scanProgress.scanned.size / scanProgress.total) *
                            300
                        }}
                      />
                    </View>
                    <SSText color="muted" size="sm" center>
                      {`Scanned parts: ${Array.from(scanProgress.scanned)
                        .toSorted((a, b) => a - b)
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
            if (isEmitting) {
              cancelNFCEmitterScan()
            }
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
              <Animated.View style={nfcPulseStyle}>
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
            if (isReading) {
              cancelNFCScan()
            }
          }}
        >
          <SSVStack itemsCenter gap="lg">
            <SSText center style={{ maxWidth: 300 }}>
              {nfcError ? t('common.error') : t('transaction.preview.nfcTip')}
            </SSText>
            <Animated.View style={nfcPulseStyle}>
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
            setCurrentCosignerIndex(null)
          }}
        >
          <View style={styles.seedWordsModalBody}>
            <ScrollView
              style={{ maxHeight: 600, maxWidth: 400, width: '100%' }}
            >
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
                  wordListName="english"
                  network={appNetworkToBdkNetwork(network)}
                  onMnemonicValid={handleMnemonicValid}
                  onMnemonicInvalid={handleMnemonicInvalid}
                  showPassphrase
                  showChecksum
                  showFingerprint
                  showPasteButton
                  showScanSeedQRButton
                  showActionButton
                  actionButtonLabel="Sign with Seed Words"
                  actionButtonVariant="secondary"
                  onActionButtonPress={handleSeedWordsSubmit}
                  actionButtonDisabled={false}
                  showCancelButton={false}
                  autoCheckClipboard
                  onWordSelectorStateChange={setWordSelectorState}
                />
              </View>
            </ScrollView>
            <SSKeyboardWordSelector
              visible={wordSelectorState.visible}
              wordStart={wordSelectorState.wordStart}
              wordListName="english"
              onWordSelected={wordSelectorState.onWordSelected}
            />
          </View>
        </SSModal>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  mainLayout: { paddingBottom: 20, paddingTop: 0 },
  modalStack: { marginVertical: 32, paddingHorizontal: 32, width: '100%' },
  qrFormatSegmentTrack: {
    alignSelf: 'center',
    backgroundColor: Colors.gray[850],
    borderRadius: Sizes.button.borderRadius,
    flexDirection: 'row',
    gap: 3,
    marginBottom: 10,
    padding: 3
  },
  seedWordsModalBody: {
    flex: 1,
    maxWidth: 400,
    position: 'relative',
    width: '100%'
  }
})

export default PreviewTransaction
