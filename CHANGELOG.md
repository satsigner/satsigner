# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-11-13

### Added

- **Payjoin** (BIP77 and BIP78) send and receive, with a manual offline PSBT
  handoff, directory or manual coordination modes, session expiry, and payjoin
  details on the send preview. Mixed-ownership transactions are labelled.
- **Replace-by-fee**: bump an unconfirmed transaction with a higher fee, with a
  replacement fee floor and optional extra confirmed UTXOs.
- **Bitcoin Core RPC backend**: sync, rescan (with wallet birthday and
  checkpoints), broadcast, and chain data over RPC, alongside Electrum and
  Esplora.
- **Explorer**: block, transaction, address, chain, halving, mempool, node and
  network pages; raw block hex with a hex dump and decoded view; raw
  transaction broadcast; fee and mempool backlog estimates.
- **Ark**: swaps between on-chain, Ark and Lightning; boarding in one
  transaction from any Satsigner wallet (also with payjoin); VTXO details with
  expiry and exit cost; tracking, funding and claiming exits; on-chain balance
  sweep; labels and tags on movements; full Ark state in backups.
- **Lightning**: LND REST client (lndconnect and gRPC pairing), on-chain
  receive and send, channel opening, invoice polling, and amountless BOLT11
  payments. Ecash multi-mint payments and proof restore from backups.
- **Nostr**: NIP-04 and NIP-17 direct messages with replies, reactions,
  deletion and proof of work; DM inbox split by follows; feed with likes,
  reposts, zaps and zap totals; note proof-of-work mining and deletion
  requests; relay settings and connection status; key QR codes (npub, hex,
  Lightning address).
- **Message signing**: BIP-137 and BIP-322 for P2WPKH and P2SH-P2WPKH, with
  low-R signatures.
- **UTXO control**: sort, group, filter (script and tag), exclude, and nested
  bubbles; Stonewall outputs ordered like Sparrow; privacy change and fake-mix
  outputs shown on charts.
- **Transactions**: Sankey flow charts with labels from previous transactions,
  wallet ownership annotations, historical fiat values resolved on device
  (opt-in), and signed drafts kept across restarts.
- Import a single-signature WIF as one address; view key material and WIF in
  address details.
- Encrypted backups now include labels, Ark, Lightning and ecash data, with a
  per-section summary.
- Stronger PIN key derivation, more PIN lengths, and a passphrase strength
  meter; reopen the last screen after unlocking.
- Warn before connecting to a public server; account syncs are queued and
  stalled ones over Tor are stopped.
- "Report a security issue" in Settings > About: an encrypted NIP-17 message
  to the project, anonymous by default.
- Developer diagnostics (crypto, entropy, PIN KDF, secure store, SQLite,
  NIP-17, relay and payjoin roundtrips) and an opt-in on-screen dev console.
- Onboarding intro and guided tour; converter with written numbers and
  date-anchored prices; drawing entropy for seed creation; share buttons on QR
  screens; wallets can be reordered.
- QR scanning on Android without Google ML Kit.

### Changed

- App fonts switched to Geist and Geist Mono.
- Stop gap can be set up to 200; long-press refresh forces a full rescan.
- Unused Android permissions removed; the release build enforces an allow list.

### Fixed

- Signing pasted or scanned PSBTs crashed on Hermes (`psbt.txid()` and
  `toReversed()` calls).
- First PIN setup hung on the confirm step on fresh installs.
- Nostr publishing raced relay handshakes; profiles never loaded for new
  identities.
- Receive QR codes no longer include `amount=0`; receive URIs are validated
  against the BIP-321 parser.
- Payjoin URI and replacement PSBT are kept in saved drafts.
- Many smaller layout, sync and translation fixes.

### Security

- Security policy (`SECURITY.md`) with a private Nostr NIP-17 reporting
  channel.
- Backups are encrypted with Argon2id and authenticated encryption.
- PIN secrets are never rolled back when the keychain is unreadable.

## [0.3.6] - 2026-06-10

### Changed

- Upgraded to Expo SDK 56.
- Upgraded Bark React Native Bindings to `0.8.0` and dropped the access token.
- New splash screen.
- Bitcoin icon now uses a stroke instead of a filled style.

### Fixed

- Added missing Ark i18n strings.
- Lock the Ark create form while the wallet is being created.
- Show pending sats in the Ark balance during refresh.
- `SSButton` tap blocked after the disabled state toggled.
- Replaced broken `absoluteFill` spread with `inset: 0`.
- Stopped the descriptor validity cache from poisoning unrelated inputs.
- Respect safe area insets on the sign-and-send and UTXO select screens.
- Stale selected UTXO total under react-compiler memoization.
- Hide the label placeholder in the bubble when a UTXO has no label.
- Electrum URL validation.
- Esplora API responses with extra or optional fields failing to parse.
- Incorrect usage of `useShallow` in explorer block transactions.
