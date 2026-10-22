import { MEMPOOL_MAINNET_URL } from '@/config/servers'

const DEFAULT_FIAT_PRICE_API_URL = MEMPOOL_MAINNET_URL

const CURRENT_PRICES_RESPONSE = `GET /v1/prices

{
  "USD": 90000,
  "EUR": 85000,
  "GBP": 72000,
  "CAD": 125000,
  "CHF": 82000,
  "JPY": 13500000,
  "AUD": 140000
}`

const HISTORICAL_PRICE_RESPONSE = `GET /v1/historical-price?currency=USD&timestamp=1609459200

{
  "prices": [
    {
      "USD": 29000,
      "EUR": 24000
    }
  ],
  "exchangeRates": {
    "USDEUR": 0.83,
    "USDGBP": 0.73,
    "USDCAD": 1.27,
    "USDCHF": 0.88,
    "USDJPY": 103.5,
    "USDAUD": 1.29
  }
}`

export {
  CURRENT_PRICES_RESPONSE,
  DEFAULT_FIAT_PRICE_API_URL,
  HISTORICAL_PRICE_RESPONSE
}
