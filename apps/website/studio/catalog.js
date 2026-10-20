const screens = [
  { n: 0, id: 'intro', name: 'Intro', view: 'view-intro', source: 'Home splash' },
  { n: 1, id: 'signer', name: 'Signer', view: 'view-menu', source: 'Signer tab' },
  { n: 2, id: 'explorer', name: 'Explorer', view: 'view-menu', source: 'Explorer tab' },
  { n: 3, id: 'difficulty', name: 'Difficulty', view: 'view-kit', source: 'Difficulty epoch' },
  { n: 4, id: 'explorer-address', name: 'Address', view: 'view-kit', source: 'Address lookup' },
  { n: 5, id: 'explorer-address-detail', name: 'Address detail', view: 'view-kit', source: 'Balance and UTXOs' },
  { n: 6, id: 'explorer-address-verify', name: 'Verify message', view: 'view-kit', source: 'Signature check' },
  { n: 7, id: 'explorer-transaction', name: 'Transaction', view: 'view-kit', source: 'Transaction lookup' },
  { n: 8, id: 'explorer-transaction-detail', name: 'Transaction detail', view: 'view-kit', source: 'Inputs and outputs' },
  { n: 9, id: 'explorer-node', name: 'Node', view: 'view-kit', source: 'Node info' },
  { n: 10, id: 'explorer-network', name: 'Network', view: 'view-kit', source: 'Network stats' },
  { n: 11, id: 'explorer-block', name: 'Block', view: 'view-kit', source: 'Block lookup' },
  { n: 12, id: 'explorer-block-detail', name: 'Block detail', view: 'view-kit', source: 'Header and analytics' },
  { n: 13, id: 'explorer-block-hex', name: 'Block hex', view: 'view-kit', source: 'Raw, dump, decoded' },
  { n: 14, id: 'explorer-block-transactions', name: 'Block transactions', view: 'view-kit', source: 'Transaction list' },
  { n: 15, id: 'explorer-chain', name: 'Chain', view: 'view-kit', source: 'Chain overview' },
  { n: 16, id: 'explorer-chaintip', name: 'Chaintip', view: 'view-kit', source: 'Latest block' },
  { n: 17, id: 'explorer-halving', name: 'Halving', view: 'view-kit', source: 'Subsidy schedule' },
  { n: 18, id: 'explorer-mempool', name: 'Mempool', view: 'view-kit', source: 'Fee market' },
  { n: 19, id: 'accounts', name: 'Bitcoin', view: 'view-kit', source: 'Accounts' },
  { n: 20, id: 'converter', name: 'Converter', view: 'view-menu', source: 'Converter tab' },
  { n: 21, id: 'currency', name: 'Currency', view: 'view-kit', source: 'Currency converter' },
  { n: 22, id: 'account', name: 'Account', view: 'view-kit', source: 'Account overview' },
  { n: 23, id: 'tx', name: 'Transaction', view: 'view-kit', source: 'Transaction details' },
  { n: 24, id: 'coins', name: 'Coins', view: 'view-kit', source: 'Account coins tab' },
  { n: 25, id: 'chart', name: 'Chart', view: 'view-kit', source: 'Account chart' },
  { n: 26, id: 'send', name: 'Send', view: 'view-send', source: 'Send form' },
  { n: 27, id: 'output', name: 'Output', view: 'view-send', source: 'Output amount and label' },
  { n: 28, id: 'payjoin', name: 'Payjoin', view: 'view-send', source: 'Send with Payjoin' },
  { n: 29, id: 'preview', name: 'Preview', view: 'view-preview', source: 'Transaction preview' },
  { n: 30, id: 'builder', name: 'Transaction IO', view: 'view-kit', source: 'Transaction flow' },
  { n: 31, id: 'sign', name: 'Sign', view: 'view-sign', source: 'Payjoin sign' },
  { n: 32, id: 'psbt-qr', name: 'UQR', view: 'view-kit', source: 'UQR export' },
  { n: 33, id: 'sent', name: 'Sent', view: 'view-sent', source: 'Transaction broadcasted' },
  { n: 34, id: 'coin-list', name: 'Select inputs', view: 'view-kit', source: 'Spendable outputs' },
  { n: 35, id: 'coin-bubbles', name: 'Select inputs (bubbles)', view: 'view-kit', source: 'Bubble chart' },
  { n: 36, id: 'exclude-utxos', name: 'Excluded UTXOs', view: 'view-kit', source: 'Include again' },
  { n: 37, id: 'fee-management', name: 'Fee management', view: 'view-kit', source: 'Replace by fee' },
  { n: 38, id: 'timelock', name: 'Timelock', view: 'view-kit', source: 'Block height or date' },
  { n: 39, id: 'wallet-synced', name: 'Wallet synced', view: 'view-kit', source: 'Sync before sending' },
  { n: 40, id: 'ark', name: 'Ark', view: 'view-kit', source: 'Ark accounts' },
  { n: 41, id: 'ark-account', name: 'Ark account', view: 'view-kit', source: 'Vtxos' },
  { n: 42, id: 'lightning', name: 'Lightning', view: 'view-kit', source: 'LND node landing' },
  { n: 43, id: 'lightning-node', name: 'Lightning node', view: 'view-kit', source: 'Channels' },
  { n: 44, id: 'lightning-rest', name: 'LND REST', view: 'view-kit', source: 'REST connection' },
  { n: 45, id: 'lightning-rpc', name: 'LND RPC', view: 'view-kit', source: 'RPC connection' },
  { n: 46, id: 'ecash', name: 'ECash', view: 'view-kit', source: 'Cashu accounts' },
  { n: 47, id: 'ecash-account', name: 'ECash account', view: 'view-kit', source: 'Mint balance' },
  { n: 48, id: 'ecash-send', name: 'ECash send', view: 'view-kit', source: 'Send token' },
  { n: 49, id: 'ecash-receive', name: 'ECash receive', view: 'view-kit', source: 'Receive token' },
  { n: 50, id: 'ecash-add', name: 'Add ECash', view: 'view-kit', source: 'Add account' },
  { n: 51, id: 'nostr', name: 'Nostr', view: 'view-kit', source: 'Identities' },
  { n: 52, id: 'nostr-account', name: 'Nostr account', view: 'view-kit', source: 'Identity' },
  { n: 53, id: 'nostr-relays', name: 'Nostr relays', view: 'view-kit', source: 'Relay list' },
  { n: 54, id: 'nostr-add', name: 'Add Nostr', view: 'view-kit', source: 'Add identity' },
  { n: 55, id: 'new-account', name: 'New account', view: 'view-kit', source: 'Name and policy' },
  { n: 56, id: 'new-singlesig', name: 'New single-sig', view: 'view-kit', source: 'Entropy choice' },
  { n: 57, id: 'entropy-dice', name: 'Dice', view: 'view-kit', source: 'Dice entropy' },
  { n: 58, id: 'entropy-coin', name: 'Coin flips', view: 'view-kit', source: 'Coin entropy' },
  { n: 59, id: 'entropy-drawing', name: 'Drawing', view: 'view-kit', source: 'Drawing entropy' },
  { n: 60, id: 'multisig-setup', name: 'Multisig policy', view: 'view-kit', source: 'Key count and script' },
  { n: 61, id: 'multisig-keys', name: 'Multisig keys', view: 'view-kit', source: 'Cosigner manager' },
  { n: 62, id: 'multisig-key', name: 'Key settings', view: 'view-kit', source: 'Generate a cosigner' },
  { n: 63, id: 'multisig-settings', name: 'Multisig settings', view: 'view-kit', source: 'Account keys' },
  { n: 64, id: 'multisig-sign', name: 'Multisig sign', view: 'view-kit', source: 'Collect signatures' },
  { n: 65, id: 'account-receive', name: 'Receive', view: 'view-kit', source: 'Address and QR' },
  { n: 66, id: 'account-address', name: 'Address', view: 'view-kit', source: 'Address detail' },
  { n: 67, id: 'account-address-label', name: 'Address label', view: 'view-kit', source: 'Label and tags' },
  { n: 68, id: 'account-address-sign', name: 'Sign message', view: 'view-kit', source: 'Sign with address' },
  { n: 69, id: 'account-address-verify', name: 'Verify message', view: 'view-kit', source: 'Verify signature' },
  { n: 70, id: 'account-tx-label', name: 'Transaction label', view: 'view-kit', source: 'Label a transaction' },
  { n: 71, id: 'account-utxo', name: 'UTXO', view: 'view-kit', source: 'Output detail' },
  { n: 72, id: 'account-utxo-label', name: 'UTXO label', view: 'view-kit', source: 'Label an output' },
  { n: 73, id: 'import-outputs', name: 'Import outputs', view: 'view-kit', source: 'Paste outputs' },
  { n: 74, id: 'account-birthday', name: 'Wallet birthday', view: 'view-kit', source: 'Block or date' },
  { n: 75, id: 'account-export-descriptor', name: 'Export descriptor', view: 'view-kit', source: 'Key descriptor' },
  { n: 76, id: 'account-export-descriptors', name: 'Export descriptors', view: 'view-kit', source: 'Account descriptors' },
  { n: 77, id: 'account-export-labels', name: 'Export labels', view: 'view-kit', source: 'BIP329 labels' },
  { n: 78, id: 'account-export-pubkeys', name: 'Export public keys', view: 'view-kit', source: 'All keys' },
  { n: 79, id: 'account-export-public-key', name: 'Export public key', view: 'view-kit', source: 'One key' },
  { n: 80, id: 'account-export-seed-words', name: 'Seed words', view: 'view-kit', source: 'Reveal mnemonic' },
  { n: 81, id: 'account-import-labels', name: 'Import labels', view: 'view-kit', source: 'Paste labels' },
  { n: 82, id: 'account-manage-addresses', name: 'Manage addresses', view: 'view-kit', source: 'Watched addresses' },
  { n: 83, id: 'account-nostr', name: 'Nostr sync', view: 'view-kit', source: 'Device sync' },
  { n: 84, id: 'account-nostr-device', name: 'Nostr device', view: 'view-kit', source: 'Device detail' },
  { n: 85, id: 'account-nostr-group-chat', name: 'Devices chat', view: 'view-kit', source: 'Group chat' },
  { n: 86, id: 'account-nostr-key', name: 'Nostr key', view: 'view-kit', source: 'Sync key' },
  { n: 87, id: 'account-nostr-relays', name: 'Sync relays', view: 'view-kit', source: 'Select relays' },
  { n: 88, id: 'add-generate-mnemonic', name: 'Generate mnemonic', view: 'view-kit', source: 'New seed' },
  { n: 89, id: 'add-confirm-word', name: 'Confirm word', view: 'view-kit', source: 'Seed check' },
  { n: 90, id: 'add-created', name: 'Account created', view: 'view-kit', source: 'Done' },
  { n: 91, id: 'add-import-mnemonic', name: 'Import mnemonic', view: 'view-kit', source: 'Seed words' },
  { n: 92, id: 'add-import-descriptor', name: 'Import descriptor', view: 'view-kit', source: 'Descriptor' },
  { n: 93, id: 'add-import-descriptor-from-account', name: 'Descriptor from account', view: 'view-kit', source: 'Pick account' },
  { n: 94, id: 'add-import-xpub', name: 'Import xpub', view: 'view-kit', source: 'Extended public key' },
  { n: 95, id: 'add-import-unified', name: 'Import unified', view: 'view-kit', source: 'Xpub or descriptor' },
  { n: 96, id: 'add-multisig-export-descriptor', name: 'Multisig descriptor', view: 'view-kit', source: 'Export' },
  { n: 97, id: 'add-multisig-export-public-key', name: 'Multisig public key', view: 'view-kit', source: 'Export' },
  { n: 98, id: 'add-multisig-export-seed-words', name: 'Multisig seed words', view: 'view-kit', source: 'Export' },
  { n: 99, id: 'add-multisig-finish', name: 'Multisig finish', view: 'view-kit', source: 'Create account' },
  { n: 100, id: 'add-multisig-import-descriptor', name: 'Multisig import', view: 'view-kit', source: 'Descriptor' },
  { n: 101, id: 'add-watch-only', name: 'Watch only', view: 'view-kit', source: 'Watch-only account' },
  { n: 102, id: 'settings', name: 'Settings', view: 'view-kit', source: 'App settings' },
  { n: 103, id: 'settings-network', name: 'Network', view: 'view-kit', source: 'Bitcoin network' },
  { n: 104, id: 'settings-network-detail', name: 'Network detail', view: 'view-kit', source: 'Per-network config' },
  { n: 105, id: 'settings-network-server', name: 'Server', view: 'view-kit', source: 'Backend servers' },
  { n: 106, id: 'settings-network-explorer', name: 'Explorer servers', view: 'view-kit', source: 'Explorer backends' },
  { n: 107, id: 'settings-network-params', name: 'Network params', view: 'view-kit', source: 'Connection parameters' },
  { n: 108, id: 'settings-network-comparison', name: 'Network comparison', view: 'view-kit', source: 'Mainnet, testnet, signet' },
  { n: 109, id: 'settings-ark', name: 'Ark settings', view: 'view-kit', source: 'Ark servers' },
  { n: 110, id: 'settings-features', name: 'Features', view: 'view-kit', source: 'Feature toggles' },
  { n: 111, id: 'settings-features-auto-select', name: 'Auto select UTXOs', view: 'view-kit', source: 'Default algorithm' },
  { n: 112, id: 'settings-features-bip39', name: 'BIP39', view: 'view-kit', source: 'Word list' },
  { n: 113, id: 'settings-features-currency-formatting', name: 'Currency formatting', view: 'view-kit', source: 'Units and padding' },
  { n: 114, id: 'settings-features-fiat-data', name: 'Fiat data', view: 'view-kit', source: 'Price sources' },
  { n: 115, id: 'settings-features-charts', name: 'Charts', view: 'view-kit', source: 'Chart options' },
  { n: 116, id: 'settings-features-payjoin', name: 'Payjoin settings', view: 'view-kit', source: 'Payjoin directory' },
  { n: 117, id: 'settings-fiat', name: 'Fiat currency', view: 'view-kit', source: 'Display currency' },
  { n: 118, id: 'settings-security', name: 'Security', view: 'view-kit', source: 'PIN and duress' },
  { n: 119, id: 'settings-security-report', name: 'Report an issue', view: 'view-kit', source: 'Send a report' },
  { n: 120, id: 'settings-about', name: 'About', view: 'view-kit', source: 'Version and links' },
  { n: 121, id: 'settings-about-changelog', name: 'Changelog', view: 'view-kit', source: 'Release notes' },
  { n: 122, id: 'settings-developer', name: 'Developer', view: 'view-kit', source: 'Dev tools' },
  { n: 123, id: 'settings-developer-diagnosis', name: 'Diagnosis', view: 'view-kit', source: 'Self checks' },
  { n: 124, id: 'settings-developer-recover', name: 'Recover data', view: 'view-kit', source: 'Restore a backup' },
  { n: 125, id: 'settings-design', name: 'Design', view: 'view-kit', source: 'Component sandbox' },
  { n: 126, id: 'settings-icons', name: 'Icons', view: 'view-kit', source: 'Icon gallery' },
  { n: 127, id: 'script', name: 'Script', view: 'view-kit', source: 'Account script selector' },
  { n: 128, id: 'warning', name: 'Warning', view: 'view-kit', source: 'App shell' },
  { n: 129, id: 'set-pin', name: 'Set PIN', view: 'view-kit', source: 'App shell' },
  { n: 130, id: 'set-duress-pin', name: 'Duress PIN', view: 'view-kit', source: 'App shell' },
  { n: 131, id: 'unlock', name: 'Unlock', view: 'view-kit', source: 'App shell' },
  { n: 132, id: 'upcoming', name: 'Upcoming', view: 'view-kit', source: 'App shell' },
  { n: 133, id: 'session', name: 'Session', view: 'view-menu', source: 'App shell' },
  { n: 134, id: 'converter-energy', name: 'Energy', view: 'view-kit', source: 'Converter' },
  { n: 135, id: 'nostr-settings', name: 'Identity settings', view: 'view-kit', source: 'Nostr' },
  { n: 136, id: 'nostr-chat', name: 'Chats', view: 'view-kit', source: 'Nostr' },
  { n: 137, id: 'nostr-chat-peer', name: 'Conversation', view: 'view-kit', source: 'Nostr' },
  { n: 138, id: 'nostr-chat-new', name: 'New chat', view: 'view-kit', source: 'Nostr' },
  { n: 139, id: 'nostr-send', name: 'Send', view: 'view-kit', source: 'Nostr' },
  { n: 140, id: 'nostr-contacts', name: 'Contacts', view: 'view-kit', source: 'Nostr' },
  { n: 141, id: 'nostr-contact', name: 'Contact', view: 'view-kit', source: 'Nostr' },
  { n: 142, id: 'nostr-calendar', name: 'Calendar', view: 'view-kit', source: 'Nostr' },
  { n: 143, id: 'nostr-files', name: 'Files', view: 'view-kit', source: 'Nostr' },
  { n: 144, id: 'nostr-file', name: 'File', view: 'view-kit', source: 'Nostr' },
  { n: 145, id: 'nostr-keys', name: 'Keys', view: 'view-kit', source: 'Nostr' },
  { n: 146, id: 'nostr-note', name: 'Note', view: 'view-kit', source: 'Nostr' },
  { n: 147, id: 'nostr-zap', name: 'Zap', view: 'view-kit', source: 'Nostr' },
  { n: 148, id: 'nostr-profile', name: 'Profile', view: 'view-kit', source: 'Nostr' },
  { n: 149, id: 'nostr-zap-settings', name: 'Zap settings', view: 'view-kit', source: 'Nostr' },
  { n: 150, id: 'nostr-blossom', name: 'Blossom', view: 'view-kit', source: 'Nostr' },
  { n: 151, id: 'nostr-bunker', name: 'Remote signer', view: 'view-kit', source: 'Nostr' },
  { n: 152, id: 'nostr-cache', name: 'Cache', view: 'view-kit', source: 'Nostr' },
  { n: 153, id: 'nostr-compose', name: 'Compose', view: 'view-kit', source: 'Nostr' },
  { n: 154, id: 'nostr-create', name: 'Create identity', view: 'view-kit', source: 'Nostr' },
  { n: 155, id: 'nostr-create-profile', name: 'Create profile', view: 'view-kit', source: 'Nostr' },
  { n: 156, id: 'nostr-import', name: 'Import identity', view: 'view-kit', source: 'Nostr' },
  { n: 157, id: 'nostr-global-relays', name: 'Relays', view: 'view-kit', source: 'Nostr' },
  { n: 158, id: 'ark-add', name: 'Add Ark account', view: 'view-kit', source: 'Ark' },
  { n: 159, id: 'ark-receive', name: 'Ark receive', view: 'view-kit', source: 'Ark' },
  { n: 160, id: 'ark-account-receive', name: 'Account receive', view: 'view-kit', source: 'Ark' },
  { n: 161, id: 'ark-receive-lnurl-withdraw', name: 'LNURL withdraw', view: 'view-kit', source: 'Ark' },
  { n: 162, id: 'ark-send', name: 'Ark send', view: 'view-kit', source: 'Ark' },
  { n: 163, id: 'ark-send-confirm', name: 'Confirm send', view: 'view-kit', source: 'Ark' },
  { n: 164, id: 'ark-pay-invoice', name: 'Pay invoice', view: 'view-kit', source: 'Ark' },
  { n: 165, id: 'ark-movement', name: 'Movement', view: 'view-kit', source: 'Ark' },
  { n: 166, id: 'ark-movement-label', name: 'Movement label', view: 'view-kit', source: 'Ark' },
  { n: 167, id: 'ark-address-label', name: 'Address label', view: 'view-kit', source: 'Ark' },
  { n: 168, id: 'ark-settings', name: 'Ark settings', view: 'view-kit', source: 'Ark' },
  { n: 169, id: 'ark-board', name: 'Board', view: 'view-kit', source: 'Ark' },
  { n: 170, id: 'ark-offboard', name: 'Offboard', view: 'view-kit', source: 'Ark' },
  { n: 171, id: 'lightning-invoice', name: 'Invoice', view: 'view-kit', source: 'Lightning' },
  { n: 172, id: 'lightning-pay', name: 'Pay', view: 'view-kit', source: 'Lightning' },
  { n: 173, id: 'lightning-backup', name: 'Backup', view: 'view-kit', source: 'Lightning' },
  { n: 174, id: 'lightning-channel', name: 'Channel', view: 'view-kit', source: 'Lightning' },
  { n: 175, id: 'lightning-open-channel', name: 'Open channel', view: 'view-kit', source: 'Lightning' },
  { n: 176, id: 'lightning-node-settings', name: 'Node settings', view: 'view-kit', source: 'Lightning' },
  { n: 177, id: 'lightning-transaction', name: 'Transaction', view: 'view-kit', source: 'Lightning' },
  { n: 178, id: 'ecash-account-settings', name: 'eCash settings', view: 'view-kit', source: 'eCash' },
  { n: 179, id: 'ecash-settings-mint', name: 'Mints', view: 'view-kit', source: 'eCash' },
  { n: 180, id: 'ecash-settings-backup', name: 'Backup', view: 'view-kit', source: 'eCash' },
  { n: 181, id: 'ecash-settings-recovery', name: 'Recovery', view: 'view-kit', source: 'eCash' },
  { n: 182, id: 'ecash-settings-seed', name: 'Seed', view: 'view-kit', source: 'eCash' },
  { n: 183, id: 'ecash-proof', name: 'Proof', view: 'view-kit', source: 'eCash' },
  { n: 184, id: 'ecash-send-page', name: 'eCash send', view: 'view-kit', source: 'eCash' },
  { n: 185, id: 'ecash-receive-page', name: 'eCash receive', view: 'view-kit', source: 'eCash' },
  { n: 186, id: 'ecash-transaction', name: 'eCash transaction', view: 'view-kit', source: 'eCash' },
]

