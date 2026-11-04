import { DEV_CONSOLE_PERSISTED_SLOTS } from '@/constants/devConsole'
import {
  clearDevConsoleStorage,
  persistDevConsoleEntry,
  readPreviousDevConsoleSession,
  rotateDevConsoleSession
} from '@/storage/devConsoleLog'
import type { DevConsoleEntry } from '@/types/models/DevConsole'

function entry(id: number): DevConsoleEntry {
  return { id, level: 'info', message: `line ${id}`, scope: 'test', time: id }
}

describe('rotateDevConsoleSession', () => {
  beforeEach(() => {
    clearDevConsoleStorage()
  })

  it('turns the last run into the previous session', () => {
    persistDevConsoleEntry(entry(0))
    persistDevConsoleEntry(entry(1))

    expect(rotateDevConsoleSession()).toStrictEqual([entry(0), entry(1)])
    expect(readPreviousDevConsoleSession()).toStrictEqual([entry(0), entry(1)])
  })

  it('keeps the previous session when the last run logged nothing', () => {
    persistDevConsoleEntry(entry(0))
    rotateDevConsoleSession()

    expect(rotateDevConsoleSession()).toStrictEqual([entry(0)])
  })

  it('keeps only the newest entries when a run overflows the slots', () => {
    const total = DEV_CONSOLE_PERSISTED_SLOTS + 5
    for (const id of Array.from({ length: total }, (_, index) => index)) {
      persistDevConsoleEntry(entry(id))
    }

    const previous = rotateDevConsoleSession()
    expect(previous).toHaveLength(DEV_CONSOLE_PERSISTED_SLOTS)
    expect(previous[0]).toStrictEqual(entry(5))
    expect(previous.at(-1)).toStrictEqual(entry(total - 1))
  })
})
