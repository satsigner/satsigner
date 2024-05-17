import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'

export default function AddMasterKey() {
  const router = useRouter()
  const accountStore = useAccountStore()

  const [accountName, setAccountName] = useState('')
  const actionsDisabled = accountName.length < 1

  function handleOnPressAddMasterKey(
    creationType: Account['accountCreationType']
  ) {
    accountStore.currentAccount.name = accountName
    accountStore.currentAccount.accountCreationType = creationType
    router.navigate('/addMasterKey/accountOptions')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{i18n.t('addMasterKey.title')}</SSText>
          )
        }}
      />
      <SSVStack gap="lg">
        <SSFormLayout>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={i18n.t('addMasterKey.masterKeyName')} />
            <SSTextInput
              onChangeText={(accountName) => setAccountName(accountName)}
            />
          </SSFormLayout.Item>
        </SSFormLayout>
        <SSVStack>
          <SSButton
            label={i18n.t('addMasterKey.generateNewSeed.title')}
            disabled={actionsDisabled}
            onPress={() => handleOnPressAddMasterKey('generate')}
          />
          <SSButton
            label={i18n.t('addMasterKey.importExistingSeed.title')}
            disabled={actionsDisabled}
            onPress={() => handleOnPressAddMasterKey('import')}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
