import {
  DURESS_PIN_KEY,
  PIN_KEY,
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  PIN_SIZE,
  SALT_KEY,
  SALT_KEY_DURESS
} from '@/config/auth'
import { getItem, setItem } from '@/storage/encrypted'
import { generateSalt, pbkdf2Encrypt } from '@/utils/crypto'

type PinType = typeof PIN_KEY | typeof DURESS_PIN_KEY

async function setPin(pin: string, pinType: PinType = PIN_KEY) {
  const salt = await generateSalt()
  const hashedPin = await pbkdf2Encrypt(pin, salt)
  const saltKey = pinType === DURESS_PIN_KEY ? SALT_KEY_DURESS : SALT_KEY
  const pinKey = pinType === DURESS_PIN_KEY ? DURESS_PIN_KEY : PIN_KEY
  await setItem(saltKey, salt)
  await setItem(pinKey, hashedPin)
  return hashedPin
}

async function getPin(pinType: PinType = PIN_KEY): Promise<string> {
  const pin = await getItem(pinType)
  if (pin === null) {
    throw new Error('PIN unavailable')
  }
  return pin
}

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
  getPin,
  getPinCursorIndex,
  isPinFilled,
  setPin
}
