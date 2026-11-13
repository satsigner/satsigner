import {
  getPinSetupStart,
  isCurrentPinRequired,
  isPinSetupLocked
} from '@/utils/pinSetup'

const ESTABLISHED_PIN = {
  firstTime: false,
  requirePinMigration: false,
  skipPin: false
}

describe('isCurrentPinRequired', () => {
  it('requires the current PIN once a PIN is established', () => {
    expect(isCurrentPinRequired(ESTABLISHED_PIN)).toBe(true)
  })

  it.each([
    ['no PIN is set yet', { firstTime: true }],
    ['the legacy default PIN is migrated', { requirePinMigration: true }],
    ['the dev-only PIN skip is on', { skipPin: true }]
  ])('does not require it when %s', (_case, overrides) => {
    expect(isCurrentPinRequired({ ...ESTABLISHED_PIN, ...overrides })).toBe(
      false
    )
  })
})

describe('getPinSetupStart', () => {
  it('changes an established PIN starting at the current PIN', () => {
    expect(getPinSetupStart(ESTABLISHED_PIN)).toStrictEqual({
      changingPin: true,
      stage: 'verify'
    })
  })

  it('sets the first PIN straight away', () => {
    expect(
      getPinSetupStart({ ...ESTABLISHED_PIN, firstTime: true })
    ).toStrictEqual({ changingPin: false, stage: 'set' })
  })

  it('replaces a legacy default PIN without asking for it', () => {
    expect(
      getPinSetupStart({ ...ESTABLISHED_PIN, requirePinMigration: true })
    ).toStrictEqual({ changingPin: true, stage: 'set' })
  })
})

describe('isPinSetupLocked', () => {
  const LOCKED_APP = {
    firstTime: false,
    lockTriggered: true,
    requiresAuth: true,
    skipPin: false
  }

  it('keeps PIN setup behind unlock while the app is locked', () => {
    expect(isPinSetupLocked(LOCKED_APP)).toBe(true)
  })

  it.each([
    ['the app is unlocked', { lockTriggered: false }],
    ['no PIN is set yet', { firstTime: true }]
  ])('opens PIN setup when %s', (_case, overrides) => {
    expect(isPinSetupLocked({ ...LOCKED_APP, ...overrides })).toBe(false)
  })
})
