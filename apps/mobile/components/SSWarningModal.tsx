import { Modal, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { t } from '@/locales'
import { Colors, Layout } from '@/styles'

import SSButton from './SSButton'

type SSWarningModalProps = {
  visible: boolean
  onClose(): void
  children: React.ReactNode
}

function SSWarningModal({ visible, onClose, children }: SSWarningModalProps) {
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} transparent={false}>
      <View
        style={[
          styles.safeArea,
          {
            paddingBottom: insets.bottom,
            paddingTop: insets.top
          }
        ]}
      >
        <View style={styles.container}>
          <ScrollView>
            {children}
            <SSButton
              label={t('common.acknowledge')}
              variant="secondary"
              onPress={onClose}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop
  },
  safeArea: {
    backgroundColor: Colors.black,
    flex: 1
  }
})

export default SSWarningModal
