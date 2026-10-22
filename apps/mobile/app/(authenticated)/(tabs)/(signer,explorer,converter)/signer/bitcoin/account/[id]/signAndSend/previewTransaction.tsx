import * as Clipboard from 'expo-clipboard'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { type ComponentProps, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { type PsbtLike } from 'react-native-bdk-sdk'
import Animated from 'react-native-reanimated'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSDustWarningBanner from '@/components/SSDustWarningBanner'
import SSMnemonicWordCountSelectModal from '@/components/SSMnemonicWordCountSelectModal'
import SSModal from '@/components/SSModal'
import SSPsbtQRExportModal from '@/components/SSPsbtQRExportModal'
import SSSeedWordsEntry from '@/components/SSSeedWordsEntry'
import SSSignatureDropdown from '@/components/SSSignatureDropdown'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import SSTransactionIdFormatted from '@/components/SSTransactionIdFormatted'
import { WATCH_ONLY_COSIGNER_INDEX } from '@/constants/account'
import { useCosignerSignatures } from '@/hooks/useCosignerSignatures'
import { useDecryptedKeys } from '@/hooks/useDecryptedKeys'
import { useNfcPulseStyle } from '@/hooks/useNfcPulseStyle'
import { useNostrShareTransaction } from '@/hooks/useNostrShareTransaction'
import { usePayjoinInvoice } from '@/hooks/usePayjoinInvoice'
import { usePsbtNfcExport } from '@/hooks/usePsbtNfcExport'
import { usePsbtSignatureImport } from '@/hooks/usePsbtSignatureImport'
import { useSeedWordsSigning } from '@/hooks/useSeedWordsSigning'
import { useTransactionPsbt } from '@/hooks/useTransactionPsbt'
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
import { type Network } from '@/types/settings/blockchain'
import { type Notice } from '@/types/ui/notice'
import { hasStoredMnemonic } from '@/utils/account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { isPSBT } from '@/utils/bitcoinContent'
import { type DetectedContent } from '@/utils/contentDetector'
import { formatMessage } from '@/utils/notice'
import { formatPayjoinSummary } from '@/utils/payjoinInvoice'
import { getCollectedSignedPsbts, getPsbtTxidOrFallback } from '@/utils/psbt'
import {
  buildKnownTxIds,
  buildOutpointLabelsByRef,
  buildTxLabelsById
} from '@/utils/sankeyInputLabel'
import {
  buildChartTransactionFromBuilder,
  buildPreviewTransactionHex,
  getTransactionIdDisplay
} from '@/utils/transaction'

const tn = _tn('transaction.build.preview')

const TRANSACTION_CHART_SCALE = 0.9

type CosignerSignatures = ReturnType<typeof useCosignerSignatures>

type SeedWordsSigning = ReturnType<typeof useSeedWordsSigning>

type PayjoinNoteProps = {
  invoice: PayjoinInvoice | undefined
  expiryLabel: string | null
}

type TransactionIdSectionProps = {
  isDustError: boolean
  isLoadingPSBT: boolean
  psbtBuildErrorMessage: string
  psbtBuildStatus: PsbtBuildStatus
  transactionId: string
}

type TransactionContentsSectionProps = Pick<
  ComponentProps<typeof SSTransactionChart>,
  | 'knownTxIds'
  | 'onOpenLinkedTx'
  | 'outpointLabelsByRef'
  | 'ownAddresses'
  | 'transaction'
  | 'txLabelsById'
>

type DecodedTransactionSectionProps = {
  transactionHex: string
}

type MultisigSignaturesSectionProps = {
  account: Account
  transactionId: string
  txBuilderResult: PsbtLike | undefined
  serializedPsbt: string
  signedPsbts: CosignerSignatures['signedPsbts']
  validationResults: Map<number, boolean>
  decryptedKeys: Key[]
  nfcHardwareSupported: boolean
  isEmitting: boolean
  isReading: boolean
  handleNFCExport: () => void
  handleCosignerPasteFromClipboard: (index: number) => void
  handleCosignerCameraScan: (index: number) => void
  handleCosignerNFCScan: (index: number) => void
  handleSignWithLocalKey: CosignerSignatures['signWithLocalKey']
  handleSeedWordsScanned: (index: number) => void
  handleShareSignaturesWithNostrGroup: () => void
  showQrExportModal: () => void
}

type SignActionsProps = {
  account: Account
  canShareWithGroup: boolean
  collectedSignatures: number
  isSignDisabled: boolean
  onShareWithGroup: () => void
  onSign: () => void
}

type WatchOnlyActionsProps = {
  account: Account
  isEmitting: boolean
  isReading: boolean
  nfcHardwareSupported: boolean
  serializedPsbt: string
  signedPsbt: string
  transactionId: string
  onCheckSignature: () => void
  onCopy: () => void
  onNFCExport: () => void
  onNFCScan: () => void
  onPaste: () => void
  onScanQR: () => void
  onShowQR: () => void
}

type NfcTransferModalProps = {
  errorKey: string | null
  onClose: () => void
  pulseStyle: ReturnType<typeof useNfcPulseStyle>
  statusLabel: string
  visible: boolean
}

type SeedWordsSignModalProps = {
  visible: boolean
  onClose: () => void
  selectedWordCount: MnemonicWordCount
  network: Network
  handleMnemonicValid: SeedWordsSigning['handleMnemonicValid']
  handleMnemonicInvalid: SeedWordsSigning['handleMnemonicInvalid']
  handleSeedWordsSubmit: SeedWordsSigning['submitSeedWords']
}

function showNoticeAsToast(notice: Notice) {
  toast[notice.type](formatMessage(notice))
}

function PreviewTransaction() {
  const router = useRouter()
  const { id, psbt } = useLocalSearchParams<PreviewTransactionSearchParams>()

  const [inputs, outputs, txBuilderResult] = useTransactionBuilderStore(
    useShallow((state) => [state.inputs, state.outputs, state.psbt])
  )

  const { payjoinInvoice, payjoinExpiryLabel } = usePayjoinInvoice()

  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
  )
  const ownAddresses = new Set(account?.addresses?.map((a) => a.address))
  const txLabelsById = buildTxLabelsById(account?.transactions)
  const knownTxIds = buildKnownTxIds(account?.transactions)
  const outpointLabelsByRef = buildOutpointLabelsByRef(account ?? {})
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const [qrExportModalVisible, setQrExportModalVisible] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [selectedCosignerIndex, setSelectedCosignerIndex] = useState<
    number | null
  >(null)

  const decryptedKeys = useDecryptedKeys(account)

  const {
    isDustError,
    isLoadingPSBT,
    psbtBuildError,
    psbtBuildStatus,
    serializedPsbt,
    transactionId
  } = useTransactionPsbt({
    account,
    accountId: id,
    importedPsbtBase64: psbt,
    onNotice: showNoticeAsToast
  })

  const {
    combineAndFinalizeSignatures,
    combineCollectedSignaturesForSharing,
    hasAllRequiredSignatures,
    importSignedDataMatchingPsbt,
    signWithLocalKey,
    signWithMnemonic,
    signedPsbt,
    signedPsbts,
    validationResults
  } = useCosignerSignatures({
    account,
    decryptedKeys,
    importedPsbtBase64: psbt,
    onNotice: showNoticeAsToast
  })

  const {
    closeNfcScanModal,
    importFromNfc,
    isNfcSupported,
    isReading,
    nfcScanModalVisible,
    pasteFromClipboard,
    signOrImportScannedContent
  } = usePsbtSignatureImport({
    importSignedDataMatchingPsbt,
    onNotice: showNoticeAsToast,
    signWithMnemonic
  })
  const {
    closeNfcExportModal,
    isEmitting,
    nfcErrorKey,
    nfcExportModalVisible,
    startOrCancelNfcExport
  } = usePsbtNfcExport({
    onNotice: showNoticeAsToast,
    psbtHex: serializedPsbt
  })
  const nfcPulseStyle = useNfcPulseStyle(
    nfcExportModalVisible || nfcScanModalVisible
  )

  const shareInDevicesGroupChat = useNostrShareTransaction(account)

  const {
    closeSeedWordsModal,
    closeWordCountModal,
    confirmWordCount,
    handleMnemonicInvalid,
    handleMnemonicValid,
    seedWordsModalVisible,
    selectedWordCount,
    setSelectedWordCount,
    startSeedWordsSigning,
    submitSeedWords,
    wordCountModalVisible
  } = useSeedWordsSigning({
    onNotice: showNoticeAsToast,
    selectedCosignerIndex,
    setSelectedCosignerIndex,
    signWithMnemonic
  })

  const transactionHex = account
    ? buildPreviewTransactionHex(inputs, outputs, account.network)
    : ''
  const transaction = buildChartTransactionFromBuilder(
    inputs,
    outputs,
    getPsbtTxidOrFallback(txBuilderResult, transactionId)
  )

  function openCameraForCosigner(index: number) {
    setCameraModalVisible(true)
    setSelectedCosignerIndex(index)
  }

  function openCameraForWatchOnlyImport() {
    setCameraModalVisible(true)
  }

  function closeCameraModal() {
    setCameraModalVisible(false)
    setSelectedCosignerIndex(null)
  }

  function handleContentScanned(content: DetectedContent) {
    signOrImportScannedContent(content, selectedCosignerIndex)
  }

  function showQrExportModal() {
    setQrExportModalVisible(true)
  }

  function closeQrExportModal() {
    setQrExportModalVisible(false)
  }

  function openLinkedTransaction(linkedTxId: string) {
    router.push(`/signer/bitcoin/account/${id}/transaction/${linkedTxId}`)
  }

  function handleWatchOnlyPasteFromClipboard() {
    pasteFromClipboard(WATCH_ONLY_COSIGNER_INDEX)
  }

  function handleWatchOnlyNFCScan() {
    importFromNfc(WATCH_ONLY_COSIGNER_INDEX)
  }

  function shareInDevicesGroupChatOrShowError(
    psbtBase64OrSignedTxHex: string | undefined
  ) {
    const { errorKey } = shareInDevicesGroupChat(psbtBase64OrSignedTxHex)
    if (errorKey) {
      toast.error(t(errorKey))
    }
  }

  function handleShareWithNostrGroup() {
    shareInDevicesGroupChatOrShowError(txBuilderResult?.toBase64())
  }

  function handleShareSignaturesWithNostrGroup() {
    const combinedPsbt = combineCollectedSignaturesForSharing()
    if (combinedPsbt) {
      shareInDevicesGroupChatOrShowError(combinedPsbt)
    }
  }

  if (!id || !account) {
    return <Redirect href="/" />
  }

  const propsMultisigSection = {
    account,
    decryptedKeys,
    handleCosignerCameraScan: openCameraForCosigner,
    handleCosignerNFCScan: importFromNfc,
    handleCosignerPasteFromClipboard: pasteFromClipboard,
    handleNFCExport: startOrCancelNfcExport,
    handleSeedWordsScanned: startSeedWordsSigning,
    handleShareSignaturesWithNostrGroup,
    handleSignWithLocalKey: signWithLocalKey,
    isEmitting,
    isReading,
    nfcHardwareSupported: isNfcSupported,
    serializedPsbt,
    showQrExportModal,
    signedPsbts,
    transactionId,
    txBuilderResult,
    validationResults
  }

  const isMultisig = account.policyType === 'multisig'

  function navigateToSignTransaction() {
    router.navigate(`/signer/bitcoin/account/${id}/signAndSend/signTransaction`)
  }

  function handleSign() {
    if (isMultisig && !combineAndFinalizeSignatures()) {
      return
    }
    navigateToSignTransaction()
  }

  function handleCopyUnsignedPsbt() {
    const psbtBase64 = txBuilderResult?.toBase64()
    if (!psbtBase64) {
      return
    }
    Clipboard.setStringAsync(psbtBase64)
    toast(t('common.copiedToClipboard'))
  }

  const propsSignActions = {
    account,
    canShareWithGroup:
      !!account.nostr?.autoSync && !!txBuilderResult?.toBase64(),
    collectedSignatures: getCollectedSignedPsbts(signedPsbts).size,
    isSignDisabled:
      !transactionId ||
      psbtBuildStatus !== 'idle' ||
      (isMultisig && !hasAllRequiredSignatures),
    onShareWithGroup: handleShareWithNostrGroup,
    onSign: handleSign
  }

  const propsWatchOnlyActions = {
    account,
    isEmitting,
    isReading,
    nfcHardwareSupported: isNfcSupported,
    onCheckSignature: navigateToSignTransaction,
    onCopy: handleCopyUnsignedPsbt,
    onNFCExport: startOrCancelNfcExport,
    onNFCScan: handleWatchOnlyNFCScan,
    onPaste: handleWatchOnlyPasteFromClipboard,
    onScanQR: openCameraForWatchOnlyImport,
    onShowQR: showQrExportModal,
    serializedPsbt,
    signedPsbt,
    transactionId
  }

  const propsQrExportModal = {
    onClose: closeQrExportModal,
    psbtBase64: txBuilderResult?.toBase64(),
    visible: qrExportModalVisible
  }

  const propsCameraModal = {
    onClose: closeCameraModal,
    onContentScanned: handleContentScanned,
    title: getCameraModalTitle(decryptedKeys, selectedCosignerIndex),
    visible: cameraModalVisible
  }

  const propsWordCountModal = {
    onCancel: closeWordCountModal,
    onChange: setSelectedWordCount,
    onSelect: confirmWordCount,
    selectedWordCount,
    visible: wordCountModalVisible
  }

  const propsSeedWordsModal = {
    handleMnemonicInvalid,
    handleMnemonicValid,
    handleSeedWordsSubmit: submitSeedWords,
    network,
    onClose: closeSeedWordsModal,
    selectedWordCount,
    visible: seedWordsModalVisible
  }

  const propsIdSection = {
    isDustError,
    isLoadingPSBT,
    psbtBuildErrorMessage: psbtBuildError ? formatMessage(psbtBuildError) : '',
    psbtBuildStatus,
    transactionId
  }

  const propsContents = {
    knownTxIds,
    onOpenLinkedTx: openLinkedTransaction,
    outpointLabelsByRef,
    ownAddresses,
    transaction,
    txLabelsById
  }

  const propsNfcEmitModal = {
    errorKey: nfcErrorKey,
    onClose: closeNfcExportModal,
    pulseStyle: nfcPulseStyle,
    statusLabel: t('transaction.preview.emittingNFC'),
    visible: nfcExportModalVisible
  }

  const propsNfcScanModal = {
    errorKey: null,
    onClose: closeNfcScanModal,
    pulseStyle: nfcPulseStyle,
    statusLabel: t('watchonly.read.scanning'),
    visible: nfcScanModalVisible
  }

  return (
    <SSMainLayout style={styles.mainLayout}>
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack>
            <PayjoinNote
              invoice={payjoinInvoice}
              expiryLabel={payjoinExpiryLabel}
            />
            <TransactionIdSection {...propsIdSection} />
            <TransactionContentsSection {...propsContents} />
            <DecodedTransactionSection transactionHex={transactionHex} />
            <MultisigSignaturesSection {...propsMultisigSection} />
            <SignActions {...propsSignActions} />
            <WatchOnlyActions {...propsWatchOnlyActions} />
          </SSVStack>
        </ScrollView>
      </SSVStack>
      <SSPsbtQRExportModal {...propsQrExportModal} />
      <SSCameraModal context="bitcoin" {...propsCameraModal} />
      <NfcTransferModal {...propsNfcEmitModal} />
      <NfcTransferModal {...propsNfcScanModal} />
      <SSMnemonicWordCountSelectModal {...propsWordCountModal} />
      <SeedWordsSignModal {...propsSeedWordsModal} />
    </SSMainLayout>
  )
}

