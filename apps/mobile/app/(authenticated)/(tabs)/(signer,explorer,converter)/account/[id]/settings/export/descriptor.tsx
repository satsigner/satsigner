import { Descriptor } from 'bdk-rn'
import { KeychainKind, type Network as BDKNetwork } from 'bdk-rn/lib/lib/enums'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import { PIN_KEY } from '@/config/auth'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type Secret } from '@/types/models/Account'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { getDescriptorsFromKey } from '@/utils/bip32'
import { getDescriptorFromMnemonic } from '@/utils/bip39'
import { getDerivationPathFromScriptVersion } from '@/utils/bitcoin'
import { aesDecrypt } from '@/utils/crypto'
import { shareFile } from '@/utils/filesystem'

export default function DescriptorPage() {
  const { id: accountId, keyIndex } = useLocalSearchParams<
    AccountSearchParams & { keyIndex: string }
  >()

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [descriptor, setDescriptor] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [keyName, setKeyName] = useState('')
  const [creationType, setCreationType] = useState('')
  const [scriptVersion, setScriptVersion] = useState<string>('P2PKH')
  const [_descriptorComponents, setDescriptorComponents] = useState<{
    scriptFunction: string
    fingerprint: string
    derivationPath: string
    publicKey: string
    checksum: string
  } | null>(null)

  // Parse descriptor components for display
  function parseDescriptorComponents(descriptor: string) {
    try {
      // Extract script function (e.g., pkh, sh, wpkh, tr)
      const scriptMatch = descriptor.match(/^([a-z]+)\(/)
      const scriptFunction = scriptMatch ? scriptMatch[1] : ''

      // Extract fingerprint and derivation path
      const fingerprintMatch = descriptor.match(/\[([0-9a-fA-F]{8})\/?/)
      const fingerprint = fingerprintMatch ? fingerprintMatch[1] : ''

      // Extract derivation path - handle both with and without fingerprint
      let derivationPath = ''
      const pathMatch = descriptor.match(/\[[0-9a-fA-F]{8}\/([0-9'/]+)\]/)
      if (pathMatch) {
        derivationPath = `m/${pathMatch[1]}`
      } else {
        // Try to extract path without fingerprint
        const simplePathMatch = descriptor.match(/([0-9'/]+)\/[0-9]+\/\*/)
        if (simplePathMatch) {
          derivationPath = `m/${simplePathMatch[1]}`
        }
      }

      // Extract public key (xpub, ypub, zpub, vpub, etc.)
      const pubKeyMatch = descriptor.match(/([a-z]pub[a-zA-Z0-9]{107})/)
      const publicKey = pubKeyMatch ? pubKeyMatch[1] : ''

      // Extract checksum
      const checksumMatch = descriptor.match(/#([a-z0-9]+)$/)
      const checksum = checksumMatch ? checksumMatch[1] : ''

      return {
        scriptFunction,
        fingerprint,
        derivationPath,
        publicKey,
        checksum
      }
    } catch {
      return null
    }
  }

  useEffect(() => {
    async function getDescriptor() {
      if (!account || !keyIndex) return

      setIsLoading(true)
      const pin = await getItem(PIN_KEY)
      if (!pin) return

      try {
        const keyIndexNum = parseInt(keyIndex, 10)
        const key = account.keys[keyIndexNum]

        if (!key) {
          toast.error('Key not found')
          return
        }

        setKeyName(key.name || `Key ${keyIndexNum + 1}`)
        setCreationType(key.creationType)
        setScriptVersion(key.scriptVersion || 'P2PKH')

        // Decrypt the key's secret
        let decryptedSecret: Secret
        if (typeof key.secret === 'string') {
          const decryptedSecretString = await aesDecrypt(
            key.secret,
            pin,
            key.iv
          )
          decryptedSecret = JSON.parse(decryptedSecretString) as Secret
        } else {
          decryptedSecret = key.secret as Secret
        }

        // Generate descriptor based on creation type
        let descriptorString = ''

        if (
          key.creationType === 'generateMnemonic' ||
          key.creationType === 'importMnemonic'
        ) {
          // First check if we have a stored descriptor
          if (decryptedSecret.externalDescriptor) {
            descriptorString = decryptedSecret.externalDescriptor

            // If the descriptor doesn't have a checksum, add one
            if (descriptorString && !descriptorString.includes('#')) {
              try {
                const descriptor = await new Descriptor().create(
                  descriptorString,
                  network as BDKNetwork
                )
                if (descriptor) {
                  descriptorString = await descriptor.asString()
                }
              } catch {
                // Keep the original descriptor if BDK fails
              }
            }
          } else if (decryptedSecret.mnemonic && key.scriptVersion) {
            descriptorString = getDescriptorFromMnemonic(
              decryptedSecret.mnemonic,
              key.scriptVersion,
              KeychainKind.External,
              decryptedSecret.passphrase,
              account.network as BDKNetwork
            )
          }
        } else if (key.creationType === 'importDescriptor') {
          // For descriptor-based keys, use the stored descriptor and ensure it has checksum
          descriptorString = decryptedSecret.externalDescriptor || ''

          // If the descriptor doesn't have a checksum, add one
          if (descriptorString && !descriptorString.includes('#')) {
            try {
              const descriptor = await new Descriptor().create(
                descriptorString,
                network as BDKNetwork
              )
              if (descriptor) {
                descriptorString = await descriptor.asString()
              }
            } catch {
              // Keep the original descriptor if BDK fails
            }
          }

          // If no stored descriptor, try to reconstruct from public key and script version
          if (!descriptorString && decryptedSecret.extendedPublicKey) {
            const fingerprint = decryptedSecret.fingerprint || ''
            const derivationPath = getDerivationPathFromScriptVersion(
              key.scriptVersion || 'P2WPKH',
              network
            )

            let keyPart = ''
            if (fingerprint && derivationPath) {
              keyPart = `[${fingerprint}/${derivationPath}]${decryptedSecret.extendedPublicKey}/0/*`
            } else {
              keyPart = `${decryptedSecret.extendedPublicKey}/0/*`
            }

            // Add script function based on script version
            switch (key.scriptVersion) {
              case 'P2PKH':
                descriptorString = `pkh(${keyPart})`
                break
              case 'P2SH-P2WPKH':
                descriptorString = `sh(wpkh(${keyPart}))`
                break
              case 'P2WPKH':
                descriptorString = `wpkh(${keyPart})`
                break
              case 'P2TR':
                descriptorString = `tr(${keyPart})`
                break
              case 'P2WSH':
                descriptorString = `wsh(${keyPart})`
                break
              case 'P2SH-P2WSH':
                descriptorString = `sh(wsh(${keyPart}))`
                break
              case 'P2SH':
                descriptorString = `sh(${keyPart})`
                break
              default:
                descriptorString = `wpkh(${keyPart})`
            }

            // Add checksum using BDK
            try {
              const descriptor = await new Descriptor().create(
                descriptorString,
                network as BDKNetwork
              )
              if (descriptor) {
                descriptorString = await descriptor.asString()
              }
            } catch {
              // Keep the descriptor without checksum if BDK fails
            }
          }
        } else if (key.creationType === 'importExtendedPub') {
          // For extended public key-based keys, create a proper descriptor
          if (decryptedSecret.extendedPublicKey) {
            // Get fingerprint from secret
            const fingerprint = decryptedSecret.fingerprint || ''

            if (fingerprint) {
              // Use the getDescriptorsFromKeyData function for better consistency
              try {
                const descriptors = getDescriptorsFromKey(
                  decryptedSecret.extendedPublicKey,
                  fingerprint,
                  key.scriptVersion || 'P2WPKH',
                  network as BDKNetwork
                )
                descriptorString = descriptors.externalDescriptor
              } catch {
                // Fallback: try to construct descriptor manually
                const derivationPath = getDerivationPathFromScriptVersion(
                  key.scriptVersion || 'P2WPKH',
                  network
                )

                // Create proper descriptor with script function and checksum
                let keyPart = ''
                if (fingerprint && derivationPath) {
                  keyPart = `[${fingerprint}/${derivationPath}]${decryptedSecret.extendedPublicKey}/0/*`
                } else {
                  keyPart = `${decryptedSecret.extendedPublicKey}/0/*`
                }

                // Add script function based on script version
                switch (key.scriptVersion) {
                  case 'P2PKH':
                    descriptorString = `pkh(${keyPart})`
                    break
                  case 'P2SH-P2WPKH':
                    descriptorString = `sh(wpkh(${keyPart}))`
                    break
                  case 'P2WPKH':
                    descriptorString = `wpkh(${keyPart})`
                    break
                  case 'P2TR':
                    descriptorString = `tr(${keyPart})`
                    break
                  case 'P2WSH':
                    descriptorString = `wsh(${keyPart})`
                    break
                  case 'P2SH-P2WSH':
                    descriptorString = `sh(wsh(${keyPart}))`
                    break
                  case 'P2SH':
                    descriptorString = `sh(${keyPart})`
                    break
                  default:
                    descriptorString = `wpkh(${keyPart})`
                }

                // Add checksum using BDK
                try {
                  const descriptor = await new Descriptor().create(
                    descriptorString,
                    network as BDKNetwork
                  )
                  if (descriptor) {
                    descriptorString = await descriptor.asString()
                  }
                } catch {
                  // Keep the descriptor without checksum if BDK fails
                }
              }
            } else {
              const keyPart = `${decryptedSecret.extendedPublicKey}/0/*`

              // Add script function based on script version
              switch (key.scriptVersion) {
                case 'P2PKH':
                  descriptorString = `pkh(${keyPart})`
                  break
                case 'P2SH-P2WPKH':
                  descriptorString = `sh(wpkh(${keyPart}))`
                  break
                case 'P2WPKH':
                  descriptorString = `wpkh(${keyPart})`
                  break
                case 'P2TR':
                  descriptorString = `tr(${keyPart})`
                  break
                case 'P2WSH':
                  descriptorString = `wsh(${keyPart})`
                  break
                case 'P2SH-P2WSH':
                  descriptorString = `sh(wsh(${keyPart}))`
                  break
                case 'P2SH':
                  descriptorString = `sh(${keyPart})`
                  break
                default:
                  descriptorString = `wpkh(${keyPart})`
              }

              // Add checksum using BDK
              try {
                const descriptor = await new Descriptor().create(
                  descriptorString,
                  network as BDKNetwork
                )
                if (descriptor) {
                  descriptorString = await descriptor.asString()
                }
              } catch {
                // Keep the descriptor without checksum if BDK fails
              }
            }
          }
        }

        if (!descriptorString) {
          toast.error('Could not generate descriptor')
          return
        }

        setDescriptor(descriptorString)
        const components = parseDescriptorComponents(descriptorString)
        setDescriptorComponents(components)
      } catch {
        toast.error('Failed to get descriptor')
      } finally {
        setIsLoading(false)
      }
    }

    getDescriptor()
  }, [account, keyIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportDescriptor() {
    if (!account) return
    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `Descriptor_${account.name}_${keyName}_${date}.${ext}`
    shareFile({
      filename,
      fileContent: descriptor,
      dialogTitle: t('export.file.save'),
      mimeType: `text/plain`
    })
  }

  if (!account) return <Redirect href="/" />

  return (
    <ScrollView style={{ width: '100%' }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.descriptor.title')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        <SSText center uppercase color="muted">
          {t('account.descriptor.title')}
        </SSText>

        {/* Key Information */}
        {!isLoading && (
          <SSVStack gap="sm" style={{ marginBottom: 20 }}>
            <SSText center color="muted">
              {keyName}
            </SSText>
            <SSText center color="muted" size="sm">
              {t('account.descriptor.creationType', { type: creationType })}
            </SSText>
            <SSText center color="muted" size="sm">
              {t('account.descriptor.scriptVersion', {
                version: scriptVersion
              })}
            </SSText>
          </SSVStack>
        )}

        {/* QR Code */}
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          {isLoading ? (
            <View style={{ height: 250, justifyContent: 'center' }}>
              <SSText center color="muted">
                Loading...
              </SSText>
            </View>
          ) : descriptor ? (
            <View
              style={{
                backgroundColor: 'white',
                padding: 20,
                borderRadius: 10
              }}
            >
              <SSQRCode
                value={descriptor}
                size={250}
                color="black"
                backgroundColor="white"
              />
            </View>
          ) : null}
        </View>

        {/* Descriptor Text */}
        {!isLoading && descriptor && (
          <>
            <View
              style={{
                padding: 10,
                backgroundColor: Colors.gray[950],
                borderRadius: 5
              }}
            >
              <SSText color="white" size="lg" type="mono" selectable>
                {descriptor}
              </SSText>
            </View>

            {/* Action Buttons */}
            <SSClipboardCopy text={descriptor}>
              <SSButton
                label={t('common.copyToClipboard')}
                onPress={() => true}
              />
            </SSClipboardCopy>
            <SSButton
              label={t('common.downloadFile')}
              variant="secondary"
              onPress={exportDescriptor}
            />
          </>
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
