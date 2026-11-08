import { __store as secureStore } from 'expo-secure-store'
import * as mmkv from 'react-native-mmkv'

import {
  DEV_CONSOLE_LOG_KEY_STORE_KEY,
  persistDevConsoleEntry,
  readPreviousDevConsoleSession
} from '@/storage/devConsoleLog'

const HEX_32_CHARS = /^[0-9a-f]{32}$/

describe('dev console log encryption', () => {
  it('opens the log encrypted with a key kept in secure storage', () => {
    const createMMKV = jest.spyOn(mmkv, 'createMMKV')
    expect(secureStore[DEV_CONSOLE_LOG_KEY_STORE_KEY]).toBeUndefined()

    persistDevConsoleEntry({
      id: 0,
      level: 'info',
      message: 'line',
      scope: 'test',
      time: 0
    })
    readPreviousDevConsoleSession()

    const key = secureStore[DEV_CONSOLE_LOG_KEY_STORE_KEY]
    expect(key).toMatch(HEX_32_CHARS)
    expect(createMMKV).toHaveBeenCalledTimes(1)
    expect(createMMKV).toHaveBeenCalledWith(
      expect.objectContaining({ encryptionKey: key, encryptionType: 'AES-256' })
    )
  })
})
