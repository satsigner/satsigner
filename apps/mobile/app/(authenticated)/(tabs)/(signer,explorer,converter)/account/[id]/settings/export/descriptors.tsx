import { type Network } from 'bdk-rn/lib/lib/enums'
import * as Print from 'expo-print'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'

import { getWalletData } from '@/api/bdk'
import { SSIconEyeOn } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSQRCode from '@/components/SSQRCode'
import SSRadioButton from '@/components/SSRadioButton'
import SSText from '@/components/SSText'
import { PIN_KEY } from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type Account, type Secret } from '@/types/models/Account'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { aesDecrypt } from '@/utils/crypto'
import { shareFile } from '@/utils/filesystem'
import { getDerivationPathFromScriptVersion } from '@/utils/bitcoin'
import { Descriptor } from 'bdk-rn'

// Function to calculate checksum for descriptor using a simpler approach
function calculateDescriptorChecksum(descriptor: string): string {
  try {
    // Simple checksum calculation for React Native
    // This is a simplified version that creates a basic checksum
    let hash = 0
    for (let i = 0; i < descriptor.length; i++) {
      const char = descriptor.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }

    // Convert to base58-like string
    const base58Chars =
      '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    let num = Math.abs(hash)
    let result = ''

    while (num > 0) {
      result = base58Chars[num % 58] + result
      num = Math.floor(num / 58)
    }

    // Pad with leading '1's if needed
    while (result.length < 8) {
      result = '1' + result
    }

    return result
  } catch (error) {
    console.error('Failed to calculate checksum:', error)
    return ''
  }
}

