import { hex } from '@scure/base'
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
import { type PsbtLike } from 'react-native-bdk-sdk'
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

import { buildPsbt, buildTransaction } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSDustWarningBanner from '@/components/SSDustWarningBanner'
import SSKeyboardWordSelector from '@/components/SSKeyboardWordSelector'
import SSModal from '@/components/SSModal'
import SSSeedWordsInput from '@/components/SSSeedWordsInput'
import SSShareableQR from '@/components/SSShareableQR'
import SSSignatureDropdown from '@/components/SSSignatureDropdown'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import SSTransactionIdFormatted from '@/components/SSTransactionIdFormatted'
import { SATS_PER_BITCOIN } from '@/constants/btc'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { useNFCReader } from '@/hooks/useNFCReader'
import { useNow } from '@/hooks/useNow'
import { usePSBTManagement } from '@/hooks/usePSBTManagement'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useNostrStore } from '@/store/nostr'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Sizes, Typography } from '@/styles'
import type { MnemonicWordCount } from '@/types/bips/39'
import { type Account, type Key, type Secret } from '@/types/models/Account'
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
import { decryptAccountKeySecret } from '@/utils/decryption'
import { formatAddress, formatNumber } from '@/utils/format'
import {
  formatPayjoinExpiryLabel,
  parsePayjoinExpiresAtMs
} from '@/utils/payjoinExpiry'
import { hasPayjoinParam, parsePayjoinUri } from '@/utils/payjoinUri'
import {
  type ExtractedTransactionData,
  extractIndividualSignedPsbts,
  extractOriginalPsbt,
  extractTransactionDataFromPSBT,
  extractTransactionDataFromPSBTEnhanced,
  extractTransactionIdFromPSBT,
  getCollectedSignerPubkeys,
  matchSignedPsbtsToCosigners,
  signedTransactionMatchesPsbt,
  validateSignedPSBTForCosigner
} from '@/utils/psbt'
import {
  buildKnownTxIds,
  buildOutpointLabelsByRef,
  buildTxLabelsById
} from '@/utils/sankeyInputLabel'
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

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const tn = _tn('transaction.build.preview')

enum QRDisplayMode {
  RAW = 'RAW',
  UR = 'UR',
  BBQR = 'BBQR'
}

// Largest payload (chars/bytes) a single QR can hold before we must chunk it.
const QR_MAX_DATA_SIZE = 1500
// Characters shown in the on-screen QR text preview before truncating.
const QR_VALUE_PREVIEW_LENGTH = 100

// QR "density" scale exposed to the user. Max = single static (unchunked) QR.
const QR_COMPLEXITY_MIN = 1
const QR_COMPLEXITY_MAX = 12
const QR_COMPLEXITY_DEFAULT = 8

// Animation speed scale for cycling multi-part QR frames.
const ANIMATION_SPEED_MIN = 1
const ANIMATION_SPEED_MAX = 12
const ANIMATION_SPEED_DEFAULT = 6
const ANIMATION_INTERVAL_MAX_MS = 2000 // slowest cycle (speed = min)
const ANIMATION_INTERVAL_MIN_MS = 200 // fastest cycle (speed = max)
const ANIMATION_INTERVAL_FLOOR_MS = 100 // hard per-frame lower bound

// Chunk/fragment sizing for the three export encodings.
const RAW_CHUNK_BASE_SIZE = 100
const RAW_CHUNK_MAX_MULTIPLIER = 8
const BBQR_CHUNK_BASE_SIZE = 30
const BBQR_CHUNK_MIN_SIZE = 100
const BBQR_SINGLE_CHUNK_MULTIPLIER = 10
const UR_FRAGMENT_BASE_SIZE = 15
const UR_FRAGMENT_MIN_SIZE = 50
const QR_ENCODING_OVERHEAD = 1.5 // BBQR/UR add ~50% over the raw payload

// UR fountain-code assembly heuristics (fragments needed relative to range).
const UR_ASSEMBLY_CONSERVATIVE_FACTOR = 1.1
const UR_ASSEMBLY_THEORETICAL_FACTOR = 1.5
const UR_ASSEMBLY_FALLBACK_FACTOR = 0.8

// Layout ratios/sizes for the QR + scanner modals.
const QR_SIZE_WIDTH_RATIO = 0.9
const QR_SIZE_HEIGHT_RATIO = 0.5
const QR_SIZE_MAX = 700
const QR_TRACK_WIDTH_RATIO = 0.92
const MODAL_PADDING_RATIO = 0.05
const CAMERA_VIEW_SIZE = 340
const NFC_PULSE_SIZE = 200
const NFC_PULSE_DURATION_MS = 1000

// Bitcoin script/tx domain constants.
const OP_1 = 81 // OP_1..OP_16 encode the multisig threshold m
const OP_16 = 96
const OP_N_VALUE_OFFSET = 80 // decoded value = opcode - 80
const MIN_MULTISIG_SCRIPT_LENGTH = 3
const TXID_HEX_LENGTH = 64
const TXID_BYTE_LENGTH = 32
const MIN_VALID_ADDRESS_LENGTH = 10

const MNEMONIC_WORD_COUNTS: MnemonicWordCount[] = [12, 15, 18, 21, 24]