const themes = [
  ['Shell', ['signer', 'settings', 'warning', 'set-pin', 'set-duress-pin', 'unlock', 'upcoming', 'session']],
  ['Settings', ['settings-network', 'settings-network-detail', 'settings-network-server', 'settings-network-explorer', 'settings-network-params', 'settings-network-comparison', 'settings-ark', 'settings-features', 'settings-features-auto-select', 'settings-features-bip39', 'settings-features-currency-formatting', 'settings-features-fiat-data', 'settings-features-charts', 'settings-features-payjoin', 'settings-fiat', 'settings-security', 'settings-security-report', 'settings-about', 'settings-about-changelog', 'settings-developer', 'settings-developer-diagnosis', 'settings-developer-recover', 'settings-design', 'settings-icons']],
  ['Signer', ['intro']],
  ['Explorer', ['explorer', 'difficulty', 'explorer-address', 'explorer-address-detail', 'explorer-address-verify', 'explorer-transaction', 'explorer-transaction-detail', 'explorer-node', 'explorer-network', 'explorer-block', 'explorer-block-detail', 'explorer-block-hex', 'explorer-block-transactions', 'explorer-chain', 'explorer-chaintip', 'explorer-halving', 'explorer-mempool']],
  ['Converter', ['converter', 'currency', 'converter-energy']],
  ['Bitcoin', ['accounts', 'account', 'tx', 'coins', 'chart', 'send', 'output', 'payjoin', 'preview', 'builder', 'sign', 'psbt-qr', 'sent', 'coin-list', 'coin-bubbles', 'exclude-utxos', 'fee-management', 'timelock', 'wallet-synced', 'script', 'new-account', 'new-singlesig', 'entropy-dice', 'entropy-coin', 'entropy-drawing', 'multisig-setup', 'multisig-keys', 'multisig-key', 'multisig-settings', 'multisig-sign', 'account-receive', 'account-address', 'account-address-label', 'account-address-sign', 'account-address-verify', 'account-tx-label', 'account-utxo', 'account-utxo-label', 'import-outputs', 'account-birthday', 'account-export-descriptor', 'account-export-descriptors', 'account-export-labels', 'account-export-pubkeys', 'account-export-public-key', 'account-export-seed-words', 'account-import-labels', 'account-manage-addresses', 'account-nostr', 'account-nostr-device', 'account-nostr-group-chat', 'account-nostr-key', 'account-nostr-relays', 'add-generate-mnemonic', 'add-confirm-word', 'add-created', 'add-import-mnemonic', 'add-import-descriptor', 'add-import-descriptor-from-account', 'add-import-xpub', 'add-import-unified', 'add-multisig-export-descriptor', 'add-multisig-export-public-key', 'add-multisig-export-seed-words', 'add-multisig-finish', 'add-multisig-import-descriptor', 'add-watch-only']],
  ['Lightning', ['lightning', 'lightning-node', 'lightning-rest', 'lightning-rpc', 'lightning-invoice', 'lightning-pay', 'lightning-backup', 'lightning-channel', 'lightning-open-channel', 'lightning-node-settings', 'lightning-transaction']],
  ['Ark', ['ark', 'ark-account', 'ark-add', 'ark-receive', 'ark-account-receive', 'ark-receive-lnurl-withdraw', 'ark-send', 'ark-send-confirm', 'ark-pay-invoice', 'ark-movement', 'ark-movement-label', 'ark-address-label', 'ark-settings', 'ark-board', 'ark-offboard']],
  ['ECash', ['ecash', 'ecash-account', 'ecash-send', 'ecash-receive', 'ecash-add', 'ecash-account-settings', 'ecash-settings-mint', 'ecash-settings-backup', 'ecash-settings-recovery', 'ecash-settings-seed', 'ecash-proof', 'ecash-send-page', 'ecash-receive-page', 'ecash-transaction']],
  ['Nostr', ['nostr', 'nostr-account', 'nostr-relays', 'nostr-add', 'nostr-settings', 'nostr-chat', 'nostr-chat-peer', 'nostr-chat-new', 'nostr-send', 'nostr-contacts', 'nostr-contact', 'nostr-calendar', 'nostr-files', 'nostr-file', 'nostr-keys', 'nostr-note', 'nostr-zap', 'nostr-profile', 'nostr-zap-settings', 'nostr-blossom', 'nostr-bunker', 'nostr-cache', 'nostr-compose', 'nostr-create', 'nostr-create-profile', 'nostr-import', 'nostr-global-relays']]
]
const themeOf = {}
themes.forEach(([theme, ids]) => ids.forEach((id) => { themeOf[id] = theme }))

