import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useLightningStore } from '@/store/lightning'
import type { LNDConfig } from '@/types/models/LND'
import { getAllClipboardContent } from '@/utils/clipboard'
import { type DetectedContent } from '@/utils/contentDetector'

export default function LNDRestPage() {
  const router = useRouter()
  const { setConfig, setConnected, setNodeInfo } = useLightningStore()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [connectionString, setConnectionString] = useState('')
  const [isButtonEnabled, setIsButtonEnabled] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const validateConnectionString = (text: string): boolean => {
    return /^config=.*\.config$/i.test(text.trim())
  }

  const fetchLNDConfig = async (configUrl: string): Promise<LNDConfig> => {
    const response = await fetch(configUrl)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch LND config: ${response.status} ${response.statusText}`
      )
    }
    const text = await response.text()

    const jsonConfig = JSON.parse(text)

    if (!jsonConfig.configurations?.[0]) {
      throw new Error('Invalid config format: missing configurations array')
    }

    const [config] = jsonConfig.configurations

    const lndConfig: LNDConfig = {
      cert: config.cert,
      macaroon: config.macaroon,
      url: config.uri
    }

    if (!lndConfig.macaroon || !lndConfig.url) {
      throw new Error(
        `Invalid config format: missing required fields. Found: ${Object.keys(
          lndConfig
        ).join(', ')}`
      )
    }

    return lndConfig
  }
  const handleConnect = async () => {
    if (!connectionString.trim()) {
      return
    }

    setIsConnecting(true)
    try {
      const configUrl = connectionString
        .trim()
        .replace(/^config=/i, '')
        .trim()

      // Fetch and parse LND config
      const config = await fetchLNDConfig(configUrl)

      // Test connection and fetch node info
      const response = await fetch(`${config.url}/v1/getinfo`, {
        headers: {
          'Grpc-Metadata-macaroon': config.macaroon
        }
      })

      if (response.ok) {
        const nodeInfo = await response.json()

        setConfig(config)
        setNodeInfo(nodeInfo)
        setConnected(true)

        toast.success('Successfully connected to LND node')
        setTimeout(router.back, 2000)
      } else {
        toast.error('Failed to connect to LND node')
      }
    } catch {
      toast.error('Failed to connect to LND node')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleContentScanned = (content: DetectedContent) => {
    const scannedData = content.cleaned
    if (validateConnectionString(scannedData)) {
      setConnectionString(scannedData)
      setIsButtonEnabled(true)
      setCameraModalVisible(false)
    } else {
      toast.error(
        'Invalid QR Code: the scanned QR code is not a valid LND connection string'
      )
    }
  }

  const handlePasteFromClipboard = async () => {
    const text = (await getAllClipboardContent()) ?? ''
    setConnectionString(text)
    setIsButtonEnabled(validateConnectionString(text))
  }

  const handleTextChange = (text: string) => {
    setConnectionString(text)
    setIsButtonEnabled(validateConnectionString(text))
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
            Connect to your LND node via Rest API
          </SSText>
          <SSVStack style={styles.inputContainer}>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={4}
              value={connectionString}
              onChangeText={handleTextChange}
              placeholder="Enter LND connection string..."
              placeholderTextColor="#666"
            />
            <SSHStack style={styles.buttonRow}>
              <SSButton
                label="Paste"
                onPress={handlePasteFromClipboard}
                variant="subtle"
                uppercase
                style={styles.buttonRowItem}
              />
              <SSButton
                label="Scan QR"
                onPress={() => setCameraModalVisible(true)}
                variant="subtle"
                uppercase
                style={styles.buttonRowItem}
              />
            </SSHStack>
          </SSVStack>
          <SSButton
            label={isConnecting ? 'Connecting...' : 'Connect to Node'}
            onPress={handleConnect}
            variant="secondary"
            uppercase
            disabled={!isButtonEnabled || isConnecting}
          />
        </SSVStack>
      </SSMainLayout>

      <SSCameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onContentScanned={handleContentScanned}
        context="lightning"
        title="Scan LND Connection String"
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
    borderRadius: 8,
    borderWidth: 1,
    color: '#fff',
    height: 100,
    padding: 12,
    textAlignVertical: 'top',
    width: '100%'
  }
})
