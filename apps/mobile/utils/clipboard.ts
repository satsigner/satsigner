import * as Clipboard from 'expo-clipboard'

import { isValidBitcoinContent } from './bitcoinContent'

export async function setClipboard(value: string): Promise<void> {
  try {
    await Clipboard.setStringAsync(value)
  } catch {
    /* silently ignored */
  }
}

export async function getBitcoinAddressFromClipboard(): Promise<string | undefined> {
  try {
    if (!(await Clipboard.hasStringAsync())) {
      return
    }
    const value = await Clipboard.getStringAsync()
    if (!isValidBitcoinContent(value)) {
      return
    }
    return value
  } catch {
    /* silently ignored */
  }
}

export async function getAllClipboardContent() {
  try {
    if (!(await Clipboard.hasStringAsync())) {
      return
    }
    return await Clipboard.getStringAsync()
  } catch {
    /* silently ignored */
  }
}

export async function clearClipboard() {
  try {
    await Clipboard.setStringAsync('')
  } catch {
    /* silently ignored */
  }
}
