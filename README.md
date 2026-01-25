# Satsigner

**Privacy-first Bitcoin signer with complete UTXO control**

<img width="3508" height="2480" alt="image" src="https://github.com/user-attachments/assets/5690172b-17db-4d51-8033-9b7ed07bef50" />

## Why work on this?

Satsigner is a comprehensive Bitcoin wallet application built for users who demand complete control over their Bitcoin. Built on the Bitcoin Development Kit (BDK), Satsigner provides native support for single-signature, multi-signature, and watch-only accounts across mainnet, testnet, and signet networks. Focused on user experience for everyday use. It also allows easy movements between Bitcoin layers, enhancing the utility of your sats.

**Why contribute?**

- Help build a powerful native mobile Bitcoin signer management application
- Contribute towards the integration, development and enhancement of Bitcoin UX design
- Unlock coin insights via integrated onchain (privacy/provenance/economic) analyses and corresponding data visualization to help inform, encourage and automate better Bitcoin usage best-practices
- Advance Bitcoin understanding through visual tools and Bitcoin-native terminology
- Test market demand for bitcoin centric applications
- Propagate open-source ethos
- Build and support Bitcoin and related FOSS projects
- Participate in Bitcoin history

### Ethos/priorities/design philosophy

- **Bitcoin On Chain First**: Full vertical support of all things sats with on chain as the safe layer of last resort
- **Sat denomination supremacy**: Sats as the primary unit
- **Complete UTXO control**: Full control over coin selection and spending
- **Privacy first**: Emphasis on privacy-enhancing features and no tracking
- **Visual-native UI**: Comprehensive visualization tools for all Bitcoin data
- **Bitcoin-native terminology**: Using Bitcoin's true language (UTXOs, transactions, signers)
- **Security focused**: PIN-protected encryption, seed dropping, multi-signature support
- **Open source**: Fully auditable codebase with open-source dependencies only
- **User sovereignty**: Complete control over keys, data, and privacy
- **Educational**: Learn Bitcoin while using it with visual tools and explanations
- **Design inspiration**: Builds upon powerful features from Sparrow, FullyNoded, and other brilliant open-source projects

## Features

### Core Bitcoin Features

- **Full UTXO Control**: Visual bubble charts and detailed selection tools for complete UTXO management
- **Multi-Signature Support**: M-of-N multisig wallets with sortedmulti descriptors and per-cosigner PSBT tracking
- **Account Types**: Single-signature, multi-signature, and watch-only accounts
- **Script Versions**: Support for all Bitcoin script types (P2PKH, P2SH-P2WPKH, P2WPKH, P2TR, P2WSH, P2SH-P2WSH, P2SH)
- **Network Support**: Mainnet, testnet, and signet
- **Dual Backends**: Electrum Protocol and Esplora API support
- **BIP329 Labeling**: Comprehensive labeling system for transactions, addresses, and UTXOs
- **Advanced Transaction Building**: Manual fee control, RBF, time-locks, and custom output configuration

### Security & Privacy

- **PIN Protection**: AES-256-CBC encryption with PIN-protected access
- **Seed Dropping**: Remove mnemonics after key extraction for enhanced security
- **Duress PIN**: Support for duress scenarios
- **Encrypted Storage**: All sensitive data encrypted at rest
- **No Tracking**: No third-party tracking or analytics
- **Open Source**: Fully auditable codebase

### Visualization & Analysis

- **UTXO Bubble Charts**: Interactive visual UTXO selection
- **Sankey Diagrams**: Transaction flow visualization
- **Transaction Charts**: Visual transaction analysis
- **Fee Rate History**: Mempool statistics and fee rate charts
- **Balance Evolution**: Timeline charts showing balance changes
- **Network Statistics**: Difficulty charts and blockchain explorer

### Multi-Signature Workflow

- **Collaborative Signing**: Per-cosigner PSBT tracking and combination
- **QR Code Seed Scanning**: Air-gapped signing with seed QR codes
- **Signature Validation**: Automatic threshold verification
- **Individual PSBT Export**: Export per-cosigner signed PSBTs
- **Fingerprint Matching**: Account association verification

### Export & Import

- **Descriptors**: Export/import output descriptors with checksum validation
- **Extended Public Keys**: Export/import xpub/ypub/zpub/vpub with format conversion
- **BIP329 Labels**: Import/export labels in JSON, JSONL, and CSV formats
- **PSBT Support**: Full PSBT import/export with QR code and NFC support
- **Account Backup**: Comprehensive backup and recovery options

### Lightning Network & eCash

- **LND Integration**: Connect to LND nodes via REST API
- **Lightning Payments**: Create and pay Lightning invoices
- **eCash (Cashu)**: Private digital cash support with mint management
- **Token Operations**: Receive, send, and manage eCash tokens

### Nostr Integration

- **Label Synchronization**: Decentralized label sync via Nostr DMs
- **Auto-Sync**: Automatic label synchronization configuration
- **Relay Management**: Add and manage Nostr relays
- **Trusted Devices**: Manage trusted device list for secure sync

