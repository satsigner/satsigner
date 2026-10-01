import * as bitcoinjs from 'bitcoinjs-lib'
import * as Clipboard from 'expo-clipboard'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { type ComponentProps, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { type PsbtLike } from 'react-native-bdk-sdk'
import Animated from 'react-native-reanimated'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { buildPsbt, buildTransaction } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSDustWarningBanner from '@/components/SSDustWarningBanner'
import SSModal from '@/components/SSModal'
import SSPsbtQRExportModal from '@/components/SSPsbtQRExportModal'
import SSSeedWordsEntry from '@/components/SSSeedWordsEntry'
import SSSignatureDropdown from '@/components/SSSignatureDropdown'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import SSTransactionIdFormatted from '@/components/SSTransactionIdFormatted'
import SSWordCountSelectModal from '@/components/SSWordCountSelectModal'
import { PSBT_MAGIC_BASE64, PSBT_MAGIC_HEX } from '@/constants/btc'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import { useDecryptedKeys } from '@/hooks/useDecryptedKeys'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { useNfcPulse } from '@/hooks/useNfcPulse'
import { useNFCReader } from '@/hooks/useNFCReader'
import { useNostrShareTransaction } from '@/hooks/useNostrShareTransaction'
import { usePayjoinInvoice } from '@/hooks/usePayjoinInvoice'
import { usePSBTManagement } from '@/hooks/usePSBTManagement'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Typography } from '@/styles'
import type { MnemonicWordCount } from '@/types/bips/39'
import { type Account, type Key } from '@/types/models/Account'
import { type PsbtBuildStatus } from '@/types/models/Psbt'
import { type PreviewTransactionSearchParams } from '@/types/navigation/searchParams'
import { type PayjoinInvoice } from '@/types/payjoin'
import { getKeyFingerprint } from '@/utils/account'
import { appNetworkToBdkNetwork, bitcoinjsNetwork } from '@/utils/bitcoin'
import { type DetectedContent } from '@/utils/contentDetector'
import { formatPayjoinSummary } from '@/utils/payjoinUri'
import {
  bindScannedDataToPsbt,
  buildPubkeyToCosignerIndex,
  combineAndFinalizePsbts,
  combinePsbts,
  createMockPsbt,
  type ExtractedTransactionData,
  extractIndividualSignedPsbts,
  extractOriginalPsbt,
  extractTransactionDataFromPSBT,
  extractTransactionDataFromPSBTEnhanced,
  generateTransactionId,
  getCollectedSignedPsbts,
  getCollectedSignerPubkeys,
  getPsbtTxidOrFallback,
  hasAllRequiredSignatures,
  matchSignedPsbtsToCosigners,
  validateSignedPSBTForCosigner
} from '@/utils/psbt'
import {
  buildKnownTxIds,
  buildOutpointLabelsByRef,
  buildTxLabelsById
} from '@/utils/sankeyInputLabel'
import {
  buildChartTransactionFromBuilder,
  buildPreviewTransactionHex
} from '@/utils/transaction'

const tn = _tn('transaction.build.preview')

// Shorter outputs are likely still being typed; don't flag them as invalid.
const MIN_VALID_ADDRESS_LENGTH = 10
// Cosigner index used for watch-only imports (no cosigner).
const WATCH_ONLY_INDEX = -1

const TRANSACTION_CHART_SCALE = 0.9

type PsbtManagement = ReturnType<typeof usePSBTManagement>
type ProcessScannedData = (data: string) => string | null
type NfcTransfer = ReturnType<typeof useNfcTransfer>
type SeedSigning = ReturnType<typeof useSeedSigning>

