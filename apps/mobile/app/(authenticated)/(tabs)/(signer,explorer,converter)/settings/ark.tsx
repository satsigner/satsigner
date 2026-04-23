import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView
} from 'react-native'

import SSIconEyeOff from '@/components/icons/SSIconEyeOff'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { ARK_SERVERS, ARK_SUPPORTED_NETWORKS } from '@/constants/arkServers'
import { useArkServerAccessToken } from '@/hooks/useArkServerAccessToken'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useArkStore } from '@/store/ark'
import type { Network } from '@/types/settings/blockchain'
import { arkNetworkLabel } from '@/utils/ark'

const tn = _tn('settings.ark')

export default function ArkSettings() {
  const router = useRouter()
  const persistedTokens = useArkStore((state) => state.serverAccessTokens)
  const { applyAccessToken } = useArkServerAccessToken()

  const [tokens, setTokens] = useState<Partial<Record<Network, string>>>({
    bitcoin: persistedTokens.bitcoin ?? '',
    signet: persistedTokens.signet ?? ''
  })
  const [visibleTokens, setVisibleTokens] = useState<
    Partial<Record<Network, boolean>>
  >({})

  function handleChangeToken(network: Network, value: string) {
    setTokens((prev) => ({ ...prev, [network]: value }))
  }

  function handleToggleTokenVisibility(network: Network) {
    setVisibleTokens((prev) => ({ ...prev, [network]: !prev[network] }))
  }

  function handleSave() {
    for (const network of ARK_SUPPORTED_NETWORKS) {
      applyAccessToken(network, tokens[network] ?? '')
    }
    router.back()
  }

  return (
    <SSMainLayout style={{ flex: 1, paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, minHeight: 0 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
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
                  <SSVStack gap="sm">
                    <SSText uppercase size="sm">
                      {tn('serverAccessToken')}
                    </SSText>
                    <SSText color="muted" size="xs">
                      {tn('serverAccessTokenDescription')}
                    </SSText>
                    <SSTextInput
                      value={tokens[network] ?? ''}
                      onChangeText={(text) => handleChangeToken(network, text)}
                      placeholder={tn('serverAccessTokenPlaceholder')}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!visibleTokens[network]}
                      actionRight={
                        <Pressable
                          onPress={() => handleToggleTokenVisibility(network)}
                          hitSlop={8}
                        >
                          {visibleTokens[network] ? (
                            <SSIconEyeOn height={20} width={20} />
                          ) : (
                            <SSIconEyeOff height={20} width={20} />
                          )}
                        </Pressable>
                      }
                    />
                  </SSVStack>
                </SSVStack>
              )
            })}
          </SSVStack>
        </ScrollView>
        <SSVStack gap="md" style={{ flexShrink: 0, paddingTop: 16 }}>
          <SSButton
            variant="secondary"
            label={t('common.save')}
            onPress={handleSave}
          />
          <SSButton
            variant="ghost"
            label={t('common.cancel')}
            onPress={() => router.back()}
          />
        </SSVStack>
      </KeyboardAvoidingView>
    </SSMainLayout>
  )
}
