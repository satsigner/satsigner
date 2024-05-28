import { Image } from 'expo-image'
import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSSeparator from '@/components/SSSeparator'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
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
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{accountStore.currentAccount.name}</SSText>
          )
        }}
      />
      <SSMainLayout style={{ flex: 0 }}>
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
          <SSVStack itemsCenter gap="sm">
            <SSVStack itemsCenter gap="xs">
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
            </SSVStack>
            <SSVStack itemsCenter gap="none">
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText
                  size="7xl"
                  color="white"
                  weight="ultralight"
                  style={{ lineHeight: 62 }}
                >
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
        </SSVStack>
      </SSMainLayout>
      <SSSeparator color="grayDark" style={{ width: '100%', marginTop: 12 }} />
      <SSHStack justifyBetween style={{ paddingHorizontal: '5%' }}>
        <SSButton
          variant="ghost"
          label={`${i18n.t('common.selectAll').toUpperCase()} 3000 ${i18n.t('bitcoin.sats').toLowerCase()}`}
          style={{ width: 'auto' }}
          textStyle={{
            color: Colors.gray[75],
            textTransform: 'none',
            textDecorationLine: 'underline'
          }}
        />
        <SSHStack>
          <SSSortDirectionToggle
            label={i18n.t('common.date')}
            onDirectionChanged={() => {}}
          />
          <SSSortDirectionToggle
            label={i18n.t('common.amount')}
            onDirectionChanged={() => {}}
          />
        </SSHStack>
      </SSHStack>
      <SSMainLayout style={{ paddingTop: 0 }}>
        <View style={styles.absoluteSubmitContainer}>
          <SSButton label="Add as inputs to message" variant="secondary" />
        </View>
      </SSMainLayout>
    </>
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
