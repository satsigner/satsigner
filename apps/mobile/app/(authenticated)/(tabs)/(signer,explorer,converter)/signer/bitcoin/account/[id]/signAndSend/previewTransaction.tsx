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
import { WATCH_ONLY_INDEX } from '@/constants/account'
import { PSBT_MAGIC_BASE64, PSBT_MAGIC_HEX } from '@/constants/btc'
import { useCosignerSignatures } from '@/hooks/useCosignerSignatures'
import { useDecryptedKeys } from '@/hooks/useDecryptedKeys'
import { useNfcPulse } from '@/hooks/useNfcPulse'
import { useNostrShareTransaction } from '@/hooks/useNostrShareTransaction'
import { usePayjoinInvoice } from '@/hooks/usePayjoinInvoice'
import { usePsbtSignatureImport } from '@/hooks/usePsbtSignatureImport'
import { useSeedSigning } from '@/hooks/useSeedSigning'
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
import { type Notice } from '@/types/ui/notice'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { type DetectedContent } from '@/utils/contentDetector'
import { formatMessage } from '@/utils/notice'
import { formatPayjoinSummary } from '@/utils/payjoinUri'
import {
  combinePsbts,
  getCollectedSignedPsbts,
  getPsbtTxidOrFallback
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

const TRANSACTION_CHART_SCALE = 0.9

type CosignerSignatures = ReturnType<typeof useCosignerSignatures>
type SeedSigning = ReturnType<typeof useSeedSigning>

type NfcModalProps = {
  nfcErrorKey: string | null
  nfcPulseStyle: ReturnType<typeof useNfcPulse>
  onClose: () => void
  visible: boolean
}

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
    finalize,
    hasAllRequiredSignatures,
    importSignedData,
    signWithLocalKey,
    signWithMnemonic,
    signedPsbt,
    signedPsbts,
    updateSignedPsbt,
    validationResults
  } = useCosignerSignatures({
    account,
    decryptedKeys,
    onNotice: showNotice,
    routePsbt: psbt
  })

  const {
    closeNfcExportModal,
    closeNfcScanModal,
    exportToNfc,
    handleScannedContent,
    importFromNfc,
    isEmitting,
    isNfcSupported,
    isReading,
    nfcErrorKey,
    nfcExportModalVisible,
    nfcScanModalVisible,
    pasteFromClipboard
  } = usePsbtSignatureImport({
    importSignedData,
    onNotice: showNotice,
    serializedPsbt,
    signWithMnemonic,
    storeSignedData: updateSignedPsbt
  })
  const nfcPulseStyle = useNfcPulse(
    nfcExportModalVisible || nfcScanModalVisible
  )

  const shareWithNostrGroup = useNostrShareTransaction({ account, id })

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
    combineAndFinalizeMultisigPSBTs: finalize,
    handleNFCExport: exportToNfc,
    handleShareWithNostrGroup,
    handleWatchOnlyNFCScan,
    handleWatchOnlyPasteFromClipboard,
    hasAllRequiredSignatures,
    isEmitting,
    isReading,
    nfcHardwareSupported: isNfcSupported,
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
    onContentScanned: (content: DetectedContent) =>
      handleScannedContent(content, currentCosignerIndex),
    title: getCameraModalTitle(decryptedKeys, currentCosignerIndex),
    visible: cameraModalVisible
  }

  const propsWordCountModal = {
    onClose: closeWordCountModal,
    onContinue: confirmWordCount,
    selectedWordCount,
    setSelectedWordCount,
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
    onOpenLinkedTx: (linkedTxId: string) =>
      router.push(`/signer/bitcoin/account/${id}/transaction/${linkedTxId}`),
    outpointLabelsByRef,
    ownAddresses,
    transaction,
    txLabelsById
  }

  const propsNfcEmitModal = {
    nfcErrorKey,
    nfcPulseStyle,
    onClose: closeNfcExportModal,
    visible: nfcExportModalVisible
  }

  const propsNfcScanModal = {
    nfcErrorKey,
    nfcPulseStyle,
    onClose: closeNfcScanModal,
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
  | 'knownTxIds'
  | 'onOpenLinkedTx'
  | 'outpointLabelsByRef'
  | 'ownAddresses'
  | 'transaction'
  | 'txLabelsById'
>

function PreviewTransactionContents({
  knownTxIds,
  onOpenLinkedTx,
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
  nfcErrorKey,
  nfcPulseStyle,
  onClose,
  visible
}: NfcModalProps) {
  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack itemsCenter gap="lg">
        <SSText center style={styles.nfcTitle}>
          {nfcErrorKey
            ? t('common.errorTitle')
            : t('transaction.preview.nfcTip')}
        </SSText>
        {nfcErrorKey ? (
          <SSVStack itemsCenter gap="md">
            <SSText color="white" center>
              {t(nfcErrorKey)}
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
  nfcErrorKey,
  nfcPulseStyle,
  onClose,
  visible
}: NfcModalProps) {
  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack itemsCenter gap="lg">
        <SSText center style={styles.nfcTitle}>
          {nfcErrorKey
            ? t('common.errorTitle')
            : t('transaction.preview.nfcTip')}
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
  signedPsbts: CosignerSignatures['signedPsbts']
  validationResults: Map<number, boolean>
  decryptedKeys: Key[]
  nfcHardwareSupported: boolean
  isEmitting: boolean
  isReading: boolean
  updateSignedPsbt: CosignerSignatures['updateSignedPsbt']
  handleNFCExport: () => void
  handleCosignerPasteFromClipboard: (index: number) => void
  handleCosignerCameraScan: (index: number) => void
  handleCosignerNFCScan: (index: number) => void
  handleSignWithLocalKey: CosignerSignatures['signWithLocalKey']
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
            txBuilderResult={txBuilderResult}
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
            onSignWithSeedQR={() => handleCosignerCameraScan(index)}
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
  signedPsbts: CosignerSignatures['signedPsbts']
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
  handleSeedWordsSubmit: SeedSigning['submitSeedWords']
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
