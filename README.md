![Satsigner Banner](https://github.com/user-attachments/assets/5690172b-17db-4d51-8033-9b7ed07bef50)

<div align="center">
  <h1>Satsigner</h1>
  <p>Privacy-first bitcoin signer with complete UTXO control</p>
  <a href="https://satsigner.com"><img alt="badge" src="https://shieldcn.dev/badge/satsigner.com.svg?logo=false"></a>
  <a href="https://satsigner.com/apk">
    <img alt="badge" src="https://shieldcn.dev/badge/Download%20latest%20APK.svg?variant=secondary&logo=lu%3ADownload">
  </a>
</div>

<br />

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/satsigner/satsigner/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/satsigner/satsigner/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/satsigner/satsigner/pulls)

</div>

<br />

Satsigner is a comprehensive Bitcoin wallet application built for users who demand complete control over their Bitcoin. Built on the Bitcoin Development Kit (BDK), Satsigner provides native support for single-signature, multi-signature, and watch-only accounts across mainnet, testnet, and signet networks. Focused on user experience for everyday use. It also allows easy movements between Bitcoin layers, enhancing the utility of your sats.

Read more about Satsigner [here](ABOUT.md) and check out the [features](FEATURES.md).

## Stack

- [Expo](https://expo.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Bitcoin Development Kit](https://bitcoindevkit.org/) via [react-native-bdk-sdk](https://npmx.dev/package/react-native-bdk-sdk)
- [Nostr Development Kit](https://nostr-dev-kit.github.io/ndk/)

## Inspiration

- [Sparrow](https://github.com/sparrowwallet/sparrow) - very powerful and clean native Bitcoin signer management desktop app
- [FullyNoded](https://github.com/Fonta1n3/FullyNoded) - very powerful iOS app focused on remote full node management
- [BitFeed](https://github.com/bitfeed-project/bitfeed) - beautiful, psychedelic block/transaction/timechain visualization
- [Mempool.space](https://github.com/mempool/mempool) - beautiful block explorer and Bitcoin data visualizations
- [Zeus](https://github.com/ZeusLN/zeus) - pretty, increasingly powerful remote LN node management app

## Clone with ngit

Pushes, pull requests, and Zapstore releases go through the local release page. It listens on `127.0.0.1`. The Nostr key stays in a NIP-07 browser extension.

```bash
pnpm --dir apps/release install
pnpm --dir apps/release dev
```

Open http://127.0.0.1:4717 and sign in (Alby or nos2x). The signer relay uses port `4718`.

**Sync with ngit** publishes the repository when `origin` is not a `nostr://` remote yet, then pushes the current branch. After the first publish the page prints the clone URL. The repository identifier is `satsigner`.

```bash
git clone nostr://<npub>/satsigner
```

A pull request is a branch whose name starts with `pr/`. Push that branch from the same page.

**Build and publish** sends the current Android release APK to Zapstore. **Build APK** saves a copy under `apps/mobile/dist/apks`. Details, including the tools each action expects, are in [apps/release/README.md](apps/release/README.md).

## Contributing

Thinking about contributing to Satsigner? Read more about it [here](CONTRIBUTING.md).

## Questions or issues

If you run into any issues at all, let us know:

- [X](https://x.com/satsigner)
- [Issue Tracker](https://github.com/satsigner/satsigner/issues)

## License

Released under the **MIT** license — see the [LICENSE](LICENSE) file for details.
