import * as StatusBar from 'expo-status-bar'
import { useEffect } from 'react'
import { Modal, Platform, ScrollView, SafeAreaView } from 'react-native'

import SSMainLayout from '@/layouts/SSMainLayout'
import { i18n } from '@/locales'

import SSButton from './SSButton'
import { Colors } from '@/styles'

type SSWarningModalProps = {
  visible: boolean
  onClose(): void
  children: React.ReactNode
}

export default function SSWarningModal({
  visible,
  onClose,
  children
}: SSWarningModalProps) {
  useEffect(() => {
    if (Platform.OS !== 'android') return
    if (!visible)
      return StatusBar.setStatusBarBackgroundColor('transparent', false)

    StatusBar.setStatusBarStyle('light')
    StatusBar.setStatusBarBackgroundColor('black', false)
  }, [visible])

  return (
    <Modal visible={visible} transparent={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.black }}>
        <SSMainLayout black>
          <ScrollView>{children}</ScrollView>
          <SSButton
            label={i18n.t('common.acknowledge')}
            variant="secondary"
            onPress={() => onClose()}
          />
        </SSMainLayout>
      </SafeAreaView>
    </Modal>
  )
}
