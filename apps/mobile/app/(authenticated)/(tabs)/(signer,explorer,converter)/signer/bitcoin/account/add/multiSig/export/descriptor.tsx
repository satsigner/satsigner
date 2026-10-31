import { useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { ScrollView, View, type ViewInstance } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSShareableQR from '@/components/SSShareableQR'
import SSShareButton from '@/components/SSShareButton'
import SSText from '@/components/SSText'
import { useAsyncEffect } from '@/hooks/useAsyncEffect'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { shareFile } from '@/utils/filesystem'
import { getOutputDescriptorStringForKey } from '@/utils/getOutputDescriptorForKey'

export default function DescriptorPage() {
  const { keyIndex } = useLocalSearchParams<{ keyIndex: string }>()
  const router = useRouter()
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const keyIndexNum = Number.parseInt(keyIndex, 10)
  const [accountName, key] = useAccountBuilderStore(
    useShallow((state) => [state.name, state.keys[keyIndexNum]])
  )

  const [isLoading, setIsLoading] = useState(true)
  const [descriptor, setDescriptor] = useState('')
  const qrRef = useRef<ViewInstance>(null)

  const keyName = key?.name || `Key ${keyIndexNum + 1}`

  async function getDescriptor() {
    if (!key) {
      toast.error('Key not found')
      return
    }

    const descriptorString =
      typeof key.secret === 'object'
        ? await getOutputDescriptorStringForKey(key, key.secret, network)
        : ''
    if (!descriptorString) {
      toast.error('No descriptors available for this key')
      return
    }
    setDescriptor(descriptorString)
  }

  useAsyncEffect(async () => {
    setIsLoading(true)
    try {
      await getDescriptor()
    } catch {
      toast.error('Failed to get descriptor')
    }
    setIsLoading(false)
  }, [key, network])

  function exportDescriptor() {
    if (!descriptor) {
      toast.error('No descriptor available')
      return
    }

    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `Descriptor_${accountName}_${keyName}_${date}.${ext}`
    shareFile({
      dialogTitle: t('export.file.save'),
      fileContent: descriptor,
      filename,
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
              {t('account.descriptor.creationType', {
                type: key?.creationType
              })}
            </SSText>
            <SSText center color="muted" size="sm">
              {t('account.descriptor.scriptVersion', {
                version: key?.scriptVersion
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
            <SSShareableQR
              qrRef={qrRef}
              value={descriptor}
              size={250}
              color="black"
              backgroundColor="white"
              containerStyle={{
                backgroundColor: 'white',
                borderRadius: 10,
                padding: 20
              }}
              hideShareButton
            />
          ) : null}
        </View>

        {/* Descriptor Text */}
        {!isLoading && descriptor && (
          <>
            <View
              style={{
                backgroundColor: Colors.gray[950],
                borderRadius: 5,
                padding: 10
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
            <SSShareButton qrRef={qrRef} />
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
