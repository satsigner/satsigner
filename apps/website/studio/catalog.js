const screens = [
  { id: 'intro', name: 'Intro', view: 'view-intro', source: 'Home splash' },
  { id: 'signer', name: 'Signer', view: 'view-menu', source: 'Signer tab' },
  { id: 'explorer', name: 'Explorer', view: 'view-menu', source: 'Explorer tab' },
  { id: 'difficulty', name: 'Difficulty', view: 'view-difficulty', source: 'Difficulty epoch' },
  { id: 'explorer-address', name: 'Address', view: 'view-kit', source: 'Address lookup' },
  { id: 'explorer-address-detail', name: 'Address detail', view: 'view-kit', source: 'Balance and UTXOs' },
  { id: 'explorer-address-verify', name: 'Verify message', view: 'view-kit', source: 'Signature check' },
  { id: 'explorer-transaction', name: 'Transaction', view: 'view-kit', source: 'Transaction lookup' },
  { id: 'explorer-transaction-detail', name: 'Transaction detail', view: 'view-kit', source: 'Inputs and outputs' },
  { id: 'explorer-node', name: 'Node', view: 'view-kit', source: 'Node info' },
  { id: 'explorer-network', name: 'Network', view: 'view-kit', source: 'Network stats' },
  { id: 'explorer-block', name: 'Block', view: 'view-kit', source: 'Block lookup' },
  { id: 'explorer-block-detail', name: 'Block detail', view: 'view-kit', source: 'Header and analytics' },
  { id: 'explorer-block-hex', name: 'Block hex', view: 'view-kit', source: 'Raw, dump, decoded' },
  { id: 'explorer-block-transactions', name: 'Block transactions', view: 'view-kit', source: 'Transaction list' },
  { id: 'explorer-chain', name: 'Chain', view: 'view-kit', source: 'Chain overview' },
  { id: 'explorer-chaintip', name: 'Chaintip', view: 'view-kit', source: 'Latest block' },
  { id: 'explorer-halving', name: 'Halving', view: 'view-kit', source: 'Subsidy schedule' },
  { id: 'explorer-mempool', name: 'Mempool', view: 'view-kit', source: 'Fee market' },
  { id: 'accounts', name: 'Bitcoin', view: 'view-accounts', source: 'Accounts' },
  { id: 'converter', name: 'Converter', view: 'view-menu', source: 'Converter tab' },
  { id: 'currency', name: 'Currency', view: 'view-converter', source: 'Currency converter' },
  { id: 'account', name: 'Account', view: 'view-account', source: 'Account overview' },
  { id: 'tx', name: 'Transaction', view: 'view-tx', source: 'Transaction details' },
  { id: 'coins', name: 'Coins', view: 'view-account', source: 'Account coins tab' },
  { id: 'chart', name: 'Chart', view: 'view-account', source: 'Account chart' },
  { id: 'send', name: 'Send', view: 'view-send', source: 'Send form' },
  { id: 'output', name: 'Output', view: 'view-send', source: 'Output amount and label' },
  { id: 'payjoin', name: 'Payjoin', view: 'view-send', source: 'Send with Payjoin' },
  { id: 'preview', name: 'Preview', view: 'view-preview', source: 'Transaction preview' },
  { id: 'builder', name: 'Transaction IO', view: 'view-preview', source: 'Transaction flow' },
  { id: 'sign', name: 'Sign', view: 'view-sign', source: 'Payjoin sign' },
  { id: 'psbt-qr', name: 'UQR', view: 'view-psbt-qr', source: 'UQR export' },
  { id: 'sent', name: 'Sent', view: 'view-sent', source: 'Transaction broadcasted' },
  { id: 'coin-list', name: 'Select inputs', view: 'view-kit', source: 'Spendable outputs' },
  { id: 'coin-bubbles', name: 'Select inputs (bubbles)', view: 'view-kit', source: 'Bubble chart' },
  { id: 'exclude-utxos', name: 'Excluded UTXOs', view: 'view-kit', source: 'Include again' },
  { id: 'fee-management', name: 'Fee management', view: 'view-kit', source: 'Replace by fee' },
  { id: 'timelock', name: 'Timelock', view: 'view-kit', source: 'Block height or date' },
  { id: 'wallet-synced', name: 'Wallet synced', view: 'view-kit', source: 'Sync before sending' },
  { id: 'ark', name: 'Ark', view: 'view-ark', source: 'Ark accounts' },
  { id: 'ark-account', name: 'Ark account', view: 'view-ark-account', source: 'Vtxos' },
  { id: 'lightning', name: 'Lightning', view: 'view-lightning', source: 'LND node landing' },
  { id: 'lightning-node', name: 'Lightning node', view: 'view-lightning-node', source: 'Channels' },
  { id: 'lightning-rest', name: 'LND REST', view: 'view-lightning-rest', source: 'REST connection' },
  { id: 'lightning-rpc', name: 'LND RPC', view: 'view-lightning-rpc', source: 'RPC connection' },
  { id: 'ecash', name: 'ECash', view: 'view-ecash', source: 'Cashu accounts' },
  { id: 'ecash-account', name: 'ECash account', view: 'view-ecash-account', source: 'Mint balance' },
  { id: 'ecash-send', name: 'ECash send', view: 'view-ecash-send', source: 'Send token' },
  { id: 'ecash-receive', name: 'ECash receive', view: 'view-ecash-receive', source: 'Receive token' },
  { id: 'ecash-add', name: 'Add ECash', view: 'view-ecash-add', source: 'Add account' },
  { id: 'nostr', name: 'Nostr', view: 'view-nostr', source: 'Identities' },
  { id: 'nostr-account', name: 'Nostr account', view: 'view-nostr-account', source: 'Identity' },
  { id: 'nostr-relays', name: 'Nostr relays', view: 'view-nostr-relays', source: 'Relay list' },
  { id: 'nostr-add', name: 'Add Nostr', view: 'view-nostr-add', source: 'Add identity' },
  { id: 'new-account', name: 'New account', view: 'view-new-account', source: 'Name and policy' },
  { id: 'new-singlesig', name: 'New single-sig', view: 'view-new-singlesig', source: 'Entropy choice' },
  { id: 'entropy-dice', name: 'Dice', view: 'view-entropy-dice', source: 'Dice entropy' },
  { id: 'entropy-coin', name: 'Coin flips', view: 'view-entropy-coin', source: 'Coin entropy' },
  { id: 'entropy-drawing', name: 'Drawing', view: 'view-entropy-drawing', source: 'Drawing entropy' },
  { id: 'multisig-setup', name: 'Multisig policy', view: 'view-multisig-setup', source: 'Key count and script' },
  { id: 'multisig-keys', name: 'Multisig keys', view: 'view-multisig-keys', source: 'Cosigner manager' },
  { id: 'multisig-key', name: 'Key settings', view: 'view-multisig-key', source: 'Generate a cosigner' },
  { id: 'multisig-settings', name: 'Multisig settings', view: 'view-multisig-settings', source: 'Account keys' },
  { id: 'multisig-sign', name: 'Multisig sign', view: 'view-multisig-sign', source: 'Collect signatures' },
  { id: 'account-receive', name: 'Receive', view: 'view-kit', source: 'Address and QR' },
  { id: 'account-address', name: 'Address', view: 'view-kit', source: 'Address detail' },
  { id: 'account-address-label', name: 'Address label', view: 'view-kit', source: 'Label and tags' },
  { id: 'account-address-sign', name: 'Sign message', view: 'view-kit', source: 'Sign with address' },
  { id: 'account-address-verify', name: 'Verify message', view: 'view-kit', source: 'Verify signature' },
  { id: 'account-tx-label', name: 'Transaction label', view: 'view-kit', source: 'Label a transaction' },
  { id: 'account-utxo', name: 'UTXO', view: 'view-kit', source: 'Output detail' },
  { id: 'account-utxo-label', name: 'UTXO label', view: 'view-kit', source: 'Label an output' },
  { id: 'import-outputs', name: 'Import outputs', view: 'view-kit', source: 'Paste outputs' },
  { id: 'account-birthday', name: 'Wallet birthday', view: 'view-kit', source: 'Block or date' },
  { id: 'account-export-descriptor', name: 'Export descriptor', view: 'view-kit', source: 'Key descriptor' },
  { id: 'account-export-descriptors', name: 'Export descriptors', view: 'view-kit', source: 'Account descriptors' },
  { id: 'account-export-labels', name: 'Export labels', view: 'view-kit', source: 'BIP329 labels' },
  { id: 'account-export-pubkeys', name: 'Export public keys', view: 'view-kit', source: 'All keys' },
  { id: 'account-export-public-key', name: 'Export public key', view: 'view-kit', source: 'One key' },
  { id: 'account-export-seed-words', name: 'Seed words', view: 'view-kit', source: 'Reveal mnemonic' },
  { id: 'account-import-labels', name: 'Import labels', view: 'view-kit', source: 'Paste labels' },
  { id: 'account-manage-addresses', name: 'Manage addresses', view: 'view-kit', source: 'Watched addresses' },
  { id: 'account-nostr', name: 'Nostr sync', view: 'view-kit', source: 'Device sync' },
  { id: 'account-nostr-device', name: 'Nostr device', view: 'view-kit', source: 'Device detail' },
  { id: 'account-nostr-group-chat', name: 'Devices chat', view: 'view-kit', source: 'Group chat' },
  { id: 'account-nostr-key', name: 'Nostr key', view: 'view-kit', source: 'Sync key' },
  { id: 'account-nostr-relays', name: 'Sync relays', view: 'view-kit', source: 'Select relays' },
  { id: 'add-generate-mnemonic', name: 'Generate mnemonic', view: 'view-kit', source: 'New seed' },
  { id: 'add-confirm-word', name: 'Confirm word', view: 'view-kit', source: 'Seed check' },
  { id: 'add-created', name: 'Account created', view: 'view-kit', source: 'Done' },
  { id: 'add-import-mnemonic', name: 'Import mnemonic', view: 'view-kit', source: 'Seed words' },
  { id: 'add-import-descriptor', name: 'Import descriptor', view: 'view-kit', source: 'Descriptor' },
  { id: 'add-import-descriptor-from-account', name: 'Descriptor from account', view: 'view-kit', source: 'Pick account' },
  { id: 'add-import-xpub', name: 'Import xpub', view: 'view-kit', source: 'Extended public key' },
  { id: 'add-import-unified', name: 'Import unified', view: 'view-kit', source: 'Xpub or descriptor' },
  { id: 'add-multisig-export-descriptor', name: 'Multisig descriptor', view: 'view-kit', source: 'Export' },
  { id: 'add-multisig-export-public-key', name: 'Multisig public key', view: 'view-kit', source: 'Export' },
  { id: 'add-multisig-export-seed-words', name: 'Multisig seed words', view: 'view-kit', source: 'Export' },
  { id: 'add-multisig-finish', name: 'Multisig finish', view: 'view-kit', source: 'Create account' },
  { id: 'add-multisig-import-descriptor', name: 'Multisig import', view: 'view-kit', source: 'Descriptor' },
  { id: 'add-watch-only', name: 'Watch only', view: 'view-kit', source: 'Watch-only account' },
  { id: 'settings', name: 'Settings', view: 'view-kit', source: 'App settings' },
  { id: 'settings-network', name: 'Network', view: 'view-kit', source: 'Bitcoin network' },
  { id: 'settings-network-detail', name: 'Network detail', view: 'view-kit', source: 'Per-network config' },
  { id: 'settings-network-server', name: 'Server', view: 'view-kit', source: 'Backend servers' },
  { id: 'settings-network-explorer', name: 'Explorer servers', view: 'view-kit', source: 'Explorer backends' },
  { id: 'settings-network-params', name: 'Network params', view: 'view-kit', source: 'Connection parameters' },
  { id: 'settings-network-comparison', name: 'Network comparison', view: 'view-kit', source: 'Mainnet, testnet, signet' },
  { id: 'settings-ark', name: 'Ark settings', view: 'view-kit', source: 'Ark servers' },
  { id: 'settings-features', name: 'Features', view: 'view-kit', source: 'Feature toggles' },
  { id: 'settings-features-auto-select', name: 'Auto select UTXOs', view: 'view-kit', source: 'Default algorithm' },
  { id: 'settings-features-bip39', name: 'BIP39', view: 'view-kit', source: 'Word list' },
  { id: 'settings-features-currency-formatting', name: 'Currency formatting', view: 'view-kit', source: 'Units and padding' },
  { id: 'settings-features-fiat-data', name: 'Fiat data', view: 'view-kit', source: 'Price sources' },
  { id: 'settings-features-charts', name: 'Charts', view: 'view-kit', source: 'Chart options' },
  { id: 'settings-features-payjoin', name: 'Payjoin settings', view: 'view-kit', source: 'Payjoin directory' },
  { id: 'settings-fiat', name: 'Fiat currency', view: 'view-kit', source: 'Display currency' },
  { id: 'settings-security', name: 'Security', view: 'view-kit', source: 'PIN and duress' },
  { id: 'settings-security-report', name: 'Report an issue', view: 'view-kit', source: 'Send a report' },
  { id: 'settings-about', name: 'About', view: 'view-kit', source: 'Version and links' },
  { id: 'settings-about-changelog', name: 'Changelog', view: 'view-kit', source: 'Release notes' },
  { id: 'settings-developer', name: 'Developer', view: 'view-kit', source: 'Dev tools' },
  { id: 'settings-developer-diagnosis', name: 'Diagnosis', view: 'view-kit', source: 'Self checks' },
  { id: 'settings-developer-recover', name: 'Recover data', view: 'view-kit', source: 'Restore a backup' },
  { id: 'settings-design', name: 'Design', view: 'view-kit', source: 'Component sandbox' },
  { id: 'settings-icons', name: 'Icons', view: 'view-kit', source: 'Icon gallery' },
  { id: 'script', name: 'Script', view: 'sheet', source: 'Account script selector' }
]

