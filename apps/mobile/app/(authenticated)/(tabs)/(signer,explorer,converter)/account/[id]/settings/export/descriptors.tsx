import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import * as Print from 'expo-print'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'

import {
  extractExtendedKeyFromDescriptor,
  extractFingerprintFromExtendedPublicKey,
  getExtendedPublicKeyFromAccountKey,
  getWalletData
} from '@/api/bdk'
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
import {
  getDerivationPathFromScriptVersion,
  getMultisigDerivationPathFromScriptVersion,
  getMultisigScriptTypeFromScriptVersion
} from '@/utils/bitcoin'
import { aesDecrypt } from '@/utils/crypto'
import { shareFile } from '@/utils/filesystem'

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
  } catch {
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
        const isImportAddress =
          account.keys?.[0]?.creationType === 'importAddress'

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

        const _walletData = !isImportAddress
          ? await getWalletData(temporaryAccount, network as Network).catch(
              () => undefined
            )
          : undefined

        // --- BEGIN: Descriptor Generation Logic ---
        let descriptorString = ''

        // Safety check: ensure account has keys
        if (!temporaryAccount.keys || temporaryAccount.keys.length === 0) {
          descriptorString = 'No keys available for account'
        } else if (!isImportAddress) {
          if (temporaryAccount.policyType === 'singlesig') {
            // For single signature accounts, generate single key descriptor
            const key = temporaryAccount.keys[0]
            if (!key) {
              descriptorString =
                'No key data available for single signature account'
            } else {
              const secret = key.secret as Secret
              let extendedPublicKey = ''
              let fingerprint = ''

              // Get fingerprint from secret or key
              fingerprint =
                (typeof secret === 'object' && secret.fingerprint) ||
                key.fingerprint ||
                ''

              // Get extended public key from various possible sources
              if (typeof secret === 'object') {
                if (secret.extendedPublicKey) {
                  extendedPublicKey = secret.extendedPublicKey
                } else if (secret.externalDescriptor) {
                  try {
                    const descriptor = await new Descriptor().create(
                      secret.externalDescriptor,
                      network as Network
                    )
                    extendedPublicKey =
                      await extractExtendedKeyFromDescriptor(descriptor)
                  } catch (_error) {
                    // Failed to extract extended public key from descriptor
                  }
                } else if (secret.mnemonic) {
                  try {
                    const extendedKey =
                      await getExtendedPublicKeyFromAccountKey(
                        {
                          ...key,
                          secret: {
                            mnemonic: secret.mnemonic,
                            passphrase: secret.passphrase
                          }
                        },
                        network as Network
                      )
                    if (extendedKey) {
                      extendedPublicKey = extendedKey
                    }
                  } catch (_error) {
                    // Failed to generate extended public key from mnemonic
                  }
                }
              }

              // If we still don't have a fingerprint, try to extract it from the extended public key
              if (!fingerprint && extendedPublicKey) {
                try {
                  fingerprint = await extractFingerprintFromExtendedPublicKey(
                    extendedPublicKey,
                    network as Network
                  )
                } catch (_error) {
                  // Failed to extract fingerprint from extended public key
                }
              }

              // If we still don't have a fingerprint, try to get it from the key's fingerprint property
              if (!fingerprint && key.fingerprint) {
                fingerprint = key.fingerprint
              }

              if (fingerprint && extendedPublicKey) {
                // Get the correct derivation path for the script version
                const scriptVersion = key.scriptVersion || 'P2WPKH'
                const derivationPath = key.derivationPath || ''

                // Remove leading 'm' or 'M' from derivationPath if present
                const cleanDerivationPath = derivationPath.replace(/^m\/?/i, '')

                // Build the key part with fingerprint and derivation path
                const keyPart = `[${fingerprint}/${cleanDerivationPath}]${extendedPublicKey}`

                // Create single signature descriptor based on script version
                let singleSigDescriptor = ''
                switch (scriptVersion) {
                  case 'P2PKH':
                    singleSigDescriptor = `pkh(${keyPart}/0/*)`
                    break
                  case 'P2SH-P2WPKH':
                    singleSigDescriptor = `sh(wpkh(${keyPart}/0/*))`
                    break
                  case 'P2WPKH':
                    singleSigDescriptor = `wpkh(${keyPart}/0/*)`
                    break
                  case 'P2TR':
                    singleSigDescriptor = `tr(${keyPart}/0/*)`
                    break
                  default:
                    singleSigDescriptor = `wpkh(${keyPart}/0/*)`
                }

                // Add checksum
                const checksum =
                  calculateDescriptorChecksum(singleSigDescriptor)
                if (checksum) {
                  descriptorString = `${singleSigDescriptor}#${checksum}`
                } else {
                  descriptorString = singleSigDescriptor
                }
              } else {
                descriptorString =
                  'No descriptor available - missing fingerprint or extended public key'
              }
            }
          } else if (temporaryAccount.policyType === 'multisig') {
            // For multisig accounts, create proper descriptor with policy-based derivation paths and checksum
            if (!temporaryAccount.keys || temporaryAccount.keys.length === 0) {
              descriptorString = 'No keys available for multisig account'
            } else {
              const scriptVersion =
                temporaryAccount.keys[0]?.scriptVersion || 'P2WSH'
              const keyCount = temporaryAccount.keys.length
              const keysRequired = temporaryAccount.keysRequired || keyCount

              // Extract fingerprints and extended public keys for each key
              const keyData = await Promise.all(
                temporaryAccount.keys.map(async (key, index) => {
                  if (!key)
                    return { fingerprint: '', extendedPublicKey: '', index }

                  const secret = key.secret as Secret
                  let extendedPublicKey = ''
                  let fingerprint = ''

                  // Get fingerprint from secret or key (same pattern as SSMultisigKeyControl)
                  fingerprint =
                    (typeof secret === 'object' && secret.fingerprint) ||
                    key.fingerprint ||
                    ''

                  // Get extended public key from various possible sources (same pattern as SSMultisigKeyControl)
                  if (typeof secret === 'object') {
                    // First, try to get from extendedPublicKey directly
                    if (secret.extendedPublicKey) {
                      extendedPublicKey = secret.extendedPublicKey
                    } else if (secret.externalDescriptor) {
                      // If we have a descriptor, extract the extended public key from it
                      try {
                        const descriptor = await new Descriptor().create(
                          secret.externalDescriptor,
                          network as Network
                        )
                        extendedPublicKey =
                          await extractExtendedKeyFromDescriptor(descriptor)
                      } catch (_error) {
                        // Failed to extract extended public key from descriptor for key ${index}
                      }
                    } else if (secret.mnemonic) {
                      // If we have a mnemonic, generate the extended public key
                      try {
                        const extendedKey =
                          await getExtendedPublicKeyFromAccountKey(
                            {
                              ...key,
                              secret: {
                                mnemonic: secret.mnemonic,
                                passphrase: secret.passphrase
                              }
                            },
                            network as Network
                          )
                        if (extendedKey) {
                          extendedPublicKey = extendedKey
                        }
                      } catch (_error) {
                        // Failed to generate extended public key from mnemonic for key ${index}
                      }
                    }
                  }

                  // If we still don't have a fingerprint, try to extract it from the extended public key
                  if (!fingerprint && extendedPublicKey) {
                    try {
                      fingerprint =
                        await extractFingerprintFromExtendedPublicKey(
                          extendedPublicKey,
                          network as Network
                        )
                    } catch (_error) {
                      // Failed to extract fingerprint from extended public key for key ${index}
                    }
                  }

                  // If we still don't have a fingerprint, try to get it from the key's fingerprint property
                  if (!fingerprint && key.fingerprint) {
                    fingerprint = key.fingerprint
                  }

                  // If we still don't have an extended public key, try to get it from the key's secret
                  if (!extendedPublicKey && typeof secret === 'object') {
                    // Try to extract from externalDescriptor if available
                    if (secret.externalDescriptor) {
                      try {
                        const descriptor = await new Descriptor().create(
                          secret.externalDescriptor,
                          network as Network
                        )
                        extendedPublicKey =
                          await extractExtendedKeyFromDescriptor(descriptor)
                      } catch (_error) {
                        // Failed to extract extended public key from externalDescriptor for key ${index}
                      }
                    }
                  }

                  return { fingerprint, extendedPublicKey, index }
                })
              )

              // Filter out keys that don't have both fingerprint and extended public key
              const validKeyData = keyData.filter(
                (kd) => kd.fingerprint && kd.extendedPublicKey
              )

              if (validKeyData.length !== keyCount) {
                // Missing fingerprint or extended public key for some keys
                // Set a fallback descriptor string to indicate the issue
                descriptorString =
                  'No descriptors available - missing fingerprint or extended public key for some keys'
              } else {
                // Get the correct multisig script type for descriptor generation
                const multisigScriptType =
                  getMultisigScriptTypeFromScriptVersion(scriptVersion)

                // Get the policy-based derivation path according to the account type
                const policyDerivationPath =
                  temporaryAccount.policyType === 'multisig'
                    ? getMultisigDerivationPathFromScriptVersion(
                        multisigScriptType,
                        network
                      )
                    : getDerivationPathFromScriptVersion(scriptVersion, network)

                // Remove leading 'm' or 'M' from derivationPath if present
                const cleanPolicyPath = policyDerivationPath.replace(
                  /^m\/?/i,
                  ''
                )

                // Build key section with policy-based derivation paths
                const keySection = validKeyData
                  .map(({ fingerprint, extendedPublicKey }) => {
                    // Format: [FINGERPRINT/POLICY_DERIVATION_PATH]XPUB/<0;1>/*
                    return `[${fingerprint}/${cleanPolicyPath}]${extendedPublicKey}/<0;1>/*`
                  })
                  .join(',')

                // Create descriptor based on account type
                let finalDescriptor = ''
                if (temporaryAccount.policyType === 'multisig') {
                  // Create multisig descriptor using sortedmulti
                  switch (multisigScriptType) {
                    case 'P2SH':
                      finalDescriptor = `sh(sortedmulti(${keysRequired},${keySection}))`
                      break
                    case 'P2SH-P2WSH':
                      finalDescriptor = `sh(wsh(sortedmulti(${keysRequired},${keySection})))`
                      break
                    case 'P2WSH':
                      finalDescriptor = `wsh(sortedmulti(${keysRequired},${keySection}))`
                      break
                    case 'P2TR':
                      finalDescriptor = `tr(sortedmulti(${keysRequired},${keySection}))`
                      break
                    default:
                      finalDescriptor = `wsh(sortedmulti(${keysRequired},${keySection}))`
                  }
                } else {
                  // For single-sig accounts, create simple descriptor
                  const singleKey = keySection.split(',')[0] // Use first (and only) key
                  switch (scriptVersion) {
                    case 'P2PKH':
                      finalDescriptor = `pkh(${singleKey.replace(
                        '/<0;1>/*',
                        '/0/*'
                      )})`
                      break
                    case 'P2SH-P2WPKH':
                      finalDescriptor = `sh(wpkh(${singleKey.replace(
                        '/<0;1>/*',
                        '/0/*'
                      )}))`
                      break
                    case 'P2WPKH':
                      finalDescriptor = `wpkh(${singleKey.replace(
                        '/<0;1>/*',
                        '/0/*'
                      )})`
                      break
                    case 'P2TR':
                      finalDescriptor = `tr(${singleKey.replace(
                        '/<0;1>/*',
                        '/0/*'
                      )})`
                      break
                    default:
                      finalDescriptor = `wpkh(${singleKey.replace(
                        '/<0;1>/*',
                        '/0/*'
                      )})`
                  }
                }

                // Validate descriptor format before adding checksum
                if (
                  !finalDescriptor ||
                  keySection.split(',').length !== keyCount
                ) {
                  descriptorString = finalDescriptor
                } else {
                  // Always calculate checksum manually for multisig descriptors
                  const checksum = calculateDescriptorChecksum(finalDescriptor)
                  if (checksum) {
                    descriptorString = `${finalDescriptor}#${checksum}`
                  } else {
                    descriptorString = finalDescriptor
                  }
            }
          } else {
            // For watchonly accounts, handle different creation types
            const key = temporaryAccount.keys[0]
            if (!key) {
              descriptorString = 'No key data available for watch-only account'
            } else {
              const secret = key.secret as Secret

              if (
                key.creationType === 'importDescriptor' &&
                secret.externalDescriptor
              ) {
                // For watch-only accounts with imported descriptors, use the existing descriptor
                const descriptor = secret.externalDescriptor

                // Add checksum if not present
                if (!descriptor.includes('#')) {
                  const checksum = calculateDescriptorChecksum(descriptor)
                  if (checksum) {
                    descriptorString = `${descriptor}#${checksum}`
                  } else {
                    descriptorString = descriptor
                  }
                } else {
                  descriptorString = descriptor
                }
              } else if (
                key.creationType === 'importExtendedPub' &&
                secret.extendedPublicKey &&
                secret.fingerprint
              ) {
                // For watch-only accounts with imported extended public keys, generate descriptor
                const scriptVersion = key.scriptVersion || 'P2WPKH'
                const derivationPath = key.derivationPath || ''

                // Remove leading 'm' or 'M' from derivationPath if present
                const cleanDerivationPath = derivationPath.replace(/^m\/?/i, '')

                // Build the key part with fingerprint and derivation path
                const keyPart = `[${secret.fingerprint}/${cleanDerivationPath}]${secret.extendedPublicKey}`

                // Create descriptor based on script version
                let descriptor = ''
                switch (scriptVersion) {
                  case 'P2PKH':
                    descriptor = `pkh(${keyPart}/0/*)`
                    break
                  case 'P2SH-P2WPKH':
                    descriptor = `sh(wpkh(${keyPart}/0/*))`
                    break
                  case 'P2WPKH':
                    descriptor = `wpkh(${keyPart}/0/*)`
                    break
                  case 'P2TR':
                    descriptor = `tr(${keyPart}/0/*)`
                    break
                  default:
                    descriptor = `wpkh(${keyPart}/0/*)`
                }

                // Add checksum
                const checksum = calculateDescriptorChecksum(descriptor)
                if (checksum) {
                  descriptorString = `${descriptor}#${checksum}`
                } else {
                  descriptorString = descriptor
                }
              } else if (
                key.creationType === 'importAddress' &&
                secret.externalDescriptor
              ) {
                // For watch-only accounts with imported addresses, use the address descriptor
                const descriptor = secret.externalDescriptor

                // Add checksum if not present
                if (!descriptor.includes('#')) {
                  const checksum = calculateDescriptorChecksum(descriptor)
                  if (checksum) {
                    descriptorString = `${descriptor}#${checksum}`
                  } else {
                    descriptorString = descriptor
                  }
                } else {
                  descriptorString = descriptor
                }
              } else {
                descriptorString =
                  'No descriptor available for watch-only account - missing required data'
              }
            }
          }
        } else {
          // For importAddress, handle address-based accounts
          const key = temporaryAccount.keys[0]
          if (!key) {
            descriptorString = 'No key data available for imported address'
          } else {
            const secret = key.secret as Secret

            if (secret.externalDescriptor) {
              // Use the existing address descriptor
              const descriptor = secret.externalDescriptor

              // Add checksum if not present
              if (!descriptor.includes('#')) {
                const checksum = calculateDescriptorChecksum(descriptor)
                if (checksum) {
                  descriptorString = `${descriptor}#${checksum}`
                } else {
                  descriptorString = descriptor
                }
              } else {
                descriptorString = descriptor
              }
            } else {
              descriptorString =
                'No descriptor available for imported address - missing address data'
            }
          }
        }
        // --- END: Descriptor Generation Logic ---

        // Compose export content - ensure it's always a string
        const exportString = descriptorString || 'No descriptor available'
        setExportContent(exportString)
      } catch (_error) {
        // Error generating descriptors
        setExportContent(
          'Error generating descriptors. Please check your account configuration.'
        )
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
    const filename = `${t(
      'export.file.name.descriptors'
    )}_${accountId}_${date}.${ext}`
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

  const descriptors = (exportContent || '').split('\n').filter(Boolean)

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
            {t('common.loadingX', { x: 'descriptors...' })}
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
                      {index === 0 ? 'External' : 'Internal'}{' '}
                      {t('common.descriptor')}
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
            {t('account.descriptors.noAvailable')}
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