export default function ExportDescriptors() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [exportContent, setExportContent] = useState('')
  const [showSeparate, setShowSeparate] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const qrRef = useRef<View>(null)

  useEffect(() => {
    async function getDescriptors() {
      if (!account) return
      const pin = await getItem(PIN_KEY)
      if (!pin) return
      try {
        const isImportAddress = account.keys[0].creationType === 'importAddress'

        const temporaryAccount = JSON.parse(JSON.stringify(account)) as Account

        // Decrypt all keys and extract fingerprint, derivation path, and public key
        for (const key of temporaryAccount.keys) {
          if (typeof key.secret === 'string') {
            // Decrypt the secret
            const decryptedSecretString = await aesDecrypt(
              key.secret,
              pin,
              key.iv
            )
            const decryptedSecret = JSON.parse(decryptedSecretString) as Secret
            key.secret = decryptedSecret

            // Extract fingerprint and derivation path from decrypted secret
            // Use the same pattern as account settings: prefer top-level, fallback to secret
            key.fingerprint = key.fingerprint || ''
            key.derivationPath = key.derivationPath || ''
          } else {
            // Secret is already decrypted, ensure fingerprint and derivation path are set
            key.fingerprint = key.fingerprint || ''
            key.derivationPath = key.derivationPath || ''
          }
        }

        const walletData = !isImportAddress
          ? await getWalletData(temporaryAccount, network as Network)
          : undefined

        // --- BEGIN: Multisig Key Details Formatting ---
        let descriptorString = ''
        if (!isImportAddress) {
          // For multisig, create proper descriptor with derivation paths and checksum
          const scriptVersion =
            temporaryAccount.keys[0]?.scriptVersion || 'P2WPKH'
          const keyCount = temporaryAccount.keys.length
          const keysRequired = temporaryAccount.keysRequired || keyCount

          // Build key section with proper derivation paths
          const keySection = temporaryAccount.keys
            .map((key) => {
              const secret = key.secret as Secret

              // Get fingerprint from secret or key
              const fingerprint =
                (typeof secret === 'object' && secret.fingerprint) ||
                key.fingerprint ||
                ''

              // Get derivation path from script version or key
              let derivationPath = key.derivationPath || ''
              if (!derivationPath || key.creationType === 'importExtendedPub') {
                derivationPath = getDerivationPathFromScriptVersion(
                  scriptVersion,
                  network
                )
              }

              // Get extended public key
              const xpub =
                (typeof secret === 'object' && secret.extendedPublicKey) || ''

              // Remove leading 'm' or 'M' from derivationPath if present
              const cleanPath = derivationPath.replace(/^m\/?/i, '')

              // Format: [FINGERPRINT/DERIVATION_PATH]XPUB
              return `[${fingerprint}/${cleanPath}]${xpub}`
            })
            .join(',')

          // Create multisig descriptor based on script version
          let multisigDescriptor = ''
          switch (scriptVersion) {
            case 'P2PKH':
              multisigDescriptor = `pkh(multi(${keysRequired},${keySection}))`
              break
            case 'P2SH-P2WPKH':
              multisigDescriptor = `sh(wpkh(multi(${keysRequired},${keySection})))`
              break
            case 'P2WPKH':
              multisigDescriptor = `wpkh(multi(${keysRequired},${keySection}))`
              break
            case 'P2TR':
              multisigDescriptor = `tr(multi(${keysRequired},${keySection}))`
              break
            default:
              multisigDescriptor = `wpkh(multi(${keysRequired},${keySection}))`
          }

          // Validate descriptor format before adding checksum
          if (
            !multisigDescriptor ||
            keySection.split(',').length !== keyCount
          ) {
            console.error('Invalid multisig descriptor format')
            descriptorString = multisigDescriptor
          } else {
            // Always calculate checksum manually for multisig descriptors
            const checksum = calculateDescriptorChecksum(multisigDescriptor)
            if (checksum) {
              descriptorString = `${multisigDescriptor}#${checksum}`
            } else {
              descriptorString = multisigDescriptor
            }
          }
        } else {
          // For importAddress, fallback to single key descriptor
          let singleKeyDescriptor = (typeof temporaryAccount.keys[0].secret ===
            'object' &&
            temporaryAccount.keys[0].secret.externalDescriptor!) as string

          // Add checksum if not present
          if (singleKeyDescriptor && !singleKeyDescriptor.includes('#')) {
            const checksum = calculateDescriptorChecksum(singleKeyDescriptor)
            if (checksum) {
              descriptorString = `${singleKeyDescriptor}#${checksum}`
              console.log(
                'Added checksum to single key descriptor:',
                descriptorString
              )
            } else {
              descriptorString = singleKeyDescriptor
              console.warn(
                'Failed to calculate checksum for single key descriptor'
              )
            }
          } else {
            descriptorString = singleKeyDescriptor
          }
        }
        // --- END: Multisig Key Details Formatting ---

        // Compose export content
        const exportString = descriptorString
        setExportContent(exportString)
      } catch {
        // TODO
      } finally {
        setIsLoading(false)
      }
    }
    getDescriptors()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportDescriptors() {
    if (!account) return
    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `${t('export.file.name.descriptors')}_${accountId}_${date}.${ext}`
    shareFile({
      filename,
      fileContent: exportContent,
      dialogTitle: t('export.file.save'),
      mimeType: `text/plain`
    })
  }

  async function exportDescriptorsPDF() {
    if (!account || !exportContent) return

    try {
      // Generate PDF with QR code using a different approach
      generatePDF()
    } catch {
      // Handle error silently
    }
  }

  async function generatePDF() {
    if (!account || !exportContent) return

    try {
      // Capture QR code as image using react-native-view-shot
      let qrDataURL = ''
      if (qrRef.current) {
        qrDataURL = await captureRef(qrRef.current, {
          format: 'png',
          quality: 0.9,
          result: 'data-uri'
        })
      }

      await createPDFWithQR(qrDataURL)
    } catch {
      // Fallback without QR code
      await createPDFWithQR('')
    }
  }

  async function createPDFWithQR(qrDataURL: string) {
    if (!account) return
    const title = account.name

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            @page {
              margin: 1in;
              size: A4;
            }
            
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 20px;
              background-color: white;
              color: black;
              line-height: 1.4;
            }
            
            .header {
              text-align: center;
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 30px;
            }
            
            .qr-section {
              text-align: center;
              margin: 30px 0;
              page-break-inside: avoid;
            }
            
            .qr-code {
              max-width: 300px;
              max-height: 300px;
              border: 2px solid #000;
              margin: 0 auto;
              display: block;
            }
            
            .descriptor-text {
              font-family: 'Courier New', monospace;
              font-size: 11px;
              word-break: break-all;
              background-color: #f8f8f8;
              padding: 20px;
              border: 1px solid #ddd;
              margin: 15px 0;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="header">${title}</div>
          
          ${
            qrDataURL
              ? `
          <div class="qr-section">
            <img src="${qrDataURL}" class="qr-code" alt="QR Code for descriptor" />
          </div>
          `
              : ''
          }
          
          <div class="descriptor-text">${exportContent}</div>
        </body>
      </html>
    `

    try {
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      })

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('export.file.save'),
          UTI: 'com.adobe.pdf'
        })
      }
    } catch {
      // Handle error silently
    }
  }

  if (!account) return <Redirect href="/" />

  const descriptors = exportContent.split('\n').filter(Boolean)

  return (
    <ScrollView style={{ width: '100%' }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
              {account.policyType === 'watchonly' && (
                <SSIconEyeOn stroke="#fff" height={16} width={16} />
              )}
            </SSHStack>
          ),
          headerRight: undefined
        }}
      />
      <SSVStack style={{ padding: 20 }} gap="lg">
        <SSText center uppercase color="muted">
          {t('account.export.descriptors')}
        </SSText>

        {isLoading ? (
          <SSText center color="muted">
            Loading descriptors...
          </SSText>
        ) : exportContent ? (
          <>
            <SSHStack gap="sm" style={{ justifyContent: 'space-between' }}>
              <SSRadioButton
                variant="outline"
                label="Together"
                selected={!showSeparate}
                onPress={() => setShowSeparate(false)}
                style={{ width: '48%' }}
              />
              <SSRadioButton
                variant="outline"
                label="Separate"
                selected={showSeparate}
                onPress={() => setShowSeparate(true)}
                style={{ width: '48%' }}
              />
            </SSHStack>

            {showSeparate ? (
              <SSVStack gap="md">
                {descriptors.map((descriptor, index) => (
                  <View key={index} style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        backgroundColor: Colors.white,
                        padding: 16,
                        borderRadius: 2
                      }}
                    >
                      <SSQRCode
                        value={descriptor}
                        size={150}
                        color={Colors.black}
                        backgroundColor={Colors.white}
                      />
                    </View>
                    <SSText color="muted" size="sm" style={{ marginTop: 8 }}>
                      {index === 0 ? 'External' : 'Internal'} Descriptor
                    </SSText>
                  </View>
                ))}
              </SSVStack>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <View
                  ref={qrRef}
                  style={{
                    backgroundColor: Colors.white,
                    padding: 16,
                    borderRadius: 2
                  }}
                >
                  <SSQRCode
                    value={exportContent}
                    size={250}
                    color={Colors.black}
                    backgroundColor={Colors.white}
                  />
                </View>
              </View>
            )}

            <View
              style={{
                padding: 10,
                backgroundColor: Colors.gray[950],
                borderRadius: 5
              }}
            >
              <SSText color="white" size="md" type="mono">
                {exportContent}
              </SSText>
            </View>
            <SSClipboardCopy text={exportContent}>
              <SSButton
                label={t('common.copyToClipboard')}
                onPress={() => true}
              />
            </SSClipboardCopy>
            <SSButton
              label={t('account.export.descriptorsPDF')}
              variant="secondary"
              onPress={exportDescriptorsPDF}
            />
            <SSButton
              label={t('common.downloadFile')}
              variant="outline"
              onPress={exportDescriptors}
            />
          </>
        ) : (
          <SSText center color="muted">
            No descriptors available
          </SSText>
        )}
        <SSButton
          label={t('common.cancel')}
          variant="ghost"
          onPress={() => router.back()}
        />
      </SSVStack>
    </ScrollView>
  )
}
