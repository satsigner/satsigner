import * as StatusBar from 'expo-status-bar'
import { useEffect } from 'react'
import { Modal, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import SSMainLayout from '@/layouts/SSMainLayout'
import { t } from '@/locales'
import { Colors } from '@/styles'

import SSButton from './SSButton'

type SSWarningModalProps = {
  visible: boolean
  onClose(): void
  children: React.ReactNode
}

function SSWarningModal({ visible, onClose, children }: SSWarningModalProps) {
  useEffect(() => {
    if (Platform.OS !== 'android') return
    if (!visible)
      return StatusBar.setStatusBarBackgroundColor('transparent', false)

    StatusBar.setStatusBarStyle('light')
    StatusBar.setStatusBarBackgroundColor('black', false)
  }, [visible])

  return (
    <Modal visible={visible} transparent={false}>
      <SafeAreaView style={{ backgroundColor: Colors.black, flex: 1 }}>
        <SSMainLayout black>
          <ScrollView>
            {children}
            <SSButton
              label={t('common.acknowledge')}
              variant="secondary"
              onPress={onClose}
            />
          </ScrollView>
        </SSMainLayout>
      </SafeAreaView>
    </Modal>
  )
}

export default SSWarningModal
