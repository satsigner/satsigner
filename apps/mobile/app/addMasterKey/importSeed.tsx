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
        <SSText style={{ alignSelf: 'center' }}>
          {i18n.t('addMasterKey.accountOptions.mnemonic')}
        </SSText>
        {accountStore.currentAccount.seedWordCount && (
          <SSSeedLayout count={accountStore.currentAccount.seedWordCount}>
            {[...Array(accountStore.currentAccount.seedWordCount)].map(
              (_, index) => (
                <SSWordInput key={index} position={index + 1} />
              )
            )}
          </SSSeedLayout>
        )}
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
