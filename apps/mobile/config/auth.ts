const PIN_KEY = 'satsigner_pin'
const DURESS_PIN_KEY = 'satsigner_duress_pin'
const SALT_KEY = 'satsigner_salt'
const PIN_KDF_KEY = 'satsigner_pin_kdf'
const DURESS_KDF_KEY = 'satsigner_duress_kdf'
const PIN_LENGTH_KEY = 'satsigner_pin_length'
const SALT_KEY_DURESS = 'satsigner_salt_duress'

const PIN_SIZE = 4
const PIN_MIN_LENGTH = 4
const PIN_MAX_LENGTH = 8
const DEFAULT_PIN_MAX_TRIES = 5
const DEFAULT_LOCK_DELTA_TIME_SECONDS = 30
const SETTINGS_PIN_MIN_POSSIBLE_TRIES = 3
const SETTINGS_PIN_MAX_POSSIBLE_TRIES = 10

export {
  DEFAULT_LOCK_DELTA_TIME_SECONDS,
  DEFAULT_PIN_MAX_TRIES,
  DURESS_KDF_KEY,
  DURESS_PIN_KEY,
  PIN_KDF_KEY,
  PIN_KEY,
  PIN_LENGTH_KEY,
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  PIN_SIZE,
  SALT_KEY,
  SALT_KEY_DURESS,
  SETTINGS_PIN_MAX_POSSIBLE_TRIES,
  SETTINGS_PIN_MIN_POSSIBLE_TRIES
}
