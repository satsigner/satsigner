/**
 * Custom Network Configuration Screen
 *
 * TODO: Future UX Enhancements
 * - Add paste from clipboard functionality to auto-parse server URLs (ssl://host:port)
 * - Add QR code scan button to scan server connection details and auto-populate form
 * - Add URL parsing utility to parse full URLs into protocol, host, port components
 * - Add input validation for pasted URLs with helpful error messages
 * - Add server import/export functionality to share configurations via QR codes
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconBlackIndicator,
  SSIconGreenIndicator,
  SSIconYellowIndicator
} from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSProxyFormFields from '@/components/SSProxyFormFields'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useCustomNetworkForm } from '@/hooks/useCustomNetworkForm'
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { trimOnionAddress } from '@/utils/urlValidation'
import {
  type Backend,
  type Network,
  type Server
} from '@/types/settings/blockchain'

export default function CustomNetwork() {
  const { network } = useLocalSearchParams()
  const router = useRouter()
  const { formData, updateField, updateProxyField, constructUrl } =
    useCustomNetworkForm()

  const networkType = network as Network

  const [
    selectedNetwork,
    configs,
    setSelectedNetwork,
    updateServer,
    addCustomServer
  ] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configs,
      state.setSelectedNetwork,
      state.updateServer,
      state.addCustomServer
    ])
  )

  const [connectionState, connectionString, isPrivateConnection] =
    useVerifyConnection()

  const [testing, setTesting] = useState(false)
  const [oldNetwork] = useState<Network>(selectedNetwork)
  const [oldServer] = useState<Server>(configs[networkType].server)

  const backends: Backend[] = ['electrum', 'esplora']
  const protocols = ['ssl', 'tcp'] as const

  const urlPreview = useMemo(() => {
    if (!formData.host) return ''
    if (formData.backend === 'electrum' && !formData.port) return ''
    const fullUrl = constructUrl()
    return trimOnionAddress(fullUrl)
  }, [formData.host, formData.port, formData.backend, constructUrl])

  useEffect(() => {
    if (testing && !connectionState) toast.error(t('error.invalid.backend'))
  }, [testing, connectionState])

  function isValid() {
    if (!formData.name.trim()) {
      toast.warning(t('error.require.name'))
      return false
    }

    if (!formData.host.trim()) {
      toast.warning(t('error.require.host'))
      return false
    }

    if (formData.backend === 'electrum') {
      if (!formData.port.trim()) {
        toast.warning(t('error.require.port'))
        return false
      }

      if (!formData.port.match(/^[0-9]+$/)) {
        toast.warning(t('error.invalid.port'))
        return false
      }
    } else {
      if (formData.port.trim() && !formData.port.match(/^[0-9]+$/)) {
        toast.warning(t('error.invalid.port'))
        return false
      }
    }

    return true
  }

  function handleTest() {
    setTesting(false)

    if (!isValid()) return

    const url = constructUrl()
    const server: Server = {
      name: formData.name,
      backend: formData.backend,
      network: networkType,
      url,
      proxy: formData.proxy.enabled ? formData.proxy : undefined
    }

    setSelectedNetwork(networkType)
    updateServer(networkType, server)

    setTesting(true)
  }

  function handleAdd() {
    if (isValid()) {
      if (!connectionState) {
        setSelectedNetwork(oldNetwork)
        updateServer(oldNetwork, oldServer)
      }

      const url = constructUrl()
      const server: Server = {
        name: formData.name,
        backend: formData.backend,
        network: networkType,
        url,
        proxy: formData.proxy.enabled ? formData.proxy : undefined
      }

      addCustomServer(server)
      router.back()
    }
  }

  function handleCancel() {
    if (!connectionState) {
      setSelectedNetwork(oldNetwork)
      updateServer(oldNetwork, oldServer)
    }
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.network.custom.title')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSVStack gap="lg" justifyBetween>
        <ScrollView
          style={{ marginBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack gap="xl">
            <SSVStack>
              <SSText uppercase>{t('settings.network.server.backend')}</SSText>
              {backends.map((be) => (
                <SSHStack key={be}>
                  <SSCheckbox
                    key={be}
                    selected={be === formData.backend}
                    onPress={() => updateField('backend', be)}
                  />
                  <TouchableOpacity onPress={() => updateField('backend', be)}>
                    <SSVStack gap="none" justifyBetween>
                      <SSText
                        style={{ lineHeight: 18, textTransform: 'capitalize' }}
                        size="md"
                      >
                        {be}
                      </SSText>
                      <SSText style={{ lineHeight: 14 }} color="muted">
                        {t(`settings.network.server.description.${be}`)}
                      </SSText>
                    </SSVStack>
                  </TouchableOpacity>
                </SSHStack>
              ))}
            </SSVStack>
            <SSVStack gap="md">
              <SSVStack gap="sm">
                <SSText uppercase>{t('common.name')}</SSText>
                <SSTextInput
                  value={formData.name}
                  onChangeText={(value) => updateField('name', value)}
                />
              </SSVStack>
              {formData.backend === 'electrum' && (
                <SSVStack gap="sm">
                  <SSText uppercase>
                    {t('settings.network.server.protocolLabel')}
                  </SSText>
                  <SSHStack gap="lg">
                    {protocols.map((protocol) => (
                      <SSHStack key={protocol}>
                        <SSCheckbox
                          selected={protocol === formData.protocol}
                          onPress={() => updateField('protocol', protocol)}
                        />
                        <TouchableOpacity
                          onPress={() => updateField('protocol', protocol)}
                        >
                          <SSText
                            style={{
                              lineHeight: 18,
                              textTransform: 'uppercase'
                            }}
                            size="md"
                          >
                            {t(`settings.network.server.protocol.${protocol}`)}
                          </SSText>
                        </TouchableOpacity>
                      </SSHStack>
                    ))}
                  </SSHStack>
                </SSVStack>
              )}
              <SSVStack gap="sm">
                <SSText uppercase>
                  {t('settings.network.server.hostLabel')}
                </SSText>
                <SSTextInput
                  value={formData.host}
                  onChangeText={(value) => updateField('host', value)}
                  multiline={true}
                  style={{ height: 'auto', minHeight: 70 }}
                  placeholder={t(
                    `settings.network.server.host.placeholder.${formData.backend}`
                  )}
                />
                {/* TODO: Add paste from clipboard functionality to auto-parse server URLs */}
                {/* TODO: Add QR code scan button to scan server connection details */}
              </SSVStack>
              <SSVStack gap="sm">
                <SSText uppercase>
                  {t('settings.network.server.portLabel')}
                  {formData.backend === 'esplora' && (
                    <SSText
                      style={{ textTransform: 'none', fontWeight: 'normal' }}
                    >
                      {' '}
                      ({t('common.optional')})
                    </SSText>
                  )}
                </SSText>
                <SSTextInput
                  value={formData.port}
                  onChangeText={(value) => updateField('port', value)}
                  placeholder={t(
                    `settings.network.server.port.placeholder.${formData.backend}`
                  )}
                  keyboardType="numeric"
                />
              </SSVStack>
              {urlPreview && (
                <SSVStack gap="sm">
                  <SSText uppercase>
                    {t('settings.network.server.urlPreview')}
                  </SSText>
                  <SSText color="muted" size="sm">
                    {urlPreview}
                  </SSText>
                </SSVStack>
              )}
              <SSProxyFormFields
                proxy={formData.proxy}
                onProxyChange={updateProxyField}
              />
              {testing && (
                <SSHStack
                  style={{ justifyContent: 'center', gap: 0, marginBottom: 24 }}
                >
                  {connectionState ? (
                    isPrivateConnection ? (
                      <SSIconYellowIndicator height={24} width={24} />
                    ) : (
                      <SSIconGreenIndicator height={24} width={24} />
                    )
                  ) : (
                    <SSIconBlackIndicator height={24} width={24} />
                  )}
                  <SSText
                    size="xxs"
                    uppercase
                    style={{
                      color: connectionState
                        ? Colors.gray['200']
                        : Colors.gray['450']
                    }}
                  >
                    {connectionString}
                  </SSText>
                </SSHStack>
              )}
            </SSVStack>

            <SSVStack>
              <SSButton
                label={t('settings.network.server.test')}
                onPress={() => handleTest()}
              />
              <SSButton
                variant="secondary"
                label={t('common.add')}
                onPress={() => handleAdd()}
              />
              <SSButton
                variant="ghost"
                label={t('common.cancel')}
                onPress={() => handleCancel()}
              />
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </SSMainLayout>
  )
}
