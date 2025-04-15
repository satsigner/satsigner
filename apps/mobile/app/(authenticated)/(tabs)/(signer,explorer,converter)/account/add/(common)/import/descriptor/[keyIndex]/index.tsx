import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { extractExtendedKeyFromDescriptor, parseDescriptor } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { type ImportDescriptorSearchParams } from '@/types/navigation/searchParams'

export default function ImportDescriptor() {
  const { keyIndex } = useLocalSearchParams<ImportDescriptorSearchParams>()
  const router = useRouter()
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [loading, setLoading] = useState(false)
  const [localDescriptor, setLocalDescriptor] = useState('')

  const [
    setKey,
    setExternalDescriptor,
    updateKeyFingerprint,
    setKeyDerivationPath,
    setExtendedPublicKey,
    clearKeyState
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.setKey,
      state.setExternalDescriptor,
      state.updateKeyFingerprint,
      state.setKeyDerivationPath,
      state.setExtendedPublicKey,
      state.clearKeyState
    ])
  )

  async function handleOnPressPaste() {
    const text = await Clipboard.getStringAsync()
    setLocalDescriptor(text)
  }

  async function handleOnPressConfirm() {
    setLoading(true)
    const descriptor = await new Descriptor().create(
      localDescriptor,
      network as Network
    )
    const { fingerprint, derivationPath } = await parseDescriptor(descriptor)
    const extendedKey = await extractExtendedKeyFromDescriptor(descriptor)

    setExternalDescriptor(localDescriptor)
    setExtendedPublicKey(extendedKey)
    setKey(Number(keyIndex))
    updateKeyFingerprint(Number(keyIndex), fingerprint)
    setKeyDerivationPath(Number(keyIndex), derivationPath)
    clearKeyState()

    setLoading(false)
    router.dismiss(2)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.import.descriptor')}</SSText>
          )
        }}
      />
      <ScrollView>
        <SSVStack justifyBetween>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('common.descriptor')} />
              <SSTextInput
                align="left"
                style={{
                  height: 300,
                  verticalAlign: 'top',
                  paddingVertical: 16
                }}
                multiline
                numberOfLines={10}
                value={localDescriptor}
                onChangeText={setLocalDescriptor}
              />
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSButton label={t('common.paste')} onPress={handleOnPressPaste} />
          <SSButton label={t('camera.scanQRCode')} onPress={() => {}} />
          <SSButton
            variant="outline"
            label={t('account.import.fromOtherWallet')}
            onPress={() =>
              router.push(
                `/account/add/import/descriptor/${keyIndex}/fromAccount`
              )
            }
          />
          <SSButton
            label={t('common.confirm')}
            variant="secondary"
            loading={loading}
            onPress={handleOnPressConfirm}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => router.back()}
          />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
