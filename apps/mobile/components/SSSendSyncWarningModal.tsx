import { StyleSheet, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { warning } from '@/styles/colors'

import SSButton from './SSButton'
import SSModal from './SSModal'
import SSText from './SSText'

type SSSendSyncWarningModalProps = {
  visible: boolean
  lastSyncedLabel: string
  isChecking: boolean
  /** A quick check is possible; otherwise checking means a full sync. */
  isQuickCheck: boolean
  progressLabel?: string
  onCheck: () => void
  onContinue: () => void
  onCancel: () => void
}

type RiskRowProps = {
  title: string
  description: string
}

function RiskRow({ title, description }: RiskRowProps) {
  return (
    <SSHStack gap="sm" style={styles.riskRow}>
      <View style={styles.bullet} />
      <SSVStack gap="xxs" style={styles.riskText}>
        <SSText weight="medium">{title}</SSText>
        <SSText color="muted" size="sm">
          {description}
        </SSText>
      </SSVStack>
    </SSHStack>
  )
}

function SSSendSyncWarningModal({
  visible,
  lastSyncedLabel,
  isChecking,
  isQuickCheck,
  progressLabel,
  onCheck,
  onContinue,
  onCancel
}: SSSendSyncWarningModalProps) {
  return (
    <SSModal
      fullOpacity
      visible={visible}
      label=""
      title={t('transaction.syncWarning.title')}
      onClose={onCancel}
    >
      <SSVStack gap="lg" widthFull>
        <SSText center color="muted">
          {lastSyncedLabel}
        </SSText>
        <SSVStack gap="md">
          <RiskRow
            title={t('transaction.syncWarning.spentTitle')}
            description={t('transaction.syncWarning.spentDescription')}
          />
          <RiskRow
            title={t('transaction.syncWarning.privacyTitle')}
            description={t('transaction.syncWarning.privacyDescription')}
          />
        </SSVStack>
        <SSVStack gap="sm">
          <SSButton
            variant="gradient"
            label={t('transaction.syncWarning.check')}
            loading={isChecking}
            disabled={isChecking}
            onPress={onCheck}
          />
          <SSText center color="muted" size="xs">
            {isChecking && progressLabel
              ? progressLabel
              : t(
                  isQuickCheck
                    ? 'transaction.syncWarning.checkHint'
                    : 'transaction.syncWarning.fullCheckHint'
                )}
          </SSText>
          <SSButton
            variant="outline"
            label={t('transaction.syncWarning.continue')}
            onPress={onContinue}
          />
          <SSButton
            variant="ghost"
            label={t('common.cancel')}
            onPress={onCancel}
          />
        </SSVStack>
      </SSVStack>
    </SSModal>
  )
}

const BULLET_SIZE = 6

const styles = StyleSheet.create({
  bullet: {
    backgroundColor: warning,
    borderRadius: BULLET_SIZE / 2,
    height: BULLET_SIZE,
    marginTop: 8,
    width: BULLET_SIZE
  },
  riskRow: {
    alignItems: 'flex-start'
  },
  riskText: {
    flex: 1
  }
})

export default SSSendSyncWarningModal