if (!new URLSearchParams(location.search).has('embed')) {

const list = document.getElementById('list-view')
const tableBody = document.getElementById('screen-rows')

function previewSrc(id) {
  return '/studio/?embed=1&device=1&screen=' + encodeURIComponent(id)
}

function frame(id, title) {
  const iframe = document.createElement('iframe')
  iframe.title = title
  iframe.tabIndex = -1
  iframe.setAttribute('aria-hidden', 'true')
  iframe.loading = 'lazy'
  iframe.src = previewSrc(id)
  return iframe
}

function replay(iframe) {
  if (!iframe.contentWindow) return
  iframe.contentWindow.postMessage({ type: 'satsigner', play: true }, location.origin)
}

screens.forEach((screen) => {
  const href = '/studio/?view=prototype#' + screen.id

  const card = document.createElement('a')
  card.className = 'screen-card'
  card.href = href
  const preview = document.createElement('span')
  preview.className = 'screen-preview'
  const cardFrame = frame(screen.id, '')
  preview.appendChild(cardFrame)
  card.appendChild(preview)
  const heading = document.createElement('h2')
  heading.textContent = screen.name
  const copy = document.createElement('p')
  copy.textContent = screen.source
  card.appendChild(heading)
  card.appendChild(copy)
  card.addEventListener('mouseenter', () => replay(cardFrame))
  card.addEventListener('focus', () => replay(cardFrame))
  list.appendChild(card)

  const row = document.createElement('tr')
  const thumbCell = document.createElement('td')
  const thumb = document.createElement('a')
  thumb.className = 'thumb'
  thumb.href = href
  thumb.setAttribute('aria-label', screen.name)
  const thumbFrame = frame(screen.id, '')
  thumb.appendChild(thumbFrame)
  thumb.addEventListener('mouseenter', () => replay(thumbFrame))
  thumbCell.appendChild(thumb)
  row.appendChild(thumbCell)

  const num = document.createElement('td')
  num.className = 'route num'
  num.textContent = screen.n
  num.dataset.sort = screen.n
  row.appendChild(num)

  const name = document.createElement('td')
  const link = document.createElement('a')
  link.href = href
  link.textContent = screen.name
  name.appendChild(link)
  name.dataset.sort = screen.name
  row.appendChild(name)

  const theme = document.createElement('td')
  theme.textContent = themeOf[screen.id] || ''
  theme.dataset.sort = theme.textContent
  row.appendChild(theme)

  const route = document.createElement('td')
  route.className = 'route'
  route.textContent = '#' + screen.id
  route.dataset.sort = route.textContent
  row.appendChild(route)

  const markup = document.createElement('td')
  markup.className = 'route'
  markup.textContent = screen.view
  markup.dataset.sort = markup.textContent
  row.appendChild(markup)

  const source = document.createElement('td')
  source.textContent = screen.source
  source.dataset.sort = source.textContent
  row.appendChild(source)
  tableBody.appendChild(row)
})

const sortColumns = { n: 1, name: 2, theme: 3, route: 4, markup: 5, source: 6 }
let sortKey = 'n'
let sortDir = 1

document.querySelectorAll('.screen-table th button').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.getAttribute('data-sort')
    sortDir = sortKey === key ? -sortDir : 1
    sortKey = key
    document.querySelectorAll('.screen-table th').forEach((header) => header.removeAttribute('aria-sort'))
    button.parentElement.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending')
    const index = sortColumns[key]
    const rows = [...tableBody.rows]
    rows.sort((a, b) => {
      const left = a.cells[index].dataset.sort
      const right = b.cells[index].dataset.sort
      if (key === 'n') return (Number(left) - Number(right)) * sortDir
      return left.localeCompare(right) * sortDir
    })
    rows.forEach((row) => tableBody.appendChild(row))
  })
})

