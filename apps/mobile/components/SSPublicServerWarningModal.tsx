import { StyleSheet } from 'react-native'

import { SSIconWarning } from '@/components/icons'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

import SSButton from './SSButton'
import SSModal from './SSModal'
import SSText from './SSText'

type SSPublicServerWarningModalProps = {
  visible: boolean
  serverName: string
  /** `restore`: the server came from a backup that was just restored. */
  reason?: 'select' | 'restore'
  onConfirm: () => void
  onCancel: () => void
}

const WARNING_ICON_SIZE = 32

function SSPublicServerWarningModal({
  visible,
  serverName,
  reason = 'select',
  onConfirm,
  onCancel
}: SSPublicServerWarningModalProps) {
  const isRestore = reason === 'restore'
  return (
    <SSModal visible={visible} fullOpacity showLabel={false} onClose={onCancel}>
      <SSVStack gap="xl" style={styles.content}>
        <SSVStack gap="md" itemsCenter>
          <SSIconWarning width={WARNING_ICON_SIZE} height={WARNING_ICON_SIZE} />
          <SSText size="md" weight="medium" uppercase center>
            {t('settings.network.server.publicWarning.title')}
          </SSText>
          <SSText center>
            {isRestore
              ? t('settings.network.server.publicWarning.restoreDescription', {
                  name: serverName
                })
              : t('settings.network.server.publicWarning.description', {
                  name: serverName
                })}
          </SSText>
          <SSText color="muted" center size="sm">
            {t('settings.network.server.publicWarning.tradeoffs')}
          </SSText>
        </SSVStack>
        <SSVStack gap="sm">
          <SSButton
            label={t('settings.network.server.publicWarning.useAnyway')}
            variant="secondary"
            onPress={onConfirm}
          />
          <SSButton
            label={
              isRestore
                ? t('settings.network.server.publicWarning.changeServer')
                : t('common.cancel')
            }
            variant="ghost"
            onPress={onCancel}
          />
        </SSVStack>
      </SSVStack>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    width: '100%'
  }
})

export default SSPublicServerWarningModal
