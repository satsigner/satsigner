# BTC historical price data

Static dataset of Bitcoin historical prices from the
[mempool.space public API](https://mempool.space/docs/api/rest). SatSigner
bundles a compact JSON copy so historical fiat on a transaction date can be
resolved **on device** without sending timestamps to a price server.

Spot prices can still come from the live API. Historical lookups use this
bundle by default. Users who opt in (Fiat Data settings) may fetch missing
dates from the API; that **sends transaction timestamps**.

## Files

| File                               | Role                                                             |
| ---------------------------------- | ---------------------------------------------------------------- |
| `btc_<currency>_weekly.csv`        | Human-readable source in git (USD, EUR, GBP, CAD, CHF, AUD, JPY) |
| `update.mjs`                       | Fetch mempool (or `--from-csv`) and regenerate CSVs + app JSON   |
| `apps/mobile/assets/prices/*.json` | Generated; required by the mobile app. Do not edit by hand       |

CSV columns: `date` (`YYYY-MM-DD` UTC), `close_<CURRENCY>`. Resolution is
weekly for older data and daily for recent entries, matching mempool storage.

CHF and JPY have fewer rows because mempool started those series later.

## Update

From the repo root:

```bash
pnpm prices:update
```

This fetches all seven currencies, rewrites the CSVs, and writes JSON under
`apps/mobile/assets/prices/`. Commit both CSVs and JSON.

Offline conversion (no network):

```bash
node btc_prices/update.mjs --from-csv
```

A weekly GitHub Action opens a PR with the same refresh.