const navSections = [
  {
    name: 'Explorer',
    tree: {
      id: 'explorer',
      children: [
        { id: 'explorer-mempool' },
        { id: 'explorer-chaintip' },
        { id: 'explorer-block', children: [{ id: 'explorer-block-detail', children: [{ id: 'explorer-block-hex' }, { id: 'explorer-block-transactions' }] }] },
        { id: 'explorer-transaction', children: [{ id: 'explorer-transaction-detail' }] },
        { id: 'explorer-address', children: [{ id: 'explorer-address-detail', children: [{ id: 'explorer-address-verify' }] }] },
        { id: 'difficulty' },
        { id: 'explorer-halving' },
        { id: 'explorer-chain' },
        { id: 'explorer-node' },
        { id: 'explorer-network' }
      ]
    }
  },
  {
    name: 'Signer',
    tree: {
      id: 'signer',
      children: [
        {
          id: 'accounts',
          children: [
            {
              id: 'account',
              children: [
                { id: 'tx' },
                { id: 'coins' },
                { id: 'chart' },
                { id: 'script' },
                { id: 'multisig-settings' },
                {
                  id: 'send',
                  children: [
                    { id: 'output' },
                    { id: 'payjoin' },
                    { id: 'preview', children: [{ id: 'builder' }, { id: 'sign', children: [{ id: 'sent' }] }, { id: 'psbt-qr' }, { id: 'multisig-sign' }] }
                  ]
                }
              ]
            },
            {
              id: 'new-account',
              children: [
                { id: 'new-singlesig', children: [{ id: 'entropy-dice' }, { id: 'entropy-coin' }, { id: 'entropy-drawing' }] },
                { id: 'multisig-setup', children: [{ id: 'multisig-keys', children: [{ id: 'multisig-key' }] }] }
              ]
            }
          ]
        },
        { id: 'lightning', children: [{ id: 'lightning-node' }, { id: 'lightning-rest' }, { id: 'lightning-rpc' }] },
        { id: 'ark', children: [{ id: 'ark-account' }] },
        {
          id: 'ecash',
          children: [
            { id: 'ecash-account', children: [{ id: 'ecash-send' }, { id: 'ecash-receive' }] },
            { id: 'ecash-add' }
          ]
        },
        {
          id: 'nostr',
          children: [
            { id: 'nostr-account', children: [{ id: 'nostr-relays' }] },
            { id: 'nostr-add' }
          ]
        },
        { id: 'settings', children: [{ id: 'settings-network', children: [{ id: 'settings-network-server' }] }, { id: 'settings-features' }, { id: 'settings-security' }, { id: 'settings-about' }, { id: 'settings-developer' }] }
      ]
    }
  },
  {
    name: 'Converter',
    tree: { id: 'converter', children: [{ id: 'currency' }] }
  }
]

