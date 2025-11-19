/* eslint-disable no-console */
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Clipboard, StyleSheet, TextInput } from 'react-native'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import type { LNDConfig } from '@/store/lightning'
import { useLightningStore } from '@/store/lightning'
import { type DetectedContent } from '@/utils/contentDetector'

export default function LNDRestPage() {
  const router = useRouter()
  const { setConfig, setConnected, setNodeInfo } = useLightningStore()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [connectionString, setConnectionString] = useState('')
  const [isButtonEnabled, setIsButtonEnabled] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const validateConnectionString = (text: string): boolean => {
    const pattern = /^config=.*\.config$/
    return pattern.test(text.trim())
  }

  const fetchLNDConfig = async (configUrl: string): Promise<LNDConfig> => {
    try {
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

      const config = jsonConfig.configurations[0]

      const lndConfig: LNDConfig = {
        macaroon: config.macaroon,
        cert: config.cert,
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
    } catch (error) {
      console.error('Config fetch error:', error)
      throw error
    }
  }
  const handleConnect = async () => {
    if (!connectionString.trim()) return

    setIsConnecting(true)
    try {
      // Extract config URL from connection string
      const configUrl = connectionString.replace('config=', '').trim()

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

        Alert.alert('Success', 'Successfully connected to LND node', [
          {
            text: 'OK',
            onPress: () => {
              router.back()
            }
          }
        ])
      } else {
        console.error('Failed to connect to LND node:', {
          status: response.status,
          statusText: response.statusText
        })
        Alert.alert('Error', 'Failed to connect to LND node')
      }
    } catch (error) {
      console.error('Connection error:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      })
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to connect to LND node'
      )
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
      Alert.alert(
        'Invalid QR Code',
        'The scanned QR code is not a valid LND connection string'
      )
    }
  }

  const handlePasteFromClipboard = async () => {
    const text = await Clipboard.getString()
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
  mainLayout: {
    paddingTop: 32,
    paddingHorizontal: '5%'
  },
  content: {
    flex: 1,
    alignItems: 'center'
  },
  headerText: {
    marginBottom: 8
  },
  subtitle: {
    marginBottom: 32,
    textAlign: 'center'
  },
  buttonContainer: {
    width: '100%',
    gap: 16
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
    gap: 12
  },
  textArea: {
    width: '100%',
    height: 100,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    backgroundColor: '#1a1a1a',
    textAlignVertical: 'top'
  },
  pasteButton: {
    width: '100%'
  },
  buttonRow: {
    width: '100%',
    gap: 12
  },
  buttonRowItem: {
    flex: 1
  }
})
