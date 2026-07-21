# CHANGELOG

## v0.3.6 (2026-06-10)

### Highlights

- Migrate to Expo SDK v56
- Ark updates https://github.com/satsigner/satsigner/pull/404
- Refactor, fixes and improvements

## v0.3.5 (2026-05-15)

### Fixes and improvements

- Import xpub
- Block account creation with same name as another
- Misc. fixes and improvements

## v0.3.4 (2026-04-29)

### Highlights

- Prefill LNURL pay amount with minSendable
- Allow users to export `bark` sqlite DB in Ark wallet settings
- Add Ark as an option to pay zaps on nostr notes

### Fixes and improvements

- bitcoinUnits utils
- Set `roundTxRequiredConfirmations` to `0` by default
- Guard `getConfirmWordCandidates` against empty word and short seeds
- Freeze decoy word candidates across renders

## v0.3.3 (2026-04-28)

### Highlights

- Add Ark LNURL withdraw receive flow
- Update `@secondts/bark-react-native` to `0.5.0`
- Option to add description on BOLT11 invoices

### Fixes and improvements

- Fix Ark `sendOnchain`/`offboard` hang via race-against-`MovementCreated` with 30s timeout
- Hide "exceeds balance" warning on Ark send confirm while mutation pending
- Extract `useArkSendNavigation` hook and compact send/receive action group
- Add scan-to-send shortcut on Ark account home

## v0.3.2 (2026-04-28)

### Highlights

- Implement Ark `sendOnchain` feature

### Fixes and improvements

- Fix Ark fee estimation UI flicker
- Guard Ark send confirm against re-entry
- Mute stale `bark.exit` start movements
- Fix refresh UI display
- Dedupe toast for same movement id
- Re-subscribe notifications and resync wallet when returning from background

## v0.3.1 (2026-04-28)

## Highlights

### Ark Fixes

- Run bark daemon when opening Bark wallet

## v0.3.0 (2026-04-27)

## Highlights

### Ark Payments

- Enable Ark Payment with [bark-react-native](https://npmx.dev/package/@secondts/bark-react-native)

## v0.2.1 (2026-04-12)

Version **before** the Expo SDK v55 migration.
