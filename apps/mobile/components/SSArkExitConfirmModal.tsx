import { StyleSheet, View } from 'react-native'

import SSIconWarning from '@/components/icons/SSIconWarning'
import SSButton from '@/components/SSButton'
import SSDetailRow from '@/components/SSDetailRow'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type ArkEmergencyExitFee } from '@/types/models/Ark'
import { type ArkExitFunding } from '@/utils/arkExit'
import { formatMaskedNumber } from '@/utils/format'

const WARNING_ICON_SIZE = 20

type SSArkExitConfirmModalProps = {
  visible: boolean
  title: string
  estimate: ArkEmergencyExitFee | undefined
  // Missing until the on-chain wallet that pays the exit fees has been read.
  funding: ArkExitFunding | undefined
  estimateLoading: boolean
  estimateFailed: boolean
  nearExpiryCount: number | undefined
  expiryCheckLoading: boolean
  privacyMode: boolean
  confirming: boolean
  onConfirm: () => void
  onClose: () => void
  onRetryEstimate: () => void
  onRetryExpiryCheck: () => void
}

function SSArkExitConfirmModal({
  visible,
  title,
  estimate,
  funding,
  estimateLoading,
  estimateFailed,
  nearExpiryCount,
  expiryCheckLoading,
  privacyMode,
  confirming,
  onConfirm,
  onClose,
  onRetryEstimate,
  onRetryExpiryCheck
}: SSArkExitConfirmModalProps) {
  const unit = t('bitcoin.sats')
  const expiryCheckFailed = nearExpiryCount === undefined && !expiryCheckLoading

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
        {nearExpiryCount !== undefined && nearExpiryCount > 0 && (
          <View style={styles.notice}>
            <SSText size="sm" style={styles.warningText}>
              {t('ark.exit.nearExpiryWarning', { count: nearExpiryCount })}
            </SSText>
          </View>
        )}
        {expiryCheckFailed && (
          <SSText
            size="sm"
            center
            style={styles.warningText}
            onPress={onRetryExpiryCheck}
          >
            {t('ark.exit.expiryUnavailable')}
          </SSText>
        )}
        {(estimateLoading || expiryCheckLoading) && (
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
              {funding && (
                <SSDetailRow
                  label={t('ark.exit.fee.onchainWallet')}
                  value={satsLabel(funding.onchainConfirmedSats)}
                />
              )}
              {funding && funding.onchainPendingSats > 0 && (
                <SSDetailRow
                  label={t('ark.exit.fee.onchainIncoming')}
                  value={satsLabel(funding.onchainPendingSats)}
                />
              )}
            </View>
            <SSText color="muted" size="xs">
              {t('ark.exit.feeHint')}
            </SSText>
          </SSVStack>
        )}
        {funding && funding.shortfallSats > 0 && (
          <View style={styles.notice}>
            <SSText size="sm" style={styles.warningText}>
              {t('ark.exit.fundingShortfall', {
                amount: satsLabel(funding.shortfallSats)
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
          disabled={confirming || estimateLoading || expiryCheckLoading}
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
