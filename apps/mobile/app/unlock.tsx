import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSPinEntry from '@/components/SSPinEntry'
import { DURESS_PIN_KEY, PIN_KEY, PIN_SIZE, SALT_KEY } from '@/config/auth'
import SSMainLayout from '@/layouts/SSMainLayout'
import { deleteItem, getItem, setItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { useWalletsStore } from '@/store/wallets'
import { Layout } from '@/styles'
import { pbkdf2Encrypt } from '@/utils/crypto'

export default function Unlock() {
  const router = useRouter()
  const [
    setLockTriggered,
    resetPinTries,
    incrementPinTries,
    setFirstTime,
    setRequiresAuth,
    setJustUnlocked
  ] = useAuthStore(
    useShallow((state) => [
      state.setLockTriggered,
      state.resetPinTries,
      state.incrementPinTries,
      state.setFirstTime,
      state.setRequiresAuth,
      state.setJustUnlocked
    ])
  )
  const showWarning = useSettingsStore((state) => state.showWarning)
  const deleteAccounts = useAccountsStore((state) => state.deleteAccounts)
  const deleteWallets = useWalletsStore((state) => state.deleteWallets)

  const [pin, setPin] = useState<string[]>(Array(PIN_SIZE).fill(''))

  function clearPin() {
    setPin(Array(PIN_SIZE).fill(''))
  }

  async function handleOnFillEnded(pin: string) {
    const salt = await getItem(SALT_KEY)
    const storedEncryptedPin = await getItem(PIN_KEY)
    const storedEncryptedDuressPin = await getItem(DURESS_PIN_KEY)
    if (!salt || !storedEncryptedPin) return // TODO: handle error

    const encryptedPin = await pbkdf2Encrypt(pin, salt)
    const isPinValid =
      encryptedPin === storedEncryptedPin ||
      encryptedPin === storedEncryptedDuressPin

    if (encryptedPin === storedEncryptedDuressPin) {
      deleteAccounts()

      // delete evidence there existed a duress pin,
      // acting as if the duress pin was the true pin
      deleteItem(DURESS_PIN_KEY)
      setItem(PIN_KEY, storedEncryptedDuressPin)
    }

    if (isPinValid) {
      setLockTriggered(false)
      setJustUnlocked(true)
      resetPinTries()

      // TODO: Deactivated this for now
      // Note: Take into account that we don't persist account build
      // We had a problem with pages = ["/", "/account/add/", "/account/add/(common)/confirm/0/word/11"]
      // This pushes the previous page history (before screen was unlocked)
      // const pages = getPagesHistory()
      // clearPageHistory()
      // for (const page of pages) {
      //   router.push(page as any)
      // }
      if (showWarning) router.push('./warning')
      else router.push('/')
    } else {
      clearPin()

      const triesLeft = incrementPinTries()
      if (triesLeft === 0) {
        deleteAccounts()
        deleteWallets()
        setFirstTime(true)
        setRequiresAuth(false)
        setLockTriggered(false)
        router.replace('/')
        resetPinTries()
      }
    }
  }

  return (
    <SSMainLayout
      style={{
        paddingBottom: Layout.mainContainer.paddingBottom,
        paddingTop: '25%'
      }}
    >
      <SSPinEntry pin={pin} setPin={setPin} onFillEnded={handleOnFillEnded} />
    </SSMainLayout>
  )
}
