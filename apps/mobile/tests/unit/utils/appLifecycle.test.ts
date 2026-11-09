import { nextAppLifecycleStep } from '@/utils/appLifecycle'

const BASE = {
  lockDeltaTime: 30,
  requiresAuth: true,
  secondsAway: 0
}

describe('nextAppLifecycleStep', () => {
  it('covers the screen and records the time when going to the background', () => {
    expect(
      nextAppLifecycleStep({ ...BASE, next: 'background', previous: 'active' })
    ).toMatchObject({ overlay: 'show', recordBackground: true })
  })

  it('locks when the app was away longer than the lock delay', () => {
    expect(
      nextAppLifecycleStep({
        ...BASE,
        next: 'active',
        previous: 'background',
        secondsAway: 31
      })
    ).toMatchObject({ lock: true, overlay: 'hideSoon' })
  })

  it('does not lock after a short trip to the background', () => {
    expect(
      nextAppLifecycleStep({
        ...BASE,
        next: 'active',
        previous: 'background',
        secondsAway: 5
      })
    ).toMatchObject({ lock: false, overlay: 'hideSoon' })
  })

  it('hides the overlay at once when nothing needs the unlock screen', () => {
    expect(
      nextAppLifecycleStep({
        ...BASE,
        next: 'active',
        previous: 'background',
        requiresAuth: false
      })
    ).toMatchObject({ lock: false, overlay: 'hide' })
  })

  it('leaves everything as it is on an inactive state', () => {
    expect(
      nextAppLifecycleStep({ ...BASE, next: 'inactive', previous: 'active' })
    ).toStrictEqual({
      clearExpiredPayjoin: false,
      lock: false,
      overlay: 'keep',
      recordBackground: false
    })
  })
})
