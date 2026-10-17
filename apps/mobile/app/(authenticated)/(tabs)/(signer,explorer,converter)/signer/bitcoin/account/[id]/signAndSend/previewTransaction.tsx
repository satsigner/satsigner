import * as Clipboard from 'expo-clipboard'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSPreviewMultisigSection from '@/components/previewTransaction/SSPreviewMultisigSection'
import SSPreviewNfcModal from '@/components/previewTransaction/SSPreviewNfcModal'
import SSPreviewPayjoinNote from '@/components/previewTransaction/SSPreviewPayjoinNote'
import SSPreviewSeedWordsModal from '@/components/previewTransaction/SSPreviewSeedWordsModal'
import SSPreviewSignActions from '@/components/previewTransaction/SSPreviewSignActions'
import SSPreviewTransactionContents from '@/components/previewTransaction/SSPreviewTransactionContents'
import SSPreviewTransactionDecoded from '@/components/previewTransaction/SSPreviewTransactionDecoded'
import SSPreviewTransactionId from '@/components/previewTransaction/SSPreviewTransactionId'
import SSPreviewWatchOnlyActions from '@/components/previewTransaction/SSPreviewWatchOnlyActions'
import SSCameraModal from '@/components/SSCameraModal'
import SSMnemonicWordCountSelectModal from '@/components/SSMnemonicWordCountSelectModal'
import SSPsbtQRExportModal from '@/components/SSPsbtQRExportModal'
import { WATCH_ONLY_INDEX } from '@/constants/account'
import { useCosignerSignatures } from '@/hooks/useCosignerSignatures'
import { useDecryptedKeys } from '@/hooks/useDecryptedKeys'
import { useNfcPulse } from '@/hooks/useNfcPulse'
import { useNostrShareTransaction } from '@/hooks/useNostrShareTransaction'
import { usePayjoinInvoice } from '@/hooks/usePayjoinInvoice'
import { usePsbtNfcExport } from '@/hooks/usePsbtNfcExport'
import { usePsbtSignatureImport } from '@/hooks/usePsbtSignatureImport'
import { useSeedSigning } from '@/hooks/useSeedSigning'
import { useTransactionPsbt } from '@/hooks/useTransactionPsbt'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Key } from '@/types/models/Account'
import { type PreviewTransactionSearchParams } from '@/types/navigation/searchParams'
import { type Notice } from '@/types/ui/notice'
import { hasStoredMnemonic } from '@/utils/account'
import { type DetectedContent } from '@/utils/contentDetector'
import { formatMessage } from '@/utils/notice'
import { getCollectedSignedPsbts, getPsbtTxidOrFallback } from '@/utils/psbt'
import {
  buildKnownTxIds,
  buildOutpointLabelsByRef,
  buildTxLabelsById
} from '@/utils/sankeyInputLabel'
import {
  buildChartTransactionFromBuilder,
  buildPreviewTransactionHex
} from '@/utils/transaction'

