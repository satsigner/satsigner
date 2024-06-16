import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import Animated from 'react-native-reanimated'

import SSPinInput from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { PIN_SIZE } from '@/config/auth'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAuthStore } from '@/store/auth'
import { Layout } from '@/styles'

export default function Init() {
  const router = useRouter()
  const authStore = useAuthStore()
  const { shake, shakeStyle } = useAnimatedShake()

  const [pin, setPin] = useState<string[]>(Array(PIN_SIZE).fill(''))
  const [triesLeft, setTriesLeft] = useState<number | null>(null)

  function clearPin() {
    setPin(Array(PIN_SIZE).fill(''))
  }

  async function handleOnFillEnded() {
    const isPinValid = await authStore.validatePin(pin.join(''))
    if (isPinValid) {
      authStore.setLockTriggered(false)
      authStore.resetPinTries()
      router.replace('/')
    } else {
      shake()
      clearPin()

      const triesLeft = authStore.incrementPinTries()
      if (triesLeft === 0) {
        // TODO: Delete accounts?
        authStore.setFirstTime(true)
        authStore.setRequiresAuth(false)
        authStore.setLockTriggered(false)
        router.replace('/')
        authStore.resetPinTries()
        return
      }

      setTriesLeft(triesLeft)
    }
  }

  return (
    <SSMainLayout
      style={{
        paddingBottom: Layout.mainContainer.paddingBottom,
        paddingTop: '25%'
      }}
    >
      <SSVStack style={{ height: '100%' }} itemsCenter justifyBetween>
        <SSVStack gap="lg" style={{ marginTop: '25%' }}>
          <SSText uppercase size="lg" color="muted" center>
            {i18n.t('auth.unlock')}
          </SSText>
          <Animated.View style={shakeStyle}>
            <SSPinInput
              pin={pin}
              setPin={setPin}
              onFillEnded={() => handleOnFillEnded()}
            />
          </Animated.View>
          {triesLeft !== null && (
            <SSText uppercase color="muted" center>
              {triesLeft} {i18n.t('auth.triesLeft')}
            </SSText>
          )}
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
