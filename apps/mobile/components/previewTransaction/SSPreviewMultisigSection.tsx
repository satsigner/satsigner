import { StyleSheet } from 'react-native'
import { type PsbtLike } from 'react-native-bdk-sdk'

import SSSignatureDropdown from '@/components/SSSignatureDropdown'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import { type useCosignerSignatures } from '@/hooks/useCosignerSignatures'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type Account, type Key } from '@/types/models/Account'
import { getCollectedSignedPsbts } from '@/utils/psbt'

type CosignerSignatures = ReturnType<typeof useCosignerSignatures>

type SSPreviewMultisigSectionProps = {
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

function SSPreviewMultisigSection({
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
}: SSPreviewMultisigSectionProps) {
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

const styles = StyleSheet.create({
  keysRequired: {
    alignSelf: 'center',
    fontSize: 55,
    textTransform: 'lowercase'
  },
  sectionSpacing: { marginTop: 16 }
})

export default SSPreviewMultisigSection
