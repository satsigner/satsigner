# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- NIP-04 + NIP-17 direct messages in the nostr identity section: conversation
  lists per protocol, thread view with composer, new-message modal (contacts or
  npub), and focus-scoped relay subscriptions with local SQLite history.
- "Report a security issue" in Settings > About: sends an encrypted NIP-17
  message to the project npub, anonymous by default (throwaway key) or from the
  active identity for a reply channel; shows the publish relays up front and a
  confirmation screen with the exact sent message.
- Settings and About links above the version in the side navigation.
- One-click developer diagnostics (Settings > Developer > Diagnostics): crypto
  roundtrip, entropy collision test against the device RNG, PIN KDF, secure
  store, SQLite integrity, NIP-17 wrap/unwrap, and a live relay roundtrip that
  publishes a test gift wrap to the project security npub and verifies
  retrieval + decryption.
- Dev console now logs symbolicated source file:line for crashes and unhandled
  promise rejections (Metro symbolication via the same path LogBox uses).

### Fixed

- Signing a transaction crashed with "undefined is not a function":
  `psbt.txid()` was called unguarded though the stored PSBT is not always a BDK
  Psbt instance; the txid now derives from the PSBT bytes (ground truth) with a
  guarded fallback.
- `TypedArray.prototype.toReversed()` is missing in Hermes — replaced the
  remaining bare call sites (PSBT input extraction, Electrum scripthash,
  energy converter) with the established `Buffer.from(x).reverse()` pattern.
  This was the actual blocker for signing pasted/scanned PSBTs.
- First-ever PIN set hung forever on the confirm step on fresh installs
  (`getPin()` throws before any PIN exists since the security hardening).
- Event publishing raced relay TLS handshakes and failed with "failed to
  publish on any relay"; publishing now waits for at least one connected relay
  and sends only to connected sockets.
- Nostr kind0 profile name/image never loaded for freshly created identities:
  identities now connect relays by default and relay resolution falls back to
  the well-known indexing relays when none are configured.
- Left-aligned the security report message textarea.
- Receive QR codes no longer emit `amount=0` for zero-satoshi requests, and
  receive URIs are now round-trip validated against the real BIP-321 parser in
  tests (plain, amount, label, and payjoin variants).
- "Follow us" links on About now render as a centered, aligned row.

### Security

- Security policy (`SECURITY.md`) with a Nostr NIP-17 private reporting channel
  (project npub inbox relays).

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
