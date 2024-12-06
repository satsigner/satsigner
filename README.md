# Satsigner

<img width="594" alt="image" src="https://user-images.githubusercontent.com/807505/183712134-d1f56508-4576-4c6b-b262-3e09dee9cd31.png">
https://twitter.com/pedromvpg/status/1553123963139756032

## Why work on this?

- Help build a powerful native mobile Bitcoin signer management application
- Contribute towards the integration, development and enhancement of Bitcoin UX design
- Unlock coin insights via integrated onchain (privacy/provenance/economic) analyses and corresponding data visualisation to help inform, encourage and automate better Bitcoin usage best-pratices
- Advance Bitcoin understanding
- Test market demand for bitcoin centric applications
- Propagate open-source ethos
- Build and support Bitcoin and related FOSS projects
- Participate in Bitcoin history

### Ethos/priorities/design philosophy

- Bitcoin only
- Sat denomination supremacy
- Initial focus on on-chain bitcoin (coin-control/controlling sats)
- Emphasis on privacy
- Emphasis on personal labeling, tagging, and bookmarking
- Application of visualisation/visual-native UI aiming to build upon and develop new Bitcoin design primitives to help make more advanced/poower-user Bitcoin UX/UI more intuitive and accessible
- Take advantage of appropriate charts and graphic layouts for all data vizualisation
- Security - targetting optimal hot-signer-level security initially (future support for watch-only cold, multisig, vaults etc)
- Visually crafted and UX builds upon powerful feattures and improvements introoduced by the many existing brilliant open-soouurce FullyNoded, or Sparrow
- An intuitive and powerful mobile bitcoin app

## Features

### Main features and goals

- Experimental bitcoin centric lexicon
  - Send bitcoin -> Sign bitcoin messages
  - Spend bitcoin -> Consume UTXO
  - Bitcoin balance -> Total spendable sats
  - Wallet -> Signer
  - Private key -> Account
  - Address -> Invoice
  - Transaction -> Message
  - (...)
- Bitcoin specific UX patterns
- Bitcoin technology education
- Visual personal chain analysis
- UTXO control
- Fully open source
- Easily reproducible
- Open source dependencies only
- Bitcoin interface exclusively via open source library

### Forward looking ambitions

- Mobile collaborative transaction interface (mobile joinmarket client?)
- Native lightning support built with LDK (keeping with UX/Data visual-focus)

## Stack

#### Backend

- [Bitcoin Development Kit](https://github.com/bitcoindevkit) via [RN-BDK](https://github.com/LtbLightning/bdk-rn) - becoming reference Bitcoin dev tools
- [Blockstream Electrs](https://github.com/Blockstream/electrs) - performant Bitcoin server interface/signer backend to bootstrap users who don't yet run their own node
- [Photon SDK](https://github.com/photon-sdk) - powerful mobile Bitcoin dev kit to build forgiving, easy backup and recovery, intuitive signers
- [Tor](https://www.torproject.org/) - private communications with your personal nodeserver/electrs

#### Frontend

- [React bubble chart](https://www.npmjs.com/package/react-bubble-chart)
- [React d3 tree](https://github.com/bkrem/react-d3-tree)

### Design/product inspiration + revered FOSS projects

- [Sparrow](https://github.com/sparrowwallet/sparrow) - very powerful and clean native Bitcoin signer management desktop app
- [FullyNoded](https://github.com/Fonta1n3/FullyNoded) - very powerful iOS app focused on remote full node management
- [BitFeed](https://github.com/bitfeed-project/bitfeed) - beautiful, psychedelic block/transaction/timechain visualisation
- [Mempool.space](https://github.com/mempool/mempool) - beautiful block explorer and Bitcoin data visualisations
- [Zeus](https://github.com/ZeusLN/zeus) - pretty, increasingly powerful remote LN node management app

## UI

<img width="1521" alt="image" src="https://user-images.githubusercontent.com/807505/186901157-c43ffea1-f38a-443a-b219-8886f67923a9.png">

## Concepts

![image](https://user-images.githubusercontent.com/807505/186901328-429c31e4-ad73-4d76-bdaa-3eb4fa201725.png)
UTXO selection

![image](https://user-images.githubusercontent.com/807505/186901348-0e566668-d056-441b-a692-25677b6da770.png)
Security

![image](https://user-images.githubusercontent.com/807505/186901366-01739b32-dea9-451a-800f-ab90e77cb1d1.png)
Verification

![image](https://user-images.githubusercontent.com/807505/186901387-7611d337-79a1-4a93-9ac5-61f60aae0518.png)
UTXO consumption

## Dev Environment Setup

### Prerequisites

- Node.js (minimum version 18)
- [Yarn](https://yarnpkg.com/getting-started/install)

### Install dependencies

Install the dependencies at the root of the repository

```bash
yarn install
```

### Set up your environment

Follow the expo documentation [here](https://docs.expo.dev/get-started/set-up-your-environment/)

Make sure to select "Development build" and disabled "Build with Expo Application Services (EAS)"

Note: When starting a development server, do NOT run: `npx expo start`

### Run the app

Make sure you are on the `mobile` folder

```bash
cd apps/mobile
```

Run for android or iOS

```bash
yarn android

yarn ios
```
