import Clipboard from 'expo-clipboard'

import { isValidBitcoinContent } from './bitcoinContent'

export async function setClipboard(value: string): Promise<void> {
  try {
    await Clipboard.setStringAsync(value)
  } catch {
    // TO DO: add error logger
  }
}

export async function getBitcoinAddressFromClipboard(): Promise<string | void> {
  ///
  try {
    if (!(await Clipboard.hasStringAsync())) {
      return
    }
    const value = await Clipboard.getStringAsync()
    if (!isValidBitcoinContent(value)) {
      return
    }
    return value
  } catch {}
}

export async function getAllClipboardContent() {
  try {
    if (!(await Clipboard.hasStringAsync())) {
      return
    }
    return await Clipboard.getStringAsync()
  } catch {}
}

export async function clearClipboard() {
  try {
    await Clipboard.setStringAsync('')
  } catch {}
}
