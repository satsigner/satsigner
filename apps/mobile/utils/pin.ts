import { PIN_SIZE, DEFAULT_PIN, PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'

async function getPin(skipPin = false): Promise<string> {
  if (skipPin) {
    return DEFAULT_PIN
  }
  const pin = await getItem(PIN_KEY)
  if (pin === null) {
    throw new Error('PIN unavailable')
  }
  return pin
}

function emptyPin(): string[] {
  return Array.from<string>({ length: PIN_SIZE }).fill('')
}

function getPinCursorIndex(pin: string[]): number {
  const firstEmptyIndex = pin.indexOf('')
  return firstEmptyIndex === -1 ? pin.length : firstEmptyIndex
}

function isPinFilled(pin: string[]): boolean {
  return !pin.includes('')
}

function fillPinDigit(pin: string[], digit: string): string[] {
  const index = pin.indexOf('')
  if (index === -1) {
    return pin
  }
  const newPin = [...pin]
  newPin[index] = digit
  return newPin
}

function deletePinDigit(pin: string[]): string[] {
  const indexToClear = getPinCursorIndex(pin) - 1
  if (indexToClear < 0) {
    return pin
  }
  const newPin = [...pin]
  newPin[indexToClear] = ''
  return newPin
}

export {
  deletePinDigit,
  emptyPin,
  fillPinDigit,
  getPin,
  getPinCursorIndex,
  isPinFilled
}