type NfcModalProps = {
  nfcError: NfcTransfer['nfcError']
  nfcPulseStyle: ReturnType<typeof useNfcPulse>
  onClose: () => void
  visible: boolean
}

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
  const [noKeyModalVisible, setNoKeyModalVisible] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [currentCosignerIndex, setCurrentCosignerIndex] = useState<
    number | null
  >(null)

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
    nfcScanModalVisible,
    setNfcError,
    setNfcModalVisible,
    setNfcScanModalVisible
  } = useNfcTransfer({ serializedPsbt, updateSignedPsbt })
  const nfcPulseStyle = useNfcPulse(nfcModalVisible || nfcScanModalVisible)

  const shareWithNostrGroup = useNostrShareTransaction({ account, id })

  const { handlePasteFromClipboard } = useClipboardImport({
    processScannedData,
    updateSignedPsbt
  })

  const handleScannedContent = useScannedContentImport({
    currentCosignerIndex,
    handleSignWithSeedQR,
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
    wordCountModalVisible
  } = useSeedSigning({
    currentCosignerIndex,
    handleSignWithSeedQR,
    setCurrentCosignerIndex
  })

  const transactionHex = useMemo(
    () =>
      account
        ? buildPreviewTransactionHex(inputs, outputs, account.network)
        : '',
    [account, inputs, outputs]
  )

  const transaction = useMemo(
    () =>
      buildChartTransactionFromBuilder(
        inputs,
        outputs,
        getPsbtTxidOrFallback(txBuilderResult, transactionId)
      ),
    [inputs, outputs, transactionId, txBuilderResult]
  )

  useEffect(() => {
    if (signedPsbtsFromStore && signedPsbtsFromStore.size > 0) {
      setSignedPsbts(signedPsbtsFromStore)
    }
  }, [signedPsbtsFromStore, setSignedPsbts])

  function handleCosignerPasteFromClipboard(index: number) {
    handlePasteFromClipboard(index)
  }

  function handleCosignerCameraScan(index: number) {
    setCameraModalVisible(true)
    setCurrentCosignerIndex(index)
  }

  function handleCosignerNFCScan(index: number) {
    handleNFCScan(index)
  }

  function handleSeedQRScanned(index: number) {
    setCameraModalVisible(true)
    setCurrentCosignerIndex(index)
  }

  function handleWatchOnlyPasteFromClipboard() {
    handlePasteFromClipboard(WATCH_ONLY_INDEX)
  }

  function handleWatchOnlyNFCScan() {
    handleNFCScan(WATCH_ONLY_INDEX)
  }

  function shareOrShowError(psbtBase64: string | undefined) {
    const errorKey = shareWithNostrGroup(psbtBase64)
    if (errorKey) {
      toast.error(t(errorKey))
    }
  }

  function handleShareWithNostrGroup() {
    shareOrShowError(txBuilderResult?.toBase64())
  }

  // Shares the PSBT under review combined with every cosigner signature
  // collected so far.
  function handleShareSignaturesWithNostrGroup() {
    const originalPsbtBase64 = txBuilderResult?.toBase64()
    if (!transactionId || !originalPsbtBase64) {
      toast.error(t('account.nostrSync.transactionDataNotAvailable'))
      return
    }
    try {
      shareOrShowError(
        combinePsbts([
          originalPsbtBase64,
          ...getCollectedSignedPsbts(signedPsbts).values()
        ])
      )
    } catch {
      toast.error(t('account.nostrSync.failedToSendTransactionData'))
    }
  }

  useEffect(() => {
    if (signedPsbt) {
      setSignedTx(signedPsbt)
    }
  }, [signedPsbt, setSignedTx])

  if (!id || !account) {
    return <Redirect href="/" />
  }

  const propsMultisigSection = {
    account,
    decryptedKeys,
    handleCosignerCameraScan,
    handleCosignerNFCScan,
    handleCosignerPasteFromClipboard,
    handleNFCExport,
    handleSeedQRScanned,
    handleSeedWordsScanned,
    handleShareSignaturesWithNostrGroup,
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
    onClose: () => setNoKeyModalVisible(false),
    psbtBase64: txBuilderResult?.toBase64(),
    visible: noKeyModalVisible
  }

  const propsCameraModal = {
    onClose: () => {
      setCameraModalVisible(false)
      setCurrentCosignerIndex(null)
    },
    onContentScanned: handleScannedContent,
    title: getCameraModalTitle(decryptedKeys, currentCosignerIndex),
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
    visible: seedWordsModalVisible
  }

  const propsIdSection = {
    isDustError,
    isLoadingPSBT,
    psbtBuildErrorMessage,
    psbtBuildStatus,
    transactionId
  }

  const propsContents = {
    accountId: id,
    knownTxIds,
    outpointLabelsByRef,
    ownAddresses,
    transaction,
    txLabelsById
  }

  const propsNfcEmitModal = {
    nfcError,
    nfcPulseStyle,
    onClose: () => {
      setNfcModalVisible(false)
      setNfcError(null)
      if (isEmitting) {
        cancelNFCEmitterScan()
      }
    },
    visible: nfcModalVisible
  }

  const propsNfcScanModal = {
    nfcError,
    nfcPulseStyle,
    onClose: () => {
      setNfcScanModalVisible(false)
      if (isReading) {
        cancelNFCScan()
      }
    },
    visible: nfcScanModalVisible
  }

  return (
    <SSMainLayout style={styles.mainLayout}>
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack>
            <PreviewTransactionPayjoinNote
              invoice={payjoinInvoice}
              expiryLabel={payjoinExpiryLabel}
            />
            <PreviewTransactionIdSection {...propsIdSection} />
            <PreviewTransactionContents {...propsContents} />
            <PreviewTransactionDecoded transactionHex={transactionHex} />
            <PreviewTransactionMultisigSection {...propsMultisigSection} />
            <PreviewTransactionActions {...propsActions} />
          </SSVStack>
        </ScrollView>
      </SSVStack>
      <SSPsbtQRExportModal {...propsQrExportModal} />
      <SSCameraModal context="bitcoin" {...propsCameraModal} />
      <PreviewTransactionNfcEmitModal {...propsNfcEmitModal} />
      <PreviewTransactionNfcScanModal {...propsNfcScanModal} />
      <SSWordCountSelectModal {...propsWordCountModal} />
      <PreviewTransactionSeedWordsModal {...propsSeedWordsModal} />
    </SSMainLayout>
  )
}

