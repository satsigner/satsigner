import { FULLY_CONFIRMED_COUNT } from '@/constants/btc'
import { Colors } from '@/styles'

const UNCONFIRMED_COLOR_STYLE = { color: Colors.mainRed }
const PENDING_COLOR_STYLE = { color: Colors.warning }
const CONFIRMED_COLOR_STYLE = { color: Colors.gray[300] }

function getConfirmationsColor(confirmations: number) {
  if (confirmations <= 0) {
    return Colors.mainRed
  }
  if (confirmations < FULLY_CONFIRMED_COUNT) {
    return Colors.warning
  }
  return Colors.gray[300]
}

function getConfirmationsColorStyle(confirmations: number) {
  if (confirmations <= 0) {
    return UNCONFIRMED_COLOR_STYLE
  }
  if (confirmations < FULLY_CONFIRMED_COUNT) {
    return PENDING_COLOR_STYLE
  }
  return CONFIRMED_COLOR_STYLE
}

export { getConfirmationsColor, getConfirmationsColorStyle }
