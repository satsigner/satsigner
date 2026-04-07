import * as StatusBar from 'expo-status-bar'
import { useEffect } from 'react'
import { Modal, Platform, ScrollView, StyleSheet, View } from 'react-native'
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

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return
    }
    if (!visible) {
      return StatusBar.setStatusBarBackgroundColor('transparent', false)
    }

    StatusBar.setStatusBarStyle('light')
    StatusBar.setStatusBarBackgroundColor('black', false)
  }, [visible])

  return (
    <Modal visible={visible} transparent={false}>
      <View
        style={[
          styles.safeArea,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom
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
