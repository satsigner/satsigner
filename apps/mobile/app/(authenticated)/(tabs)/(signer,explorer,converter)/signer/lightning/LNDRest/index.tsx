import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { lndRestFetch } from '@/api/lndRest'
import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSLoader from '@/components/SSLoader'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { type LNDNodeInfo } from '@/types/models/Lightning'
import { getAllClipboardContent } from '@/utils/clipboard'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  parseLndConnectionInput,
  resolveLndConfigFromConnectionInput
} from '@/utils/lndRestRemoteConfig'

const CONNECTING_LOADER_SIZE = 80

export default function LNDRestPage() {
  const router = useRouter()
  const protocolParam = useLocalSearchParams<{ protocol?: string | string[] }>()
    .protocol
  const protocol = Array.isArray(protocolParam)
    ? protocolParam[0]
    : protocolParam
  const isRpcPairing = protocol === 'rpc'
  const [setConfig, setConnected, setNodeInfo] = useLightningStore(
    useShallow((s) => [s.setConfig, s.setConnected, s.setNodeInfo])
  )
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [connectionString, setConnectionString] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const canPressConnect = parseLndConnectionInput(connectionString) !== null

  const handleConnect = async () => {
    if (!parseLndConnectionInput(connectionString)) {
      toast.error(t('lightning.lndRest.invalidConnectionString'))
      return
    }

    setIsConnecting(true)
    try {
      const config = await resolveLndConfigFromConnectionInput(connectionString)

      const baseUrl = config.url.replace(/\/+$/, '')
      const response = await lndRestFetch(
        { ...config, url: baseUrl },
        '/v1/getinfo'
      )

      if (response.ok) {
        const nodeInfo = (await response.json()) as LNDNodeInfo

        setConfig({ ...config, url: baseUrl })
        setNodeInfo(nodeInfo)
        setConnected(true)

        toast.success(t('lightning.lndRest.connectSuccess'))
        setTimeout(() => {
          router.back()
        }, 2000)
      } else {
        const responseText = await response.text()
        const errBody = responseText.replace(/\s+/g, ' ').trim().slice(0, 180)
        throw new Error(
          errBody
            ? `getinfo failed (${response.status}): ${errBody}`
            : `getinfo failed (${response.status})`
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const detail =
        message.length > 220 ? `${message.slice(0, 217)}…` : message
      toast.error(t('lightning.lndRest.connectFailed'), {
        description: t('lightning.lndRest.connectFailedDetail', {
          detail
        })
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleContentScanned = (content: DetectedContent) => {
    const scannedData = content.cleaned
    if (parseLndConnectionInput(scannedData)) {
      setConnectionString(scannedData)
      setCameraModalVisible(false)
    } else {
      toast.error(t('lightning.lndRest.invalidQrCode'))
    }
  }

  const handlePasteFromClipboard = async () => {
    const text = (await getAllClipboardContent()) ?? ''
    setConnectionString(text)
  }

  const handleTextChange = (text: string) => {
    setConnectionString(text)
  }

  function handleOpenCamera() {
    setCameraModalVisible(true)
  }

  function handleCloseCamera() {
    setCameraModalVisible(false)
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              Lightning
            </SSText>
          )
        }}
      />
      <SSMainLayout style={styles.mainLayout}>
        {isConnecting ? (
          <SSVStack
            gap="md"
            itemsCenter
            widthFull
            style={styles.connectingState}
          >
            <SSLoader size={CONNECTING_LOADER_SIZE} />
            <SSText center uppercase>
              {t('lightning.lndRest.connectingButton')}
            </SSText>
            <SSText center color="muted" size="xs">
              {t('lightning.lndRest.connectingHint')}
            </SSText>
          </SSVStack>
        ) : (
          <SSVStack style={styles.content}>
            <SSText color="muted" style={styles.subtitle}>
              {isRpcPairing
                ? t('lightning.lndRest.subtitleRpc')
                : t('lightning.lndRest.subtitle')}
            </SSText>
            <SSText color="muted" size="xs" style={styles.helpText}>
              {isRpcPairing
                ? t('lightning.lndRest.helpTextRpc')
                : t('lightning.lndRest.helpText')}
            </SSText>
            <SSText
              color="muted"
              size="xs"
              type="mono"
              style={styles.helpExample}
            >
              {isRpcPairing
                ? t('lightning.lndRest.helpExampleRpc')
                : t('lightning.lndRest.helpExample')}
            </SSText>
            <SSVStack style={styles.inputContainer}>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                value={connectionString}
                onChangeText={handleTextChange}
                placeholder={t('lightning.lndRest.inputPlaceholder')}
                placeholderTextColor="#666"
              />
              <SSHStack style={styles.buttonRow}>
                <SSButton
                  label={t('lightning.lndRest.pasteButton')}
                  onPress={handlePasteFromClipboard}
                  variant="subtle"
                  uppercase
                  style={styles.buttonRowItem}
                />
                <SSButton
                  label={t('lightning.lndRest.scanQrButton')}
                  onPress={handleOpenCamera}
                  variant="subtle"
                  uppercase
                  style={styles.buttonRowItem}
                />
              </SSHStack>
            </SSVStack>
            <SSButton
              label={t('lightning.lndRest.connectButton')}
              onPress={handleConnect}
              variant="secondary"
              uppercase
              disabled={!canPressConnect}
            />
          </SSVStack>
        )}
      </SSMainLayout>

      <SSCameraModal
        visible={cameraModalVisible}
        onClose={handleCloseCamera}
        onContentScanned={handleContentScanned}
        context="lightning"
        title={t('lightning.lndRest.scanModalTitle')}
      />
    </>
  )
}

const styles = StyleSheet.create({
  buttonContainer: {
    gap: 16,
    width: '100%'
  },
  buttonRow: {
    gap: 12,
    width: '100%'
  },
  buttonRowItem: {
    flex: 1
  },
  connectingState: {
    flex: 1,
    justifyContent: 'center'
  },
  content: {
    alignItems: 'center',
    flex: 1
  },
  headerText: {
    marginBottom: 8
  },
  helpExample: {
    marginBottom: 24,
    textAlign: 'center'
  },
  helpText: {
    marginBottom: 12,
    textAlign: 'center'
  },
  inputContainer: {
    gap: 12,
    marginBottom: 24,
    width: '100%'
  },
  mainLayout: {
    paddingHorizontal: '5%',
    paddingTop: 32
  },
  pasteButton: {
    width: '100%'
  },
  subtitle: {
    marginBottom: 32,
    textAlign: 'center'
  },
  textArea: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333',
    borderRadius: 3,
    borderWidth: 1,
    color: '#fff',
    height: 100,
    padding: 12,
    textAlignVertical: 'top',
    width: '100%'
  }
})
