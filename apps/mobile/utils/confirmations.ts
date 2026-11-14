import { FULLY_CONFIRMED_COUNT } from '@/constants/btc'
import { Colors } from '@/styles'

const UNCONFIRMED_COLOR_STYLE = { color: Colors.mainRed }
const PENDING_COLOR_STYLE = { color: Colors.warning }
const CONFIRMED_COLOR_STYLE = { color: Colors.gray[300] }

/**
 * Confirmations of a transaction mined at `minedAtHeight`, or null while the
 * known tip has not reached that block (the tip is 0 until a backend reports
 * one).
 */
function getConfirmations(minedAtHeight: number, tipHeight: number) {
  return tipHeight >= minedAtHeight ? tipHeight - minedAtHeight + 1 : null
}

function getConfirmationsColor(confirmations: number) {
  if (confirmations <= 0) {
    return Colors.mainRed
  }
  if (confirmations < FULLY_CONFIRMED_COUNT) {
    return Colors.warning
  }
  return Colors.gray[300]
}

/** `null` is a mined transaction whose count is not known yet. */
function getConfirmationsColorStyle(confirmations: number | null) {
  if (confirmations === null) {
    return CONFIRMED_COLOR_STYLE
  }
  if (confirmations <= 0) {
    return UNCONFIRMED_COLOR_STYLE
  }
  if (confirmations < FULLY_CONFIRMED_COUNT) {
    return PENDING_COLOR_STYLE
  }
  return CONFIRMED_COLOR_STYLE
}

export { getConfirmations, getConfirmationsColor, getConfirmationsColorStyle }
