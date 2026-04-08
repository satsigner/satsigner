## Features

<img width="1521" alt="image" src="https://user-images.githubusercontent.com/807505/186901157-c43ffea1-f38a-443a-b219-8886f67923a9.png">

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
