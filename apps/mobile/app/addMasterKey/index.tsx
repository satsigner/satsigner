import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSMainLayout from '@/layouts/SSMainLayout'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { Account } from '@/types/models/Account'

export default function AddMasterKey() {
  const router = useRouter()
  const accountStore = useAccountStore()

  const [accountName, setAccountName] = useState('')
  const actionsDisabled = useMemo(() => {
    return accountName.length < 1
  }, [accountName])

  function handleOnPressAddMasterKey(
    creationType: Account['accountCreationType']
  ) {
    accountStore.currentAccount.name = accountName
    accountStore.currentAccount.accountCreationType = creationType
    router.push('/addMasterKey/accountOptions')
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
      <SSTextInput
        label={i18n.t('addMasterKey.masterKeyName')}
        onChangeText={(accountName) => setAccountName(accountName)}
      />
      <View style={styles.actionsContainer}>
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
      </View>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actionsContainer: {
    flex: 1,
    gap: 12
  }
})
