import { DEV_CONSOLE_MAX_MESSAGE_LENGTH } from '@/constants/devConsole'
import { readPreviousDevConsoleSession } from '@/storage/devConsoleLog'
import { useDevConsoleStore } from '@/store/devConsole'
import {
  clearDevConsole,
  devLog,
  devStep,
  formatConsoleArgs,
  formatDevConsoleTime,
  isDevVariantPackage,
  pauseDevSteps,
  releaseNextDevStep,
  resumeDevSteps,
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
