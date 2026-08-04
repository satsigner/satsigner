import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, PIN_SIZE } from '@/config/auth'

function emptyPin(length: number = PIN_SIZE): string[] {
  return Array.from<string>({ length }).fill('')
}

function clampPinLength(length: number): number {
  if (!Number.isInteger(length)) {
    return PIN_SIZE
  }
  return Math.min(PIN_MAX_LENGTH, Math.max(PIN_MIN_LENGTH, length))
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
  clampPinLength,
  deletePinDigit,
  emptyPin,
  fillPinDigit,
  getPinCursorIndex,
  isPinFilled
}
