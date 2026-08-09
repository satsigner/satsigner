import {
  PIN_SIZE,
  PIN_KEY,
  SALT_KEY,
  DURESS_PIN_KEY,
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

async function checkPinEqual(plainPin: string, pinType: PinType = PIN_KEY) {
  const saltKey = pinType === DURESS_PIN_KEY ? SALT_KEY_DURESS : SALT_KEY
  const salt = await getItem(saltKey)
  if (!salt) {
    return false
  }
  const hashedPin = await pbkdf2Encrypt(plainPin, salt)
  const storedPin = await getItem(pinType)
  return storedPin === hashedPin
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
  checkPinEqual,
  deletePinDigit,
  emptyPin,
  fillPinDigit,
  getPin,
  getPinCursorIndex,
  isPinFilled,
  setPin
}
