import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import Animated from 'react-native-reanimated'
import { toast } from 'sonner-native'

import SSPinInput, { type SSPinInputProps } from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { DURESS_PIN_KEY, PIN_LENGTH_KEY, SALT_KEY } from '@/config/auth'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import useKdfMigration from '@/hooks/useKdfMigration'
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
import { secureWipeAllWalletData } from '@/utils/secureWipe'

type SSPinAuthProps = {
  onFail?: () => void
  onSuccess: () => void
  onTriesOver?: () => void
  maxTries?: number
  resetPin?: boolean
  title?: string
} & Pick<SSPinInputProps, 'feedbackBold' | 'feedbackColor' | 'feedbackText'>

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
  const migrateIfNeeded = useKdfMigration()
  const [pin, setPin] = useState<string[] | null>(null)
  const [tries, setTries] = useState(0)
  const { shakeStyle } = useAnimatedShake()

  // PIN length is persisted at set time; fall back to the legacy default.
  useEffect(() => {
    let mounted = true
    async function loadPinLength() {
      const stored = await getItem(PIN_LENGTH_KEY)
      if (!mounted) {
        return
      }
      const length = clampPinLength(stored ? Number(stored) : Number.NaN)
      setPin((current) => current ?? emptyPin(length))
    }
    loadPinLength()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (resetPin === true) {
      setPin((current) => (current ? emptyPin(current.length) : current))
      setTries(0)
    }
  }, [resetPin])

  async function handleFillEnded(inputPin: string) {
    const hashedPin = await getPin()
    const hashedDuressPin = await getItem(DURESS_PIN_KEY)
    const salt = await getItem(SALT_KEY)
    if (!hashedPin || !salt) {
      toast.error(t('auth.pinRetrieveFailed'))
      return
    }

    // DURESS PIN — wipe secrets/stores so the duress PIN appears as the real PIN.
    // Legacy installs hashed duress against SALT_KEY_DURESS; current installs
    // share SALT_KEY. pinMatchesDuressDigest checks both.
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
      router.push('/')
      return
    }

    const mainKdf = await getStoredKdfConfig()
    const hashedInput = await derivePinDigest(inputPin, salt, mainKdf)

    // Upon failure, the pin reset is already done here
    if (!safeEqualHex(hashedInput, hashedPin)) {
      setPin((current) => (current ? emptyPin(current.length) : current))

      // max tries logic
      const newTries = tries + 1
      setTries(newTries)
      if (maxTries && newTries >= maxTries && onTriesOver) {
        onTriesOver()
      }

      // The fail callback could be show a warning, dismiss a modal, etc...
      if (onFail) {
        onFail()
      }
      return
    }

    // Verified. Upgrade the stored digest to the current best KDF (and
    // re-encrypt all key secrets to it) when it predates it. A migration
    // failure must not lock the user out of this session.
    try {
      await migrateIfNeeded(inputPin, salt, hashedPin)
    } catch {
      /* verified under the old config; migration can retry next unlock */
    }

    // The success callback could be unlock the app, or view mnemonic, or confirm wallet deletion
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
          {title}
        </SSText>
      )}
      <Animated.View style={[{ flex: 1, width: '100%' }, shakeStyle]}>
        {pin !== null && (
          <SSPinInput
            pin={pin}
            setPin={(update) =>
              setPin((current) =>
                current === null
                  ? current
                  : typeof update === 'function'
                    ? update(current)
                    : update
              )
            }
            onFillEnded={handleFillEnded}
            {...props}
          />
        )}
      </Animated.View>
    </SSVStack>
  )
}

export default SSPinAuth
