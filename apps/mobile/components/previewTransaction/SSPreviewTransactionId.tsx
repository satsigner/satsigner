import { StyleSheet } from 'react-native'

import SSDustWarningBanner from '@/components/SSDustWarningBanner'
import SSText from '@/components/SSText'
import SSTransactionIdFormatted from '@/components/SSTransactionIdFormatted'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type PsbtBuildStatus } from '@/types/models/Psbt'
import { formatMessage } from '@/utils/notice'
import { getTransactionIdDisplay } from '@/utils/transaction'

type SSPreviewTransactionIdProps = {
  isDustError: boolean
  isLoadingPSBT: boolean
  psbtBuildErrorMessage: string
  psbtBuildStatus: PsbtBuildStatus
  transactionId: string
}

function SSPreviewTransactionId({
  isDustError,
  isLoadingPSBT,
  psbtBuildErrorMessage,
  psbtBuildStatus,
  transactionId
}: SSPreviewTransactionIdProps) {
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

const styles = StyleSheet.create({
  statusText: { marginTop: 8 }
})

export default SSPreviewTransactionId
