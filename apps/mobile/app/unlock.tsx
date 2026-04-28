import { useRouter } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import SSPinAuth from '@/components/SSPinAuth'
import SSMainLayout from '@/layouts/SSMainLayout'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { useWalletsStore } from '@/store/wallets'
import { Colors, Layout } from '@/styles'
import { error, gray, warning } from '@/styles/colors'

export default function Unlock() {
  const router = useRouter()
  const [
    setLockTriggered,
    resetPinTries,
    incrementPinTries,
    setFirstTime,
    setRequiresAuth,
    setJustUnlocked,
    pinTries,
    pinMaxTries
  ] = useAuthStore(
    useShallow((state) => [
      state.setLockTriggered,
      state.resetPinTries,
      state.incrementPinTries,
      state.setFirstTime,
      state.setRequiresAuth,
      state.setJustUnlocked,
      state.pinTries,
      state.pinMaxTries
    ])
  )
  const showWarning = useSettingsStore((state) => state.showWarning)
  const [deleteAccounts, deleteTags] = useAccountsStore(
    useShallow((state) => [state.deleteAccounts, state.deleteTags])
  )
  const deleteWallets = useWalletsStore((state) => state.deleteWallets)
  const triesLeft = pinMaxTries - pinTries

  function getWarningColor() {
    if (triesLeft > 2) {
      return gray[200]
    }
    if (triesLeft === 1) {
      return error
    }
    if (triesLeft === 2) {
      return warning
    }
    return undefined
  }

  function getWarningText() {
    let text = ''
    if (triesLeft < pinMaxTries) {
      text += triesLeft
      text += ' '
      text += triesLeft > 1 ? t('auth.triesLeft') : t('auth.tryLeft')
      if (triesLeft <= 2) {
        text += '\n'
        text += t('auth.warningKeysErase')
      }
    }
    return text
  }

  function handleSuccess() {
    setLockTriggered(false)
    setJustUnlocked(true)
    resetPinTries()
    // INFO: Deactivated this for now
    // Note: Take into account that we don't persist account build
    // We had a problem with pages = ["/", "/account/add/", "/account/add/(common)/confirm/0/word/11"]
    // This pushes the previous page history (before screen was unlocked)
    // const pages = getPagesHistory()
    // clearPageHistory()
    // for (const page of pages) {
    //   router.push(page as any)
    // }
    router.push(showWarning ? './warning' : '/')
  }

  function handleFailure() {
    const triesLeft = incrementPinTries()
    if (triesLeft > 0) {
      return
    }
    deleteAccounts()
    deleteWallets()
    deleteTags()
    setFirstTime(true)
    setRequiresAuth(false)
    setLockTriggered(false)
    router.replace('/')
    resetPinTries()
  }

  return (
    <SSMainLayout
      backgroundColor={Colors.gray[950]}
      style={{
        paddingBottom: Layout.mainContainer.paddingBottom,
        paddingTop: '40%'
      }}
    >
      <SSPinAuth
        onSuccess={handleSuccess}
        onFail={handleFailure}
        title={t('auth.enterPinTitle')}
        feedbackText={getWarningText()}
        feedbackColor={getWarningColor()}
        feedbackBold={triesLeft <= 2 && triesLeft > 0}
      />
    </SSMainLayout>
  )
}
