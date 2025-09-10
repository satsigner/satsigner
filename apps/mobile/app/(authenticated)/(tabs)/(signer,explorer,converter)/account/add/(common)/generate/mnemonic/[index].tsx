import { type Network } from 'bdk-rn/lib/lib/enums'
import { KeychainKind } from 'bdk-rn/lib/lib/enums'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import {
  getDescriptor,
  getDescriptorsFromKeyData,
  getExtendedPublicKeyFromAccountKey,
  getFingerprint,
  parseDescriptor,
  validateMnemonic
} from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSChecksumStatus from '@/components/SSChecksumStatus'
import SSFingerprint from '@/components/SSFingerprint'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSWordInput from '@/components/SSWordInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { type GenerateMnemonicSearchParams } from '@/types/navigation/searchParams'
import { convertMnemonic } from '@/utils/bip39'
import { getDerivationPathFromScriptVersion } from '@/utils/bitcoin'

export default function GenerateMnemonic() {
  const { index } = useLocalSearchParams<GenerateMnemonicSearchParams>()
  const router = useRouter()
  const [
    name,
    originalMnemonic,
    mnemonicWordCount,
    mnemonic,
    fingerprint,
    policyType,
    scriptVersion,
    passphrase,
    setPassphrase,
    setFingerprint,
    setKey,
    setKeyDerivationPath,
    _updateKeySecret,
    setExtendedPublicKey,
    setExternalDescriptor,
    setInternalDescriptor
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.mnemonic,
      state.mnemonicWordCount,
      convertMnemonic(state.mnemonic, state.mnemonicWordList).split(' '),
      state.fingerprint,
      state.policyType,
      state.scriptVersion,
      state.passphrase,
      state.setPassphrase,
      state.setFingerprint,
      state.setKey,
      state.setKeyDerivationPath,
      state.updateKeySecret,
      state.setExtendedPublicKey,
      state.setExternalDescriptor,
      state.setInternalDescriptor
    ])
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [checksumValid, setChecksumValid] = useState(true)

  // TODO: Debounce this
  async function handleUpdatePassphrase(passphrase: string) {
    setPassphrase(passphrase)

    const validMnemonic = await validateMnemonic(originalMnemonic)
    setChecksumValid(validMnemonic)

    if (checksumValid) {
      const fingerprint = await getFingerprint(
        originalMnemonic,
        passphrase,
        network as Network
      )
      setFingerprint(fingerprint)
    }
  }

  function handleOnPressCancel() {
    if (policyType === 'multisig') router.back()
    else if (policyType === 'singlesig') router.dismissAll()
  }

  async function handleOnPressConfirm() {
    try {
      // Extract derivation path from mnemonic
      let derivationPath = ''
      try {
        const externalDescriptor = await getDescriptor(
          originalMnemonic,
          scriptVersion, // Use the script version from store
          KeychainKind.External,
          passphrase || '', // Use passphrase from store
          network as Network
        )
        const parsedDescriptor = await parseDescriptor(externalDescriptor)
        derivationPath = parsedDescriptor.derivationPath
      } catch (_error) {
        // Use default derivation path if extraction fails
        derivationPath = `m/${getDerivationPathFromScriptVersion(
          scriptVersion,
          network
        )}`
      }

      // Generate extended public key first
      const extendedPublicKey = await getExtendedPublicKeyFromAccountKey(
        {
          index: Number(index),
          name: '',
          creationType: 'generateMnemonic',
          mnemonicWordCount,
          secret: {
            mnemonic: originalMnemonic,
            passphrase,
            fingerprint
          },
          iv: '',
          scriptVersion,
          fingerprint
        },
        network as Network
      )

      // Generate descriptors from the key data
      if (extendedPublicKey && fingerprint) {
        try {
          const descriptors = await getDescriptorsFromKeyData(
            extendedPublicKey,
            fingerprint,
            scriptVersion,
            network as Network
          )

          // Set global state values so setKey includes s
          setExtendedPublicKey(extendedPublicKey)
          setExternalDescriptor(descriptors.externalDescriptor)
          setInternalDescriptor(descriptors.internalDescriptor)
        } catch (_error) {
          // Continue without descriptors if generation fails
          setExtendedPublicKey(extendedPublicKey)
        }
      }

      // Create the key with all the data
      setKey(Number(index))

      // Set the derivation path for this key
      setKeyDerivationPath(Number(index), derivationPath)

      router.navigate(`/account/add/confirm/${index}/word/0`)
    } catch (_error) {
      // Handle error silently
    }
  }

  if (mnemonic.length !== mnemonicWordCount) return <Redirect href="/" />

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack justifyBetween>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.mnemonic.title')} />
              <SSSeedLayout count={mnemonicWordCount}>
                {[...Array(mnemonicWordCount)].map((_, index) => (
                  <SSWordInput
                    key={index}
                    position={index + 1}
                    value={mnemonic ? mnemonic[index] : ''}
                    editable={false}
                    index={index}
                  />
                ))}
              </SSSeedLayout>
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label
                label={`${t('bitcoin.passphrase')} (${t('common.optional')})`}
              />
              <SSTextInput
                onChangeText={(text) => handleUpdatePassphrase(text)}
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSHStack justifyBetween>
                <SSChecksumStatus valid={checksumValid} />
                {fingerprint && <SSFingerprint value={fingerprint} />}
              </SSHStack>
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSVStack>
            <SSButton
              label={t('account.confirmSeed.title')}
              variant="secondary"
              disabled={!checksumValid}
              onPress={handleOnPressConfirm}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={handleOnPressCancel}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
