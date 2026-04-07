import { Modal, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Toaster } from 'sonner-native'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Layout } from '@/styles'

import SSButton, { type SSButtonProps } from './SSButton'

type SSModalProps = {
  visible: boolean
  fullOpacity?: boolean
  closeButtonVariant?: SSButtonProps['variant']
  label?: string
  onClose(): void
  children: React.ReactNode
}

function SSModal({
  visible,
  fullOpacity = false,
  closeButtonVariant = 'ghost',
  label = t('common.cancel'),
  onClose,
  children
}: SSModalProps) {
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={[
          styles.safeArea,
          fullOpacity ? styles.containerFullOpacity : styles.containerBase,
          { paddingBottom: insets.bottom, paddingTop: insets.top }
        ]}
      >
        <View style={styles.container}>
          <SSVStack justifyBetween itemsCenter style={styles.innerContainer}>
            {children}
            {label && (
              <SSButton
                label={label}
                variant={closeButtonVariant}
                onPress={onClose}
              />
            )}
          </SSVStack>
          <Toaster
            theme="dark"
            position="top-center"
            style={{
              backgroundColor: Colors.gray[950],
              borderColor: Colors.gray[800],
              borderRadius: 8,
              borderWidth: 1,
              width: '105%',
              zIndex: 10001
            }}
          />
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
  containerBase: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 1000
  },
  containerFullOpacity: {
    backgroundColor: 'rgba(0, 0, 0, 1)',
    zIndex: 1000
  },
  innerContainer: {
    paddingVertical: 16
  },
  safeArea: {
    flex: 1
  }
})

export default SSModal