const themes = [
  ['Shell', ['signer', 'settings']],
  ['Settings', ['settings-network', 'settings-network-detail', 'settings-network-server', 'settings-network-explorer', 'settings-network-params', 'settings-network-comparison', 'settings-ark', 'settings-features', 'settings-features-auto-select', 'settings-features-bip39', 'settings-features-currency-formatting', 'settings-features-fiat-data', 'settings-features-charts', 'settings-features-payjoin', 'settings-fiat', 'settings-security', 'settings-security-report', 'settings-about', 'settings-about-changelog', 'settings-developer', 'settings-developer-diagnosis', 'settings-developer-recover', 'settings-design', 'settings-icons']],
  ['Signer', ['intro']],
  ['Explorer', ['explorer', 'difficulty', 'explorer-address', 'explorer-address-detail', 'explorer-address-verify', 'explorer-transaction', 'explorer-transaction-detail', 'explorer-node', 'explorer-network', 'explorer-block', 'explorer-block-detail', 'explorer-block-hex', 'explorer-block-transactions', 'explorer-chain', 'explorer-chaintip', 'explorer-halving', 'explorer-mempool']],
  ['Converter', ['converter', 'currency']],
  ['Bitcoin', ['accounts', 'account', 'tx', 'coins', 'chart', 'send', 'output', 'payjoin', 'preview', 'builder', 'sign', 'psbt-qr', 'sent', 'coin-list', 'coin-bubbles', 'exclude-utxos', 'fee-management', 'timelock', 'wallet-synced', 'script', 'new-account', 'new-singlesig', 'entropy-dice', 'entropy-coin', 'entropy-drawing', 'multisig-setup', 'multisig-keys', 'multisig-key', 'multisig-settings', 'multisig-sign', 'account-receive', 'account-address', 'account-address-label', 'account-address-sign', 'account-address-verify', 'account-tx-label', 'account-utxo', 'account-utxo-label', 'import-outputs', 'account-birthday', 'account-export-descriptor', 'account-export-descriptors', 'account-export-labels', 'account-export-pubkeys', 'account-export-public-key', 'account-export-seed-words', 'account-import-labels', 'account-manage-addresses', 'account-nostr', 'account-nostr-device', 'account-nostr-group-chat', 'account-nostr-key', 'account-nostr-relays', 'add-generate-mnemonic', 'add-confirm-word', 'add-created', 'add-import-mnemonic', 'add-import-descriptor', 'add-import-descriptor-from-account', 'add-import-xpub', 'add-import-unified', 'add-multisig-export-descriptor', 'add-multisig-export-public-key', 'add-multisig-export-seed-words', 'add-multisig-finish', 'add-multisig-import-descriptor', 'add-watch-only']],
  ['Lightning', ['lightning', 'lightning-node', 'lightning-rest', 'lightning-rpc']],
  ['Ark', ['ark', 'ark-account']],
  ['ECash', ['ecash', 'ecash-account', 'ecash-send', 'ecash-receive', 'ecash-add']],
  ['Nostr', ['nostr', 'nostr-account', 'nostr-relays', 'nostr-add']]
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

const sortColumns = { name: 1, theme: 2, route: 3, markup: 4, source: 5 }
let sortKey = ''
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
