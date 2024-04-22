import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSChecksumStatus from '@/components/SSChecksumStatus'
import SSFingerprint from '@/components/SSFingerprint'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSWordInput from '@/components/SSWordInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
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
        <SSFormLayout>
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label={i18n.t('addMasterKey.accountOptions.mnemonic')}
            />
            {accountStore.currentAccount.seedWordCount && (
              <SSSeedLayout count={accountStore.currentAccount.seedWordCount}>
                {[...Array(accountStore.currentAccount.seedWordCount)].map(
                  (_, index) => (
                    <SSWordInput key={index} position={index + 1} />
                  )
                )}
              </SSSeedLayout>
            )}
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label={`${i18n.t('bitcoin.passphrase')} (${i18n.t('common.optional')})`}
            />
            <SSTextInput />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSHStack justifyBetween>
              <SSChecksumStatus valid />
              <SSFingerprint value="1ca1f438" />
            </SSHStack>
          </SSFormLayout.Item>
        </SSFormLayout>
        <SSVStack justifyEnd>
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