### Explorer & Tools

- **Blockchain Explorer**: View blocks, transactions, and network statistics
- **Currency Converter**: Real-time fiat conversion with historical rates
- **Energy Converter**: Bitcoin to energy unit conversions
- **Network Analysis**: Difficulty charts and mining statistics

### Developer Features

- **Storybook Integration**: Component development in isolation
- **TypeScript**: Full type safety throughout
- **Comprehensive Testing**: Unit and integration tests
- **Open Source**: MIT licensed, fully auditable codebase

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
- [BitFeed](https://github.com/bitfeed-project/bitfeed) - beautiful, psychedelic block/transaction/timechain visualization
- [Mempool.space](https://github.com/mempool/mempool) - beautiful block explorer and Bitcoin data visualizations
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

- Node.js (minimum version 22.4.0)
- [Yarn](https://yarnpkg.com/getting-started/install)

```bash
npm install --global yarn
```

### Install dependencies

Install the dependencies at the root of the repository

```bash
yarn install
```

### Set up Android environment

Set up Android Studio as usual. Otherwise, if you are using other IDE,
then install the packages `android-sdk`, `android-sdk-build-tools`,
`android-sdk-platform-tools`, and `android-tools`.

Once installed, set the environment variable `ANDROID_HOME` to point to
the location where the packages were installed, and update your `PATH`:

```bash
export ANDROID_HOME=/opt/android-sdk
export PATH=${PATH}:${ANDROID_HOME}/tools:${ANDROID_HOME}/tools/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/emulator
```

On some Linux systems, `ANDROID_HOME` may be `/opt/android-sdk`. On Windows,
it may be `/Users/username/Library/Android/sdk`. Set it accordingly.

Install Java JDK 8 in order to download the images from the upstream.
Also, make sure to enable JDK 8 before running `sdkmanager` commands,
because they seem to work only with this version. To enable it on
arch-based systems, run:

```bash
sudo archlinux-java set java-8-openjdk
```

This will make JDK 8 the default Java environment. We can then proceed to
using `sdkmanager`.

You can list the images with the following command:

```bash
sdkmanager --list
```

Select the SDK that fits your platform (`x86_64`, `arm64`, or other). Then
install the image with the command:

```bash
sdkmanager --install 'system-images;android-34;default;x86_64'
```

Of course, replace `system-images;android-34;default;arm64-v8a` with
the desired image name. This examples uses the default image for Android
SDK 34 for the `x86_64` (intel CPU) platform.

Then, create an emulator device:

```bash
avdmanager create avd -n myemulator -k 'system-images;android-34;default;x86_64'
```

Replace `myemulator` with the desired name for the emulator device and replace
`system-images;android-34;default;x86_64` with the image downloaded earlier.

Once the device has been created, switch your Java environment to **JDK 17** in
order to run and build this application. If you choose not use a device emulator
but use a physical one, then you would skip the previous steps (and not download
Java 8) but you still have to install Java 17 and set it as the default version.

Lastly, if you get the error `[CXX5304]` while building, try running `unset
_JAVA_OPTIONS` because this variable is sourced automatically and may pass
options that interfere with the building.

### Path issues

#### Windows users

Use `gitbash` as your shell instead of `powershell`. Then, create the
file `.bash_profile` in your home directory. It will be located in
`C:\Users\user\.bash_profile`, where `user` is your username. You can
create this file via the file explorer, via some IDE, or via the bash shell:

```bash
touch /c/Users/user/.bash_profile
```

Once created, open it in your editor or IDE and append the following lines:

```bash
export PATH="/c/Users/user/AppData/Local/Android/Sdk/platform-tools:$PATH"
export PATH="/c/Program Files/Java/jdk-17/bin:$PATH"
export ANDROID_HOME="/c/Users/user/AppData/Local/Android/Sdk"
```

Of course, change `user` to your username.

This will update your environment variables to include the binaries from Android
SDK and Java JDK 17, which you must have installed to develop satsigner.

#### Linux users

Update your `PATH` to include the directories `/opt/android-sdk/tools`,
`/opt/android-sdk/platform-tools`, and `/opt/android-sdk/tools/bin`. If you
want to use the emulator, also add the directory `/opt/android-sdk/emulator`
into your `PATH`.

```bash
export PATH=$PATH:${ANDROID_HOME}/tools:${ANDROID_HOME}/tools/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/emulator
```

**Tip**: use the tool `direnv` which loads environment variables dynamically
from a file called `.envrc` in the current directory (if it exists). To do
that, install and enable `direnv`, then create the file `apps/mobile/.envrc`
and place the content of the previous code block there.

### Set up Expo environment

Follow the expo documentation [here](https://docs.expo.dev/get-started/set-up-your-environment/)

Make sure to select "Development build" and disable "Build with Expo Application Services (EAS)"

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
