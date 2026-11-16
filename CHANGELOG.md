# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.8] - 2026-11-16

### Added

- **Payjoin** (BIP77 and BIP78) send and receive, with a manual offline PSBT
  handoff, directory or manual coordination modes, session expiry, and payjoin
  details on the send preview. Mixed-ownership transactions are labelled.
- **Fee bumping**: replace an unconfirmed transaction with a higher fee, cancel
  it by sending the funds back to yourself, or raise a stuck parent's fee with
  a child (CPFP). Replacements keep a fee floor and can add confirmed UTXOs.
- **Bitcoin Core RPC backend**: sync, rescan (with wallet birthday and
  checkpoints), broadcast, and chain data over RPC, alongside Electrum and
  Esplora.
- **Explorer**: address, transaction, chain, halving, mempool, node and
  network pages; raw block hex with a hex dump and decoded view; raw
  transaction broadcast; message verification; fee and mempool backlog
  estimates.
- **Ark**: swaps between on-chain, Ark and Lightning; boarding in one
  transaction from any Satsigner wallet (also with payjoin); VTXO details with
  expiry and exit cost; tracking, funding and claiming exits; on-chain balance
  sweep; labels and tags on movements; full Ark state in backups.
- **Lightning**: on-chain receive and send through LND, channel opening,
  invoice polling, and amountless BOLT11 payments; LND pairing with onion and
  base64 lndconnect URIs and gRPC pairing strings. Ecash multi-mint payments
  and proof restore from backups.
- **Nostr**: NIP-04 and NIP-17 direct messages with replies, reactions,
  deletion and proof of work; DM inbox split by follows; feed with likes,
  reposts, zaps from note cards, zap totals and video; long-form notes, polls
  and NIP-52 calendar events; Blossom media uploads and a file browser;
  profile editing; note proof-of-work mining and deletion requests; relay
  settings and connection status; key QR codes (npub, hex, Lightning address).
- **Message signing and verification**: BIP-137 for legacy and SegWit
  addresses, BIP-322 for SegWit and Taproot, with low-R signatures.
- **UTXO control**: sort, group, filter (script and tag), exclude, and nested
  bubbles; Stonewall outputs ordered like Sparrow; privacy change and fake-mix
  outputs shown on charts.
- **Transactions**: Sankey flow charts with labels from previous transactions,
  wallet ownership annotations, historical fiat values resolved on device
  (opt-in), and signed and unsigned drafts kept across restarts.
- History chart with a fiat value line at each day's price; choose the fiat
  price provider or a custom URL.
- Import Sparrow UR and BBQR animated descriptor and xpub QR codes; the master
  fingerprint is optional.
- Import a single-signature WIF as one address; view key material and WIF in
  address details.
- Encrypted backups (Settings > Developer) now include labels, Ark, Lightning
  and ecash data, with a per-section summary.
- Stronger PIN key derivation, more PIN lengths, and a passphrase strength
  meter; reopen the last screen after unlocking.
- The server status dot shows whether the server is your own node, private or
  public.
- Warn before connecting to a public server; account syncs are queued and
  stalled ones over Tor are stopped.
- Settings to hide the transaction flow chart and UTXO bubbles, pick the
  default UTXO auto-select method, and turn payjoin off.
- Changelog, version and social links in Settings > About.
- "Report a security issue" in Settings > About: an encrypted NIP-17 message
  to the project, anonymous by default.
- Developer diagnostics: crypto, entropy, PIN KDF, secure store, SQLite,
  NIP-17, relay and payjoin roundtrips.
- Onboarding intro and guided tour; converter with written numbers and
  date-anchored prices; drawing entropy for seed creation; share buttons on QR
  screens; wallets can be reordered.
- QR scanning on Android without Google ML Kit.
- Android builds are published on Zapstore.
- Transaction search: filter by label or txid, sent or received, tags, and a
  date range on a calendar or a two-thumb slider.
- The sample segwit wallet labels every transaction, UTXO and address, for
  demos.
- Receive: "Set date" converts the fiat amount at the price on a chosen day,
  from bundled price history or the network when allowed in settings.

### Changed

- Account sync shows addresses checked ("2/45 addresses") alternating with
  the check kind, and tapping it opens sync details with "Check all
  addresses" and "Deep rescan".