// Shows a message reported by one of the preview hooks.
function showNotice(notice: Notice) {
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
  const [noKeyModalVisible, setNoKeyModalVisible] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [currentCosignerIndex, setCurrentCosignerIndex] = useState<
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
    onNotice: showNotice,
    routePsbt: psbt
  })

  const {
    combineCollectedSignatures,
    finalize,
    hasAllRequiredSignatures,
    importSignedData,
    signWithLocalKey,
    signWithMnemonic,
    signedPsbt,
    signedPsbts,
    validationResults
  } = useCosignerSignatures({
    account,
    decryptedKeys,
    onNotice: showNotice,
    routePsbt: psbt
  })

  const {
    closeNfcScanModal,
    handleScannedContent,
    importFromNfc,
    isNfcSupported,
    isReading,
    nfcScanModalVisible,
    pasteFromClipboard
  } = usePsbtSignatureImport({
    importSignedData,
    onNotice: showNotice,
    signWithMnemonic
  })
  const {
    closeNfcExportModal,
    exportToNfc,
    isEmitting,
    nfcErrorKey,
    nfcExportModalVisible
  } = usePsbtNfcExport({ onNotice: showNotice, serializedPsbt })
  const nfcPulseStyle = useNfcPulse(
    nfcExportModalVisible || nfcScanModalVisible
  )

  const shareWithNostrGroup = useNostrShareTransaction(account)

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
  } = useSeedSigning({
    cosignerIndex: currentCosignerIndex,
    onNotice: showNotice,
    setCosignerIndex: setCurrentCosignerIndex,
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

  // Opens the camera to scan a signed PSBT or a SeedQR for the cosigner.
  function handleCosignerCameraScan(index: number) {
    setCameraModalVisible(true)
    setCurrentCosignerIndex(index)
  }

  function handleWatchOnlyCameraScan() {
    setCameraModalVisible(true)
  }

  function closeCameraModal() {
    setCameraModalVisible(false)
    setCurrentCosignerIndex(null)
  }

  function handleContentScanned(content: DetectedContent) {
    handleScannedContent(content, currentCosignerIndex)
  }

  function showQrExportModal() {
    setNoKeyModalVisible(true)
  }

  function closeQrExportModal() {
    setNoKeyModalVisible(false)
  }

  function openLinkedTransaction(linkedTxId: string) {
    router.push(`/signer/bitcoin/account/${id}/transaction/${linkedTxId}`)
  }

  function handleWatchOnlyPasteFromClipboard() {
    pasteFromClipboard(WATCH_ONLY_INDEX)
  }

  function handleWatchOnlyNFCScan() {
    importFromNfc(WATCH_ONLY_INDEX)
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

  function handleShareSignaturesWithNostrGroup() {
    const combinedPsbt = combineCollectedSignatures()
    if (combinedPsbt) {
      shareOrShowError(combinedPsbt)
    }
  }

  if (!id || !account) {
    return <Redirect href="/" />
  }

  const propsMultisigSection = {
    account,
    decryptedKeys,
    handleCosignerCameraScan,
    handleCosignerNFCScan: importFromNfc,
    handleCosignerPasteFromClipboard: pasteFromClipboard,
    handleNFCExport: exportToNfc,
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

  // Multisig needs every collected signature combined and finalized first.
  function handleSign() {
    if (isMultisig && !finalize()) {
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
    onNFCExport: exportToNfc,
    onNFCScan: handleWatchOnlyNFCScan,
    onPaste: handleWatchOnlyPasteFromClipboard,
    onScanQR: handleWatchOnlyCameraScan,
    onShowQR: showQrExportModal,
    serializedPsbt,
    signedPsbt,
    transactionId
  }

  const propsQrExportModal = {
    onClose: closeQrExportModal,
    psbtBase64: txBuilderResult?.toBase64(),
    visible: noKeyModalVisible
  }

  const propsCameraModal = {
    onClose: closeCameraModal,
    onContentScanned: handleContentScanned,
    title: getCameraModalTitle(decryptedKeys, currentCosignerIndex),
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
            <SSPreviewPayjoinNote
              invoice={payjoinInvoice}
              expiryLabel={payjoinExpiryLabel}
            />
            <SSPreviewTransactionId {...propsIdSection} />
            <SSPreviewTransactionContents {...propsContents} />
            <SSPreviewTransactionDecoded transactionHex={transactionHex} />
            <SSPreviewMultisigSection {...propsMultisigSection} />
            <SSPreviewSignActions {...propsSignActions} />
            <SSPreviewWatchOnlyActions {...propsWatchOnlyActions} />
          </SSVStack>
        </ScrollView>
      </SSVStack>
      <SSPsbtQRExportModal {...propsQrExportModal} />
      <SSCameraModal context="bitcoin" {...propsCameraModal} />
      <SSPreviewNfcModal {...propsNfcEmitModal} />
      <SSPreviewNfcModal {...propsNfcScanModal} />
      <SSMnemonicWordCountSelectModal {...propsWordCountModal} />
      <SSPreviewSeedWordsModal {...propsSeedWordsModal} />
    </SSMainLayout>
  )
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
  return hasStoredMnemonic(decryptedKeys[currentCosignerIndex])
    ? t('camera.scanQRCode')
    : t('transaction.preview.scanSeedQR')
}

const styles = StyleSheet.create({
  mainLayout: { paddingBottom: 20, paddingTop: 0 }
})

export default PreviewTransaction
