import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import Animated from 'react-native-reanimated'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSPinInput, { type SSPinInputProps } from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import {
  DURESS_KDF_KEY,
  DURESS_PIN_KEY,
  PIN_LENGTH_KEY,
  SALT_KEY
} from '@/config/auth'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import useKdfMigration from '@/hooks/useKdfMigration'
import SSVStack from '@/layouts/SSVStack'
import { deleteItem, getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useWalletsStore } from '@/store/wallets'
import { gray } from '@/styles/colors'
import { getPin } from '@/utils/crypto'
import { clampPinLength, emptyPin } from '@/utils/pin'
import {
  derivePinDigest,
  getStoredKdfConfig,
  safeEqualHex
} from '@/utils/pinKdf'

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
  const [duressPinEnabled, setDuressPinEnabled] = useAuthStore(
    useShallow((state) => [state.duressPinEnabled, state.setDuressPinEnabled])
  )
  const [deleteAccounts, deleteTags] = useAccountsStore(
    useShallow((state) => [state.deleteAccounts, state.deleteTags])
  )
  const deleteWallets = useWalletsStore((state) => state.deleteWallets)
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
      toast.error('Failed to retrieve PIN for authentication')
      return
    }

    // DURESS PIN (verified under its own stored KDF config)
    if (duressPinEnabled && hashedDuressPin) {
      const duressKdf = await getStoredKdfConfig(DURESS_KDF_KEY)
      const duressInput = await derivePinDigest(inputPin, salt, duressKdf)
      if (safeEqualHex(duressInput, hashedDuressPin)) {
        // erase data
        deleteAccounts()
        deleteWallets()
        deleteTags()

        // delete evidence there existed a duress pin in the first place,
        // acting as if the duress pin was the true pin
        setDuressPinEnabled(false)
        await deleteItem(DURESS_PIN_KEY)

        // reset route
        router.dismissAll()
        router.push('/')
        return
      }
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