- **Breaking:** TLS certificates of `ssl://` Electrum servers are now verified,
  so servers with self-signed certificates fail. Install the CA on the device.
  `tcp://` still works on a trusted LAN, but it is unencrypted and does not
  authenticate the server, so anyone on the network can see wallet activity
  or impersonate the server.
- Upgraded to Expo SDK 58 and React Native 0.88.
- Large accounts load faster with fewer database queries.
- Switching between Electrum, Esplora and Bitcoin Core RPC no longer forces a
  full rescan.
- App fonts switched to Geist and Geist Mono.
- Stop gap can be set up to 200; long-press refresh forces a full rescan.
- Production Android APKs are ARM only and much smaller.
- Unused Android permissions removed; the release build enforces an allow list.
- Launcher and store icons fill the whole shape instead of a round logo with
  white corners.
- Dev and branch builds carry a coloured badge on the icon.
- Self-sends are tagged `#selfsend` on sync.
- Fiat Data settings are split into current price, historical prices and
  price provider, and say where each price comes from and what is sent.
- Transactions show automatic `#consolidation`, `#payjoin`, `#dust` and `#rbf`
  tags, worked out from the transaction and drawn as outlines.

### Removed

- "Set PIN later". Skipping the PIN used to encrypt seeds with a fixed default
  PIN; users who skipped it are asked to set a PIN after upgrading.

### Fixed

- Android back closes select modals, and leaves User coin selection when no
  inputs were picked.
- Signing pasted or scanned PSBTs crashed on Hermes (`psbt.txid()` and
  `toReversed()` calls).
- Multisig: each key keeps its own origin path, `sh(wsh())` descriptors parse,
  BIP-380 checksums are verified, keys for another network and unsorted
  `multi()` are rejected, and mnemonic keys export the right script type.
- Accounts on another signet (such as Mutinynet) mixed balances and
  transactions; they are now detected and rescanned.
- A slow or unreachable Electrum server froze or crashed the app; large
  backups froze the recover screen.
- Changing a chart setting could reset a custom server to mempool.space.
- Sending: turning RBF off still signalled RBF, a typed fee rate was ignored,
  weight and vsize ignored the witness discount, rescans dropped excluded
  UTXOs, and the auto-sync delay was inverted. The timelock option never set a
  timelock and is hidden.
- Ecash tokens from mints with v2 keyset ids could not be read.
- Receive QR codes no longer include `amount=0`; receive URIs are validated
  against the BIP-321 parser.
- Swiping back reached the PIN screen, toasts showed behind modals, the
  keyboard covered inputs, and "No transactions" showed while syncing.
- The app crashed on launch on Android 14 and newer: `expo-screen-capture`
  registered a screenshot listener that needs a permission Satsigner blocks.
  It is now built from patched source and skips the listener; screenshots are
  still blocked on secret screens.
- Syncing over Electrum or Esplora failed with "Cannot lower this object to a
  pointer", most visibly on the first sync after restoring a backup. The
  UniFFI runtime in `@ubjs/core` rejected the JavaScript progress inspector
  passed to the scan.
- The Zapstore description keeps its line breaks.
- Many smaller layout, sync and translation fixes.

### Security

- Electrum data is cross-checked: transactions against their txid, and each
  UTXO's value and script against the transaction that created it. This does
  not prove the transaction is in a block, so a malicious server can still
  present a fabricated deposit; use your own node for full assurance.
- Signing refuses a foreign or changed PSBT returned by a cosigner or
  coordinator; the transaction you review is the one broadcast.
- Nostr keys, LND macaroons and certificates, and Bitcoin Core RPC credentials
  are encrypted with the PIN at rest.
- Screenshots and screen recording are blocked on seed, private key, WIF, nsec
  and ecash secret screens.
- The wrong-PIN wipe survives restarts and wipes every secret; Change PIN
  counts attempts; a deep link can no longer replace the PIN while locked.
- Locking the app stops syncs, NIP-46 sessions and Ark daemons, and clears
  cached secrets.
- Nostr: NIP-17 seal signatures and senders are verified, label sync only
  imports from trusted devices, and NIP-46 approvals show the full content and
  always ask for sensitive kinds and decryption.
- LNURL-pay invoices must match the requested amount, and LNURL requires
  HTTPS.
- Dice and coin-flip seed entropy is conditioned with SHA-512 and warns on
  weak input.
- Backups are encrypted with Argon2id and authenticated encryption.
- Security policy (`SECURITY.md`) with a private Nostr NIP-17 reporting
  channel.

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
