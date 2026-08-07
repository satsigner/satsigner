# Security Policy

SatSigner is self-custody Bitcoin software. Vulnerabilities here can put user
funds at risk, so we ask reporters to follow the process below and give us a
chance to ship a fix before details become public.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

The only way to contact the project privately is Nostr:

- Send a **NIP-17 gift-wrapped direct message** (kind 1059) to
  `npub1ewv0j6l7fplmadqmcmdywkff2snham403sensqlqavymt7fx7jfs58e60d`,
  published **only to that account's inbox relays** — the DM relay list
  advertised in its kind 10050 event. Any NIP-17-capable client resolves the
  inbox relays and delivers the gift wrap automatically.
- Do **not** use legacy NIP-04 DMs — they expose metadata and are not
  monitored. Do not broadcast the gift wrap to public relays beyond the
  inbox set.
- Reports sent through any other channel (GitHub issues, discussions, pull
  requests, public notes) are treated as public disclosure.
- You may report from a throwaway npub to remain pseudonymous.

Please include:

- A description of the vulnerability and its potential impact
- Affected version(s) and platform(s) (iOS / Android)
- Steps to reproduce or a proof of concept
- Any suggested remediation, if you have one

### What to expect

- **Acknowledgement** within 72 hours
- **Initial assessment** (severity, affected versions, remediation plan)
  within 7 days
- **Status updates** at least every 14 days until resolution
- **Coordinated disclosure** — we aim to release a fix before any public
  disclosure and will agree on a disclosure timeline with you. We credit
  reporters in the release notes and the published advisory unless you ask to
  remain anonymous.

We do not currently run a paid bug bounty program.

## Scope

In scope — issues in SatSigner code that could lead to:

- Theft or loss of funds (key/seed extraction, transaction manipulation,
  malicious address substitution, PSBT tampering)
- Exposure of secrets at rest (mnemonics, keys, PIN/Passphrase material,
  Nostr keys, RPC credentials)
- Bypass of authentication or duress-PIN behavior
- Cryptographic weaknesses in our usage (key derivation, encryption, random
  number generation)
- Network attacks against the app (cleartext traffic, malicious
  Electrum/Esplora/Nostr relay behavior not already covered by the trust
  assumptions below)

Out of scope:

- Vulnerabilities in third-party dependencies that are not exploitable through
  SatSigner (report them upstream instead)
- Attacks requiring a rooted/jailbroken device, physical access to an
  unlocked device, or a compromised operating system
- Social engineering, phishing, or compromised user devices/accounts
- Denial of service of public infrastructure (relays, Electrum servers)
- Issues in the docs site or CI that do not affect the shipped app

## Supported Versions

Only the latest released version of SatSigner receives security fixes. Fixes
ship in a new release; we do not backport patches to older versions.

| Version            | Supported |
| ------------------ | --------- |
| Latest release     | Yes       |
| Older releases     | No        |

## Security Model Notes

SatSigner is designed to minimize trust in networked services, but some trust
assumptions remain:

- **Electrum/Esplora servers** see the addresses you query. Use your own node
  or connect over Tor for privacy.
- **Nostr relays** are used for label sync and account backup; sensitive
  payloads are encrypted client-side before leaving the device.
- **Device security** is foundational: seed words and keys are encrypted at
  rest and gated by the device keystore and your PIN, but no app can protect
  secrets on a compromised operating system.

## Verifying Releases

Release builds are published on GitHub Releases and on Zapstore, where
releases are attested by the project's Nostr identity
(`npub1ewv0j6l7fplmadqmcmdywkff2snham403sensqlqavymt7fx7jfs58e60d`). Only
install builds obtained from these official channels.
