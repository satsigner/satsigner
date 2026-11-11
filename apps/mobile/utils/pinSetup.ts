import { isAppLocked } from '@/utils/appLifecycle'

type PinSetupAuthState = {
  firstTime: boolean
  requirePinMigration: boolean
  skipPin: boolean
}

type PinSetupLockState = Parameters<typeof isAppLocked>[0] &
  Pick<PinSetupAuthState, 'firstTime'>

type PinSetupStart = {
  changingPin: boolean
  stage: 'verify' | 'set'
}

/**
 * Replacing an established PIN takes the current one. Only a PIN the user
 * never chose is exempt: none yet, the legacy default, or the dev-only skip.
 */
function isCurrentPinRequired({
  firstTime,
  requirePinMigration,
  skipPin
}: PinSetupAuthState): boolean {
  return !firstTime && !requirePinMigration && !skipPin
}

/**
 * The root PIN screen sits outside the (authenticated) lock guard, so it
 * applies the lock itself. First setup goes first, as in that guard: with no
 * PIN yet there is nothing to unlock.
 */
function isPinSetupLocked(state: PinSetupLockState): boolean {
  return !state.firstTime && isAppLocked(state)
}

/** Decided by auth state alone, never by how the screen was opened. */
function getPinSetupStart(state: PinSetupAuthState): PinSetupStart {
  return {
    changingPin: !state.firstTime,
    stage: isCurrentPinRequired(state) ? 'verify' : 'set'
  }
}

export {
  getPinSetupStart,
  isCurrentPinRequired,
  isPinSetupLocked,
  type PinSetupStart
}
