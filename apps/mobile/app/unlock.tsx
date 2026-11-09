import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSPinAuth from '@/components/SSPinAuth'
import SSMainLayout from '@/layouts/SSMainLayout'
import { t } from '@/locales'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { Colors, Layout } from '@/styles'
import { loadAuthenticatedSession } from '@/utils/authenticatedSession'
import {
  isDevConsoleAvailable,
  registerDevConsoleSecretTap
} from '@/utils/devConsole'
import { navigateAfterUnlock } from '@/utils/lastRouteSession'

void loadAuthenticatedSession()

function handleTitlePress() {
  const enabled = registerDevConsoleSecretTap()
  if (enabled === null) {
    return
  }
  toast(enabled ? t('devConsole.turnedOn') : t('devConsole.turnedOff'))
}

// Production gets a plain title, so screen readers do not announce a button.
const titlePressHandler = isDevConsoleAvailable() ? handleTitlePress : undefined

export default function Unlock() {
  const [setLockTriggered, setJustUnlocked] = useAuthStore(
    useShallow((state) => [state.setLockTriggered, state.setJustUnlocked])
  )
  const showWarning = useSettingsStore((state) => state.showWarning)

  async function handleSuccess() {
    await loadAuthenticatedSession()
    setLockTriggered(false)
    setJustUnlocked(true)
    await navigateAfterUnlock(showWarning)
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
        onTitlePress={titlePressHandler}
        title={t('auth.enterPinTitle')}
      />
    </SSMainLayout>
  )
}
