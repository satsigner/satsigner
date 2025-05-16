import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import SSIconInfo from '@/components/icons/SSIconInfo'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'

const tn = _tn('settings.network.comparison')

export default function NetworksComparison() {
  const router = useRouter()

  const networks = [
    'mainnet',
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
            <SSHStack gap="sm">
              <SSIconInfo height={16} width={16} />
              <SSText size="xs" style={{ flexShrink: 1 }}>
                {tn('testnetInfo')}
              </SSText>
            </SSHStack>
            <SSButton
              label={t('common.close').toUpperCase()}
              onPress={() => router.back()}
            />
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
