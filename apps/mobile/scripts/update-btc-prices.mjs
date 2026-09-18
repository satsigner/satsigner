#!/usr/bin/env node
/**
 * Refresh BTC historical prices from mempool.space and emit:
 *   - apps/mobile/assets/prices/<currency>.json (bundled in the app)
 *   - apps/mobile/assets/prices/meta.json
 *
 * Usage (repo root):
 *   pnpm prices:update
 *   node apps/mobile/scripts/update-btc-prices.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'CHF', 'AUD', 'JPY']
const MEMPOOL_HISTORICAL_URL =
  'https://mempool.space/api/v1/historical-price?currency='

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ASSET_DIR = path.resolve(SCRIPT_DIR, '../assets/prices')

const DAY_SECONDS = 86_400
const WEEK_SECONDS = 7 * DAY_SECONDS
const MAX_AGE_DAYS = 8
// mempool stored weekly closes until this UTC day, then daily
const DAILY_FROM = Date.UTC(2022, 1, 28) / 1000

function jsonPath(currency) {
  return path.join(ASSET_DIR, `${currency.toLowerCase()}.json`)
}

function dateFromUnix(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

function utcDayStart(unixSeconds) {
  return Math.floor(unixSeconds / DAY_SECONDS) * DAY_SECONDS
}

function toDailyCloses(rows, currency) {
  const byDay = new Map()
  // API is newest-first; keep the first sample per UTC day (latest close)
  for (const row of rows) {
    const time = row.time
    const price = row[currency]
    if (typeof time !== 'number') {
      continue
    }
    const day = utcDayStart(time)
    if (byDay.has(day)) {
      continue
    }
    if (price === -1 || price === null) {
      byDay.set(day, null)
      continue
    }
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
      continue
    }
    byDay.set(day, price)
  }
  return byDay
}

function downsample(byDay) {
  const days = [...byDay.keys()].toSorted((a, b) => a - b)
  const times = []
  const prices = []
  let lastWeekly
  for (const day of days) {
    if (day < DAILY_FROM) {
      if (lastWeekly !== undefined && day - lastWeekly < WEEK_SECONDS) {
        continue
      }
      lastWeekly = day
    }
    times.push(day)
    prices.push(byDay.get(day) ?? null)
  }
  return { prices, times }
}

function assertSeriesFresh(currency, times, generatedAt) {
  const last = times.at(-1)
  if (last === undefined) {
    throw new Error(`No timestamps for ${currency}`)
  }
  const generatedUnix = Date.parse(`${generatedAt}T00:00:00Z`) / 1000
  const ageDays = (generatedUnix - last) / DAY_SECONDS
  if (ageDays > MAX_AGE_DAYS) {
    throw new Error(
      `${currency} series is stale: last ${dateFromUnix(last)}, run date ${generatedAt}, age ${Math.floor(ageDays)}d (max ${MAX_AGE_DAYS}d)`
    )
  }
}

async function fetchCurrency(currency) {
  const response = await fetch(`${MEMPOOL_HISTORICAL_URL}${currency}`)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${currency}`)
  }
  const data = await response.json()
  if (!Array.isArray(data.prices)) {
    throw new Error(`Missing prices array for ${currency}`)
  }

  const series = downsample(toDailyCloses(data.prices, currency))
  if (series.times.length === 0) {
    throw new Error(`No price rows for ${currency}`)
  }
  return series
}

async function writeOutputs(currency, times, prices, generatedAt) {
  await writeFile(
    jsonPath(currency),
    JSON.stringify({
      currency,
      generatedAt,
      prices,
      times
    }),
    'utf8'
  )
}

async function main() {
  const generatedAt = new Date().toISOString().slice(0, 10)

  await mkdir(ASSET_DIR, { recursive: true })

  const accepted = []
  for (const currency of CURRENCIES) {
    const series = await fetchCurrency(currency)
    assertSeriesFresh(currency, series.times, generatedAt)
    accepted.push({ currency, series })
    console.log(
      `${currency}: ${series.times.length} rows, last ${dateFromUnix(series.times[series.times.length - 1])}`
    )
  }

  const lastTimes = {}
  const counts = {}
  for (const { currency, series } of accepted) {
    await writeOutputs(currency, series.times, series.prices, generatedAt)
    lastTimes[currency] = series.times[series.times.length - 1]
    counts[currency] = series.times.length
  }

  await writeFile(
    path.join(ASSET_DIR, 'meta.json'),
    JSON.stringify({
      counts,
      generatedAt,
      lastTimes
    }),
    'utf8'
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
