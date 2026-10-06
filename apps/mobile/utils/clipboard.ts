import * as Clipboard from 'expo-clipboard'

export async function setClipboard(value: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(value)
    return true
  } catch {
    return false
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
