import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { getAllClipboardContent } from '@/utils/clipboard'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  fetchLndConfig,
  getLndConfigFileUrlFromConnectionInput
} from '@/utils/lndRestRemoteConfig'

export default function LNDRestPage() {
  const router = useRouter()
  const [setConfig, setConnected, setNodeInfo] = useLightningStore(
    useShallow((s) => [s.setConfig, s.setConnected, s.setNodeInfo])
  )
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [connectionString, setConnectionString] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const canPressConnect =
    getLndConfigFileUrlFromConnectionInput(connectionString) !== null

  const handleConnect = async () => {
    const configUrl = getLndConfigFileUrlFromConnectionInput(connectionString)
    if (!configUrl) {
      toast.error(t('lightning.lndRest.invalidConnectionString'))
      return
    }

    setIsConnecting(true)
    try {
      const config = await fetchLndConfig(configUrl)

      const baseUrl = config.url.replace(/\/+$/, '')
      const response = await fetch(`${baseUrl}/v1/getinfo`, {
        headers: {
          'Content-Type': 'application/json',
          'Grpc-Metadata-macaroon': config.macaroon
        }
      })

      if (response.ok) {
        const nodeInfo = await response.json()

        setConfig({ ...config, url: baseUrl })
        setNodeInfo(nodeInfo)
        setConnected(true)

        toast.success(t('lightning.lndRest.connectSuccess'))
        setTimeout(() => {
          router.back()
        }, 2000)
      } else {
        const errBody = (await response.text())
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 180)
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
    if (getLndConfigFileUrlFromConnectionInput(scannedData)) {
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
        <SSVStack style={styles.content}>
          <SSText color="muted" style={styles.subtitle}>
            {t('lightning.lndRest.subtitle')}
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
                onPress={() => setCameraModalVisible(true)}
                variant="subtle"
                uppercase
                style={styles.buttonRowItem}
              />
            </SSHStack>
          </SSVStack>
          <SSButton
            label={
              isConnecting
                ? t('lightning.lndRest.connectingButton')
                : t('lightning.lndRest.connectButton')
            }
            onPress={handleConnect}
            variant="secondary"
            uppercase
            disabled={!canPressConnect || isConnecting}
          />
        </SSVStack>
      </SSMainLayout>

      <SSCameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
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
  content: {
    alignItems: 'center',
    flex: 1
  },
  headerText: {
    marginBottom: 8
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
