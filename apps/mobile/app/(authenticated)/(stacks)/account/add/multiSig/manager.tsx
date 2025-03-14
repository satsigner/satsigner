import { Redirect, Stack, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSMultisigCountSelector from '@/components/SSMultisigCountSelector'
import SSMultisigKeyControl from '@/components/SSMultisigKeyControl'
import SSText from '@/components/SSText'
import { MAX_MULTISIG_KEYS } from '@/config/keys'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'

export default function MultiSigManager() {
  const router = useRouter()

  const [name, keys, keyCount, keysRequired] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.keys,
      state.keyCount,
      state.keysRequired
    ])
  )

  const allKeysFilled = useMemo(
    () => keys?.length === keyCount,
    [keys, keyCount]
  )

  if (!keyCount || !keysRequired) return <Redirect href="/" />

  return (
    <SSMainLayout style={{ paddingHorizontal: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <SSVStack style={{ flex: 1 }}>
        <SSVStack
          style={{ backgroundColor: '#131313', paddingHorizontal: 16 }}
          gap="md"
        >
          <SSMultisigCountSelector
            maxCount={MAX_MULTISIG_KEYS}
            requiredNumber={keysRequired}
            totalNumber={keyCount}
            viewOnly
          />
          <SSText center>{t('account.addOrGenerateKeys')}</SSText>
        </SSVStack>
        <ScrollView>
          <SSVStack gap="none">
            {Array.from({ length: keyCount }, (_, i) => i).map((index) => (
              <SSMultisigKeyControl
                key={index}
                isBlackBackground={index % 2 === 0}
                index={index}
                keyCount={keyCount}
                keyDetails={keys[index]}
              />
            ))}
          </SSVStack>
          <SSVStack style={{ padding: 16 }}>
            <SSButton
              label={t('common.confirm')}
              variant="secondary"
              disabled={!allKeysFilled}
              onPress={() => router.navigate('/account/add/multiSig/finish')}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => router.back()}
            />
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </SSMainLayout>
  )
}
