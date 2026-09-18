# BTC historical price data

Static dataset of Bitcoin historical prices from the
[mempool.space public API](https://mempool.space/docs/api/rest). SatSigner
bundles these JSON files so historical fiat on a transaction date can be
resolved **on device** without sending timestamps to a price server.

Spot prices can still come from the live API. Historical lookups use this
bundle by default. Users who opt in (Fiat Data settings) may fetch missing
dates from the API; that **sends transaction timestamps**.

Do not edit these files by hand. Each currency file stores `times` (unix
seconds, UTC) and `prices` in lockstep. Resolution is weekly for older data
and daily for recent entries, matching mempool storage.

CHF and JPY have fewer rows because mempool started those series later.

## Update

From the repo root:

```bash
pnpm prices:update
```

This runs `apps/mobile/scripts/update-btc-prices.mjs`, fetches all seven
currencies, and rewrites this directory. Commit the JSON files.

A weekly GitHub Action (`.github/workflows/update-btc-prices.yml`) opens a PR
with the same refresh.
