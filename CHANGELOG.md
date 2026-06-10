# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
