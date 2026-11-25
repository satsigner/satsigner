import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

import SSButton from './SSButton'
import SSModal from './SSModal'
import SSText from './SSText'

type SSSyncDetailsModalProps = {
  visible: boolean
  isSyncing: boolean
  lastSyncedLabel: string
  lastFullCheckLabel: string
  onCheckAll: () => void
  onDeepRescan: () => void
  onClose: () => void
}

function SSSyncDetailsModal({
  visible,
  isSyncing,
  lastSyncedLabel,
  lastFullCheckLabel,
  onCheckAll,
  onDeepRescan,
  onClose
}: SSSyncDetailsModalProps) {
  return (
    <SSModal
      visible={visible}
      fullOpacity
      title={t('account.sync.details.title')}
      label={t('common.close')}
      onClose={onClose}
    >
      <SSVStack gap="md" widthFull>
        <SSText color="muted">{t('account.sync.details.explanation')}</SSText>
        <SSText color="muted" size="xs">
          {t('account.sync.details.reuseNote')}
        </SSText>
        <SSVStack gap="xxs">
          <SSText size="xs">{lastSyncedLabel}</SSText>
          <SSText size="xs" color="muted">
            {lastFullCheckLabel}
          </SSText>
        </SSVStack>
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
