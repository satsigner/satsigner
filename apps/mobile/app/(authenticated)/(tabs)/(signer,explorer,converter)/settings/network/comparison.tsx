import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'

const tn = _tn('settings.network.comparison')

export default function NetworksComparison() {
  const router = useRouter()

  const networks = [
    'regtest',
    'signet',
    'simnet',
    'testnet3',
    'testnet4',
    'mutinynet'
  ]

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>,
          headerRight: undefined
        }}
      />
      <SSMainLayout style={{ paddingTop: 0 }}>
        <ScrollView>
          <SSVStack>
            <SSVStack>
              {networks.map((network) => (
                <SSVStack key={network} gap="none">
                  <SSText uppercase weight="bold">
                    {tn(`${network}.title`)}
                  </SSText>
                  <SSText color="muted">{tn(`${network}.description`)}</SSText>
                  <SSText color="muted">
                    <SSText weight="bold" color="muted">
                      {tn('usage')}
                    </SSText>{' '}
                    {tn(`${network}.useCase`)}
                  </SSText>
                </SSVStack>
              ))}
            </SSVStack>
            <SSButton
              label={t('common.acknowledge').toUpperCase()}
              onPress={() => router.back()}
            />
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
