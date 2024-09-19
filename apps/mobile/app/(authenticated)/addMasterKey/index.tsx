import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

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
  const [
    hasAccountWithName,
    setCurrentAccountName,
    setCurrentAccountCreationType
  ] = useAccountStore(
    useShallow((state) => [
      state.hasAccountWithName,
      state.setCurrentAccountName,
      state.setCurrentAccountCreationType
    ])
  )

  const [accountName, setAccountName] = useState('')
  const actionsDisabled = accountName.length < 1

  function handleOnPressAddMasterKey(
    creationType: Account['accountCreationType']
  ) {
    if (hasAccountWithName(accountName)) {
      Alert.alert(i18n.t('addMasterKey.hasAccountWithName'))
      setAccountName('')
      return
    }
    setCurrentAccountName(accountName)
    setCurrentAccountCreationType(creationType)
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
              value={accountName}
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
