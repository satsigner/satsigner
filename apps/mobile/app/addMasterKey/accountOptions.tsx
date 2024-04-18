import { Stack, useRouter } from 'expo-router'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import SSFormLayout from '@/layouts/SSFormLayout'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'

export default function AccountOptions() {
  const router = useRouter()
  const accountStore = useAccountStore()

  function getContinueButtonLabel() {
    const accountCreationType = accountStore.currentAccount.accountCreationType

    if (accountCreationType === 'generate')
      return i18n.t('addMasterKey.generateNewSeed.action')
    else if (accountCreationType === 'import')
      return i18n.t('addMasterKey.importExistingSeed.action')

    return ''
  }

  function handleOnPressConfirmAccountOptions() {
    const accountCreationType = accountStore.currentAccount.accountCreationType

    if (accountCreationType === 'generate')
      router.push('/addMasterKey/generateSeed')
    else if (accountCreationType === 'import')
      router.push('/addMasterKey/importSeed')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{accountStore.currentAccount.name}</SSText>
          )
        }}
      />
      <SSFormLayout>
        <SSFormLayout.Item>
          <SSFormLayout.Label
            label={i18n.t('addMasterKey.accountOptions.policyType')}
          />
          <SSButton label="" withSelect />
        </SSFormLayout.Item>
        <SSFormLayout.Item>
          <SSFormLayout.Label
            label={i18n.t('addMasterKey.accountOptions.scriptVersion')}
          />
          <SSButton label="" withSelect />
        </SSFormLayout.Item>
        <SSFormLayout.Item>
          <SSFormLayout.Label
            label={i18n.t('addMasterKey.accountOptions.mnmonic')}
          />
          <SSButton label="" withSelect />
        </SSFormLayout.Item>
      </SSFormLayout>
      <SSVStack>
        <SSButton
          label={getContinueButtonLabel()}
          variant="secondary"
          onPress={() => handleOnPressConfirmAccountOptions()}
        />
        <SSButton
          label={i18n.t('common.cancel')}
          variant="ghost"
          onPress={() => router.navigate('/accountList/')}
        />
      </SSVStack>
    </SSMainLayout>
  )
}
