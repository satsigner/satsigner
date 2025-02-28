import { useRouter } from 'expo-router'
import { useState } from 'react'
import Animated from 'react-native-reanimated'
import { useShallow } from 'zustand/react/shallow'

import SSPinInput from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { PIN_SIZE } from '@/config/auth'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAuthStore } from '@/store/auth'
import { Layout } from '@/styles'

export default function Unlock() {
  const router = useRouter()
  const [
    validatePin,
    setLockTriggered,
    resetPinTries,
    incrementPinTries,
    setFirstTime,
    setRequiresAuth,
    getPagesHistory,
    clearPageHistory
  ] = useAuthStore(
    useShallow((state) => [
      state.validatePin,
      state.setLockTriggered,
      state.resetPinTries,
      state.incrementPinTries,
      state.setFirstTime,
      state.setRequiresAuth,
      state.getPagesHistory,
      state.clearPageHistory
    ])
  )
  const { shake, shakeStyle } = useAnimatedShake()

  const [pin, setPin] = useState<string[]>(Array(PIN_SIZE).fill(''))
  const [triesLeft, setTriesLeft] = useState<number | null>(null)

  function clearPin() {
    setPin(Array(PIN_SIZE).fill(''))
  }

  async function handleOnFillEnded(pinString?: string) {
    const isPinValid = await validatePin(pinString || pin.join(''))
    if (isPinValid) {
      setLockTriggered(false)
      resetPinTries()

      // this pushes the previous page history (before screen was unlocked)
      const pages = getPagesHistory()
      clearPageHistory()
      for (const page of pages) {
        router.push(page as any)
      }
    } else {
      shake()
      clearPin()

      const triesLeft = incrementPinTries()
      if (triesLeft === 0) {
        // TODO: Delete accounts?
        setFirstTime(true)
        setRequiresAuth(false)
        setLockTriggered(false)
        router.replace('/')
        resetPinTries()
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
      <SSVStack itemsCenter justifyBetween style={{ height: '100%' }}>
        <SSVStack gap="lg" itemsCenter style={{ marginTop: '25%' }}>
          <SSText uppercase size="lg" color="muted" center>
            {t('auth.unlock')}
          </SSText>
          <Animated.View style={shakeStyle}>
            <SSPinInput
              pin={pin}
              setPin={setPin}
              autoFocus
              onFillEnded={handleOnFillEnded}
            />
          </Animated.View>
          {triesLeft !== null && (
            <SSText uppercase color="muted" center>
              {triesLeft}{' '}
              {triesLeft > 1 ? t('auth.triesLeft') : t('auth.tryLeft')}
            </SSText>
          )}
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
