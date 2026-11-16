import { t } from '@/locales'
import { type Transaction } from '@/types/models/Transaction'
import { formatDate } from '@/utils/format'
import { parseLabel } from '@/utils/parse'

type TransactionDirection = Transaction['type']

type TransactionSearchFilters = {
  direction?: TransactionDirection
  query: string
  tags: string[]
  from?: Date
  to?: Date
}

const MS_PER_DAY = 86_400_000

type TransactionDateBounds = { first: Date; dayCount: number }

function startOfDay(date: Date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

function endOfDay(date: Date) {
  const day = new Date(date)
  day.setHours(23, 59, 59, 999)
  return day
}

function getTransactionTags(transactions: Transaction[]) {
  const tags = transactions.flatMap((tx) => parseLabel(tx.label ?? '').tags)
  return [...new Set(tags)].toSorted((a, b) => a.localeCompare(b))
}

function matchesQuery(tx: Transaction, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }
  const { label } = parseLabel(tx.label ?? '')
  return (
    label.toLowerCase().includes(needle) || tx.id.toLowerCase().includes(needle)
  )
}

function matchesTags(tx: Transaction, tags: string[]) {
  if (tags.length === 0) {
    return true
  }
  const txTags = parseLabel(tx.label ?? '').tags
  return tags.every((tag) => txTags.includes(tag))
}

function matchesDirection(tx: Transaction, direction?: TransactionDirection) {
  return !direction || tx.type === direction
}

function matchesDateRange(tx: Transaction, from?: Date, to?: Date) {
  if (!from && !to) {
    return true
  }
  if (!tx.timestamp) {
    return false
  }
  const time = tx.timestamp.getTime()
  if (from && time < startOfDay(from).getTime()) {
    return false
  }
  return !to || time <= endOfDay(to).getTime()
}

function filterTransactions(
  transactions: Transaction[],
  { direction, query, tags, from, to }: TransactionSearchFilters
) {
  return transactions
    .filter(
      (tx) =>
        matchesDirection(tx, direction) &&
        matchesQuery(tx, query) &&
        matchesTags(tx, tags) &&
        matchesDateRange(tx, from, to)
    )
    .toSorted(
      (a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0)
    )
}

function getTransactionDateBounds(
  transactions: Transaction[]
): TransactionDateBounds | undefined {
  const times = transactions.flatMap((tx) =>
    tx.timestamp ? [tx.timestamp.getTime()] : []
  )
  if (times.length === 0) {
    return undefined
  }
  const first = startOfDay(new Date(Math.min(...times)))
  const last = startOfDay(new Date(Math.max(...times)))
  return { dayCount: dateToDayIndex(first, last), first }
}

function dateToDayIndex(first: Date, date: Date) {
  return Math.round((startOfDay(date).getTime() - first.getTime()) / MS_PER_DAY)
}

function dayIndexToDate(first: Date, dayIndex: number) {
  const date = new Date(first)
  date.setDate(date.getDate() + dayIndex)
  return date
}

const DIRECTION_SUMMARY_KEYS = {
  receive: 'account.search.directionReceived',
  send: 'account.search.directionSent'
} as const

function describeDateRange(from?: Date, to?: Date) {
  if (!from && !to) {
    return undefined
  }
  const anyDate = t('account.search.anyDate')
  return `${from ? formatDate(from) : anyDate} - ${to ? formatDate(to) : anyDate}`
}

function describeActiveFilters({
  direction,
  query,
  tags,
  from,
  to
}: TransactionSearchFilters) {
  const trimmedQuery = query.trim()
  return [
    direction ? t(DIRECTION_SUMMARY_KEYS[direction]) : undefined,
    trimmedQuery ? `"${trimmedQuery}"` : undefined,
    ...tags.map((tag) => `#${tag}`),
    describeDateRange(from, to)
  ].filter((part) => part !== undefined)
}

function toggleTag(tags: string[], tag: string) {
  return tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]
}

export {
  dateToDayIndex,
  describeActiveFilters,
  dayIndexToDate,
  filterTransactions,
  getTransactionDateBounds,
  getTransactionTags,
  toggleTag
}
export type {
  TransactionDateBounds,
  TransactionDirection,
  TransactionSearchFilters
}
