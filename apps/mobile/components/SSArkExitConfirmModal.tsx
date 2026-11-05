import { StyleSheet, View } from 'react-native'

import SSIconWarning from '@/components/icons/SSIconWarning'
import SSButton from '@/components/SSButton'
import SSDetailRow from '@/components/SSDetailRow'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import { type ArkExitFeeEstimate } from '@/hooks/useArkExitFeeEstimate'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { formatMaskedNumber } from '@/utils/format'

const WARNING_ICON_SIZE = 20

type SSArkExitConfirmModalProps = {
  visible: boolean
  title: string
  estimate: ArkExitFeeEstimate | undefined
  estimateLoading: boolean
  estimateFailed: boolean
  nearExpiryCount: number
  privacyMode: boolean
  confirming: boolean
  onConfirm: () => void
  onClose: () => void
  onRetryEstimate: () => void
}

function SSArkExitConfirmModal({
  visible,
  title,
  estimate,
  estimateLoading,
  estimateFailed,
  nearExpiryCount,
  privacyMode,
  confirming,
  onConfirm,
  onClose,
  onRetryEstimate
}: SSArkExitConfirmModalProps) {
  const unit = t('bitcoin.sats')

  function satsLabel(amountSats: number) {
    return `${formatMaskedNumber(amountSats, privacyMode)} ${unit}`
  }

  return (
    <SSModal
      visible={visible}
      onClose={onClose}
      label={t('common.cancel')}
      closeButtonVariant="ghost"
      fullOpacity
    >
      <SSVStack gap="lg" style={styles.content}>
        <SSVStack gap="sm" itemsCenter>
          <SSIconWarning
            height={WARNING_ICON_SIZE}
            width={WARNING_ICON_SIZE}
            fill="transparent"
            stroke={Colors.error}
          />
          <SSText center uppercase size="md" weight="medium">
            {title}
          </SSText>
          <SSText center color="muted">
            {t('ark.exit.confirmDescription')}
          </SSText>
        </SSVStack>
        {nearExpiryCount > 0 && (
          <View style={styles.notice}>
            <SSText size="sm" style={styles.warningText}>
              {t('ark.exit.nearExpiryWarning', { count: nearExpiryCount })}
            </SSText>
          </View>
        )}
        {estimateLoading && (
          <SSText color="muted" size="sm" center>
            {t('common.loading')}
          </SSText>
        )}
        {estimate && (
          <SSVStack gap="xs">
            <View>
              <SSDetailRow
                label={t('ark.exit.fee.exitTransactions')}
                value={satsLabel(estimate.exitBroadcastFeeSats)}
              />
              <SSDetailRow
                label={t('ark.exit.fee.claim')}
                value={satsLabel(estimate.claimFeeSats)}
              />
              <SSDetailRow
                label={t('ark.exit.fee.total')}
                value={t('ark.exit.fee.totalValue', {
                  amount: satsLabel(estimate.totalFeeSats),
                  feeRate: estimate.feeRateSatPerVb
                })}
              />
              <SSDetailRow
                label={t('ark.exit.fee.onchainWallet')}
                value={satsLabel(estimate.onchainConfirmedSats)}
              />
              {estimate.onchainPendingSats > 0 && (
                <SSDetailRow
                  label={t('ark.exit.fee.onchainIncoming')}
                  value={satsLabel(estimate.onchainPendingSats)}
                />
              )}
            </View>
            <SSText color="muted" size="xs">
              {t('ark.exit.feeHint')}
            </SSText>
          </SSVStack>
        )}
        {estimate && estimate.shortfallSats > 0 && (
          <View style={styles.notice}>
            <SSText size="sm" style={styles.warningText}>
              {t('ark.exit.fundingShortfall', {
                amount: satsLabel(estimate.shortfallSats)
              })}
            </SSText>
          </View>
        )}
        {estimateFailed && (
          <SSText
            size="sm"
            center
            style={styles.warningText}
            onPress={onRetryEstimate}
          >
            {t('ark.exit.feeUnavailable')}
          </SSText>
        )}
        <SSButton
          label={t('ark.exit.confirm')}
          variant="danger"
          loading={confirming}
          disabled={confirming || estimateLoading}
          onPress={onConfirm}
        />
      </SSVStack>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 8,
    width: '100%'
  },
  notice: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  warningText: {
    color: Colors.warning
  }
})

export default SSArkExitConfirmModal
