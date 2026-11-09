import { useShallow } from 'zustand/react/shallow'

import { t } from '@/locales'
import { useAuthStore } from '@/store/auth'
import { error, gray, warning } from '@/styles/colors'
import { toPinAttempts } from '@/utils/pinAttempts'

const ERASE_WARNING_TRIES_LEFT = 2

function getWarningColor(triesLeft: number) {
  if (triesLeft > ERASE_WARNING_TRIES_LEFT) {
    return gray[200]
  }
  if (triesLeft === 1) {
    return error
  }
  if (triesLeft === ERASE_WARNING_TRIES_LEFT) {
    return warning
  }
  return undefined
}

function getWarningText(triesLeft: number, pinMaxTries: number) {
  if (triesLeft >= pinMaxTries) {
    return ''
  }
  const triesLeftText = t('auth.triesLeft', { count: triesLeft })
  if (triesLeft > ERASE_WARNING_TRIES_LEFT) {
    return triesLeftText
  }
  return `${triesLeftText}\n${t('auth.warningKeysErase')}`
}

/**
 * Tries left before the wipe, for every PIN prompt: each one counts against
 * the same persisted tries, so each must warn before the last one.
 */
export function usePinTriesFeedback() {
  const [pinTries, pinMaxTries] = useAuthStore(
    useShallow((state) => [state.pinTries, state.pinMaxTries])
  )
  const attempts = toPinAttempts(pinTries, pinMaxTries)
  const triesLeft = attempts.status === 'counting' ? attempts.left : 0
  return {
    feedbackBold: triesLeft <= ERASE_WARNING_TRIES_LEFT && triesLeft > 0,
    feedbackColor: getWarningColor(triesLeft),
    feedbackText: getWarningText(triesLeft, pinMaxTries)
  }
}
