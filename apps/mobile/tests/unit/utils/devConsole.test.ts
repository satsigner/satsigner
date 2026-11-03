import { DEV_CONSOLE_MAX_MESSAGE_LENGTH } from '@/constants/devConsole'
import { readPreviousDevConsoleSession } from '@/storage/devConsoleLog'
import { useDevConsoleStore } from '@/store/devConsole'
import {
  clearDevConsole,
  devLog,
  devStep,
  formatConsoleArgs,
  formatDevConsoleEntries,
  formatDevConsoleTime,
  hideDevConsole,
  isDevVariantPackage,
  pauseDevSteps,
  releaseNextDevStep,
  resumeDevSteps,
  toggleDevConsoleDock,
  truncateDevMessage
} from '@/utils/devConsole'

function messages() {
  return useDevConsoleStore.getState().entries.map((entry) => entry.message)
}

describe('isDevVariantPackage', () => {
  beforeEach(() => {
    resumeDevSteps()
    clearDevConsole()
    useDevConsoleStore.getState().setEnabled(true)
  })

  it('accepts dev and branch packages only', () => {
    expect(isDevVariantPackage('com.satsigner.satsigner.dev')).toBe(true)
    expect(
      isDevVariantPackage('com.satsigner.satsigner.dev.fix_backup_recover_hang')
    ).toBe(true)
    expect(isDevVariantPackage('com.satsigner.satsigner')).toBe(false)
    expect(isDevVariantPackage('com.satsigner.satsigner.devil')).toBe(false)
  })
})

describe('devLog', () => {
  beforeEach(() => {
    resumeDevSteps()
    clearDevConsole()
    useDevConsoleStore.getState().setEnabled(true)
  })

  it('records entries while enabled', () => {
    devLog('session', 'load wallets')
    expect(messages()).toStrictEqual(['load wallets'])
  })

  it('records nothing while disabled', () => {
    useDevConsoleStore.getState().setEnabled(false)
    devLog('session', 'load wallets')
    expect(messages()).toStrictEqual([])
  })

  it('truncates long messages', () => {
    const long = 'a'.repeat(DEV_CONSOLE_MAX_MESSAGE_LENGTH + 10)
    expect(truncateDevMessage(long)).toHaveLength(
      DEV_CONSOLE_MAX_MESSAGE_LENGTH + 1
    )
  })
})

describe('devStep', () => {
  beforeEach(() => {
    resumeDevSteps()
    clearDevConsole()
    useDevConsoleStore.getState().setEnabled(true)
  })

  it('runs straight through when not paused', async () => {
    await expect(devStep('session', 'load wallets')).resolves.toBeUndefined()
    expect(useDevConsoleStore.getState().pausedSteps).toStrictEqual([])
  })

  it('waits for Next while paused, one step at a time', async () => {
    pauseDevSteps()
    const order: string[] = []
    const first = devStep('session', 'load wallets').then(() =>
      order.push('load wallets')
    )
    const second = devStep('ark', 'open wallet').then(() =>
      order.push('open wallet')
    )
    await Promise.resolve()

    expect(useDevConsoleStore.getState().pausedSteps).toStrictEqual([
      'session: load wallets',
      'ark: open wallet'
    ])
    expect(order).toStrictEqual([])

    releaseNextDevStep()
    await first
    expect(order).toStrictEqual(['load wallets'])
    expect(useDevConsoleStore.getState().pausedSteps).toStrictEqual([
      'ark: open wallet'
    ])

    resumeDevSteps()
    await second
    expect(order).toStrictEqual(['load wallets', 'open wallet'])
    expect(useDevConsoleStore.getState().stepMode).toBe(false)
  })
})

describe('session persistence', () => {
  beforeEach(() => {
    resumeDevSteps()
    clearDevConsole()
    useDevConsoleStore.getState().setEnabled(true)
  })

  it('clearing the console also drops the stored last run', () => {
    devLog('session', 'before freeze')
    clearDevConsole()
    expect(readPreviousDevConsoleSession()).toStrictEqual([])
  })
})

describe('formatting', () => {
  beforeEach(() => {
    resumeDevSteps()
    clearDevConsole()
    useDevConsoleStore.getState().setEnabled(true)
  })

  it('formats console arguments', () => {
    expect(formatConsoleArgs(['open', { id: 1 }, new Error('boom')])).toBe(
      'open {"id":1} boom'
    )
  })

  it('formats time with milliseconds', () => {
    const time = new Date(2026, 10, 3, 9, 5, 7, 42).getTime()
    expect(formatDevConsoleTime(time)).toBe('09:05:07.042')
  })
})

describe('panel controls', () => {
  beforeEach(() => {
    resumeDevSteps()
    clearDevConsole()
    useDevConsoleStore.getState().setEnabled(true)
    useDevConsoleStore.getState().setDock('top')
  })

  it('hide turns the console off and releases waiting steps', async () => {
    pauseDevSteps()
    const waiting = devStep('session', 'load wallets')
    useDevConsoleStore.getState().setPanelOpen(true)

    hideDevConsole()
    await waiting

    const state = useDevConsoleStore.getState()
    expect(state.enabled).toBe(false)
    expect(state.panelOpen).toBe(false)
    expect(state.stepMode).toBe(false)
  })

  it('moves the panel between top and bottom', () => {
    toggleDevConsoleDock()
    expect(useDevConsoleStore.getState().dock).toBe('bottom')
    toggleDevConsoleDock()
    expect(useDevConsoleStore.getState().dock).toBe('top')
  })

  it('formats entries for copying', () => {
    const time = new Date(2026, 10, 3, 23, 5, 19, 440).getTime()
    expect(
      formatDevConsoleEntries([
        {
          id: 0,
          level: 'step',
          message: 'load wallets',
          scope: 'session',
          time
        },
        { id: 1, level: 'error', message: 'boom', scope: 'ark', time }
      ])
    ).toBe(
      '23:05:19.440 STEP [session] load wallets\n23:05:19.440 ERROR [ark] boom'
    )
  })
})
