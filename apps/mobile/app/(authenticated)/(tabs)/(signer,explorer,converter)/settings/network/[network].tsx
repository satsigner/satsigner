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

import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
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
import SSModal from '@/components/SSModal'
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
import {
  type Backend,
  type Network,
  type Server
} from '@/types/settings/blockchain'

export default function CustomNetwork() {
  const { network, editUrl } = useLocalSearchParams<{
    network: string
    editUrl?: string
  }>()
  const router = useRouter()
  const {
    applyPastedUrl,
    formData,
    loadServer,
    updateField,
    updateProxyField,
    constructUrl,
    constructTrimmedUrl
  } = useCustomNetworkForm()
  const [scanModalVisible, setScanModalVisible] = useState(false)
  const [, requestCameraPermission] = useCameraPermissions()

  const networkType = network as Network

  const [
    selectedNetwork,
    configs,
    customServers,
    setSelectedNetwork,
    updateServer,
    addCustomServer,
    updateCustomServer
  ] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configs,
      state.customServers,
      state.setSelectedNetwork,
      state.updateServer,
      state.addCustomServer,
      state.updateCustomServer
    ])
  )

  const [connectionState, connectionString, isPrivateConnection] =
    useVerifyConnection()

  const [testing, setTesting] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [oldNetwork] = useState<Network>(selectedNetwork)
  const [oldServer] = useState<Server>(configs[networkType].server)

  useEffect(() => {
    if (editUrl && customServers.length > 0) {
      const decoded = decodeURIComponent(editUrl)
      const server = customServers.find((s) => s.url === decoded)
      if (server) {
        setEditingServer(server)
        loadServer(server)
      }
    }
  }, [editUrl, customServers.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const backends: Backend[] = ['electrum', 'esplora']
  const protocols = ['ssl', 'tcp'] as const

  const urlPreview = useMemo(() => {
    return constructTrimmedUrl()
  }, [constructTrimmedUrl])

  useEffect(() => {
    if (testing && !connectionState) toast.error(t('error.invalid.backend'))
  }, [testing, connectionState])

  async function handlePaste() {
    try {
      const text = await Clipboard.getStringAsync()
      if (applyPastedUrl(text)) {
        toast.success(t('watchonly.success.clipboardPasted'))
      } else {
        toast.error(t('error.invalid.url'))
      }
    } catch {
      toast.error(t('error.invalid.url'))
    }
  }

  async function handleOpenScan() {
    const { granted } = await requestCameraPermission()
    if (!granted) return
    setScanModalVisible(true)
  }

  function handleScanResult(data: string) {
    if (applyPastedUrl(data)) {
      setScanModalVisible(false)
      toast.success(t('watchonly.success.qrScanned'))
    } else {
      toast.error(t('error.invalid.url'))
    }
  }

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

  function handleSave() {
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

      if (editingServer) {
        updateCustomServer(editingServer, server)
      } else {
        addCustomServer(server)
      }
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
                  multiline
                  style={{ height: 'auto', minHeight: 70 }}
                  placeholder={t(
                    `settings.network.server.host.placeholder.${formData.backend}`
                  )}
                />
                <SSHStack gap="md" style={{ width: '100%' }}>
                  <SSButton
                    variant="outline"
                    label={t('common.paste')}
                    onPress={handlePaste}
                    style={{ flex: 1 }}
                  />
                  <SSButton
                    variant="outline"
                    label={t('common.scanQR')}
                    onPress={handleOpenScan}
                    style={{ flex: 1 }}
                  />
                </SSHStack>
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
                label={editingServer ? t('common.save') : t('common.add')}
                onPress={() => handleSave()}
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

      <SSModal
        visible={scanModalVisible}
        fullOpacity
        onClose={() => setScanModalVisible(false)}
      >
        <SSVStack itemsCenter gap="md">
          <SSText color="muted" uppercase>
            {t('common.scanQR')}
          </SSText>
          <CameraView
            onBarcodeScanned={({ data }) => {
              if (data) handleScanResult(data)
            }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={{ width: 340, height: 340 }}
          />
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}
