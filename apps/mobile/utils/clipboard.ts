/* eslint-disable no-console */
import * as Clipboard from 'expo-clipboard'

import { isBitcoinAddress } from './format'

export async function setClipboard(value: string): Promise<void> {
  try {
    await Clipboard.setStringAsync(value)
  } catch (error) {
    console.error(error)
  }
}

export async function getClipboard(): Promise<string | void> {
  try {
    if (!(await Clipboard.hasStringAsync())) {
      return
    }
    const value = await Clipboard.getStringAsync()
    if (!isBitcoinAddress(value)) {
      return
    }
    return value
  } catch (error) {
    console.error(error)
  }
}

export async function clearClipboard(): Promise<void> {
  try {
    await Clipboard.setStringAsync('')
  } catch (error) {
    console.error(error)
  }
}