function flowKids(node) {
  return node.children || []
}

function flowWidth(node) {
  const kids = flowKids(node)
  if (!kids.length) return 1
  return kids.reduce((sum, child) => sum + flowWidth(child), 0)
}

function flowDepth(node) {
  const kids = flowKids(node)
  if (!kids.length) return 1
  return 1 + Math.max(...kids.map(flowDepth))
}

function placeFlow(node, left, row, slots, edges) {
  const width = flowWidth(node)
  slots[node.id] = { col: left + (width - 1) / 2, row }
  let cursor = left
  flowKids(node).forEach((child) => {
    edges.push([node.id, child.id])
    placeFlow(child, cursor, row + 1, slots, edges)
    cursor += flowWidth(child)
  })
}

function renderFlow() {
  const root = document.getElementById('flow-view')
  const nodeW = 156
  const nodeH = 52
  const colW = 172
  const rowH = 72
  const padX = 24
  const padY = 56
  const slots = {}
  const flows = [['intro', 'explorer'], ['intro', 'signer'], ['intro', 'converter']]
  let cursor = 0
  navSections.forEach((section) => {
    const width = flowWidth(section.tree)
    placeFlow(section.tree, cursor, 1, slots, flows)
    cursor += width + 0.6
  })
  slots.intro = { col: (cursor - 0.6) / 2, row: 0 }
  const boxes = {}
  screens.forEach((screen) => {
    const slot = slots[screen.id]
    if (!slot) return
    boxes[screen.id] = {
      x: padX + slot.col * colW,
      y: padY + slot.row * rowH,
      w: nodeW,
      h: nodeH
    }
  })
  const width = padX * 2 + cursor * colW
  const depth = Math.max(...navSections.map((section) => flowDepth(section.tree)))
  const height = padY + (1 + depth) * rowH + 24
  root.innerHTML = ''
  const zoomBar = document.createElement('div')
  zoomBar.className = 'flow-zoom'
  zoomBar.setAttribute('role', 'group')
  zoomBar.setAttribute('aria-label', 'Chart zoom')
  const zoomOut = document.createElement('button')
  zoomOut.type = 'button'
  zoomOut.textContent = '−'
  zoomOut.setAttribute('aria-label', 'Zoom out')
  const zoomLabel = document.createElement('button')
  zoomLabel.type = 'button'
  zoomLabel.setAttribute('aria-label', 'Reset zoom')
  const zoomIn = document.createElement('button')
  zoomIn.type = 'button'
  zoomIn.textContent = '+'
  zoomIn.setAttribute('aria-label', 'Zoom in')
  zoomBar.append(zoomOut, zoomLabel, zoomIn)
  const scale = document.createElement('div')
  scale.className = 'flow-scale'
  const canvas = document.createElement('div')
  canvas.className = 'flow-canvas'
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  let zoom = 1
  function applyZoom() {
    zoom = Math.min(1.8, Math.max(0.1, Math.round(zoom * 20) / 20))
    canvas.style.transform = 'scale(' + zoom + ')'
    scale.style.width = width * zoom + 'px'
    scale.style.height = height * zoom + 'px'
    zoomLabel.textContent = Math.round(zoom * 100) + '%'
  }
  zoomOut.addEventListener('click', () => { zoom -= 0.1; applyZoom() })
  zoomIn.addEventListener('click', () => { zoom += 0.1; applyZoom() })
  zoomLabel.addEventListener('click', () => { zoom = 1; applyZoom() })
  applyZoom()
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
  flows.forEach(([from, to]) => {
    const a = boxes[from]
    const b = boxes[to]
    if (!a || !b) return
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const x1 = a.x + a.w / 2
    const y1 = a.y + a.h
    const x2 = b.x + b.w / 2
    const y2 = b.y
    const mid = (y1 + y2) / 2
    path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + mid + ', ' + x2 + ' ' + mid + ', ' + x2 + ' ' + y2)
    path.setAttribute('class', 'flow-edge')
    path.dataset.from = from
    path.dataset.to = to
    svg.appendChild(path)
  })
  canvas.appendChild(svg)
  screens.forEach((screen) => {
    const box = boxes[screen.id]
    if (!box) return
    const link = document.createElement('a')
    link.className = 'flow-node'
    link.href = '/studio/?view=prototype#' + screen.id
    link.dataset.id = screen.id
    link.style.left = box.x + 'px'
    link.style.top = box.y + 'px'
    link.style.width = box.w + 'px'
    link.style.height = box.h + 'px'
    const title = document.createElement('strong')
    title.textContent = screen.name
    const copy = document.createElement('span')
    copy.textContent = screen.source
    link.appendChild(title)
    link.appendChild(copy)
    link.addEventListener('mouseenter', () => highlightFlow(screen.id))
    link.addEventListener('focus', () => highlightFlow(screen.id))
    link.addEventListener('mouseleave', clearFlow)
    link.addEventListener('blur', clearFlow)
    canvas.appendChild(link)
  })
  scale.appendChild(canvas)
  const scroller = document.createElement('div')
  scroller.className = 'flow-scroll'
  scroller.appendChild(scale)
  root.append(zoomBar, scroller)
}