type PreviewTransactionPayjoinNoteProps = {
  invoice: PayjoinInvoice | undefined
  expiryLabel: string | null
}

function PreviewTransactionPayjoinNote({
  invoice,
  expiryLabel
}: PreviewTransactionPayjoinNoteProps) {
  if (!invoice) {
    return null
  }

  return (
    <View style={styles.payjoinNote} testID="preview-payjoin-note">
      <SSText size="xs" uppercase color="muted" center>
        {t('transaction.build.payjoin.previewNote.title')}
      </SSText>
      <SSText size="sm" weight="light" center>
        {formatPayjoinSummary(invoice, expiryLabel)}
      </SSText>
      <SSText size="xs" center style={styles.payjoinNoteHint}>
        {t('transaction.build.payjoin.previewNote.hint')}
      </SSText>
    </View>
  )
}

type PreviewTransactionIdSectionProps = {
  isDustError: boolean
  isLoadingPSBT: boolean
  psbtBuildErrorMessage: string
  psbtBuildStatus: PsbtBuildStatus
  transactionId: string
}

function PreviewTransactionIdSection({
  isDustError,
  isLoadingPSBT,
  psbtBuildErrorMessage,
  psbtBuildStatus,
  transactionId
}: PreviewTransactionIdSectionProps) {
  const showBuildError =
    psbtBuildStatus === 'error' && psbtBuildErrorMessage !== ''

  return (
    <SSVStack gap="xxs">
      <SSText color="muted" size="sm" uppercase>
        {t('transaction.id')}
      </SSText>
      <SSTransactionIdFormatted
        size="lg"
        value={getTransactionIdDisplayValue({
          isLoadingPSBT,
          psbtBuildStatus,
          transactionId
        })}
      />
      {isLoadingPSBT && (
        <SSText color="muted" size="sm" style={styles.statusText}>
          {t('transaction.preview.processingPsbt')}
        </SSText>
      )}
      {psbtBuildStatus === 'building' && !isLoadingPSBT && (
        <SSText color="muted" size="sm" style={styles.statusText}>
          {t('transaction.preview.buildingTransaction')}
        </SSText>
      )}
      {showBuildError && isDustError && (
        <SSDustWarningBanner message={psbtBuildErrorMessage} />
      )}
      {showBuildError && !isDustError && (
        <SSText color="muted" size="sm" style={styles.statusText}>
          {psbtBuildErrorMessage}
        </SSText>
      )}
    </SSVStack>
  )
}