function getCameraModalTitle(
  decryptedKeys: Key[],
  selectedCosignerIndex: number | null
) {
  if (selectedCosignerIndex === null) {
    return t('camera.scanQRCode')
  }
  return hasStoredMnemonic(decryptedKeys[selectedCosignerIndex])
    ? t('camera.scanQRCode')
    : t('transaction.preview.scanSeedQR')
}

function PayjoinNote({ invoice, expiryLabel }: PayjoinNoteProps) {
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

function TransactionIdSection({
  isDustError,
  isLoadingPSBT,
  psbtBuildErrorMessage,
  psbtBuildStatus,
  transactionId
}: TransactionIdSectionProps) {
  const showBuildError =
    psbtBuildStatus === 'error' && psbtBuildErrorMessage !== ''

  return (
    <SSVStack gap="xxs">
      <SSText color="muted" size="sm" uppercase>
        {t('transaction.id')}
      </SSText>
      <SSTransactionIdFormatted
        size="lg"
        value={formatMessage(
          getTransactionIdDisplay({
            isLoadingPSBT,
            psbtBuildStatus,
            transactionId
          })
        )}
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

function TransactionContentsSection({
  knownTxIds,
  onOpenLinkedTx,
  outpointLabelsByRef,
  ownAddresses,
  transaction,
  txLabelsById
}: TransactionContentsSectionProps) {
  return (
    <SSVStack gap="xxs">
      <SSText color="muted" size="sm" uppercase>
        {tn('contents')}
      </SSText>
      <View style={styles.chartContainer}>
        <SSTransactionChart
          knownTxIds={knownTxIds}
          onOpenLinkedTx={onOpenLinkedTx}
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

function DecodedTransactionSection({
  transactionHex
}: DecodedTransactionSectionProps) {
  return (
    <SSVStack gap="xxs">
      <SSText uppercase size="sm" color="muted">
        {tn('decoded')}
      </SSText>
      {transactionHex !== '' && <SSTransactionDecoded txHex={transactionHex} />}
    </SSVStack>
  )
}

function MultisigSignaturesSection({
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
  handleNFCExport,
  handleCosignerPasteFromClipboard,
  handleCosignerCameraScan,
  handleCosignerNFCScan,
  handleSignWithLocalKey,
  handleSeedWordsScanned,
  handleShareSignaturesWithNostrGroup,
  showQrExportModal
}: MultisigSignaturesSectionProps) {
  if (
    account.policyType !== 'multisig' ||
    !account.keys ||
    account.keys.length === 0 ||
    !txBuilderResult
  ) {
    return null
  }

  return (
    <SSVStack gap="md" style={styles.sectionSpacing}>
      <SSText center color="muted" size="sm" uppercase>
        {t('transaction.preview.multisigSignatureRequired')}
      </SSText>

      <SSText style={styles.keysRequired}>
        {account.keysRequired || 1} {t('common.of')} {account.keyCount || 1}
      </SSText>

      <SSSignatureRequiredDisplay
        requiredNumber={account.keysRequired || 1}
        totalNumber={account.keyCount || 1}
        collectedSignatures={[...getCollectedSignedPsbts(signedPsbts).keys()]}
        validationResults={validationResults}
      />

      <SSVStack gap="none">
        {account.keys?.map((key, index) => (
          <SSSignatureDropdown
            key={key.fingerprint ?? index}
            index={index}
            totalKeys={account.keys?.length || 0}
            keyDetails={key}
            transactionId={transactionId}
            txBuilderResult={txBuilderResult}
            serializedPsbt={serializedPsbt}
            signedPsbt={signedPsbts.get(index) || ''}
            isAvailable={nfcHardwareSupported}
            isEmitting={isEmitting}
            isReading={isReading}
            decryptedKey={decryptedKeys[index]}
            account={account}
            onShowQR={showQrExportModal}
            onShareWithGroup={handleShareSignaturesWithNostrGroup}
            onNFCExport={handleNFCExport}
            onPasteFromClipboard={handleCosignerPasteFromClipboard}
            onCameraScan={handleCosignerCameraScan}
            onNFCScan={handleCosignerNFCScan}
            onSignWithLocalKey={handleSignWithLocalKey}
            onSignWithSeedQR={handleCosignerCameraScan}
            onSignWithSeedWords={handleSeedWordsScanned}
            validationResult={validationResults.get(index)}
          />
        ))}
      </SSVStack>
    </SSVStack>
  )
}

function SignActions({
  account,
  canShareWithGroup,
  collectedSignatures,
  isSignDisabled,
  onShareWithGroup,
  onSign
}: SignActionsProps) {
  if (account.policyType === 'watchonly' || account.keys.length === 0) {
    return null
  }

  const isMultisig = account.policyType === 'multisig'

  return (
    <>
      {isMultisig && (
        <SSText center color="muted" size="sm" style={styles.signaturesCount}>
          {t('transaction.preview.signaturesCollected')}: {collectedSignatures}{' '}
          / {account.keysRequired || account.keys.length}
        </SSText>
      )}
      <SSButton
        variant="secondary"
        disabled={isSignDisabled}
        label={
          isMultisig
            ? t('transaction.preview.checkAllSignatures')
            : t('sign.transaction')
        }
        onPress={onSign}
      />
      {canShareWithGroup && (
        <SSButton
          variant="ghost"
          label={t('account.nostrSync.shareWithGroup')}
          onPress={onShareWithGroup}
        />
      )}
    </>
  )
}

function WatchOnlyActions({
  account,
  isEmitting,
  isReading,
  nfcHardwareSupported,
  serializedPsbt,
  signedPsbt,
  transactionId,
  onCheckSignature,
  onCopy,
  onNFCExport,
  onNFCScan,
  onPaste,
  onScanQR,
  onShowQR
}: WatchOnlyActionsProps) {
  const creationType = account.keys[0]?.creationType
  const isImportedWatchOnly =
    account.policyType === 'watchonly' &&
    (creationType === 'importDescriptor' ||
      creationType === 'importExtendedPub')
  if (!isImportedWatchOnly) {
    return null
  }

  return (
    <>
      <SSText
        center
        color="muted"
        size="sm"
        uppercase
        style={styles.sectionSpacing}
      >
        {t('transaction.preview.exportUnsigned')}
      </SSText>
      <SSHStack gap="xxs" justifyBetween>
        <SSButton
          variant="outline"
          disabled={!transactionId}
          label={t('common.copy')}
          style={styles.halfButton}
          onPress={onCopy}
        />
        <SSButton
          variant="outline"
          disabled={!transactionId}
          label={t('common.showQR')}
          style={styles.halfButton}
          onPress={onShowQR}
        />
      </SSHStack>
      <SSHStack gap="xxs" justifyBetween>
        <SSButton
          label={t('common.usb')}
          style={styles.halfButton}
          variant="outline"
          disabled
        />
        <SSButton
          label={
            isEmitting
              ? t('watchonly.read.scanning')
              : t('transaction.preview.exportNFC')
          }
          style={styles.halfButton}
          variant="outline"
          disabled={!nfcHardwareSupported || !serializedPsbt}
          onPress={onNFCExport}
        />
      </SSHStack>
      <SSText
        center
        color="muted"
        size="sm"
        uppercase
        style={styles.sectionSpacing}
      >
        {isPSBT(signedPsbt)
          ? t('transaction.preview.importedPsbt')
          : t('transaction.preview.importSigned')}
      </SSText>
      <View style={styles.signedPsbtBox}>
        <ScrollView
          style={styles.signedPsbtScroll}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          <SSText style={styles.signedPsbtText}>
            {signedPsbt || t('transaction.preview.signedPsbt')}
          </SSText>
        </ScrollView>
      </View>
      <SSHStack gap="xxs" justifyBetween>
        <SSButton
          label={t('common.paste')}
          style={styles.halfButton}
          variant="outline"
          onPress={onPaste}
        />
        <SSButton
          label={t('common.scanQR')}
          style={styles.halfButton}
          variant="outline"
          onPress={onScanQR}
        />
      </SSHStack>
      <SSHStack gap="xxs" justifyBetween>
        <SSButton
          label={t('common.usb')}
          style={styles.halfButton}
          variant="outline"
          disabled
        />
        <SSButton
          label={
            isReading ? t('watchonly.read.scanning') : t('watchonly.read.nfc')
          }
          style={styles.halfButton}
          variant="outline"
          disabled={!nfcHardwareSupported}
          onPress={onNFCScan}
        />
      </SSHStack>
      <SSButton
        label={t('transaction.preview.checkSignature')}
        style={styles.checkSignatureButton}
        variant="secondary"
        disabled={!signedPsbt}
        onPress={onCheckSignature}
      />
    </>
  )
}

function NfcTransferModal({
  errorKey,
  onClose,
  pulseStyle,
  statusLabel,
  visible
}: NfcTransferModalProps) {
  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack itemsCenter gap="lg">
        <SSText center style={styles.nfcTitle}>
          {errorKey ? t('common.errorTitle') : t('transaction.preview.nfcTip')}
        </SSText>
        {errorKey ? (
          <SSText color="white" center>
            {t(errorKey)}
          </SSText>
        ) : (
          <Animated.View style={pulseStyle}>
            <SSText uppercase>{statusLabel}</SSText>
          </Animated.View>
        )}
      </SSVStack>
    </SSModal>
  )
}

function SeedWordsSignModal({
  visible,
  onClose,
  selectedWordCount,
  network,
  handleMnemonicValid,
  handleMnemonicInvalid,
  handleSeedWordsSubmit
}: SeedWordsSignModalProps) {
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
          actionButtonLabel={t('transaction.preview.signWithSeedWords')}
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

const styles = StyleSheet.create({
  chartContainer: { overflow: 'hidden' },
  checkSignatureButton: { marginTop: 26 },
  halfButton: { width: '48%' },
  keysRequired: {
    alignSelf: 'center',
    fontSize: 55,
    textTransform: 'lowercase'
  },
  mainLayout: { paddingBottom: 20, paddingTop: 0 },
  nfcTitle: { maxWidth: 300 },
  payjoinNote: {
    gap: 4,
    paddingVertical: 4
  },
  payjoinNoteHint: {
    color: Colors.gray[500]
  },
  sectionSpacing: { marginTop: 16 },
  seedWordsModalBody: {
    flex: 1,
    maxWidth: 400,
    position: 'relative',
    width: '100%'
  },
  seedWordsModalContent: { paddingHorizontal: 16 },
  seedWordsModalScroll: { maxHeight: 600, maxWidth: 400, width: '100%' },
  signaturesCount: { marginBottom: 8 },
  signedPsbtBox: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 600,
    minHeight: 200,
    padding: 12
  },
  signedPsbtScroll: { flex: 1 },
  signedPsbtText: {
    color: Colors.white,
    fontFamily: Typography.sfProMono,
    fontSize: 12,
    lineHeight: 18
  },
  statusText: { marginTop: 8 }
})

export default PreviewTransaction