const styles = StyleSheet.create({
  mainLayout: { paddingBottom: 20, paddingTop: 0 },
  modalStack: { marginVertical: 32, paddingHorizontal: 32, width: '100%' },
  payjoinNote: {
    gap: 4,
    paddingVertical: 4
  },
  payjoinNoteHint: {
    color: Colors.gray[500]
  },
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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type QrFormatModeTabProps = {
  label: string
  onPress: () => void
  selected: boolean
}

type PsbtManagement = ReturnType<typeof usePSBTManagement>
type ProcessScannedData = (data: string) => string | null

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

function PreviewTransaction() {
  const router = useRouter()
  const { id, psbt } = useLocalSearchParams<PreviewTransactionSearchParams>()

  const [inputs, outputs, txBuilderResult, setSignedTx, signedPsbtsFromStore] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.inputs,
        state.outputs,
        state.psbt,
        state.setSignedTx,
        state.signedPsbts
      ])
    )

  const { payjoinInvoice, payjoinExpiryLabel } = usePayjoinInvoice()

  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
  )
  const ownAddresses = useMemo(
    () => new Set(account?.addresses?.map((a) => a.address)),
    [account]
  )
  const txLabelsById = useMemo(
    () => buildTxLabelsById(account?.transactions),
    [account?.transactions]
  )
  const knownTxIds = useMemo(
    () => buildKnownTxIds(account?.transactions),
    [account?.transactions]
  )
  const outpointLabelsByRef = useMemo(
    () => buildOutpointLabelsByRef(account ?? {}),
    [account]
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const [noKeyModalVisible, setNoKeyModalVisible] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [currentCosignerIndex, setCurrentCosignerIndex] = useState<
    number | null
  >(null)
  const [permission, requestPermission] = useCameraPermissions()

  const decryptedKeys = useDecryptedKeys(account)

  const {
    signedPsbt,
    signedPsbts,
    setSignedPsbts,
    updateSignedPsbt,
    convertPsbtToFinalTransaction,
    handleSignWithLocalKey,
    handleSignWithSeedQR
  } = usePSBTManagement({
    account,
    decryptedKeys,
    psbt: txBuilderResult
  })

  const processScannedData = useScannedDataProcessor({
    convertPsbtToFinalTransaction
  })

  const {
    getPsbtString,
    isDustError,
    isLoadingPSBT,
    psbtBuildErrorMessage,
    psbtBuildStatus,
    serializedPsbt,
    transactionId
  } = usePsbtPreview({ account, id, psbt })

  const validationResults = useSignatureValidation({
    account,
    decryptedKeys,
    signedPsbts
  })

  useSignatureDetection({
    account,
    decryptedKeys,
    psbt,
    signedPsbts,
    updateSignedPsbt
  })

  const { combineAndFinalizeMultisigPSBTs, hasAllRequiredSignatures } =
    useMultisigFinalization({ account, signedPsbts, validationResults })

  const {
    cancelNFCEmitterScan,
    cancelNFCScan,
    handleNFCExport,
    handleNFCScan,
    isEmitting,
    isReading,
    nfcError,
    nfcHardwareSupported,
    nfcModalVisible,
    nfcPulseStyle,
    nfcScanModalVisible,
    setNfcError,
    setNfcModalVisible,
    setNfcScanModalVisible
  } = useNfcTransfer({ serializedPsbt, updateSignedPsbt })

  const handleShareWithNostrGroup = useNostrShare({ account, id })

  const { handlePasteFromClipboard } = useClipboardImport({
    processScannedData,
    updateSignedPsbt
  })

  const {
    handleMnemonicInvalid,
    handleMnemonicValid,
    handleSeedWordsScanned,
    handleSeedWordsSubmit,
    handleWordCountSelect,
    selectedWordCount,
    seedWordsModalVisible,
    setCurrentMnemonic,
    setSeedWordsModalVisible,
    setSelectedWordCount,
    setWordCountModalVisible,
    setWordSelectorState,
    wordCountModalVisible,
    wordSelectorState
  } = useSeedSigning({
    currentCosignerIndex,
    handleSignWithSeedQR,
    setCurrentCosignerIndex
  })

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
        input.txid.length !== TXID_HEX_LENGTH ||
        !/^[0-9a-fA-F]+$/.test(input.txid)
      ) {
        continue
      }

      const hashBuffer = Buffer.from(hex.decode(input.txid))
      if (hashBuffer.length !== TXID_BYTE_LENGTH) {
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

    const txHex = transaction.toHex()

    transaction.ins = []
    transaction.outs = []

    return txHex
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
      kind: output.kind,
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

  const handleCosignerPasteFromClipboard = (index: number) => {
    handlePasteFromClipboard(index)
  }

  const handleCosignerCameraScan = (index: number) => {
    setCameraModalVisible(true)
    setCurrentCosignerIndex(index)
  }

  const handleCosignerNFCScan = (index: number) => {
    handleNFCScan(index)
  }

  const handleSeedQRScanned = (index: number) => {
    setCameraModalVisible(true)
    setCurrentCosignerIndex(index)
  }

  const handleWatchOnlyPasteFromClipboard = () => {
    handlePasteFromClipboard(-1) // Use -1 to indicate watch-only
  }

  const handleWatchOnlyNFCScan = () => {
    handleNFCScan(-1) // Use -1 to indicate watch-only
  }

  useEffect(() => {
    if (signedPsbt) {
      setSignedTx(signedPsbt)
    }
  }, [signedPsbt, setSignedTx])

  if (!id || !account) {
    return <Redirect href="/" />
  }

  const qrSize = Math.min(
    screenWidth * QR_SIZE_WIDTH_RATIO,
    screenHeight * QR_SIZE_HEIGHT_RATIO,
    QR_SIZE_MAX
  )
  const containerPadding = screenWidth * MODAL_PADDING_RATIO // 5% of screen width

  const propsMultisigSection = {
    account,
    accountId: id,
    decryptedKeys,
    handleCosignerCameraScan,
    handleCosignerNFCScan,
    handleCosignerPasteFromClipboard,
    handleNFCExport,
    handleSeedQRScanned,
    handleSeedWordsScanned,
    handleSignWithLocalKey,
    isEmitting,
    isReading,
    nfcHardwareSupported,
    serializedPsbt,
    setNoKeyModalVisible,
    signedPsbts,
    transactionId,
    txBuilderResult,
    updateSignedPsbt,
    validationResults
  }

  const propsActions = {
    account,
    accountId: id,
    combineAndFinalizeMultisigPSBTs,
    handleNFCExport,
    handleShareWithNostrGroup,
    handleWatchOnlyNFCScan,
    handleWatchOnlyPasteFromClipboard,
    hasAllRequiredSignatures,
    isEmitting,
    isReading,
    nfcHardwareSupported,
    psbtBuildStatus,
    router,
    serializedPsbt,
    setCameraModalVisible,
    setNoKeyModalVisible,
    signedPsbt,
    signedPsbts,
    transactionId,
    txBuilderResult
  }

  const propsQrExportModal = {
    containerPadding,
    getPsbtString,
    onClose: () => setNoKeyModalVisible(false),
    qrSize,
    screenWidth,
    serializedPsbt,
    visible: noKeyModalVisible
  }

  const propsCameraModal = {
    closeCamera: () => setCameraModalVisible(false),
    convertPsbtToFinalTransaction,
    currentCosignerIndex,
    decryptedKeys,
    handleSignWithSeedQR,
    onClose: () => {
      setCameraModalVisible(false)
      setCurrentCosignerIndex(null)
    },
    permission,
    processScannedData,
    requestPermission,
    updateSignedPsbt,
    visible: cameraModalVisible
  }

  const propsWordCountModal = {
    onClose: () => {
      setWordCountModalVisible(false)
      setCurrentCosignerIndex(null)
    },
    onContinue: () => handleWordCountSelect(selectedWordCount),
    selectedWordCount,
    setSelectedWordCount,
    visible: wordCountModalVisible
  }

  const propsSeedWordsModal = {
    handleMnemonicInvalid,
    handleMnemonicValid,
    handleSeedWordsSubmit,
    network,
    onClose: () => {
      setSeedWordsModalVisible(false)
      setCurrentMnemonic('')
      setCurrentCosignerIndex(null)
    },
    selectedWordCount,
    setWordSelectorState,
    visible: seedWordsModalVisible,
    wordSelectorState
  }

  return (
    <>
      <SSMainLayout style={styles.mainLayout}>
        <SSVStack justifyBetween>
          <ScrollView>
            <SSVStack>
              {payjoinInvoice ? (
                <View style={styles.payjoinNote} testID="preview-payjoin-note">
                  <SSText size="xs" uppercase color="muted" center>
                    {t('transaction.build.payjoin.previewNote.title')}
                  </SSText>
                  <SSText size="sm" weight="light" center>
                    {[
                      payjoinInvoice.endpointKind === 'bip78'
                        ? t('transaction.build.payjoin.data.bip78')
                        : t('transaction.build.payjoin.data.bip77'),
                      payjoinInvoice.amountSats !== undefined
                        ? `${formatNumber(payjoinInvoice.amountSats)} ${t('bitcoin.sats')}`
                        : null,
                      payjoinInvoice.label || null,
                      formatAddress(payjoinInvoice.address, 'default'),
                      payjoinExpiryLabel
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </SSText>
                  <SSText size="xs" center style={styles.payjoinNoteHint}>
                    {t('transaction.build.payjoin.previewNote.hint')}
                  </SSText>
                </View>
              ) : null}
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
                    accountId={id}
                    transaction={transaction}
                    ownAddresses={ownAddresses}
                    txLabelsById={txLabelsById}
                    knownTxIds={knownTxIds}
                    outpointLabelsByRef={outpointLabelsByRef}
                    scale={0.9}
                    showUnspentLabel={false}
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
              <PreviewTransactionMultisigSection {...propsMultisigSection} />
              <PreviewTransactionActions {...propsActions} />
            </SSVStack>
          </ScrollView>
        </SSVStack>
        <PreviewTransactionQrExportModal {...propsQrExportModal} />
        <PreviewTransactionCameraModal {...propsCameraModal} />
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
              {nfcError
                ? t('common.errorTitle')
                : t('transaction.preview.nfcTip')}
            </SSText>
            {nfcError ? (
              <SSVStack itemsCenter gap="md">
                <SSText color="white" center>
                  {nfcError}
                </SSText>
              </SSVStack>
            ) : (
              <Animated.View style={nfcPulseStyle}>
                <SSText uppercase>
                  {t('transaction.preview.emittingNFC')}
                </SSText>
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
              {nfcError
                ? t('common.errorTitle')
                : t('transaction.preview.nfcTip')}
            </SSText>
            <Animated.View style={nfcPulseStyle}>
              <SSText uppercase>{t('watchonly.read.scanning')}</SSText>
            </Animated.View>
          </SSVStack>
        </SSModal>
        <PreviewTransactionWordCountModal {...propsWordCountModal} />
        <PreviewTransactionSeedWordsModal {...propsSeedWordsModal} />
      </SSMainLayout>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

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

function PreviewTransactionMultisigSection({
  account,
  accountId,
  transactionId,
  txBuilderResult,
  serializedPsbt,
  signedPsbts,
  validationResults,
  decryptedKeys,
  nfcHardwareSupported,
  isEmitting,
  isReading,
  updateSignedPsbt,
  handleNFCExport,
  handleCosignerPasteFromClipboard,
  handleCosignerCameraScan,
  handleCosignerNFCScan,
  handleSignWithLocalKey,
  handleSeedQRScanned,
  handleSeedWordsScanned,
  setNoKeyModalVisible
}: {
  account: Account
  accountId: string
  transactionId: string
  txBuilderResult: PsbtLike | undefined
  serializedPsbt: string
  signedPsbts: PsbtManagement['signedPsbts']
  validationResults: Map<number, boolean>
  decryptedKeys: Key[]
  nfcHardwareSupported: boolean
  isEmitting: boolean
  isReading: boolean
  updateSignedPsbt: PsbtManagement['updateSignedPsbt']
  handleNFCExport: () => void
  handleCosignerPasteFromClipboard: (index: number) => void
  handleCosignerCameraScan: (index: number) => void
  handleCosignerNFCScan: (index: number) => void
  handleSignWithLocalKey: PsbtManagement['handleSignWithLocalKey']
  handleSeedQRScanned: (index: number) => void
  handleSeedWordsScanned: (index: number) => void
  setNoKeyModalVisible: (visible: boolean) => void
}) {
  if (
    account.policyType !== 'multisig' ||
    !account.keys ||
    account.keys.length === 0 ||
    !txBuilderResult
  ) {
    return null
  }

  return (
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
        {account.keysRequired || 1} {t('common.of')} {account.keyCount || 1}
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
            setSignedPsbt={(psbt: string) => updateSignedPsbt(index, psbt)}
            isAvailable={nfcHardwareSupported}
            isEmitting={isEmitting}
            isReading={isReading}
            decryptedKey={decryptedKeys[index]}
            account={account}
            accountId={accountId}
            signedPsbts={signedPsbts}
            onShowQR={() => setNoKeyModalVisible(true)}
            onNFCExport={handleNFCExport}
            onPasteFromClipboard={handleCosignerPasteFromClipboard}
            onCameraScan={handleCosignerCameraScan}
            onNFCScan={handleCosignerNFCScan}
            onSignWithLocalKey={() => handleSignWithLocalKey(index)}
            onSignWithSeedQR={() => handleSeedQRScanned(index)}
            onSignWithSeedWords={() => handleSeedWordsScanned(index)}
            validationResult={validationResults.get(index)}
          />
        ))}
      </SSVStack>
    </SSVStack>
  )
}

function PreviewTransactionActions({
  account,
  accountId,
  router,
  transactionId,
  psbtBuildStatus,
  txBuilderResult,
  serializedPsbt,
  signedPsbt,
  signedPsbts,
  nfcHardwareSupported,
  isEmitting,
  isReading,
  hasAllRequiredSignatures,
  combineAndFinalizeMultisigPSBTs,
  handleShareWithNostrGroup,
  handleNFCExport,
  handleWatchOnlyPasteFromClipboard,
  handleWatchOnlyNFCScan,
  setNoKeyModalVisible,
  setCameraModalVisible
}: {
  account: Account
  accountId: string
  router: ReturnType<typeof useRouter>
  transactionId: string
  psbtBuildStatus: 'building' | 'error' | 'idle'
  txBuilderResult: PsbtLike | undefined
  serializedPsbt: string
  signedPsbt: string
  signedPsbts: PsbtManagement['signedPsbts']
  nfcHardwareSupported: boolean
  isEmitting: boolean
  isReading: boolean
  hasAllRequiredSignatures: () => boolean
  combineAndFinalizeMultisigPSBTs: () => string | null
  handleShareWithNostrGroup: () => void
  handleNFCExport: () => void
  handleWatchOnlyPasteFromClipboard: () => void
  handleWatchOnlyNFCScan: () => void
  setNoKeyModalVisible: (visible: boolean) => void
  setCameraModalVisible: (visible: boolean) => void
}) {
  return (
    <>
      {account.policyType !== 'watchonly' &&
      account.keys &&
      account.keys.length > 0 ? (
        <>
          {account.policyType === 'multisig' && (
            <SSText center color="muted" size="sm" style={{ marginBottom: 8 }}>
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
              (account.policyType === 'multisig' && !hasAllRequiredSignatures())
            }
            label={
              account.policyType === 'multisig'
                ? t('transaction.preview.checkAllSignatures')
                : t('sign.transaction')
            }
            onPress={() => {
              if (account?.policyType === 'multisig') {
                const finalTransactionHex = combineAndFinalizeMultisigPSBTs()

                if (finalTransactionHex) {
                  router.navigate(
                    `/signer/bitcoin/account/${accountId}/signAndSend/signTransaction`
                  )
                }
              } else {
                router.navigate(
                  `/signer/bitcoin/account/${accountId}/signAndSend/signTransaction`
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
                label={t('transaction.preview.showQR')}
                style={{ width: '48%' }}
                onPress={() => {
                  setNoKeyModalVisible(true)
                }}
              />
            </SSHStack>
            <SSHStack gap="xxs" justifyBetween>
              <SSButton
                label={t('transaction.preview.usb')}
                style={{ width: '48%' }}
                variant="outline"
                disabled
              />

              <SSButton
                label={
                  isEmitting
                    ? t('watchonly.read.scanning')
                    : t('transaction.preview.exportNFC')
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
                ? t('transaction.preview.importedPsbt')
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
                label={t('common.paste')}
                style={{ width: '48%' }}
                variant="outline"
                onPress={handleWatchOnlyPasteFromClipboard}
              />
              <SSButton
                label={t('transaction.preview.scanQR')}
                style={{ width: '48%' }}
                variant="outline"
                onPress={() => setCameraModalVisible(true)}
              />
            </SSHStack>
            <SSHStack gap="xxs" justifyBetween>
              <SSButton
                label={t('transaction.preview.usb')}
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
              label={t('transaction.preview.checkSignature')}
              style={{ marginTop: 26 }}
              variant="secondary"
              disabled={!signedPsbt}
              onPress={() =>
                router.navigate(
                  `/signer/bitcoin/account/${accountId}/signAndSend/signTransaction`
                )
              }
            />
          </>
        )
      )}
    </>
  )
}

function PreviewTransactionQrExportModal({
  visible,
  onClose,
  getPsbtString,
  serializedPsbt,
  qrSize,
  screenWidth,
  containerPadding
}: {
  visible: boolean
  onClose: () => void
  getPsbtString: () => string | null
  serializedPsbt: string
  qrSize: number
  screenWidth: number
  containerPadding: number
}) {
  const {
    animationSpeed,
    displayMode,
    getDisplayModeDescription,
    getQRValue,
    isDataTooLargeForSingleQR,
    isMultiPartQR,
    qrChunks,
    qrComplexity,
    qrError,
    qrRef,
    setAnimationSpeed,
    setCurrentChunk,
    setCurrentRawChunk,
    setCurrentUrChunk,
    setDisplayMode,
    setQrComplexity
  } = useQrExport({ getPsbtString, serializedPsbt })

  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
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
          <SSShareableQR
            qrRef={qrRef}
            value={getQRValue()}
            color={Colors.black}
            backgroundColor={Colors.white}
            size={qrSize}
            hideShareButton={isMultiPartQR()}
            containerStyle={{
              alignItems: 'center',
              backgroundColor: Colors.white,
              borderRadius: 2,
              marginBottom: 0,
              padding: 5,
              width: qrSize + 10
            }}
          >
            <View
              style={[
                styles.qrFormatSegmentTrack,
                { width: screenWidth * QR_TRACK_WIDTH_RATIO }
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
              style={{ maxWidth: screenWidth * QR_SIZE_WIDTH_RATIO }}
            >
              {getDisplayModeDescription()}
            </SSText>
            {isDataTooLargeForSingleQR() &&
              qrComplexity >= QR_COMPLEXITY_MAX - 1 && (
                <SSText center color="muted" size="xs" style={{ marginTop: 5 }}>
                  {t('transaction.preview.maxDensityLimited')}
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
                width: screenWidth * QR_TRACK_WIDTH_RATIO
              }}
            >
              {getQRValue().length > QR_VALUE_PREVIEW_LENGTH
                ? `${getQRValue().slice(0, QR_VALUE_PREVIEW_LENGTH)}...`
                : getQRValue()}
            </SSText>
          </SSShareableQR>
        ) : null}
        {qrChunks.length > 0 ? (
          <SSHStack
            justifyEvenly
            style={{
              marginBottom: 20,
              width: screenWidth * QR_SIZE_WIDTH_RATIO
            }}
          >
            <SSVStack gap="xs">
              <SSText color="white" size="sm" center>
                {t('transaction.preview.qrDensity', {
                  max: QR_COMPLEXITY_MAX,
                  value: qrComplexity
                })}
              </SSText>
              <SSHStack gap="sm" style={{ justifyContent: 'center' }}>
                <SSButton
                  variant="outline"
                  label="-"
                  onPress={() =>
                    setQrComplexity(
                      Math.max(QR_COMPLEXITY_MIN, qrComplexity - 1)
                    )
                  }
                  style={{ height: 50, width: 50 }}
                />
                <SSButton
                  variant={
                    qrComplexity === QR_COMPLEXITY_MAX - 1 &&
                    isDataTooLargeForSingleQR()
                      ? 'ghost'
                      : 'outline'
                  }
                  label="+"
                  onPress={() => {
                    const newComplexity = qrComplexity + 1
                    if (
                      newComplexity === QR_COMPLEXITY_MAX &&
                      isDataTooLargeForSingleQR()
                    ) {
                      toast.error(t('common.error.dataTooLarge'))
                      return
                    }
                    setQrComplexity(Math.min(QR_COMPLEXITY_MAX, newComplexity))
                  }}
                  style={{ height: 50, width: 50 }}
                />
              </SSHStack>
            </SSVStack>
            <SSVStack gap="xs">
              <SSText color="white" size="sm" center>
                {t('transaction.preview.speedValue', {
                  max: ANIMATION_SPEED_MAX,
                  value: animationSpeed
                })}
              </SSText>
              <SSHStack gap="sm" style={{ justifyContent: 'center' }}>
                <SSButton
                  variant="outline"
                  label="-"
                  onPress={() =>
                    setAnimationSpeed(
                      Math.max(ANIMATION_SPEED_MIN, animationSpeed - 1)
                    )
                  }
                  style={{ height: 50, width: 50 }}
                />
                <SSButton
                  variant="outline"
                  label="+"
                  onPress={() =>
                    setAnimationSpeed(
                      Math.min(ANIMATION_SPEED_MAX, animationSpeed + 1)
                    )
                  }
                  style={{ height: 50, width: 50 }}
                />
              </SSHStack>
            </SSVStack>
          </SSHStack>
        ) : (
          <SSText color="white" size="sm" style={{ marginTop: 16 }}>
            {t('common.loading')}
          </SSText>
        )}
      </SSVStack>
    </SSModal>
  )
}

function PreviewTransactionCameraModal({
  visible,
  onClose,
  closeCamera,
  currentCosignerIndex,
  decryptedKeys,
  permission,
  requestPermission,
  processScannedData,
  updateSignedPsbt,
  handleSignWithSeedQR,
  convertPsbtToFinalTransaction
}: {
  visible: boolean
  onClose: () => void
  closeCamera: () => void
  currentCosignerIndex: number | null
  decryptedKeys: Key[]
  permission: ReturnType<typeof useCameraPermissions>[0]
  requestPermission: ReturnType<typeof useCameraPermissions>[1]
  processScannedData: ProcessScannedData
  updateSignedPsbt: PsbtManagement['updateSignedPsbt']
  handleSignWithSeedQR: PsbtManagement['handleSignWithSeedQR']
  convertPsbtToFinalTransaction: PsbtManagement['convertPsbtToFinalTransaction']
}) {
  const { handleQRCodeScanned, resetScanProgress, scanProgress } = useQrScanner(
    {
      closeCamera,
      convertPsbtToFinalTransaction,
      handleSignWithSeedQR,
      processScannedData,
      updateSignedPsbt
    }
  )

  return (
    <SSModal
      visible={visible}
      fullOpacity
      onClose={() => {
        resetScanProgress()
        onClose()
      }}
    >
      <SSVStack itemsCenter gap="md">
        <SSText color="muted" uppercase>
          {scanProgress.type
            ? t('transaction.preview.scanningQR', {
                type: scanProgress.type.toUpperCase()
              })
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
              ? t('transaction.preview.scanSeedQR')
              : t('camera.scanQRCode')}
        </SSText>

        <CameraView
          onBarcodeScanned={(res) => {
            handleQRCodeScanned(res.raw, currentCosignerIndex ?? undefined)
          }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          style={{ height: CAMERA_VIEW_SIZE, width: CAMERA_VIEW_SIZE }}
        />

        {/* Show progress if scanning multi-part QR */}
        {scanProgress.type && scanProgress.total > 1 && (
          <SSVStack itemsCenter gap="xs" style={{ marginBottom: 10 }}>
            {scanProgress.type === 'ur' ? (
              <>
                {(() => {
                  const maxFragment = Math.max(
                    ...Array.from(scanProgress.scanned)
                  )
                  const actualTotal = maxFragment + 1
                  const conservativeTarget = Math.ceil(
                    actualTotal * UR_ASSEMBLY_CONSERVATIVE_FACTOR
                  )
                  const theoreticalTarget = Math.ceil(
                    scanProgress.total * UR_ASSEMBLY_THEORETICAL_FACTOR
                  )
                  const displayTarget = Math.min(
                    conservativeTarget,
                    theoreticalTarget
                  )

                  return (
                    <>
                      <SSText color="white" center>
                        {t('transaction.preview.urFountainProgress', {
                          scanned: scanProgress.scanned.size,
                          target: displayTarget
                        })}
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
                  {t('transaction.preview.chunksProgress', {
                    scanned: scanProgress.scanned.size,
                    total: scanProgress.total
                  })}
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
                  {t('transaction.preview.scannedParts', {
                    parts: Array.from(scanProgress.scanned)
                      .toSorted((a, b) => a - b)
                      .map((n) => n + 1)
                      .join(', ')
                  })}
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
              label={t('transaction.preview.resetScan')}
              variant="outline"
              onPress={resetScanProgress}
              style={{ marginTop: 10, width: 200 }}
            />
          </SSHStack>
        )}
      </SSVStack>
    </SSModal>
  )
}

function PreviewTransactionWordCountModal({
  visible,
  onClose,
  selectedWordCount,
  setSelectedWordCount,
  onContinue
}: {
  visible: boolean
  onClose: () => void
  selectedWordCount: MnemonicWordCount
  setSelectedWordCount: (count: MnemonicWordCount) => void
  onContinue: () => void
}) {
  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack gap="lg">
        <SSText center uppercase>
          {t('transaction.preview.selectSeedWordCount')}
        </SSText>
        <SSText center color="muted" size="sm">
          {t('transaction.preview.selectSeedWordCountHint')}
        </SSText>

        <SSVStack gap="sm">
          {MNEMONIC_WORD_COUNTS.map((wordCount) => (
            <SSButton
              key={wordCount}
              label={t('transaction.preview.wordsCount', { count: wordCount })}
              variant={selectedWordCount === wordCount ? 'outline' : 'ghost'}
              onPress={() => setSelectedWordCount(wordCount)}
            />
          ))}
        </SSVStack>
      </SSVStack>
      <SSHStack gap="sm">
        <SSButton
          label={t('common.continue')}
          variant="secondary"
          onPress={onContinue}
        />
      </SSHStack>
    </SSModal>
  )
}

function PreviewTransactionSeedWordsModal({
  visible,
  onClose,
  selectedWordCount,
  network,
  wordSelectorState,
  setWordSelectorState,
  handleMnemonicValid,
  handleMnemonicInvalid,
  handleSeedWordsSubmit
}: {
  visible: boolean
  onClose: () => void
  selectedWordCount: MnemonicWordCount
  network: Parameters<typeof appNetworkToBdkNetwork>[0]
  wordSelectorState: ReturnType<typeof useSeedSigning>['wordSelectorState']
  setWordSelectorState: ReturnType<
    typeof useSeedSigning
  >['setWordSelectorState']
  handleMnemonicValid: (mnemonic: string, fingerprint: string) => void
  handleMnemonicInvalid: () => void
  handleSeedWordsSubmit: () => void
}) {
  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <View style={styles.seedWordsModalBody}>
        <ScrollView style={{ maxHeight: 600, maxWidth: 400, width: '100%' }}>
          <View style={{ paddingHorizontal: 16 }}>
            <SSVStack gap="lg">
              <SSText center uppercase>
                {t('transaction.preview.enterSeedWords')}
              </SSText>
              <SSText center color="muted" size="sm">
                {t('transaction.preview.enterSeedWordsHint', {
                  count: selectedWordCount
                })}
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
              actionButtonLabel={t('transaction.signWithSeedWords')}
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
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function usePayjoinInvoice() {
  const payjoinUri = useTransactionBuilderStore((state) => state.payjoinUri)

  const payjoinInvoice = useMemo(() => {
    if (!payjoinUri || !hasPayjoinParam(payjoinUri)) {
      return undefined
    }
    const parsed = parsePayjoinUri(payjoinUri)
    if (!parsed.isValid || !parsed.params) {
      return undefined
    }
    const amountSats =
      parsed.params.amountBtc !== undefined && parsed.params.amountBtc > 0
        ? Math.round(parsed.params.amountBtc * SATS_PER_BITCOIN)
        : undefined
    return {
      address: parsed.params.address,
      amountSats,
      endpointKind: parsed.endpointKind,
      expiresAt: parsePayjoinExpiresAtMs(parsed.params.pj),
      label: parsed.params.label
    }
  }, [payjoinUri])

  const nowMs = useNow()
  const payjoinExpiryLabel = formatPayjoinExpiryLabel(
    payjoinInvoice?.expiresAt,
    nowMs
  )

  return { payjoinExpiryLabel, payjoinInvoice }
}

function useDecryptedKeys(account: Account | undefined) {
  const [decryptedKeys, setDecryptedKeys] = useState<Key[]>([])

  useEffect(() => {
    async function decryptKeys() {
      if (!account || !account.keys || account.keys.length === 0) {
        return
      }

      const decryptedKeysData = await Promise.all(
        account.keys.map((key, index) =>
          decryptKeyOrFallback(account.id, index, key)
        )
      )

      setDecryptedKeys(decryptedKeysData)
    }
    decryptKeys()
  }, [account])

  return decryptedKeys
}

function usePsbtPreview({
  psbt,
  id,
  account
}: {
  psbt: string | undefined
  id: string
  account: Account | undefined
}) {
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
      state.clearTransaction,
      state.clearPsbt
    ])
  )
  const wallet = useGetAccountWallet(id!)
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const { server } = useBlockchainStore(
    (state) => state.configs[state.selectedNetwork]
  )

  const [transactionId, setTransactionId] = useState('')
  const [isLoadingPSBT, setIsLoadingPSBT] = useState(false)
  const [psbtBuildStatus, setPsbtBuildStatus] = useState<
    'building' | 'error' | 'idle'
  >('idle')
  const [psbtBuildErrorMessage, setPsbtBuildErrorMessage] = useState('')
  const [isDustError, setIsDustError] = useState(false)
  const [serializedPsbt, setSerializedPsbt] = useState<string>('')

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
    const extractedData = extractTransactionDataFromPSBT(psbtBase64, network)
    if (extractedData) {
      processExtractedPsbtData(extractedData)
    }
    const txid = generateTransactionId(psbtBase64)
    setTransactionId(txid)
    const mockResult = createMockPsbt(psbtBase64, txid, extractedData?.fee ?? 0)
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
        toast.info(t('transaction.preview.psbtLoadedBasic'))
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
      toast.info(t('transaction.preview.psbtLoadedLimited'))
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

        const transaction = account
          ? await buildPsbt(wallet, server, account, {
              fee,
              inputs: inputArray,
              options: { rbf },
              outputs: outputArray
            })
          : await buildTransaction(wallet, {
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
          toast.error(t('transaction.preview.utxoNotFound'))
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
      if (!output.to || output.to.trim() === '') {
        continue
      }

      try {
        bitcoinjs.address.toOutputScript(output.to, network)
      } catch {
        // Only show error for clearly invalid addresses, not during editing
        // Check if the address looks like it might be incomplete (too short)
        if (output.to.length < MIN_VALID_ADDRESS_LENGTH) {
          continue // Skip validation for very short addresses (likely incomplete)
        }

        toast.error(
          t('transaction.preview.invalidAddressFormat', {
            address: output.to
          })
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

      const psbtHex = psbtBuffer.toString('hex')
      setSerializedPsbt(psbtHex)

      psbtBuffer.fill(0)

      return psbtHex
    } catch {
      toast.error(t('error.psbt.serialization'))
      return null
    }
  }, [txBuilderResult])

  return {
    getPsbtString,
    isDustError,
    isLoadingPSBT,
    psbtBuildErrorMessage,
    psbtBuildStatus,
    serializedPsbt,
    transactionId
  }
}

function useQrExport({
  getPsbtString,
  serializedPsbt
}: {
  getPsbtString: () => string | null
  serializedPsbt: string
}) {
  const txBuilderResult = useTransactionBuilderStore((state) => state.psbt)

  const [currentChunk, setCurrentChunk] = useState(0)
  const [displayMode, setDisplayMode] = useState<QRDisplayMode>(
    QRDisplayMode.RAW
  )
  const [qrChunks, setQrChunks] = useState<string[]>([])
  const [qrError, setQrError] = useState<string | null>(null)
  const [urChunks, setUrChunks] = useState<string[]>([])
  const [currentUrChunk, setCurrentUrChunk] = useState(0)
  const [rawPsbtChunks, setRawPsbtChunks] = useState<string[]>([])
  const [currentRawChunk, setCurrentRawChunk] = useState(0)
  const [qrComplexity, setQrComplexity] = useState(QR_COMPLEXITY_DEFAULT) // 1-12 scale, 8 is default (higher = simpler/larger QR codes)
  const [animationSpeed, setAnimationSpeed] = useState(ANIMATION_SPEED_DEFAULT) // 1-12 scale for animation speed

  const animationRef = useRef<number | null>(null)
  const qrRef = useRef<View>(null)
  const lastUpdateRef = useRef<number>(0)

  const createRawPsbtChunks = useCallback(
    (base64Psbt: string, complexity: number): string[] => {
      if (complexity === 12) {
        if (base64Psbt.length > QR_MAX_DATA_SIZE) {
          const baseChunkSize = RAW_CHUNK_BASE_SIZE
          const chunkSize = Math.max(
            RAW_CHUNK_BASE_SIZE,
            baseChunkSize * RAW_CHUNK_MAX_MULTIPLIER
          ) // Use maximum density (900 characters per chunk)

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
      const baseChunkSize = RAW_CHUNK_BASE_SIZE
      const chunkSize = Math.max(
        RAW_CHUNK_BASE_SIZE,
        baseChunkSize * Math.min(complexity, RAW_CHUNK_MAX_MULTIPLIER)
      ) // Cap at 8 to avoid too large chunks

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
    },
    [] // Remove qrComplexity dependency to prevent unnecessary re-creation
  )

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
          psbtBuffer = Buffer.from(psbtHex, 'hex')
          let bbqrChunks: string[]

          try {
            if (qrComplexity === QR_COMPLEXITY_MAX) {
              // Complexity 12: Create single static BBQR chunk
              // Check if the data would be too large for a single QR code
              const estimatedBBQRSize = psbtBuffer.length * QR_ENCODING_OVERHEAD // BBQR encoding adds overhead
              if (estimatedBBQRSize > QR_MAX_DATA_SIZE) {
                const bbqrChunkSize = Math.max(
                  BBQR_CHUNK_MIN_SIZE,
                  BBQR_CHUNK_BASE_SIZE * QR_COMPLEXITY_MAX
                ) // Use maximum density (460 characters per chunk)
                bbqrChunks = createBBQRChunks(
                  new Uint8Array(psbtBuffer),
                  BBQRFileTypes.PSBT,
                  bbqrChunkSize
                )
              } else {
                bbqrChunks = createBBQRChunks(
                  new Uint8Array(psbtBuffer),
                  BBQRFileTypes.PSBT,
                  psbtBuffer.length * BBQR_SINGLE_CHUNK_MULTIPLIER
                )
              }
            } else {
              // Complexity 1-11: Create multiple chunks (higher = larger chunks)
              // Increase chunk size significantly - BBQR can handle much more data
              const bbqrChunkSize = Math.max(
                BBQR_CHUNK_MIN_SIZE,
                BBQR_CHUNK_BASE_SIZE * qrComplexity
              )

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

          psbtBuffer.fill(0)
          psbtBuffer = null

          if (!txBuilderResult?.toBase64()) {
            throw new Error('PSBT data not available')
          }

          const rawChunks = createRawPsbtChunks(
            txBuilderResult.toBase64(),
            qrComplexity
          )

          let urFragments: string[]

          if (qrComplexity === QR_COMPLEXITY_MAX) {
            // Complexity 12: Create single static UR fragment
            // Check if the data would be too large for a single QR code
            const estimatedURSize =
              txBuilderResult.toBase64().length * QR_ENCODING_OVERHEAD // UR encoding adds overhead
            if (estimatedURSize > QR_MAX_DATA_SIZE) {
              const urFragmentSize = Math.max(
                UR_FRAGMENT_MIN_SIZE,
                UR_FRAGMENT_BASE_SIZE * QR_COMPLEXITY_MAX
              ) // Use maximum density (180 characters per fragment)
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
            const urFragmentSize = Math.max(
              UR_FRAGMENT_MIN_SIZE,
              UR_FRAGMENT_BASE_SIZE * qrComplexity
            )
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

    return () => {
      isMounted = false
      if (psbtBuffer) {
        psbtBuffer.fill(0)
        psbtBuffer = null
      }
    }
  }, [getPsbtString, txBuilderResult, qrComplexity, createRawPsbtChunks])

  // Whether the current display mode is cycling through more than one chunk
  function isMultiPartQR() {
    switch (displayMode) {
      case QRDisplayMode.RAW:
        return rawPsbtChunks.length > 1
      case QRDisplayMode.UR:
        return urChunks.length > 1
      case QRDisplayMode.BBQR:
        return qrChunks.length > 1
      default:
        return false
    }
  }

  useEffect(() => {
    // Don't animate when complexity is 12 (static mode) - but only for single chunks
    if (qrComplexity === QR_COMPLEXITY_MAX && !isMultiPartQR()) {
      return // Don't animate if we have a single chunk
    }

    const shouldAnimate = isMultiPartQR()

    if (shouldAnimate) {
      // Calculate animation interval based on speed (1 = slowest, 12 = fastest)
      // Speed 1 = 2000ms, Speed 12 = 100ms
      const maxInterval = ANIMATION_INTERVAL_MAX_MS
      const minInterval = ANIMATION_INTERVAL_MIN_MS
      const interval =
        maxInterval -
        ((animationSpeed - 1) * (maxInterval - minInterval)) /
          (ANIMATION_SPEED_MAX - ANIMATION_SPEED_MIN)

      const safeInterval = Math.max(interval, ANIMATION_INTERVAL_FLOOR_MS)

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
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [
    displayMode,
    qrChunks.length,
    urChunks.length,
    rawPsbtChunks.length,
    qrComplexity,
    animationSpeed
  ])

  useEffect(
    () => () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      setQrChunks([])
      setUrChunks([])
      setRawPsbtChunks([])
    },
    []
  )

  const getQRValue = () => {
    switch (displayMode) {
      case QRDisplayMode.RAW: {
        if (rawPsbtChunks.length > 0) {
          if (currentRawChunk >= rawPsbtChunks.length) {
            return 'NO_CHUNKS'
          }

          const value = rawPsbtChunks[currentRawChunk] || 'NO_CHUNKS'
          if (value.length > QR_MAX_DATA_SIZE) {
            return 'DATA_TOO_LARGE_FOR_QR'
          }
          return value
        }
        const base64Psbt = txBuilderResult?.toBase64()
        if (base64Psbt && base64Psbt.length > QR_MAX_DATA_SIZE) {
          return 'DATA_TOO_LARGE'
        }
        return base64Psbt || 'NO_DATA'
      }
      case QRDisplayMode.UR: {
        if (currentUrChunk >= urChunks.length) {
          return 'NO_CHUNKS'
        }

        const urValue = urChunks[currentUrChunk]
        if (urValue && urValue.length > QR_MAX_DATA_SIZE) {
          return 'DATA_TOO_LARGE_FOR_QR'
        }
        return urValue || 'NO_CHUNKS'
      }
      case QRDisplayMode.BBQR: {
        if (currentChunk >= qrChunks.length) {
          return 'NO_CHUNKS'
        }

        const bbqrValue = qrChunks?.[currentChunk]
        if (bbqrValue && bbqrValue.length > QR_MAX_DATA_SIZE) {
          return 'DATA_TOO_LARGE_FOR_QR'
        }
        return bbqrValue || 'NO_CHUNKS'
      }
      default:
        return 'NO_DATA'
    }
  }

  const isDataTooLargeForSingleQR = () => {
    const base64Psbt = txBuilderResult?.toBase64()
    if (!base64Psbt) {
      return false
    }

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

    const limit = QR_MAX_DATA_SIZE // Reduced to prevent crashes

    return maxChunkSize > limit
  }

  const getDisplayModeDescription = () => {
    switch (displayMode) {
      case QRDisplayMode.RAW:
        if (rawPsbtChunks.length > 0) {
          if (
            qrComplexity === QR_COMPLEXITY_MAX &&
            rawPsbtChunks.length === 1
          ) {
            return t('transaction.preview.staticQrPsbt')
          }
          return rawPsbtChunks.length > 1
            ? t('transaction.preview.scanAllChunks', {
                current: currentRawChunk + 1,
                total: rawPsbtChunks.length
              })
            : t('transaction.preview.singleChunk')
        }
        if (serializedPsbt.length > QR_MAX_DATA_SIZE) {
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
        if (qrComplexity === QR_COMPLEXITY_MAX && urChunks.length === 1) {
          return t('transaction.preview.staticQrUr')
        }
        return urChunks.length > 1
          ? t('transaction.preview.scanAllChunks', {
              current: currentUrChunk + 1,
              total: urChunks.length
            })
          : t('transaction.preview.singleChunk')
      case QRDisplayMode.BBQR:
        if (!qrChunks.length) {
          return t('transaction.preview.loadingBbqr')
        }
        if (qrComplexity === QR_COMPLEXITY_MAX && qrChunks.length === 1) {
          return t('transaction.preview.staticQrBbqr')
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

  return {
    animationSpeed,
    displayMode,
    getDisplayModeDescription,
    getQRValue,
    isDataTooLargeForSingleQR,
    isMultiPartQR,
    qrChunks,
    qrComplexity,
    qrError,
    qrRef,
    setAnimationSpeed,
    setCurrentChunk,
    setCurrentRawChunk,
    setCurrentUrChunk,
    setDisplayMode,
    setQrComplexity
  }
}

function useScannedDataProcessor({
  convertPsbtToFinalTransaction
}: {
  convertPsbtToFinalTransaction: PsbtManagement['convertPsbtToFinalTransaction']
}): ProcessScannedData {
  const txBuilderResult = useTransactionBuilderStore((state) => state.psbt)

  // Helper function to convert PSBT to final transaction if needed.
  // Returns null (after showing an error) when the supplied content does not
  // correspond to the transaction under review — broadcasting it would
  // execute a different transaction than the one displayed to the user.
  return (data: string): string | null => {
    try {
      let processedData = data
      if (processedData.toLowerCase().startsWith('bitcoin:')) {
        processedData = processedData.substring(8)
      }

      const originalPsbtBase64 = txBuilderResult?.toBase64()

      if (processedData.toLowerCase().startsWith('70736274ff')) {
        if (originalPsbtBase64) {
          return convertPsbtToFinalTransaction(processedData)
        }
        return processedData
      }

      // Raw transaction hex: bind it to the PSBT under review (when there
      // is one) so a swapped QR/clipboard cannot substitute the broadcast.
      if (
        originalPsbtBase64 &&
        /^[a-fA-F0-9]+$/.test(processedData) &&
        !signedTransactionMatchesPsbt(originalPsbtBase64, processedData)
      ) {
        toast.error(t('common.error.transactionMismatch'))
        return null
      }

      return processedData
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t('common.error.processScannedData')
      )
      return null
    }
  }
}

function useQrScanner({
  processScannedData,
  updateSignedPsbt,
  handleSignWithSeedQR,
  convertPsbtToFinalTransaction,
  closeCamera
}: {
  processScannedData: ProcessScannedData
  updateSignedPsbt: PsbtManagement['updateSignedPsbt']
  handleSignWithSeedQR: PsbtManagement['handleSignWithSeedQR']
  convertPsbtToFinalTransaction: PsbtManagement['convertPsbtToFinalTransaction']
  closeCamera: () => void
}) {
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

  const detectQRType = (data: string) => {
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

    if (data.toLowerCase().startsWith('ur:crypto-psbt/')) {
      // UR format: ur:crypto-psbt/[sequence]/[data] for multi-part
      // or ur:crypto-psbt/[data] for single part
      const urMatch = data.match(/^ur:crypto-psbt\/(?:(\d+)-(\d+)\/)?(.+)$/i)
      if (urMatch) {
        const [, currentStr, totalStr] = urMatch

        if (currentStr && totalStr) {
          const current = parseInt(currentStr, 10) - 1 // Convert to 0-based index
          const total = parseInt(totalStr, 10)
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

  const resetScanProgress = () => {
    setScanProgress({
      chunks: new Map(),
      scanned: new Set(),
      total: 0,
      type: null
    })
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
          const sortedChunks = Array.from(chunks.entries())
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
          const sortedChunks = Array.from(chunks.entries())
            .toSorted(([a], [b]) => a - b)
            .map(([, content]) => content)

          let result: string
          if (sortedChunks.length === 1) {
            result = decodeURToPSBT(sortedChunks[0])
          } else {
            try {
              result = await decodeMultiPartURToPSBT(sortedChunks)
            } catch {
              return null
            }
          }

          if (!result) {
            return null
          }

          if (result.toLowerCase().startsWith('70736274ff')) {
            const convertedResult = convertPsbtToFinalTransaction(result)

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

  const handleQRCodeScanned = async (
    data: string | undefined,
    index?: number
  ) => {
    if (!data) {
      toast.error(t('common.error.scanQRCode'))
      return
    }

    const qrInfo = detectQRType(data)

    if (qrInfo.type === 'single' || qrInfo.total === 1) {
      let finalContent: string | null = qrInfo.content
      try {
        if (isBBQRFragment(qrInfo.content)) {
          const decoded = decodeBBQRChunks([qrInfo.content])
          if (!decoded) {
            toast.error(t('camera.error.bbqrDecodeFailed'))
            return
          }
          const hexResult = Buffer.from(decoded).toString('hex')
          finalContent = hexResult
        } else if (qrInfo.content.startsWith('cHNidP')) {
          const hexResult = Buffer.from(qrInfo.content, 'base64').toString(
            'hex'
          )
          finalContent = hexResult
        } else if (qrInfo.content.toLowerCase().startsWith('ur:crypto-psbt/')) {
          const decoded = decodeURToPSBT(qrInfo.content)
          if (!decoded) {
            toast.error(t('camera.error.urDecodeFailed'))
            return
          }
          finalContent = decoded
        } else if (index !== undefined) {
          const decodedMnemonic = detectAndDecodeSeedQR(qrInfo.content)
          if (decodedMnemonic) {
            handleSignWithSeedQR(index, decodedMnemonic)
            closeCamera()
            resetScanProgress()
            return
          }
        }

        finalContent = processScannedData(finalContent)
      } catch {
        toast.error(t('common.error.processScannedData'))
      }

      if (finalContent === null) {
        resetScanProgress()
        return
      }

      updateSignedPsbt(index ?? -1, finalContent)

      closeCamera()
      resetScanProgress()
      toast.success(t('common.success.qrScanned'))
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
      toast.info(
        t('transaction.preview.partAlreadyScanned', { part: current + 1 })
      )
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
      // For fountain encoding, we need to find the highest fragment number to determine the actual range
      const maxFragmentNumber = Math.max(...Array.from(newScanned))
      const actualTotal = maxFragmentNumber + 1 // Convert from 0-based to 1-based

      // For fountain encoding, try assembly after collecting enough fragments
      // Be more aggressive - try when we have enough fragments to potentially succeed
      // Use either 1.1x the actual range or the theoretical minimum, whichever is lower
      const conservativeTarget = Math.ceil(
        actualTotal * UR_ASSEMBLY_CONSERVATIVE_FACTOR
      )
      const theoreticalTarget = Math.ceil(
        total * UR_ASSEMBLY_THEORETICAL_FACTOR
      )
      const assemblyTarget = Math.min(conservativeTarget, theoreticalTarget)

      // Also try assembly if we have most of the available fragments (80% of actual range)
      const fallbackTarget = Math.ceil(
        actualTotal * UR_ASSEMBLY_FALLBACK_FACTOR
      )
      const shouldTryAssembly =
        newScanned.size >= assemblyTarget || newScanned.size >= fallbackTarget

      if (shouldTryAssembly) {
        const assembledData = await assembleMultiPartQR(type, newChunks)

        if (assembledData) {
          const finalData = processScannedData(assembledData)

          if (finalData === null) {
            resetScanProgress()
            return
          }

          updateSignedPsbt(index ?? -1, finalData)

          closeCamera()
          resetScanProgress()

          if (
            finalData.toLowerCase().startsWith('70736274ff') ||
            finalData.startsWith('cHNidP')
          ) {
            toast.success(
              t('transaction.preview.psbtAssembledFragments', {
                count: newScanned.size
              })
            )
          } else {
            toast.success(
              t('transaction.preview.txAssembledFragments', {
                count: newScanned.size
              })
            )
          }
          return
        }
      }

      const targetForDisplay = Math.min(
        Math.ceil(actualTotal * UR_ASSEMBLY_CONSERVATIVE_FACTOR),
        Math.ceil(total * UR_ASSEMBLY_THEORETICAL_FACTOR)
      )
      toast.success(
        t('transaction.preview.urCollected', {
          count: newScanned.size,
          target: targetForDisplay
        })
      )
    } else if (newScanned.size === total) {
      const assembledData = await assembleMultiPartQR(type, newChunks)

      if (assembledData) {
        const finalData = processScannedData(assembledData)

        if (finalData === null) {
          resetScanProgress()
          return
        }

        updateSignedPsbt(index ?? -1, finalData)

        closeCamera()
        resetScanProgress()

        if (
          finalData.toLowerCase().startsWith('70736274ff') ||
          finalData.startsWith('cHNidP')
        ) {
          toast.success(
            t('transaction.preview.psbtAssembledParts', { count: total })
          )
        } else {
          toast.success(
            t('transaction.preview.txAssembledParts', { count: total })
          )
        }
      } else {
        toast.error(t('camera.error.assembleFailed'))
        resetScanProgress()
      }
    } else {
      toast.success(
        t('transaction.preview.scannedPartProgress', {
          current: current + 1,
          scanned: newScanned.size,
          total
        })
      )
    }
  }

  return { handleQRCodeScanned, resetScanProgress, scanProgress }
}

function useSignatureDetection({
  psbt,
  account,
  decryptedKeys,
  signedPsbts,
  updateSignedPsbt
}: {
  psbt: string | undefined
  account: Account | undefined
  decryptedKeys: Key[]
  signedPsbts: PsbtManagement['signedPsbts']
  updateSignedPsbt: PsbtManagement['updateSignedPsbt']
}) {
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

      let psbtObj: bitcoinjs.Psbt
      try {
        psbtObj = bitcoinjs.Psbt.fromBase64(combinedPsbtBase64)
      } catch {
        return
      }

      const psbtHasSignatures = psbtObj.data.inputs.some(
        (input) => input.partialSig && input.partialSig.length > 0
      )
      if (!psbtHasSignatures) {
        return
      }

      let originalPsbtBase64: string
      try {
        originalPsbtBase64 = extractOriginalPsbt(combinedPsbtBase64)
      } catch {
        return
      }

      const keyFingerprintToCosignerIndex = new Map<string, number>()
      await Promise.all(
        currentAccount.keys.map(async (key, index) => {
          const fp = await getKeyFingerprint(key)
          if (fp) {
            keyFingerprintToCosignerIndex.set(fp, index)
          }
        })
      )

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

      const signerPubkeys = getCollectedSignerPubkeys(combinedPsbtBase64)
      if (signerPubkeys.size === 0) {
        return
      }

      const bySigner = extractIndividualSignedPsbts(
        combinedPsbtBase64,
        originalPsbtBase64
      ) as Record<number, string>
      if (Object.keys(bySigner).length === 0) {
        return
      }

      const matches = matchSignedPsbtsToCosigners(
        bySigner,
        pubkeyToCosignerIndex,
        currentAccount,
        decryptedKeys,
        signedPsbts
      )

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
}

function useSignatureValidation({
  account,
  signedPsbts,
  decryptedKeys
}: {
  account: Account | undefined
  signedPsbts: PsbtManagement['signedPsbts']
  decryptedKeys: Key[]
}) {
  return useMemo(() => {
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
}

function useMultisigFinalization({
  account,
  signedPsbts,
  validationResults
}: {
  account: Account | undefined
  signedPsbts: PsbtManagement['signedPsbts']
  validationResults: Map<number, boolean>
}) {
  const [txBuilderResult, setSignedTx] = useTransactionBuilderStore(
    useShallow((state) => [state.psbt, state.setSignedTx])
  )

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

      const collectedSignedPsbts = Array.from(signedPsbts.values()).filter(
        (psbt) => psbt && psbt.trim().length > 0
      )

      if (collectedSignedPsbts.length === 0) {
        toast.error(t('common.error.noSignedPSBTs'))
        return null
      }

      const originalPsbt = bitcoinjs.Psbt.fromBase64(originalPsbtBase64)

      const combinedPsbt = originalPsbt

      for (let i = 0; i < collectedSignedPsbts.length; i += 1) {
        const signedPsbtBase64 = collectedSignedPsbts[i]

        try {
          const signedPsbt = bitcoinjs.Psbt.fromBase64(signedPsbtBase64)

          combinedPsbt.combine(signedPsbt)
        } catch {
          toast.error(
            t('transaction.preview.errorCombiningPsbt', { index: i + 1 })
          )
          return null
        }
      }

      const allInputsReady = combinedPsbt.data.inputs.every(hasEnoughSignatures)

      if (!allInputsReady) {
        toast.error(t('transaction.preview.notEnoughSignatures'))
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

  return { combineAndFinalizeMultisigPSBTs, hasAllRequiredSignatures }
}

function useNfcTransfer({
  serializedPsbt,
  updateSignedPsbt
}: {
  serializedPsbt: string
  updateSignedPsbt: PsbtManagement['updateSignedPsbt']
}) {
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

  const nfcPulseAnim = useSharedValue(0)

  const nfcPulseStyle = useAnimatedStyle(() => ({
    alignItems: 'center' as const,
    backgroundColor: interpolateColor(
      nfcPulseAnim.value,
      [0, 1],
      [Colors.gray[800], Colors.gray[400]]
    ),
    borderRadius: 100,
    height: NFC_PULSE_SIZE,
    justifyContent: 'center' as const,
    width: NFC_PULSE_SIZE
  }))

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

        updateSignedPsbt(index, txHex)

        toast.success(t('transaction.preview.nfcImported'))
      } else if (result.txId) {
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

  useEffect(() => {
    if (nfcModalVisible || nfcScanModalVisible) {
      nfcPulseAnim.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: NFC_PULSE_DURATION_MS }),
            withTiming(0, { duration: NFC_PULSE_DURATION_MS })
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

  return {
    cancelNFCEmitterScan,
    cancelNFCScan,
    handleNFCExport,
    handleNFCScan,
    isEmitting,
    isReading,
    nfcError,
    nfcHardwareSupported,
    nfcModalVisible,
    nfcPulseStyle,
    nfcScanModalVisible,
    setNfcError,
    setNfcModalVisible,
    setNfcScanModalVisible
  }
}

function useNostrShare({
  account,
  id
}: {
  account: Account | undefined
  id: string
}) {
  const router = useRouter()
  const txBuilderResult = useTransactionBuilderStore((state) => state.psbt)
  const setTransactionToShare = useNostrStore(
    (state) => state.setTransactionToShare
  )

  return () => {
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
}

function useClipboardImport({
  processScannedData,
  updateSignedPsbt
}: {
  processScannedData: ProcessScannedData
  updateSignedPsbt: PsbtManagement['updateSignedPsbt']
}) {
  useClipboardPaste({
    onPaste: (content: string) => {
      const processedData = processScannedData(content)
      if (processedData !== null) {
        updateSignedPsbt(-1, processedData) // -1 for watch-only mode
      }
    }
  })

  const handlePasteFromClipboard = async (index: number) => {
    try {
      const text = await Clipboard.getStringAsync()
      if (!text) {
        toast.error(t('common.error.noClipboardData'))
        return
      }

      const processedData = processScannedData(text)

      if (processedData === null) {
        return
      }

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

  return { handlePasteFromClipboard }
}

function useSeedSigning({
  handleSignWithSeedQR,
  currentCosignerIndex,
  setCurrentCosignerIndex
}: {
  handleSignWithSeedQR: PsbtManagement['handleSignWithSeedQR']
  currentCosignerIndex: number | null
  setCurrentCosignerIndex: (index: number | null) => void
}) {
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

  const handleSeedWordsScanned = (index: number) => {
    setCurrentCosignerIndex(index)
    setWordCountModalVisible(true)
  }

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

  const handleSeedWordsSubmit = () => {
    if (!currentMnemonic || currentCosignerIndex === null) {
      toast.error(t('common.error.validMnemonic'))
      return
    }

    handleSignWithSeedQR(currentCosignerIndex, currentMnemonic)

    setSeedWordsModalVisible(false)
    setCurrentMnemonic('')
    setCurrentCosignerIndex(null)
  }

  return {
    handleMnemonicInvalid,
    handleMnemonicValid,
    handleSeedWordsScanned,
    handleSeedWordsSubmit,
    handleWordCountSelect,
    seedWordsModalVisible,
    selectedWordCount,
    setCurrentMnemonic,
    setSeedWordsModalVisible,
    setSelectedWordCount,
    setWordCountModalVisible,
    setWordSelectorState,
    wordCountModalVisible,
    wordSelectorState
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hasEnoughSignatures(input: PsbtInputWithSignatures) {
  if (!input.witnessScript) {
    return true
  }

  try {
    const script = bitcoinjs.script.decompile(input.witnessScript)

    if (!script || script.length < MIN_MULTISIG_SCRIPT_LENGTH) {
      return false
    }

    const [op] = script

    if (typeof op !== 'number' || op < OP_1 || op > OP_16) {
      return false
    }

    const threshold = op - OP_N_VALUE_OFFSET
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
    toast.warning(t('transaction.preview.psbtNotMatchAccount'))
  } else if (
    errorMessage.includes('Invalid PSBT') ||
    errorMessage.includes('malformed')
  ) {
    toast.error(t('transaction.preview.psbtInvalidFormat'))
  } else {
    toast.warning(t('transaction.preview.psbtEnhancedFailed'))
  }
}

async function decryptKeyOrFallback(
  accountId: string,
  keyIndex: number,
  key: Key
): Promise<Key> {
  try {
    const secret = await decryptAccountKeySecret(accountId, keyIndex)
    return { ...key, secret }
  } catch {
    return key
  }
}

export default PreviewTransaction
