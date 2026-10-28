import { useRouter } from 'expo-router'
import { toast } from 'sonner-native'
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

const ERASE_WARNING_TRIES_LEFT = 2

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
    if (triesLeft >= pinMaxTries) {
      return ''
    }
    const triesLeftText = t('auth.triesLeft', { count: triesLeft })
    if (triesLeft > ERASE_WARNING_TRIES_LEFT) {
      return triesLeftText
    }
    return `${triesLeftText}\n${t('auth.warningKeysErase')}`
  }

  async function handleSuccess() {
    await loadAuthenticatedSession()
    setLockTriggered(false)
    setJustUnlocked(true)
    resetPinTries()
    router.replace(showWarning ? './warning' : '/')
  }

  // Counts against the persisted tries so restarting the app cannot reset them.
  async function handleFailure() {
    const remainingTries = incrementPinTries()
    if (remainingTries > 0) {
      return
    }
    const wiped = await secureWipeAfterMaxPinTries()
    if (!wiped) {
      toast.error(t('auth.wipeFailed'))
      return
    }
    router.replace('/')
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
        feedbackBold={triesLeft <= ERASE_WARNING_TRIES_LEFT && triesLeft > 0}
      />
    </SSMainLayout>
  )
}
