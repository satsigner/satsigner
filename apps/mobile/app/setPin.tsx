import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Platform } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconCheckCircleThin, SSIconCircleXThin } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSPinInput from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { DEFAULT_PIN, PIN_KEY, PIN_SIZE, SALT_KEY } from '@/config/auth'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem, setItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { Layout } from '@/styles'
import { type Secret } from '@/types/models/Account'
import {
  aesDecrypt,
  aesEncrypt,
  generateSalt,
  pbkdf2Encrypt
} from '@/utils/crypto'

type Stage = 'set' | 're-enter'

export default function SetPin() {
  const router = useRouter()
  const [setFirstTime, setRequiresAuth] = useAuthStore(
    useShallow((state) => [state.setFirstTime, state.setRequiresAuth])
  )
  const [accounts, updateAccount] = useAccountsStore(
    useShallow((state) => [state.accounts, state.updateAccount])
  )
  const showWarning = useSettingsStore((state) => state.showWarning)

  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>('set')

  const [pinArray, setPinArray] = useState<string[]>(Array(PIN_SIZE).fill(''))
  const [confirmationPinArray, setConfirmationPinArray] = useState<string[]>(
    Array(PIN_SIZE).fill('')
  )

  const pinFilled = pinArray.findIndex((text) => text === '') === -1
  const confirmationPinFilled =
    confirmationPinArray.findIndex((text) => text === '') === -1
  const pinsMatch = pinArray.join('') === confirmationPinArray.join('')

  async function setPin(pin: string) {
    const oldPin = await getItem(PIN_KEY)
    const salt = await generateSalt()
    const encryptedPin = await pbkdf2Encrypt(pin, salt)
    await setItem(PIN_KEY, encryptedPin)
    await setItem(SALT_KEY, salt)

    // there is no old pin, so re-encrypting account secrets is not required
    if (!oldPin) {
      return
    }

    // for each account, update re-encrypt each of its secret with new PIN
    for (const account of accounts) {
      // make copy of objects and arrays to avoid directly mutation of store
      const updatedAccount = { ...account }
      updatedAccount.keys = [...account.keys]

      for (let k = 0; k < account.keyCount; k += 1) {
        const key = account.keys[k]

        // get the secret currently encrypted using old PIN
        let secret: Secret | undefined
        if (typeof key.secret === 'string') {
          const decryptedSecretString = await aesDecrypt(
            key.secret,
            pin,
            key.iv
          )
          secret = JSON.parse(decryptedSecretString) as Secret
        } else {
          secret = key.secret
        }

        // encrypt secret with new pin
        const serializedSecret = JSON.stringify(secret)
        const newSecret = await aesEncrypt(serializedSecret, oldPin, key.iv)

        // update secret while avoiding mutating nested objects in store
        updatedAccount.keys[k] = {
          ...account.keys[k],
          secret: newSecret
        }
      }

      // update store
      updateAccount(updatedAccount)
    }
  }

  async function handleSetPinLater() {
    setFirstTime(false)

    // use default pin if none is set
    const currentPin = await getItem(PIN_KEY)
    if (!currentPin) {
      await setPin(DEFAULT_PIN)
    }

    // Let us clear the history to prevent the user from going back to Set Pin
    // screen by pressing 'back' button. Otherwise, pressing 'back' will show
    // the Set Pin and this is not desirable UX.
    router.dismissAll()

    if (showWarning) router.navigate('./warning')
    else router.navigate('/')
  }

  async function handleConfirmPin() {
    setStage('re-enter')
  }

  function clearPin() {
    setPinArray(Array(PIN_SIZE).fill(''))
  }

  function clearConfirmationPin() {
    setConfirmationPinArray(Array(PIN_SIZE).fill(''))
  }

  async function handleSetPin() {
    if (pinArray.join('') !== confirmationPinArray.join('')) return
    setLoading(true)
    await setPin(pinArray.join(''))
    setLoading(false)

    if (showWarning) router.push('./warning')
    else router.replace('/')

    setFirstTime(false)
    setRequiresAuth(true)
  }

  async function handleGoBack() {
    clearPin()
    clearConfirmationPin()
    setStage('set')
  }

  return (
    <SSMainLayout
      style={{
        paddingBottom: Layout.mainContainer.paddingBottom,
        paddingTop: '20%'
      }}
    >
      <SSVStack style={{ height: '100%' }} itemsCenter justifyBetween>
        <SSVStack gap="lg" style={{ marginTop: '10%' }}>
          <SSVStack style={{ gap: Platform.OS === 'android' ? -8 : 0 }}>
            <SSText uppercase size="lg" color="muted" center>
              {stage === 'set'
                ? t('auth.setPinTitle')
                : t('auth.reenterPinTitle')}
            </SSText>
          </SSVStack>
          {stage === 'set' && (
            <SSPinInput pin={pinArray} setPin={setPinArray} />
          )}
          {stage === 're-enter' && (
            <SSPinInput
              pin={confirmationPinArray}
              setPin={setConfirmationPinArray}
            />
          )}
          {confirmationPinFilled && pinsMatch && (
            <SSVStack itemsCenter gap="sm">
              <SSIconCheckCircleThin height={40} width={40} />
              <SSText uppercase size="lg" color="muted" center>
                {t('auth.pinsMatch')}
              </SSText>
            </SSVStack>
          )}
          {confirmationPinFilled && !pinsMatch && (
            <SSVStack itemsCenter gap="sm">
              <SSIconCircleXThin height={40} width={40} />
              <SSText uppercase size="lg" color="muted" center>
                {t('auth.pinsDontMatch')}
              </SSText>
            </SSVStack>
          )}
        </SSVStack>
        <SSVStack widthFull>
          {stage === 'set' && pinFilled && (
            <SSButton
              label={t('auth.confirmPin')}
              variant="secondary"
              onPress={() => handleConfirmPin()}
            />
          )}
          {stage === 're-enter' && confirmationPinFilled && pinsMatch && (
            <SSButton
              label={t('auth.setPin')}
              variant="secondary"
              loading={loading}
              onPress={() => handleSetPin()}
            />
          )}
          {stage === 'set' && !pinFilled && (
            <SSButton
              label={t('auth.setPinLater')}
              variant="ghost"
              onPress={() => handleSetPinLater()}
            />
          )}
          {stage === 'set' && pinFilled && (
            <SSButton
              label={t('common.clear')}
              variant="ghost"
              onPress={() => clearPin()}
            />
          )}
          {stage === 're-enter' && !confirmationPinFilled && (
            <SSButton
              label={t('common.goBack')}
              variant="ghost"
              onPress={() => handleGoBack()}
            />
          )}
          {stage === 're-enter' && confirmationPinFilled && (
            <SSButton
              label={t('common.clear')}
              variant="ghost"
              onPress={() => clearConfirmationPin()}
            />
          )}
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