function highlightFlow(id) {
  const root = document.getElementById('flow-view')
  root.classList.add('is-dim')
  root.querySelectorAll('.flow-node').forEach((node) => {
    node.classList.toggle('is-hot', node.dataset.id === id)
  })
  const linked = new Set([id])
  root.querySelectorAll('.flow-edge').forEach((edge) => {
    const hot = edge.dataset.from === id || edge.dataset.to === id
    edge.classList.toggle('is-hot', hot)
    if (hot) {
      linked.add(edge.dataset.from)
      linked.add(edge.dataset.to)
    }
  })
  root.querySelectorAll('.flow-node').forEach((node) => {
    if (linked.has(node.dataset.id)) node.classList.add('is-hot')
  })
}

function clearFlow() {
  const root = document.getElementById('flow-view')
  root.classList.remove('is-dim')
  root.querySelectorAll('.is-hot').forEach((node) => node.classList.remove('is-hot'))
}

const table = document.getElementById('table-view')
const flow = document.getElementById('flow-view')
const phone = document.getElementById('phone-view')
const componentsView = document.getElementById('components-view')
const dashboardView = document.getElementById('dashboard-view')
const catalog = document.getElementById('catalog-views')
const buttons = document.querySelectorAll('[data-view]')

const components = [
  {
    name: 'Menu button',
    source: 'SSButton',
    html:
      '<button type="button" class="menu-button"><span class="edge-left"></span><span class="edge-right"></span><span class="menu-label">' +
      icon('bitcoin', 'menu-mark') +
      '<span>Bitcoin</span></span></button>'
  },
  {
    name: 'Soon',
    source: 'Disabled menu row',
    html:
      '<button type="button" class="menu-button is-soon"><span class="edge-left"></span><span class="edge-right"></span><span class="menu-label">' +
      icon('liquid', 'menu-mark') +
      '<span>Liquid</span></span></button>'
  },
  {
    name: 'Action buttons',
    source: 'Outline, danger, save',
    html:
      '<div class="acct-actions">' +
      '<button type="button" class="menu-button is-outline"><span class="edge-left"></span><span class="edge-right"></span>Rescan Wallet</button>' +
      '<button type="button" class="menu-button is-danger"><span class="edge-left"></span><span class="edge-right"></span>Delete Account</button>' +
      '<button type="button" class="menu-button is-save"><span class="edge-left"></span><span class="edge-right"></span>Save</button>' +
      '</div>'
  },
  {
    name: 'Tab bar',
    source: 'Signer, Explorer, Converter',
    html:
      '<nav class="tab-bar" aria-label="Sections">' +
      '<button type="button" class="tab is-active">' +
      icon('signerActive', 'tab-mark') +
      '<span>Signer</span></button>' +
      '<button type="button" class="tab">' +
      icon('explorer', 'tab-mark') +
      '<span>Explorer</span></button>' +
      '<button type="button" class="tab">' +
      icon('converter', 'tab-mark') +
      '<span>Converter</span></button>' +
      '</nav>'
  },
  {
    name: 'Stack header',
    source: 'Back, title, settings',
    html:
      '<header class="stack-header"><button type="button" class="back" aria-label="Back">' +
      icon('back', 'back-mark') +
      '</button><p>Bitcoin</p><button type="button" class="settings" aria-label="Settings">' +
      icon('settings', 'settings-mark') +
      '</button></header>'
  },
  {
    name: 'Account card',
    source: 'SSAccountCard',
    html:
      '<button type="button" class="account-card"><span class="fingerprint">a1b2c3d4</span><span class="account-name">Spending</span><span class="account-balance"><span class="account-amount">22,190,000</span> <span class="account-unit">sats</span></span><span class="account-fiat">22,190 <span>USD</span></span><span class="account-stats"><span><strong>12</strong><small>UTXOs</small></span><span><strong>50,000</strong><small>Mempool</small></span></span>' +
      icon('chevron', 'account-chevron') +
      '</button>'
  },
  {
    name: 'Network tabs',
    source: 'Bitcoin, Testnet, Signet',
    html:
      '<nav class="network-tabs" aria-label="Networks"><button type="button" class="network-tab">Bitcoin</button><button type="button" class="network-tab">Testnet</button><button type="button" class="network-tab is-active">Signet</button></nav>'
  },
  {
    name: 'Balance strip',
    source: 'Connection and totals',
    html:
      '<p class="connection"><span class="dot"></span><span>Signet</span> — Default <span>mempool.space</span></p><p class="totals"><span>Total balance <strong>22,240,000</strong></span><span>Mempool <strong>50,000</strong></span></p>'
  },
  {
    name: 'Currency field',
    source: 'Converter input',
    html:
      '<label class="currency-field"><span>Bitcoin</span><input value="0.0124" readonly></label>'
  },
  {
    name: 'Field',
    source: 'Send form',
    html:
      '<label class="field"><span>Amount</span><input value="50000" readonly></label>'
  },
  {
    name: 'Policy option',
    source: 'Account script selector',
    html:
      '<button type="button" class="policy-option is-on"><strong>Native Segwit</strong><span>P2WPKH</span></button><button type="button" class="policy-option"><strong>Taproot</strong><span>P2TR</span></button>'
  },
  {
    name: 'Hint',
    source: 'Demo note',
    html: '<p class="hint">Demo only. No keys are created.</p>'
  }
]

