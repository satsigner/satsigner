#!/usr/bin/env node
/**
 * Refresh BTC historical prices from mempool.space and emit:
 *   - btc_prices/btc_<currency>_weekly.csv (source of truth in git)
 *   - apps/mobile/assets/prices/<currency>.json (bundled in the app)
 *   - apps/mobile/assets/prices/meta.json
 *
 * Usage:
 *   node btc_prices/update.mjs           # fetch API, rewrite CSVs + JSON
 *   node btc_prices/update.mjs --from-csv  # JSON from existing CSVs only
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'CHF', 'AUD', 'JPY']
const MEMPOOL_HISTORICAL_URL =
  'https://mempool.space/api/v1/historical-price?currency='

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')
const CSV_DIR = SCRIPT_DIR
const ASSET_DIR = path.join(REPO_ROOT, 'apps/mobile/assets/prices')

function csvPath(currency) {
  return path.join(CSV_DIR, `btc_${currency.toLowerCase()}_weekly.csv`)
}

function jsonPath(currency) {
  return path.join(ASSET_DIR, `${currency.toLowerCase()}.json`)
}

function dateFromUnix(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

function unixFromDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 1000
}

function parseCsv(text, currency) {
  const lines = text.trim().split(/\r?\n/)
  const header = lines[0]
  const expectedHeader = `date,close_${currency}`
  if (header !== expectedHeader) {
    throw new Error(
      `Unexpected CSV header "${header}" (wanted ${expectedHeader})`
    )
  }

  const byTime = new Map()
  for (const line of lines.slice(1)) {
    if (!line) {
      continue
    }
    const comma = line.indexOf(',')
    const date = line.slice(0, comma)
    const price = Number(line.slice(comma + 1))
    if (!date || !Number.isFinite(price)) {
      throw new Error(`Invalid CSV row: ${line}`)
    }
    const time = unixFromDate(date)
    if (!byTime.has(time)) {
      byTime.set(time, price)
    }
  }

  return sortedSeries(byTime)
}

function sortedSeries(byTime) {
  const times = [...byTime.keys()].toSorted((a, b) => a - b)
  const prices = times.map((time) => byTime.get(time))
  return { prices, times }
}

function toCsv(currency, times, prices) {
  const rows = [`date,close_${currency}`]
  for (const [index, time] of times.entries()) {
    rows.push(`${dateFromUnix(time)},${prices[index]}`)
  }
  return `${rows.join('\n')}\n`
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
  await writeFile(csvPath(currency), toCsv(currency, times, prices), 'utf8')
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
  const fromCsv = process.argv.includes('--from-csv')
  const generatedAt = new Date().toISOString().slice(0, 10)

  await mkdir(ASSET_DIR, { recursive: true })

  const lastTimes = {}
  const counts = {}

  for (const currency of CURRENCIES) {
    const series = fromCsv
      ? parseCsv(await readFile(csvPath(currency), 'utf8'), currency)
      : await fetchCurrency(currency)

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
