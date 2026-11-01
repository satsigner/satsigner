import { StyleSheet } from 'react-native'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

import SSButton from './SSButton'
import SSModal from './SSModal'
import SSText from './SSText'

type SSNostrKind0FetchWarningModalProps = {
  visible: boolean
  onFetch: () => void
  onFetchAlways: () => void
  onSaveWithoutFetching: () => void
}

function SSNostrKind0FetchWarningModal({
  visible,
  onFetch,
  onFetchAlways,
  onSaveWithoutFetching
}: SSNostrKind0FetchWarningModalProps) {
  return (
    <SSModal
      visible={visible}
      fullOpacity
      showLabel={false}
      onClose={onSaveWithoutFetching}
    >
      <SSVStack gap="xl" style={styles.content}>
        <SSVStack gap="sm" itemsCenter>
          <SSText size="md" weight="medium" uppercase center>
            {t('nostrIdentity.kind0FetchWarning.title')}
          </SSText>
          <SSText color="muted" center>
            {t('nostrIdentity.kind0FetchWarning.description')}
          </SSText>
        </SSVStack>
        <SSVStack gap="sm">
          <SSButton
            label={t('nostrIdentity.kind0FetchWarning.fetch')}
            variant="secondary"
            onPress={onFetch}
          />
          <SSButton
            label={t('nostrIdentity.kind0FetchWarning.fetchAlways')}
            variant="outline"
            onPress={onFetchAlways}
          />
          <SSButton
            label={t('nostrIdentity.kind0FetchWarning.saveWithoutFetching')}
            variant="ghost"
            onPress={onSaveWithoutFetching}
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

export default SSNostrKind0FetchWarningModal
