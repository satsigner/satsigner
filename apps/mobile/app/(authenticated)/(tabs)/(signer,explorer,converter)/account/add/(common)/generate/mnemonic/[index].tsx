import { KeychainKind, type Network } from 'bdk-rn/lib/lib/enums'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { getDescriptorObject, parseDescriptor } from '@/api/bdk'
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
import { getDescriptorsFromKey } from '@/utils/bip32'
import {
  getFingerprintFromMnemonic,
  validateMnemonic
} from '@/utils/bip39'
import {
  getDerivationPathFromScriptVersion,
  getMultisigDerivationPathFromScriptVersion
} from '@/utils/bitcoin'

export default function GenerateMnemonic() {
  const { index } = useLocalSearchParams<GenerateMnemonicSearchParams>()
  const router = useRouter()
  const [
    name,
    mnemonic,
    mnemonicList,
    mnemonicWordCount,
    mnemonicWordList,
    fingerprint,
    policyType,
    scriptVersion,
    passphrase,
    setPassphrase,
    setFingerprint,
    setKey,
    setKeyDerivationPath,
    setExtendedPublicKey,
    setExternalDescriptor,
    setInternalDescriptor
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.mnemonic,
      state.mnemonic.split(' '),
      state.mnemonicWordCount,
      state.mnemonicWordList,
      state.fingerprint,
      state.policyType,
      state.scriptVersion,
      state.passphrase,
      state.setPassphrase,
      state.setFingerprint,
      state.setKey,
      state.setKeyDerivationPath,
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

    const validMnemonic = validateMnemonic(mnemonic, mnemonicWordList)
    setChecksumValid(validMnemonic)

    if (checksumValid) {
      const fingerprint = getFingerprintFromMnemonic(
        mnemonic,
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
    // Extract derivation path from mnemonic
    let derivationPath = ''

    if (policyType === 'multisig') {
      // For multisig accounts, always use our multisig derivation path logic
      // Don't try to extract from BDK descriptors as they use single-sig paths
      const rawDerivationPath = getMultisigDerivationPathFromScriptVersion(
        scriptVersion,
        network
      )
      derivationPath = `m/${rawDerivationPath}`

      // Generate extended public key first using the same method as import flow
      const extendedPublicKey = getExtendedPublicKeyFromMnemonic(
        mnemonic,
        passphrase || '',
        network as Network,
        scriptVersion
      )

      // Generate descriptors from the key data
      if (extendedPublicKey && fingerprint) {
        try {
          const descriptors = getDescriptorsFromKey(
            extendedPublicKey,
            fingerprint,
            scriptVersion,
            network as Network,
            policyType === 'multisig' // Pass multisig flag
          )

          // Set global state values so setKey includes them
          setExtendedPublicKey(extendedPublicKey)
          setExternalDescriptor(descriptors.externalDescriptor)
          setInternalDescriptor(descriptors.internalDescriptor)
        } catch {
          // Continue without descriptors if generation fails
          setExtendedPublicKey(extendedPublicKey)
        }
      }
    } else {
      // For single-sig accounts, try to extract from BDK descriptor first
      try {
        const externalDescriptor = await getDescriptorObject(
          mnemonic,
          scriptVersion, // Use the script version from store
          KeychainKind.External,
          passphrase || '', // Use passphrase from store
          network as Network
        )
        const parsedDescriptor = await parseDescriptor(externalDescriptor)
        derivationPath = parsedDescriptor.derivationPath
        // TODO: remove try/catch
      } catch (_error) {
        // Use default derivation path if extraction fails
        const rawDerivationPath = getDerivationPathFromScriptVersion(
          scriptVersion,
          network
        )
        derivationPath = `m/${rawDerivationPath}`
      }
    }

    // Create the key with all the data
    setKey(Number(index))

    // Set the derivation path for this key
    setKeyDerivationPath(Number(index), derivationPath)

    router.navigate(`/account/add/confirm/${index}/word/0`)
  }

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
                    value={mnemonic ? mnemonicList[index] : ''}
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
