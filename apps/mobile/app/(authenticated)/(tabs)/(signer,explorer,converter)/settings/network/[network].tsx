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

import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSConnectionStatusIndicator from '@/components/SSConnectionStatusIndicator'
import SSModal from '@/components/SSModal'
import SSProxyFormFields from '@/components/SSProxyFormFields'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  type ConnectionTestResult,
  useConnectionTest
} from '@/hooks/useConnectionTest'
import { useCustomNetworkForm } from '@/hooks/useCustomNetworkForm'
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import {
  type Backend,
  type Network,
  type Server
} from '@/types/settings/blockchain'
import { formatDate } from '@/utils/date'
import { trimOnionAddress } from '@/utils/format'

const tnServer = _tn('settings.network.server')

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
  const scanHandledRef = useRef(false)
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

  const [connectionStatus, connectionString, isPrivateConnection] =
    useVerifyConnection()

  const {
    testing: connectionTesting,
    testConnection,
    resetTest
  } = useConnectionTest()

  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [oldNetwork] = useState<Network>(selectedNetwork)
  const [oldServer] = useState<Server>(configs[networkType].server)
  /** Shown under connection status so tip height/time stay visible without relying on toast alone. */
  const [lastProbeLine, setLastProbeLine] = useState<string | null>(null)

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

  const urlPreview = useMemo(() => constructTrimmedUrl(), [constructTrimmedUrl])

  function successToastDescription(
    result: Extract<ConnectionTestResult, { success: true }>
  ): string {
    const dateSec = result.tipTimestampSec ?? Math.floor(Date.now() / 1000)
    const dateStr = formatDate(dateSec)
    if (
      result.blockHeight !== null &&
      result.blockHeight !== undefined &&
      result.blockHeight > 0
    ) {
      return tnServer('tester.successDetail', {
        date: dateStr,
        height: result.blockHeight.toLocaleString()
      })
    }
    return tnServer('tester.successNoHeight', { date: dateStr })
  }

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
    if (!granted) {
      return
    }
    scanHandledRef.current = false
    setScanModalVisible(true)
  }

  function handleScanResult(data: string) {
    if (scanHandledRef.current) {
      return
    }

    scanHandledRef.current = true

    if (applyPastedUrl(data)) {
      scanHandledRef.current = false
      setScanModalVisible(false)
      toast.success(t('watchonly.success.qrScanned'))
    } else {
      toast.error(t('error.invalid.url'))
      setTimeout(() => {
        scanHandledRef.current = false
      }, 1500)
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
    } else if (formData.port.trim() && !formData.port.match(/^[0-9]+$/)) {
      toast.warning(t('error.invalid.port'))
      return false
    }

    return true
  }

  async function handleTest() {
    if (!isValid()) {
      return
    }

    setLastProbeLine(null)

    const url = constructUrl()
    const server: Server = {
      backend: formData.backend,
      name: formData.name,
      network: networkType,
      proxy: formData.proxy.enabled ? formData.proxy : undefined,
      url
    }

    await resetTest()

    try {
      const result = await testConnection(
        server.url,
        server.backend,
        server.network,
        server.proxy
      )

      if (!result.success) {
        toast.error(`${server.name} (${trimOnionAddress(server.url)})`, {
          description: result.error ?? tnServer('tester.failed')
        })
        return
      }

      setSelectedNetwork(networkType)
      updateServer(networkType, server)

      const probeLine = successToastDescription(result)
      setLastProbeLine(probeLine)

      try {
        toast.success(`${server.name} (${trimOnionAddress(server.url)})`, {
          description: `${tnServer('tester.success')} — ${probeLine}`
        })
      } catch {
        // sonner handler can break if a nested modal mounted its own Toaster; root Toaster should recover
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tnServer('tester.error')
      toast.error(`${server.name} (${trimOnionAddress(server.url)})`, {
        description: message
      })
    }
  }

  function handleSave() {
    if (isValid()) {
      const url = constructUrl()
      const server: Server = {
        backend: formData.backend,
        name: formData.name,
        network: networkType,
        proxy: formData.proxy.enabled ? formData.proxy : undefined,
        url
      }

      if (editingServer) {
        updateCustomServer(editingServer, server)
      } else {
        addCustomServer(server)
      }

      setSelectedNetwork(networkType)
      updateServer(networkType, server)
      router.back()
    }
  }

  function handleCancel() {
    if (connectionStatus !== 'connected') {
      setSelectedNetwork(oldNetwork)
      updateServer(oldNetwork, oldServer)
    }
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.network.custom.title')}</SSText>
          )
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
                      style={{ fontWeight: 'normal', textTransform: 'none' }}
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
              <SSVStack gap="none" style={{ marginBottom: 16 }}>
                <SSHStack
                  style={{ gap: 0, justifyContent: 'center', marginBottom: 8 }}
                >
                  <SSConnectionStatusIndicator
                    isPrivateConnection={isPrivateConnection}
                    status={connectionStatus}
                  />
                  <SSText
                    size="xxs"
                    uppercase
                    style={{
                      color:
                        connectionStatus === 'connected'
                          ? Colors.gray['200']
                          : Colors.gray['450']
                    }}
                  >
                    {connectionString}
                  </SSText>
                </SSHStack>
                {lastProbeLine ? (
                  <SSText center color="muted" size="xs">
                    {`${tnServer('tester.success')} — ${lastProbeLine}`}
                  </SSText>
                ) : null}
              </SSVStack>
            </SSVStack>

            <SSVStack>
              <SSButton
                label={t('settings.network.server.test')}
                loading={connectionTesting}
                disabled={connectionTesting}
                onPress={() => {
                  void handleTest()
                }}
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
        onClose={() => {
          scanHandledRef.current = false
          setScanModalVisible(false)
        }}
      >
        <SSVStack itemsCenter gap="md">
          <SSText color="muted" uppercase>
            {t('common.scanQR')}
          </SSText>
          <CameraView
            onBarcodeScanned={({ data }) => {
              if (data) {
                handleScanResult(data)
              }
            }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={{ height: 340, width: 340 }}
          />
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}
