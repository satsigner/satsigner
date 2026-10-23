import { useRouter } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import SSPinAuth from '@/components/SSPinAuth'
import SSMainLayout from '@/layouts/SSMainLayout'
import { t } from '@/locales'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { Colors, Layout } from '@/styles'
import { error, gray, warning } from '@/styles/colors'
import { loadAuthenticatedSession } from '@/utils/authenticatedSession'
import { secureWipeAfterMaxPinTries } from '@/utils/secureWipe'

void loadAuthenticatedSession()

export default function Unlock() {
  const router = useRouter()
  const [
    setLockTriggered,
    resetPinTries,
    incrementPinTries,
    setJustUnlocked,
    pinTries,
    pinMaxTries
  ] = useAuthStore(
    useShallow((state) => [
      state.setLockTriggered,
      state.resetPinTries,
      state.incrementPinTries,
      state.setJustUnlocked,
      state.pinTries,
      state.pinMaxTries
    ])
  )
  const showWarning = useSettingsStore((state) => state.showWarning)
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

  async function handleSuccess() {
    await loadAuthenticatedSession()
    setLockTriggered(false)
    setJustUnlocked(true)
    resetPinTries()
    router.replace(showWarning ? './warning' : '/')
  }

  // Counts against the persisted tries so restarting the app cannot reset them.
  function handleFailure() {
    const remainingTries = incrementPinTries()
    if (remainingTries <= 0) {
      secureWipeAfterMaxPinTries()
      router.replace('/')
    }
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
