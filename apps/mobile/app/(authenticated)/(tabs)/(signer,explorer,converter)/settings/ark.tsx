import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import { ARK_SERVERS, ARK_SUPPORTED_NETWORKS } from '@/constants/ark'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { arkNetworkLabel } from '@/utils/ark'

const tn = _tn('settings.ark')

export default function ArkSettings() {
  const router = useRouter()

  return (
    <SSMainLayout style={{ flex: 1, paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <SSVStack gap="xl" style={{ marginTop: 20 }}>
          {ARK_SUPPORTED_NETWORKS.map((network) => {
            const [server] = ARK_SERVERS[network]
            if (!server) {
              return null
            }
            return (
              <SSVStack gap="md" key={network}>
                <SSVStack gap="none">
                  <SSText
                    uppercase
                    weight="light"
                    size="xl"
                    style={{ letterSpacing: 2.5 }}
                  >
                    {arkNetworkLabel(network)}
                  </SSText>
                  <SSText color="muted">{tn(`network.${network}`)}</SSText>
                </SSVStack>
                <SSVStack gap="sm">
                  <SSText uppercase size="sm">
                    {tn('serverAddress')}
                  </SSText>
                  <SSHStack gap="sm" style={{ alignItems: 'center' }}>
                    <SSCheckbox selected disabled />
                    <SSVStack gap="none" style={{ flex: 1 }}>
                      <SSText size="md" style={{ lineHeight: 18 }}>
                        {server.name}
                      </SSText>
                      <SSText
                        color="muted"
                        size="sm"
                        style={{ lineHeight: 14 }}
                      >
                        {server.arkUrl}
                      </SSText>
                    </SSVStack>
                  </SSHStack>
                </SSVStack>
                <SSVStack gap="sm">
                  <SSText uppercase size="sm">
                    {tn('esploraAddress')}
                  </SSText>
                  <SSHStack gap="sm" style={{ alignItems: 'center' }}>
                    <SSCheckbox selected disabled />
                    <SSVStack gap="none" style={{ flex: 1 }}>
                      <SSText size="md" style={{ lineHeight: 18 }}>
                        {server.name}
                      </SSText>
                      <SSText
                        color="muted"
                        size="sm"
                        style={{ lineHeight: 14 }}
                      >
                        {server.esploraUrl}
                      </SSText>
                    </SSVStack>
                  </SSHStack>
                </SSVStack>
              </SSVStack>
            )
          })}
        </SSVStack>
      </ScrollView>
      <SSVStack gap="md" style={{ flexShrink: 0, paddingTop: 16 }}>
        <SSButton
          variant="secondary"
          label={t('common.close')}
          onPress={() => router.back()}
        />
      </SSVStack>
    </SSMainLayout>
  )
}
