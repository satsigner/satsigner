import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

import SSButton from './SSButton'
import SSModal from './SSModal'
import SSText from './SSText'

type SSSyncDetailsModalProps = {
  visible: boolean
  isSyncing: boolean
  lastSyncedLabel: string
  onCheckAll: () => void
  onDeepRescan: () => void
  onClose: () => void
}

function SSSyncDetailsModal({
  visible,
  isSyncing,
  lastSyncedLabel,
  onCheckAll,
  onDeepRescan,
  onClose
}: SSSyncDetailsModalProps) {
  return (
    <SSModal
      visible={visible}
      title={t('account.sync.details.title')}
      label={t('common.close')}
      onClose={onClose}
    >
      <SSVStack gap="md" widthFull>
        <SSText color="muted">{t('account.sync.details.explanation')}</SSText>
        <SSText color="muted" size="xs">
          {t('account.sync.details.quickCheckPending')}
        </SSText>
        <SSHStack justifyBetween>
          <SSText size="xs" color="muted">
            {t('account.sync.details.lastSynced')}
          </SSText>
          <SSText size="xs">{lastSyncedLabel}</SSText>
        </SSHStack>
        <SSButton
          label={t('account.sync.details.checkAll')}
          variant="secondary"
          disabled={isSyncing}
          onPress={onCheckAll}
        />
        <SSVStack gap="xs">
          <SSButton
            label={t('account.sync.details.deepRescan')}
            variant="outline"
            disabled={isSyncing}
            onPress={onDeepRescan}
          />
          <SSText size="xs" color="muted" center>
            {t('account.sync.details.deepRescanWarning')}
          </SSText>
        </SSVStack>
      </SSVStack>
    </SSModal>
  )
}

export default SSSyncDetailsModal
