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

function jsonPath(currency) {
  return path.join(ASSET_DIR, `${currency.toLowerCase()}.json`)
}

function dateFromUnix(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

function sortedSeries(byTime) {
  const times = [...byTime.keys()].toSorted((a, b) => a - b)
  const prices = times.map((time) => byTime.get(time))
  return { prices, times }
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

  const byTime = new Map()
  for (const row of data.prices) {
    const time = row.time
    const price = row[currency]
    if (typeof time !== 'number' || typeof price !== 'number') {
      continue
    }
    byTime.set(time, price)
  }

  if (byTime.size === 0) {
    throw new Error(`No price rows for ${currency}`)
  }

  return sortedSeries(byTime)
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

  const lastTimes = {}
  const counts = {}

  for (const currency of CURRENCIES) {
    const series = await fetchCurrency(currency)

    await writeOutputs(currency, series.times, series.prices, generatedAt)
    lastTimes[currency] = series.times[series.times.length - 1]
    counts[currency] = series.times.length
    console.log(
      `${currency}: ${series.times.length} rows, last ${dateFromUnix(lastTimes[currency])}`
    )
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
