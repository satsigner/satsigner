import { Image } from 'expo-image'
import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { Colors } from '@/styles'

export default function SelectUtxoList() {
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
      <SSVStack>
        <SSHStack justifyBetween>
          <SSText color="muted">Group</SSText>
          <SSText size="md">
            {i18n.t('signAndSend.selectSpendableOutputs')}
          </SSText>
          <SSIconButton>
            <Image
              style={{ width: 24, height: 22 }}
              source={require('@/assets/icons/bubbles.svg')}
            />
          </SSIconButton>
        </SSHStack>
        <SSVStack itemsCenter>
          <SSText>
            1 {i18n.t('common.of').toLowerCase()} 3{' '}
            {i18n.t('common.selected').toLowerCase()}
          </SSText>
          <SSHStack gap="xs">
            <SSText size="xxs" style={{ color: Colors.gray[400] }}>
              {i18n.t('common.total')}
            </SSText>
            <SSText size="xxs" style={{ color: Colors.gray[75] }}>
              3,000
            </SSText>
            <SSText size="xxs" style={{ color: Colors.gray[400] }}>
              {i18n.t('bitcoin.sats').toLowerCase()}
            </SSText>
            <SSText size="xxs" style={{ color: Colors.gray[75] }}>
              2.18
            </SSText>
            <SSText size="xxs" style={{ color: Colors.gray[400] }}>
              USD
            </SSText>
          </SSHStack>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText size="3xl" color="white" weight="light">
              3000
            </SSText>
            <SSText size="xl" color="muted">
              {i18n.t('bitcoin.sats').toLowerCase()}
            </SSText>
          </SSHStack>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText size="md" color="muted">
              0.72
            </SSText>
            <SSText size="xs" style={{ color: Colors.gray[500] }}>
              USD
            </SSText>
          </SSHStack>
        </SSVStack>
      </SSVStack>
      <View style={styles.absoluteSubmitContainer}>
        <SSButton label="Add as inputs to message" variant="secondary" />
      </View>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  absoluteSubmitContainer: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    alignSelf: 'center'
  }
})
