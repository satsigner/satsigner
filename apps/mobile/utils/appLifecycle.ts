import type { AppStateStatus } from 'react-native'

type AppLifecycleInput = {
  lockDeltaTime: number
  next: AppStateStatus
  // AppState.currentState can be unknown before the first change event.
  previous: string | null | undefined
  requiresAuth: boolean
  secondsAway: number
}

/**
 * `hideSoon` keeps the overlay up for a moment after returning, so the
 * unlock redirect renders before the previous screen can be seen.
 */
type AppLifecycleStep = {
  clearExpiredPayjoin: boolean
  lock: boolean
  overlay: 'show' | 'hide' | 'hideSoon' | 'keep'
  recordBackground: boolean
}

const NO_CHANGE: AppLifecycleStep = {
  clearExpiredPayjoin: false,
  lock: false,
  overlay: 'keep',
  recordBackground: false
}

function nextAppLifecycleStep({
  lockDeltaTime,
  next,
  previous,
  requiresAuth,
  secondsAway
}: AppLifecycleInput): AppLifecycleStep {
  if (next === 'background') {
    return requiresAuth
      ? { ...NO_CHANGE, overlay: 'show', recordBackground: true }
      : NO_CHANGE
  }
  if (next !== 'active') {
    return NO_CHANGE
  }
  if (previous === 'background' && requiresAuth) {
    return {
      ...NO_CHANGE,
      clearExpiredPayjoin: true,
      lock: secondsAway >= lockDeltaTime,
      overlay: 'hideSoon'
    }
  }
  return { ...NO_CHANGE, clearExpiredPayjoin: true, overlay: 'hide' }
}

type AppLockInput = {
  lockTriggered: boolean
  requiresAuth: boolean
  skipPin: boolean
}

/** True while the PIN screen stands in for the unmounted session. */
function isAppLocked({
  lockTriggered,
  requiresAuth,
  skipPin
}: AppLockInput): boolean {
  return requiresAuth && lockTriggered && !skipPin
}

export { type AppLifecycleStep, isAppLocked, nextAppLifecycleStep }
