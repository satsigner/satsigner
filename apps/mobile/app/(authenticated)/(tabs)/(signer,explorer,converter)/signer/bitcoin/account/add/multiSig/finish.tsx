import { Stack, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'
import { toast } from 'sonner-native'

import { SSIconSuccess } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import { useMountEffect } from '@/hooks/useMountEffect'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'

const SPINNER_TURN_DURATION_MS = 900

type CreationStatus = 'creating' | 'created' | 'failed'

function CreatingSpinner() {
  const rotation = useSharedValue(0)

  useEffect(() => {
    rotation.set(
      withRepeat(
        withTiming(360, {
          duration: SPINNER_TURN_DURATION_MS,
          easing: Easing.linear
        }),
        -1
      )
    )
    return () => cancelAnimation(rotation)
  }, [rotation])

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }]
  }))

  return (
    <Animated.View style={spinnerStyle}>
      <Svg width="163" height="163" viewBox="0 0 163 163" fill="none">
        <Circle cx="81.5" cy="81.5" r="79.5" stroke="#343434" strokeWidth="3" />
        <Path
          d="M161 81.5C161 125.407 125.407 161 81.5 161"
          stroke="white"
          strokeWidth="3"
        />
      </Svg>
    </Animated.View>
  )
}

export default function ConfirmScreen() {
  const router = useRouter()
  const getAccountData = useAccountBuilderStore((state) => state.getAccountData)
  const { accountBuilderFinish } = useAccountBuilderFinish()
  // Creation writes encrypted secrets back into the builder, so Retry must
  // start again from the keys as they were when this screen opened.
  const [account] = useState(getAccountData)

  const [status, setStatus] = useState<CreationStatus>('creating')
  const [accountId, setAccountId] = useState<string>()

  function failCreation() {
    toast.error(t('multisig.createError'))
    setStatus('failed')
  }

  async function createMultisigWallet() {
    setStatus('creating')
    try {
      const data = await accountBuilderFinish(account)
      if (!data) {
        failCreation()
        return
      }
      setAccountId(data.accountWithEncryptedSecret.id)
      setStatus('created')
    } catch {
      failCreation()
    }
  }

  function handleGoToWallet() {
    if (accountId) {
      router.dismissAll()
      router.navigate(`/signer/bitcoin/account/${accountId}`)
    }
  }

  useMountEffect(() => {
    createMultisigWallet()
  })

  function getStatusText() {
    if (status === 'created') {
      return t('account.multisig.created')
    }
    if (status === 'failed') {
      return t('multisig.createError')
    }
    return t('account.multisig.creating')
  }

  return (
    <SSMainLayout style={{ paddingHorizontal: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {status === 'created'
                ? t('account.multisig.created')
                : t('account.multisig.create')}
            </SSText>
          )
        }}
      />
      <SSVStack
        style={{
          flex: 1,
          paddingBottom: 30,
          paddingHorizontal: 24,
          paddingTop: 80
        }}
        justifyBetween
      >
        <SSVStack>
          <SSText center size="lg">
            {getStatusText()}
          </SSText>
          <SSHStack style={{ alignSelf: 'center', marginTop: 40 }}>
            <View style={{ height: 163, width: 163 }}>
              {status === 'created' && (
                <SSIconSuccess width={159} height={159} />
              )}
              {status === 'creating' && <CreatingSpinner />}
            </View>
          </SSHStack>
        </SSVStack>
        {status === 'created' && (
          <SSVStack>
            <SSButton
              label={t('account.multisig.viewAllWallets')}
              variant="outline"
              uppercase
              onPress={() => router.dismissAll()}
            />
            <SSButton
              label={t('account.multisig.gotoWallet')}
              uppercase
              variant="secondary"
              onPress={handleGoToWallet}
            />
          </SSVStack>
        )}
        {status === 'failed' && (
          <SSVStack>
            <SSButton
              label={t('common.back')}
              variant="outline"
              uppercase
              onPress={() => router.back()}
            />
            <SSButton
              label={t('common.retry')}
              uppercase
              variant="secondary"
              onPress={createMultisigWallet}
            />
          </SSVStack>
        )}
      </SSVStack>
    </SSMainLayout>
  )
}