type PreviewTransactionContentsProps = Pick<
  ComponentProps<typeof SSTransactionChart>,
  | 'accountId'
  | 'knownTxIds'
  | 'outpointLabelsByRef'
  | 'ownAddresses'
  | 'transaction'
  | 'txLabelsById'
>

function PreviewTransactionContents({
  accountId,
  knownTxIds,
  outpointLabelsByRef,
  ownAddresses,
  transaction,
  txLabelsById
}: PreviewTransactionContentsProps) {
  return (
    <SSVStack gap="xxs">
      <SSText color="muted" size="sm" uppercase>
        {tn('contents')}
      </SSText>
      <View style={styles.chartContainer}>
        <SSTransactionChart
          accountId={accountId}
          knownTxIds={knownTxIds}
          outpointLabelsByRef={outpointLabelsByRef}
          ownAddresses={ownAddresses}
          transaction={transaction}
          txLabelsById={txLabelsById}
          scale={TRANSACTION_CHART_SCALE}
          showUnspentLabel={false}
        />
      </View>
    </SSVStack>
  )
}

type PreviewTransactionDecodedProps = {
  transactionHex: string
}

function PreviewTransactionDecoded({
  transactionHex
}: PreviewTransactionDecodedProps) {
  return (
    <SSVStack gap="xxs">
      <SSText uppercase size="sm" color="muted">
        {tn('decoded')}
      </SSText>
      {transactionHex !== '' && <SSTransactionDecoded txHex={transactionHex} />}
    </SSVStack>
  )
}

function PreviewTransactionNfcEmitModal({
  nfcError,
  nfcPulseStyle,
  onClose,
  visible
}: NfcModalProps) {
  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack itemsCenter gap="lg">
        <SSText center style={styles.nfcTitle}>
          {nfcError ? t('common.errorTitle') : t('transaction.preview.nfcTip')}
        </SSText>
        {nfcError ? (
          <SSVStack itemsCenter gap="md">
            <SSText color="white" center>
              {nfcError}
            </SSText>
          </SSVStack>
        ) : (
          <Animated.View style={nfcPulseStyle}>
            <SSText uppercase>{t('transaction.preview.emittingNFC')}</SSText>
          </Animated.View>
        )}
      </SSVStack>
    </SSModal>
  )
}

function PreviewTransactionNfcScanModal({
  nfcError,
  nfcPulseStyle,
  onClose,
  visible
}: NfcModalProps) {
  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack itemsCenter gap="lg">
        <SSText center style={styles.nfcTitle}>
          {nfcError ? t('common.errorTitle') : t('transaction.preview.nfcTip')}
        </SSText>
        <Animated.View style={nfcPulseStyle}>
          <SSText uppercase>{t('watchonly.read.scanning')}</SSText>
        </Animated.View>
      </SSVStack>
    </SSModal>
  )
}

type PreviewTransactionMultisigSectionProps = {
  account: Account
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
  handleShareSignaturesWithNostrGroup: () => void
  setNoKeyModalVisible: (visible: boolean) => void
}