// SS kit (components.js). Each entry renders through the kit, so this doubles as its test page.
const kitComponents = [
  {
    name: 'SSButton',
    source: 'default, secondary, outline, elevated, gradient',
    html: ss.vstack({ gap: 'sm' },
      ss.button({ label: t('common.continue') }),
      ss.button({ label: t('common.continue'), variant: 'secondary' }),
      ss.button({ label: t('common.cancel'), variant: 'outline' }),
      ss.button({ label: 'Elevated', variant: 'elevated' }),
      ss.button({ label: 'Gradient', variant: 'gradient' }))
  },
  {
    name: 'SSButton',
    source: 'subtle, ghost, danger, select, loading, disabled',
    html: ss.vstack({ gap: 'sm' },
      ss.button({ label: 'Subtle', variant: 'subtle' }),
      ss.button({ label: t('common.cancel'), variant: 'ghost' }),
      ss.button({ label: 'Delete', variant: 'danger' }),
      ss.button({ label: 'Select', withSelect: true }),
      ss.button({ loading: true }),
      ss.button({ label: 'Disabled', disabled: true }))
  },
  {
    name: 'SSText',
    source: 'sizes, weights, colours, mono',
    html: ss.vstack({ gap: 'xs' },
      ss.text({ size: '5xl', weight: 'ultralight' }, '22,190,000'),
      ss.text({ size: 'xl', weight: 'medium' }, 'Spending'),
      ss.text({ size: 'md' }, 'Regular md'),
      ss.text({ color: 'muted', uppercase: true }, 'Muted uppercase'),
      ss.text({ type: 'mono', size: 'xs' }, 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'))
  },
  {
    name: 'SSTextInput',
    source: 'default, small left, outline, invalid',
    html: ss.vstack({ gap: 'sm' },
      ss.textInput({ placeholder: 'Account name' }),
      ss.textInput({ size: 'small', align: 'left', value: 'Spending' }),
      ss.textInput({ variant: 'outline', value: '50000' }),
      ss.textInput({ status: 'invalid', value: 'bc1qwrong', error: 'Invalid address' }))
  },
  {
    name: 'SSCheckbox · SSRadioButton',
    source: 'tap to toggle',
    html: ss.vstack({ gap: 'md' },
      ss.checkbox({ label: 'Enable payjoin', description: 'Batch with the receiver', selected: true }),
      ss.checkbox({ label: 'Auto-select UTXOs' }),
      ss.radio({ label: 'Native Segwit', group: 'script', selected: true }),
      ss.radio({ label: 'Taproot', group: 'script' }),
      ss.hstack({ gap: 'none' },
        ss.radio({ label: 'Sats', group: 'unit', variant: 'outline', selected: true }),
        ss.radio({ label: 'BTC', group: 'unit', variant: 'outline' })))
  },
  {
    name: 'SSFormLayout · SSSeparator',
    source: 'labels, items, gradient and dark separators',
    html: ss.form({},
      ss.form.item({}, ss.form.label({ label: 'Name' }), ss.textInput({ size: 'small', value: 'Savings' })),
      ss.separator(),
      ss.form.item({}, ss.form.label({ label: 'Amount' }), ss.textInput({ size: 'small', value: '50,000' })),
      ss.separator({ color: 'grayDark' }))
  },
  {
    name: 'SSIconButton · icons',
    source: 'generated/icons.js',
    html: ss.hstack({ gap: 'md' },
      ['settings', 'chevronRight', 'eyeOn', 'bitcoin', 'lightning', 'nostr', 'eCash'].map((name) =>
        ss.iconButton({ label: name }, ss.icon(name, { size: 22 }))))
  },
  {
    name: 'SSClipboardCopy · SSModal',
    source: 'tap address to copy, open modal',
    html: ss.vstack({ gap: 'md', style: 'position:relative;min-height:220px' },
      ss.clipboardCopy({ text: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
        ss.text({ type: 'mono', size: 'xs' }, 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')),
      ss.button({ label: 'Open modal', variant: 'outline', id: 'kit-modal-open' }),
      ss.modal({ id: 'kit-modal' }, ss.text({ size: 'lg', center: true }, 'Modal body')))
  }
  ,{
    name: 'SSStyledSatText · SSAmountDisplay',
    source: 'plain, send, receive, BTC padded, privacy',
    html: ss.vstack({ gap: 'sm' },
      ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.amountDisplay({ amount: 22190000 })),
      ss.styledSat({ amount: 50000, noColor: false, type: 'send', textSize: 'xl' }),
      ss.styledSat({ amount: 125000, noColor: false, type: 'receive', textSize: 'xl' }),
      ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.amountDisplay({ amount: 0.0125, currency: 'btc', textSize: '2xl' })),
      ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.amountDisplay({ amount: 1, privacyMode: true, textSize: '2xl' })))
  },
  {
    name: 'SSAddressDisplay · SSDetailsList',
    source: 'tap address to copy',
    html: ss.vstack({ gap: 'md' },
      ss.addressDisplay({ address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' }),
      ss.addressDisplay({ address: 'tb1qrent0000010000000000000', variant: 'outline', size: 'sm' }),
      ss.detailsList({ columns: 3, items: [['Fee', 1420, { unit: 'sats' }], ['Rate', '4.2', { unit: 'sat/vB' }], ['Size', 141, { unit: 'vB' }], ['Inputs', 2], ['Outputs', 2], ['Locktime', '']] }))
  },
  {
    name: 'SSAmountInput',
    source: 'tap value to type, drag slider, tap fiat to switch',
    html: ss.amountInput({ min: 546, max: 2000000, value: 50000, remainingSats: 2000000 })
  },
  {
    name: 'SSShareableQR · SSActionButton',
    source: 'fixture QR, not a real encoding',
    html: ss.vstack({ gap: 'md' },
      ss.shareableQR({ value: 'bitcoin:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', size: 200 }),
      ss.hstack({ justifyEvenly: true },
        ss.actionButton({}, ss.text({ uppercase: true }, 'Send')),
        ss.actionButton({}, ss.icon('camera', { size: 22 })),
        ss.actionButton({}, ss.text({ uppercase: true }, 'Receive'))))
  }
]
components.unshift(...kitComponents)
document.addEventListener('click', (e) => {
  if (e.target.closest('#kit-modal-open')) ss.open('kit-modal')
})

const componentGrid = document.getElementById('components-view')
components.forEach((component) => {
  const card = document.createElement('article')
  card.className = 'component-card'
  const heading = document.createElement('h2')
  heading.textContent = component.name
  const copy = document.createElement('p')
  copy.textContent = component.source
  const stage = document.createElement('div')
  stage.className = 'component-stage'
  stage.innerHTML = component.html
  card.appendChild(heading)
  card.appendChild(copy)
  card.appendChild(stage)
  componentGrid.appendChild(card)
})

const viewAliases = { phone: 'prototype', list: 'screens', flow: 'map' }

function isLayoutMode(mode) {
  return mode === 'dashboard' || mode === 'prototype' || mode === 'screens' || mode === 'table' || mode === 'map' || mode === 'components'
}

function viewFromUrl() {
  const raw = new URLSearchParams(location.search).get('view')
  const mode = viewAliases[raw] || raw
  return isLayoutMode(mode) ? mode : null
}

function setView(mode, updateUrl) {
  mode = viewAliases[mode] || mode
  if (!isLayoutMode(mode)) mode = 'dashboard'
  list.hidden = mode !== 'screens'
  table.hidden = mode !== 'table'
  flow.hidden = mode !== 'map'
  phone.hidden = mode !== 'prototype'
  componentsView.hidden = mode !== 'components'
  dashboardView.hidden = mode !== 'dashboard'
  if (catalog) catalog.hidden = mode === 'prototype'
  buttons.forEach((button) => {
    button.classList.toggle('is-active', button.getAttribute('data-view') === mode)
  })
  localStorage.setItem('screen-catalog-view', mode)
  if (updateUrl) {
    const url = new URL(location.href)
    url.searchParams.set('view', mode)
    history.replaceState(null, '', url)
  }
  if (mode === 'map') centerIntro()
}

function centerIntro() {
  const node = document.querySelector('#flow-view [data-id="intro"]')
  if (!node) return
  const rect = node.getBoundingClientRect()
  const doc = document.scrollingElement
  doc.scrollLeft += rect.left + rect.width / 2 - window.innerWidth / 2
  doc.scrollTop += rect.top + rect.height / 2 - window.innerHeight / 2
}

buttons.forEach((button) => {
  button.addEventListener('click', () => setView(button.getAttribute('data-view'), true))
})

const cardHeight = document.getElementById('card-height')
cardHeight.addEventListener('click', () => {
  const open = document.body.classList.toggle('is-full-cards')
  cardHeight.textContent = open ? 'Collapse' : 'Expand'
  cardHeight.setAttribute('aria-pressed', open ? 'true' : 'false')
})

const themeToggle = document.getElementById('theme-toggle')

function applyTheme(theme) {
  const light = theme === 'light'
  document.documentElement.dataset.theme = light ? 'light' : 'dark'
  document.documentElement.style.colorScheme = light ? 'light' : 'dark'
  const meta = document.querySelector('meta[name="color-scheme"]')
  if (meta) meta.content = light ? 'light' : 'dark'
  themeToggle.setAttribute('aria-pressed', light ? 'true' : 'false')
  themeToggle.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode')
  localStorage.setItem('studio-theme', light ? 'light' : 'dark')
}

applyTheme(localStorage.getItem('studio-theme') === 'light' ? 'light' : 'dark')
themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light')
})

// Land on the dashboard; a deep link to a screen (#send) still opens the prototype.
setView(viewFromUrl() || (location.hash.length > 1 ? 'prototype' : 'dashboard'), true)

renderFlow()
if (!flow.hidden) centerIntro()
window.addEventListener('load', () => {
  if (!flow.hidden) centerIntro()
})
}
