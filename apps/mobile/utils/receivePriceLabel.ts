import { t } from '@/locales'
import { type Currency } from '@/types/models/Blockchain'
import { formatDate, formatNumber } from '@/utils/format'

const FIAT_DECIMALS = 2
const LABEL_SEPARATOR = ', '

type PriceLabelNote = {
  date: Date
  price: number
  currency: Currency
  fiatAmount?: number
}

function buildPriceLabelNote({
  date,
  price,
  currency,
  fiatAmount
}: PriceLabelNote) {
  const rate = t('receive.priceLabel.rate', {
    currency,
    date: formatDate(date),
    price: formatNumber(price)
  })
  if (!fiatAmount || fiatAmount <= 0) {
    return rate
  }
  return t('receive.priceLabel.withAmount', {
    amount: fiatAmount.toFixed(FIAT_DECIMALS),
    currency,
    rate
  })
}

function appendLabelNote(label: string, note: string) {
  const trimmed = label.trim()
  if (!trimmed) {
    return note
  }
  if (trimmed.includes(note)) {
    return trimmed
  }
  return `${trimmed}${LABEL_SEPARATOR}${note}`
}

export { appendLabelNote, buildPriceLabelNote }