function PreviewTransactionMultisigSection({
  account,
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
  handleShareSignaturesWithNostrGroup,
  setNoKeyModalVisible
}: PreviewTransactionMultisigSectionProps) {
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
        collectedSignatures={Array.from(
          getCollectedSignedPsbts(signedPsbts).keys()
        )}
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
            onShowQR={() => setNoKeyModalVisible(true)}
            onShareWithGroup={handleShareSignaturesWithNostrGroup}
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

type PreviewTransactionActionsProps = {
  account: Account
  accountId: string
  router: ReturnType<typeof useRouter>
  transactionId: string
  psbtBuildStatus: PsbtBuildStatus
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
}: PreviewTransactionActionsProps) {
  return (
    <>
      {account.policyType !== 'watchonly' &&
      account.keys &&
      account.keys.length > 0 ? (
        <>
          {account.policyType === 'multisig' && (
            <SSText center color="muted" size="sm" style={{ marginBottom: 8 }}>
              {t('transaction.preview.signaturesCollected')}:{' '}
              {getCollectedSignedPsbts(signedPsbts).size} /{' '}
              {account.keysRequired || account.keys.length}
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
              (signedPsbt.toLowerCase().startsWith(PSBT_MAGIC_HEX) ||
                signedPsbt.startsWith(PSBT_MAGIC_BASE64))
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

type PreviewTransactionSeedWordsModalProps = {
  visible: boolean
  onClose: () => void
  selectedWordCount: MnemonicWordCount
  network: Parameters<typeof appNetworkToBdkNetwork>[0]
  handleMnemonicValid: SeedSigning['handleMnemonicValid']
  handleMnemonicInvalid: SeedSigning['handleMnemonicInvalid']
  handleSeedWordsSubmit: SeedSigning['handleSeedWordsSubmit']
}

function PreviewTransactionSeedWordsModal({
  visible,
  onClose,
  selectedWordCount,
  network,
  handleMnemonicValid,
  handleMnemonicInvalid,
  handleSeedWordsSubmit
}: PreviewTransactionSeedWordsModalProps) {
  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <View style={styles.seedWordsModalBody}>
        <SSSeedWordsEntry
          scrollStyle={styles.seedWordsModalScroll}
          contentStyle={styles.seedWordsModalContent}
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
        >
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
        </SSSeedWordsEntry>
      </View>
    </SSModal>
  )
}

type UsePsbtPreviewParams = {
  psbt: string | undefined
  id: string
  account: Account | undefined
}

function usePsbtPreview({ psbt, id, account }: UsePsbtPreviewParams) {
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
  const [psbtBuildStatus, setPsbtBuildStatus] =
    useState<PsbtBuildStatus>('idle')
  const [psbtBuildErrorMessage, setPsbtBuildErrorMessage] = useState('')
  const [isDustError, setIsDustError] = useState(false)

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
        setTransactionId(createErrorTransactionId())
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
      setTransactionId(createErrorTransactionId())
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

  const psbtBase64 = txBuilderResult?.toBase64()
  const serializedPsbt = psbtBase64
    ? Buffer.from(psbtBase64, 'base64').toString('hex')
    : ''

  return {
    isDustError,
    isLoadingPSBT,
    psbtBuildErrorMessage,
    psbtBuildStatus,
    serializedPsbt,
    transactionId
  }
}

type UseScannedDataProcessorParams = {
  convertPsbtToFinalTransaction: PsbtManagement['convertPsbtToFinalTransaction']
}

function useScannedDataProcessor({
  convertPsbtToFinalTransaction
}: UseScannedDataProcessorParams): ProcessScannedData {
  const txBuilderResult = useTransactionBuilderStore((state) => state.psbt)

  // Binds scanned/pasted data to the transaction under review. Returns null
  // (after showing an error) when it does not match: broadcasting it would
  // execute a different transaction than the one displayed to the user.
  function processScannedData(data: string) {
    try {
      const boundData = bindScannedDataToPsbt(
        data,
        txBuilderResult?.toBase64(),
        convertPsbtToFinalTransaction
      )
      if (boundData === null) {
        toast.error(t('common.error.transactionMismatch'))
      }
      return boundData
    } catch {
      toast.error(t('common.error.processScannedData'))
      return null
    }
  }

  return processScannedData
}

type UseScannedContentImportParams = {
  currentCosignerIndex: number | null
  handleSignWithSeedQR: PsbtManagement['handleSignWithSeedQR']
  processScannedData: ProcessScannedData
  updateSignedPsbt: PsbtManagement['updateSignedPsbt']
}

function useScannedContentImport({
  currentCosignerIndex,
  handleSignWithSeedQR,
  processScannedData,
  updateSignedPsbt
}: UseScannedContentImportParams) {
  // Routes a QR scanned by SSCameraModal: a SeedQR signs for the current
  // cosigner, a PSBT or signed transaction is stored as that cosigner's
  // signature (or the watch-only import when no cosigner is selected).
  function handleScannedContent(content: DetectedContent) {
    const mnemonic = content.metadata?.mnemonic
    if (content.type === 'seed_qr' && typeof mnemonic === 'string') {
      if (currentCosignerIndex === null) {
        toast.error(t('camera.error.invalidContent'))
        return
      }
      handleSignWithSeedQR(currentCosignerIndex, mnemonic)
      return
    }

    if (content.type !== 'psbt' && content.type !== 'bitcoin_transaction') {
      toast.error(t('camera.error.invalidContent'))
      return
    }

    const processedData = processScannedData(content.cleaned)
    if (processedData === null) {
      return
    }
    updateSignedPsbt(currentCosignerIndex ?? WATCH_ONLY_INDEX, processedData)
    toast.success(t('common.success.qrScanned'))
  }

  return handleScannedContent
}

type UseSignatureDetectionParams = {
  psbt: string | undefined
  account: Account | undefined
  decryptedKeys: Key[]
  signedPsbts: PsbtManagement['signedPsbts']
  updateSignedPsbt: PsbtManagement['updateSignedPsbt']
}

function useSignatureDetection({
  psbt,
  account,
  decryptedKeys,
  signedPsbts,
  updateSignedPsbt
}: UseSignatureDetectionParams) {
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

      const keyFingerprints = await Promise.all(
        currentAccount.keys.map((key) => getKeyFingerprint(key))
      )
      const pubkeyToCosignerIndex = buildPubkeyToCosignerIndex(
        psbtObj,
        keyFingerprints
      )

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

type UseSignatureValidationParams = {
  account: Account | undefined
  signedPsbts: PsbtManagement['signedPsbts']
  decryptedKeys: Key[]
}

function useSignatureValidation({
  account,
  signedPsbts,
  decryptedKeys
}: UseSignatureValidationParams) {
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

type UseMultisigFinalizationParams = {
  account: Account | undefined
  signedPsbts: PsbtManagement['signedPsbts']
  validationResults: Map<number, boolean>
}

function useMultisigFinalization({
  account,
  signedPsbts,
  validationResults
}: UseMultisigFinalizationParams) {
  const [txBuilderResult, setSignedTx] = useTransactionBuilderStore(
    useShallow((state) => [state.psbt, state.setSignedTx])
  )

  const combineAndFinalizeMultisigPSBTs = () => {
    const originalPsbtBase64 = txBuilderResult?.toBase64()
    if (!originalPsbtBase64) {
      toast.error(t('common.error.noOriginalPSBT'))
      return null
    }

    try {
      const result = combineAndFinalizePsbts(
        originalPsbtBase64,
        Array.from(getCollectedSignedPsbts(signedPsbts).values())
      )
      if ('errorKey' in result) {
        toast.error(t(result.errorKey, result.errorParams))
        return null
      }
      setSignedTx(result.hex)
      toast.success(t('transaction.finalizedSuccessfully'))
      return result.hex
    } catch {
      toast.error(t('common.error.combinePSBTs'))
      return null
    }
  }

  return {
    combineAndFinalizeMultisigPSBTs,
    hasAllRequiredSignatures: () =>
      hasAllRequiredSignatures(account, validationResults)
  }
}

type UseNfcTransferParams = {
  serializedPsbt: string
  updateSignedPsbt: PsbtManagement['updateSignedPsbt']
}

function useNfcTransfer({
  serializedPsbt,
  updateSignedPsbt
}: UseNfcTransferParams) {
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
      setNfcModalVisible(false)
    } catch {
      // Keep the modal open so the error stays visible until dismissed.
      setNfcError(t('nfc.error.writeFailed'))
      toast.error(t('nfc.error.writeFailed'))
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
    } catch {
      toast.error(t('nfc.error.readFailed'))
    } finally {
      setNfcScanModalVisible(false)
    }
  }

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
    nfcScanModalVisible,
    setNfcError,
    setNfcModalVisible,
    setNfcScanModalVisible
  }
}

type UseClipboardImportParams = {
  processScannedData: ProcessScannedData
  updateSignedPsbt: PsbtManagement['updateSignedPsbt']
}

function useClipboardImport({
  processScannedData,
  updateSignedPsbt
}: UseClipboardImportParams) {
  const { pasteFromClipboardSilent } = useClipboardPaste()

  const handlePasteFromClipboard = async (index: number) => {
    const text = await pasteFromClipboardSilent()
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
  }

  return { handlePasteFromClipboard }
}

type UseSeedSigningParams = {
  handleSignWithSeedQR: PsbtManagement['handleSignWithSeedQR']
  currentCosignerIndex: number | null
  setCurrentCosignerIndex: (index: number | null) => void
}

function useSeedSigning({
  handleSignWithSeedQR,
  currentCosignerIndex,
  setCurrentCosignerIndex
}: UseSeedSigningParams) {
  const [seedWordsModalVisible, setSeedWordsModalVisible] = useState(false)
  const [wordCountModalVisible, setWordCountModalVisible] = useState(false)
  const [selectedWordCount, setSelectedWordCount] =
    useState<MnemonicWordCount>(24)
  const [currentMnemonic, setCurrentMnemonic] = useState('')

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
    wordCountModalVisible
  }
}

type GetTransactionIdDisplayValueParams = {
  isLoadingPSBT: boolean
  psbtBuildStatus: PsbtBuildStatus
  transactionId: string
}

function getTransactionIdDisplayValue({
  isLoadingPSBT,
  psbtBuildStatus,
  transactionId
}: GetTransactionIdDisplayValueParams) {
  if (isLoadingPSBT) {
    return t('common.loading')
  }
  if (psbtBuildStatus === 'building') {
    return t('transaction.preview.buildingTransaction')
  }
  if (psbtBuildStatus === 'error') {
    return '—'
  }
  return transactionId || '—'
}

function createErrorTransactionId() {
  return `PSBT-ERROR-${Date.now().toString(36)}`
}

// Camera title: ask for a SeedQR when signing for a cosigner whose key has no
// stored mnemonic, otherwise a generic "scan QR code".
function getCameraModalTitle(
  decryptedKeys: Key[],
  currentCosignerIndex: number | null
) {
  if (currentCosignerIndex === null) {
    return t('camera.scanQRCode')
  }
  const secret = decryptedKeys[currentCosignerIndex]?.secret
  const hasMnemonic =
    typeof secret === 'object' && 'mnemonic' in secret && !!secret.mnemonic
  return hasMnemonic
    ? t('camera.scanQRCode')
    : t('transaction.preview.scanSeedQR')
}

function mapBuildTransactionError(error: unknown) {
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

const styles = StyleSheet.create({
  chartContainer: { overflow: 'hidden' },
  mainLayout: { paddingBottom: 20, paddingTop: 0 },
  nfcTitle: { maxWidth: 300 },
  payjoinNote: {
    gap: 4,
    paddingVertical: 4
  },
  payjoinNoteHint: {
    color: Colors.gray[500]
  },
  seedWordsModalBody: {
    flex: 1,
    maxWidth: 400,
    position: 'relative',
    width: '100%'
  },
  seedWordsModalContent: { paddingHorizontal: 16 },
  seedWordsModalScroll: { maxHeight: 600, maxWidth: 400, width: '100%' },
  statusText: { marginTop: 8 }
})

export default PreviewTransaction
