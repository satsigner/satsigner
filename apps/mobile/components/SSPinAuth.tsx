import { router } from 'expo-router'
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import Animated from 'react-native-reanimated'
import { toast } from 'sonner-native'

import SSPinInput, { type SSPinInputProps } from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { DURESS_PIN_KEY, PIN_LENGTH_KEY, SALT_KEY } from '@/config/auth'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { gray } from '@/styles/colors'
import { clampPinLength, emptyPin, getPin } from '@/utils/pin'
import {
  derivePinDigest,
  getStoredKdfConfig,
  pinMatchesDuressDigest,
  safeEqualHex
} from '@/utils/pinKdf'
import { bindSessionPinDigest } from '@/utils/pinUnlock'
import { secureWipeAllWalletData } from '@/utils/secureWipe'

type SSPinAuthProps = {
  onFail?: () => void
  onSuccess: () => void
  onTriesOver?: () => void
  maxTries?: number
  resetPin?: boolean
  title?: string
} & Pick<SSPinInputProps, 'feedbackBold' | 'feedbackColor' | 'feedbackText'>

function applyPinUpdate(
  update: SetStateAction<string[]>,
  setPin: Dispatch<SetStateAction<string[] | null>>
) {
  setPin((current) => {
    if (current === null) {
      return current
    }
    if (typeof update === 'function') {
      return update(current)
    }
    return update
  })
}

function SSPinAuth({
  title,
  onFail,
  onSuccess,
  onTriesOver,
  maxTries,
  resetPin,
  ...props
}: SSPinAuthProps) {
  const duressPinEnabled = useAuthStore((state) => state.duressPinEnabled)
  const [pin, setPin] = useState<string[] | null>(null)
  const [tries, setTries] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const { shakeStyle } = useAnimatedShake()

  useEffect(() => {
    const load = { cancelled: false }
    async function loadPinLength() {
      const stored = await getItem(PIN_LENGTH_KEY)
      if (load.cancelled) {
        return
      }
      const length = clampPinLength(stored ? Number(stored) : Number.NaN)
      setPin((current) => current ?? emptyPin(length))
    }
    loadPinLength()
    return () => {
      load.cancelled = true
    }
  }, [])

  useEffect(() => {
    if (resetPin === true) {
      setPin((current) => (current ? emptyPin(current.length) : current))
      setTries(0)
    }
  }, [resetPin])

  async function handleFillEnded(inputPin: string) {
    setVerifying(true)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })

    const hashedPin = await getPin()
    const hashedDuressPin = await getItem(DURESS_PIN_KEY)
    const salt = await getItem(SALT_KEY)
    if (!hashedPin || !salt) {
      setVerifying(false)
      toast.error(t('auth.pinRetrieveFailed'))
      return
    }

    if (
      duressPinEnabled &&
      hashedDuressPin &&
      (await pinMatchesDuressDigest(inputPin, hashedDuressPin))
    ) {
      try {
        await secureWipeAllWalletData()
      } catch {
        // Duress wipe is best-effort; always proceed to unlock the app.
      }
      const { setLockTriggered, setJustUnlocked, resetPinTries } =
        useAuthStore.getState()
      setLockTriggered(false)
      setJustUnlocked(true)
      resetPinTries()
      router.dismissAll()
      router.replace('/')
      return
    }

    const mainKdf = await getStoredKdfConfig()
    const hashedInput = await derivePinDigest(inputPin, salt, mainKdf)

    if (!safeEqualHex(hashedInput, hashedPin)) {
      setVerifying(false)
      setPin((current) => (current ? emptyPin(current.length) : current))

      const newTries = tries + 1
      setTries(newTries)
      if (maxTries && newTries >= maxTries && onTriesOver) {
        onTriesOver()
      }

      if (onFail) {
        onFail()
      }
      return
    }

    await bindSessionPinDigest(inputPin, salt, hashedPin)
    onSuccess()
  }

  return (
    <SSVStack
      itemsCenter
      gap={title ? 'lg' : 'none'}
      style={{ flex: 1, width: '100%' }}
    >
      {title && (
        <SSText
          uppercase
          size="lg"
          color="muted"
          center
          style={{ color: gray[300] }}
        >
          {verifying ? t('auth.unlocking') : title}
        </SSText>
      )}
      <Animated.View style={[{ flex: 1, width: '100%' }, shakeStyle]}>
        {pin !== null && (
          <SSPinInput
            pin={pin}
            setPin={(update) => applyPinUpdate(update, setPin)}
            onFillEnded={handleFillEnded}
            {...props}
          />
        )}
      </Animated.View>
    </SSVStack>
  )
}

export default SSPinAuth
