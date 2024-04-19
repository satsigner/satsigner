import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSWordInput from '@/components/SSWordInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'

export default function ImportSeed() {
  const router = useRouter()
  const accountStore = useAccountStore()

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{accountStore.currentAccount.name}</SSText>
          )
        }}
      />
      <ScrollView>
        <SSSeedLayout count={24}>
          <SSWordInput position={1} />
          <SSWordInput position={2} />
          <SSWordInput position={3} />
          <SSWordInput position={4} />

          <SSWordInput position={5} />
          <SSWordInput position={6} />
          <SSWordInput position={7} />
          <SSWordInput position={8} />

          <SSWordInput position={9} />
          <SSWordInput position={10} />
          <SSWordInput position={11} />
          <SSWordInput position={12} />

          <SSWordInput position={13} />
          <SSWordInput position={14} />
          <SSWordInput position={15} />
          <SSWordInput position={16} />

          <SSWordInput position={17} />
          <SSWordInput position={18} />
          <SSWordInput position={19} />
          <SSWordInput position={20} />

          <SSWordInput position={21} />
          <SSWordInput position={22} />
          <SSWordInput position={23} />
          <SSWordInput position={24} />
        </SSSeedLayout>
        <SSFormLayout>
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label={`${i18n.t('bitcoin.passphrase')} (${i18n.t('common.optional')})`}
            />
            <SSTextInput />
          </SSFormLayout.Item>
        </SSFormLayout>
        <SSVStack>
          <SSButton
            label={i18n.t('addMasterKey.importExistingSeed.action')}
            variant="secondary"
            onPress={() => {}}
          />
          <SSButton
            label={i18n.t('common.cancel')}
            variant="ghost"
            onPress={() => router.replace('/accountList/')}
          />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
