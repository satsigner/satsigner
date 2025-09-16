import { Redirect, Stack, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSMultisigCountSelector from '@/components/SSMultisigCountSelector'
import SSMultisigKeyControl from '@/components/SSMultisigKeyControl'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import { MAX_MULTISIG_KEYS } from '@/config/keys'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'

export default function MultiSigManager() {
  const router = useRouter()

  const [name, keys, keyCount, keysRequired, clearAllKeys] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.name,
        state.keys,
        state.keyCount,
        state.keysRequired,
        state.clearAllKeys
      ])
    )

  const allKeysFilled = useMemo(() => {
    if (!keys || keys.length !== keyCount) {
      return false
    }

    // Check that each key has both fingerprint and public key/descriptor
    const keyValidation = keys.map((key) => {
      if (!key) {
        return false
      }

      // Check for fingerprint in secret or key property
      const hasFingerprint =
        (typeof key.secret === 'object' && key.secret.fingerprint) ||
        key.fingerprint

      if (!hasFingerprint) {
        return false
      }

      // Check if key has either public key, descriptor, or mnemonic
      const hasPublicKey =
        (typeof key.secret === 'object' && key.secret.extendedPublicKey) ||
        (typeof key.secret === 'object' && key.secret.externalDescriptor) ||
        (typeof key.secret === 'object' && key.secret.mnemonic)

      if (!hasPublicKey) {
        return false
      }

      return true
    })

    const allValid = keyValidation.every((valid) => valid)
    return allValid
  }, [keys, keyCount])

  function handleConfirm() {
    router.navigate('/account/add/multiSig/finish')
  }

  function handleCancel() {
    clearAllKeys()
    router.back()
  }

  if (!keyCount || !keysRequired) {
    return <Redirect href="/" />
  }

  return (
    <SSMainLayout style={{ paddingHorizontal: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <SSVStack style={{ flex: 1 }}>
        <ScrollView>
          <SSVStack
            style={{ backgroundColor: '#131313', paddingHorizontal: 16 }}
            gap="md"
          >
            {/* N of M Header */}
            <SSText
              weight="light"
              style={{
                alignSelf: 'center',
                fontSize: 55,
                textTransform: 'lowercase'
              }}
            >
              {keysRequired} {t('common.of')} {keyCount}
            </SSText>

            <SSSignatureRequiredDisplay
              requiredNumber={keysRequired}
              totalNumber={keyCount}
              collectedSignatures={[]}
            />

            <SSText center>{t('account.addOrGenerateKeys')}</SSText>
          </SSVStack>

          <SSVStack
            gap="none"
            style={{ paddingHorizontal: 16, paddingTop: 16 }}
          >
            {Array.from({ length: keyCount }, (_, i) => i).map((index) => {
              return (
                <SSMultisigKeyControl
                  key={index}
                  index={index}
                  keyCount={keyCount}
                  keyDetails={keys[index]}
                />
              )
            })}
          </SSVStack>
          <SSVStack style={{ padding: 16 }}>
            <SSButton
              label={t('common.confirm')}
              variant="secondary"
              disabled={!allKeysFilled}
              onPress={handleConfirm}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={handleCancel}
            />
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </SSMainLayout>
  )
}
