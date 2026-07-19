# Changelog

## Unreleased

- Bitcoin Core RPC sync: connect to a full node over RPC to sync wallets, broadcast
  transactions, track chain tip data, and run wallet rescans, alongside the existing
  Electrum backend.
- Wallet rescan: set a wallet birthday and force a full rescan from account settings
  or a long-press on the refresh control.
- Sankey / privacy chart improvements: classify received vs. outgoing outputs, resolve
  prior-tx and change/fake-mix labels, surface stonewall payment previews with
  Sparrow-style input ordering, detect underfunded/high-fee transactions, and detect
  orphaned inputs when UTXOs are spent during sync.
- Ark: VTXO bubble visualization, refresh controls with next-expiry countdown, select/
  deselect all VTXOs, receive overlay animation, labels/tags on movements, force full
  rescan, board/offboard/emergency-exit flow, and UI parity with the Bitcoin tab.
- Transaction labels: improved label editing/keyboard flow on transaction screens, and
  labels are now included in encrypted backups.
- Nostr: generate personal device Nostr keys from the BIP39 seed, and pay zaps using
  Ark.
- Broadcast success is now shown with an animated check icon.
- Fiat price settings: choose and configure the fiat price data provider.
- Converter: support written numbers, European number scale, and date-anchored price
  conversion.
- Numerous fixes across sync, transaction charts, privacy builds, and mobile UI.

## 0.3.6 (2026-06-10)

- Migrated to Expo SDK 56.
- Added development and production app variants (separate bundle IDs/icons for local
  testing vs. release builds).
- Assorted bug fixes and internal refactors.

## 0.3.5 (2026-05-14)

- Nostr: redesigned profile hero card (banner, avatar overlay, lightning icon),
  tap-to-profile from zapper cards, NIP-05 validation, NIP-51 bookmarks, npub/nprofile
  mention resolution, image viewer with EXIF metadata and swipe-to-dismiss, and quote
  note support.
- Transaction charts: Sankey ribbon visualization, unspent-output labeling, and
  dynamic layout/extent calculations for the current-transaction chart.
- Added an orphaned-input detector that flags transactions whose inputs were spent
  elsewhere during sync.
- Animated tab bar with gradient backgrounds, including a dedicated converter tab
  gradient.
- Camera: zoom and lens selection in the QR scanner modal.
- Lightning: transaction detail page with status badges and raw transaction data.
- Ecash: improved spent-proof error handling and mint selector integration.
- Backup/recovery: QR-based recovery flow, and Ark/Lightning/Nostr identity state
  included in backup restoration.
- Added LND REST API connection string support and reusable duress-PIN logic.

## 0.3.4 (2026-04-29)

- Ark: pay Nostr zaps with Ark, LNURL withdraw amount prefill, and comment field
  handling per LNURL server support.
- Added bolt11 invoice description field and a database export option.
- Fixed decoy seed-word candidate freezing and short-seed candidate generation edge
  cases.
- Added unit tests for newly introduced utility functions.

## 0.3.3 (2026-04-28)

- Ark: LNURL withdraw receive flow, extracted send-navigation hook, and a timeout
  guard for hung send/offboard requests.
- Fixed the exceeds-balance warning showing while a send is still pending.

## 0.3.2 (2026-04-28)

- Ark: on-chain send support and muting of stale exit-start movement notifications.
- Fixed a fee-estimate flicker and guarded send confirmation against re-entry.
- Deduplicated toast notifications for the same movement ID.

## 0.3.1 (2026-04-27)

- Updated the Bark (Ark) client library.

## 0.3.0 (2026-04-27)

- Ark support: create and manage Ark accounts, balances, receive, delete, offboard,
  Bark push notifications, and deep-linked access tokens.
- Send flow: fee estimation and a rebuilt send screen.
- Ecash: wallet management, account details, and an improved token redemption flow
  with status checks and warnings.
- Nostr: identity key management, NIP-46 bunker connect, relay reachability caching,
  zap details, notes, following list, and profile navigation.
- Lightning: LND node dashboard for retrieving node data.
- Transaction UI: decoded-transaction viewer with ASCII/hex toggles, formatted
  transaction IDs, dust handling and fee optimization in I/O preview, and a Bitcoin
  URI balance confirmation prompt.
- Draft transactions now persist per account with a discard action.
- Privacy mode for account balances, connection status indicators, and haptics.
- Total balance across accounts shown in the account list.
- Added a virtual keyboard (SSKeyboard) with clear/delete/reset controls.
- Numerous fixes and refactors across transaction display, Nostr, and Ark flows.

## 0.2.1 (2026-03-28)

Detailed changelog not available.
