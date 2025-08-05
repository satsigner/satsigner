import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getDescriptorsFromKeyData } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type Secret } from '@/types/models/Account'
import { getDerivationPathFromScriptVersion } from '@/utils/bitcoin'
import { shareFile } from '@/utils/filesystem'

export default function DescriptorPage() {
  const { keyIndex } = useLocalSearchParams<{ keyIndex: string }>()
  const router = useRouter()
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const [getAccountData] = useAccountBuilderStore(
    useShallow((state) => [state.getAccountData])
  )

  const [isLoading, setIsLoading] = useState(true)
  const [descriptor, setDescriptor] = useState('')
  const [keyName, setKeyName] = useState('')
  const [creationType, setCreationType] = useState('')
  const [scriptVersion, setScriptVersion] = useState('P2WPKH')

  useEffect(() => {
    async function getDescriptor() {
      if (!keyIndex) return

      setIsLoading(true)

      try {
        const accountData = getAccountData()
        const keyIndexNum = parseInt(keyIndex, 10)
        const key = accountData.keys[keyIndexNum]

        if (!key) {
          toast.error('Key not found')
          return
        }

        setKeyName(key.name || `Key ${keyIndexNum + 1}`)
        setCreationType(key.creationType)
        setScriptVersion(key.scriptVersion || 'P2WPKH')

        // Get descriptor from the key data
        let foundDescriptor = ''
        if (typeof key.secret === 'object') {
          const secret = key.secret as Secret

          if (secret.externalDescriptor) {
            foundDescriptor = secret.externalDescriptor
            setDescriptor(secret.externalDescriptor)
          } else if (secret.internalDescriptor) {
            foundDescriptor = secret.internalDescriptor
            setDescriptor(secret.internalDescriptor)
          } else if (secret.extendedPublicKey && secret.fingerprint) {
            // Generate descriptor from available data (fingerprint, script version, and public key)
            try {
              const descriptors = await getDescriptorsFromKeyData(
                secret.extendedPublicKey,
                secret.fingerprint,
                key.scriptVersion || 'P2WPKH',
                network as Network
              )
              foundDescriptor = descriptors.externalDescriptor
              setDescriptor(descriptors.externalDescriptor)
            } catch (error) {
              console.error(
                'Failed to generate descriptor from key data:',
                error
              )
              // Fallback: try to construct descriptor manually
              const derivationPath = getDerivationPathFromScriptVersion(
                key.scriptVersion || 'P2WPKH',
                network
              )
              const keyPart = `[${secret.fingerprint}/${derivationPath}]${secret.extendedPublicKey}/0/*`

              let externalDescriptor = ''
              switch (key.scriptVersion) {
                case 'P2PKH':
                  externalDescriptor = `pkh(${keyPart})`
                  break
                case 'P2SH-P2WPKH':
                  externalDescriptor = `sh(wpkh(${keyPart}))`
                  break
                case 'P2WPKH':
                  externalDescriptor = `wpkh(${keyPart})`
                  break
                case 'P2TR':
                  externalDescriptor = `tr(${keyPart})`
                  break
                default:
                  externalDescriptor = `wpkh(${keyPart})`
              }

              // Add checksum using BDK
              try {
                const descriptor = await new Descriptor().create(
                  externalDescriptor,
                  network as Network
                )
                foundDescriptor = await descriptor.asString()
                setDescriptor(foundDescriptor)
              } catch (_error) {
                // Keep the descriptor without checksum if BDK fails
                foundDescriptor = externalDescriptor
                setDescriptor(externalDescriptor)
              }
            }
          }
        }

        // Check if we found a descriptor
        if (!foundDescriptor) {
          toast.error('No descriptors available for this key')
        }
      } catch (_error) {
        toast.error('Failed to get descriptor')
      } finally {
        setIsLoading(false)
      }
    }

    getDescriptor()
  }, [keyIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportDescriptor() {
    if (!descriptor) {
      toast.error('No descriptor available')
      return
    }

    const accountData = getAccountData()
    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `Descriptor_${accountData.name}_${keyName}_${date}.${ext}`
    shareFile({
      filename,
      fileContent: descriptor,
      dialogTitle: t('export.file.save'),
      mimeType: `text/plain`
    })
  }

  return (
    <ScrollView style={{ width: '100%' }}>
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
