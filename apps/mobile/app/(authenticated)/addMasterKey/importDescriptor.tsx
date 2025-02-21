import * as Clipboard from 'expo-clipboard'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

function ImportDescriptor() {
  const [localDescriptor, setLocalDescriptor] = useState<string>('')

  async function handleOnPressPaste() {
    const text = await Clipboard.getStringAsync()
    setLocalDescriptor(text)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.import.descriptor')}</SSText>
          )
        }}
      />
      <ScrollView>
        <SSVStack justifyBetween>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label="Descriptor" />
              <SSTextInput
                align="left"
                style={{
                  height: 300,
                  verticalAlign: 'top',
                  paddingVertical: 16
                }}
                multiline
                numberOfLines={10}
                value={localDescriptor}
                onChangeText={setLocalDescriptor}
              />
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSButton label={t('common.paste')} onPress={handleOnPressPaste} />
          <SSButton label={t('camera.scanQRCode')} onPress={() => {}} />
          <SSButton
            variant="outline"
            label={t('account.import.fromOtherWallet')}
            onPress={() => {}}
          />
          <SSButton
            label={t('common.confirm')}
            variant="secondary"
            onPress={() => {}}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => {}}
          />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

export default ImportDescriptor
