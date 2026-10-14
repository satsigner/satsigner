/* Screens:
   home menu — apps/mobile/app/(authenticated)/(tabs)/(signer,explorer,converter)/index.tsx
   accounts — signer/bitcoin/accountList.tsx + SSAccountCard
   converter — converter/currency.tsx
   Icons — apps/mobile/components/icons
   Stagger: 60ms delay, 150ms, 24px. */

const STAGGER_DELAY = 60
const SATS_PER_BTC = 100000000
const USD_PER_BTC = 100000

const groups = {
  signer: {
    title: 'Signer',
    items: [
      { title: 'Bitcoin', icon: 'bitcoin', screen: 'accounts' },
      { title: 'Lightning', icon: 'lightning' },
      { title: 'Ark', icon: 'ark' },
      { title: 'Liquid', icon: 'liquid', soon: true },
      { title: 'ECash', icon: 'ecash' },
      { title: 'Nostr', icon: 'nostr' }
    ]
  },
  explorer: {
    title: 'Explorer',
    items: [
      { title: 'Mempool', icon: 'mempool' },
      { title: 'Chaintip', icon: 'chaintip' },
      { title: 'Block', icon: 'block' },
      { title: 'Transaction', icon: 'transaction' },
      { title: 'Address', icon: 'address' },
      { title: 'Difficulty', icon: 'difficulty' },
      { title: 'Halving', icon: 'halving' },
      { title: 'Chain', icon: 'chain' },
      { title: 'Node', icon: 'node' },
      { title: 'Network', icon: 'network' }
    ]
  },
  converter: {
    title: 'Converter',
    items: [
      { title: 'Currency', icon: 'currency', screen: 'converter' },
      { title: 'Time', icon: 'time', soon: true },
      { title: 'Energy', icon: 'energy' }
    ]
  }
}

const accounts = [
  {
    name: 'Spending',
    network: 'signet',
    balance: 1240000,
    fiat: '1,240.00',
    fingerprint: 'ab12cd34',
    watchOnly: false,
    stats: [
      ['12', 'Transactions'],
      ['28', 'Addresses'],
      ['4', 'Outputs'],
      ['0', 'Mempool']
    ]
  },
  {
    name: 'Savings',
    network: 'signet',
    balance: 21000000,
    fiat: '21,000.00',
    fingerprint: 'ef56ab78',
    watchOnly: true,
    stats: [
      ['3', 'Transactions'],
      ['6', 'Addresses'],
      ['2', 'Outputs'],
      ['50000', 'Mempool']
    ]
  }
]

const views = {}
document.querySelectorAll('.phone-screen > section').forEach((section) => {
  views[section.id.replace('view-', '')] = section
})

const titleEl = document.getElementById('menu-title')
const listEl = document.getElementById('menu-list')
const tabs = document.querySelectorAll('.tab')
let activeTab = 'signer'

function show(name) {
  Object.entries(views).forEach(([key, node]) => {
    node.hidden = key !== name
  })
}

function renderMenu(tab) {
  const group = groups[tab]
  titleEl.textContent = group.title
  listEl.innerHTML = ''
  group.items.forEach((item, index) => {
    const row = document.createElement('div')
    row.className = 'menu-item'
    row.style.animationDelay = index * STAGGER_DELAY + 'ms'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'menu-button' + (item.soon ? ' is-soon' : '')
    button.innerHTML =
      '<span class="edge-left"></span><span class="edge-right"></span><span class="menu-label">' +
      icon(item.icon, 'menu-mark') +
      '<span>' +
      item.title +
      '</span></span>'
    button.addEventListener('click', () => {
      if (item.screen) show(item.screen)
    })
    row.appendChild(button)
    listEl.appendChild(row)
  })
}

function paintTabs() {
  tabs.forEach((tab) => {
    const name = tab.dataset.tab
    const active = name === activeTab
    tab.classList.toggle('is-active', active)
    tab.innerHTML =
      icon(active ? name + 'Active' : name, 'tab-mark') +
      '<span>' +
      tab.dataset.label +
      '</span>'
  })
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab
    paintTabs()
    show('menu')
    renderMenu(activeTab)
  })
})

document.querySelectorAll('[data-back]').forEach((button) => {
  button.innerHTML = icon('back', 'back-mark')
  button.addEventListener('click', () => show(button.dataset.back || 'menu'))
})

document.querySelectorAll('.stack-header').forEach((header) => {
  if (header.querySelector('.settings')) return
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'settings'
  button.dataset.settings = ''
  button.setAttribute('aria-label', 'Settings')
  header.appendChild(button)
})

document.querySelectorAll('[data-settings]').forEach((button) => {
  button.innerHTML = icon('settings', 'settings-mark')
  button.addEventListener('click', openSettings)
})

const accountList = document.getElementById('account-list')
const networkTabs = document.querySelectorAll('.network-tab')
const networkNames = { bitcoin: 'Bitcoin', testnet: 'Testnet', signet: 'Signet' }
let activeNetwork = 'signet'

function mempoolSats(account) {
  const mempool = account.stats.find((stat) => stat[1] === 'Mempool')
  return mempool ? Number(String(mempool[0]).replace(/,/g, '')) : 0
}

function renderAccounts() {
  const visible = accounts.filter((account) => account.network === activeNetwork)
  const balance = visible.reduce((sum, account) => sum + account.balance, 0)
  const mempool = visible.reduce((sum, account) => sum + mempoolSats(account), 0)
  document.getElementById('network-label').textContent = networkNames[activeNetwork]
  document.getElementById('total-balance').textContent = balance.toLocaleString('en-US')
  document.getElementById('total-mempool').textContent = mempool.toLocaleString('en-US')
  networkTabs.forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.network === activeNetwork)
  })
  accountList.innerHTML = ''
  if (!visible.length) {
    accountList.innerHTML = '<p class="accounts-empty">No keys yet</p>'
    return
  }
  visible.forEach((account) => {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'account-card'
    card.innerHTML =
      '<span class="fingerprint">' +
      account.fingerprint +
      '</span><span class="account-name">' +
      account.name +
      '</span><span class="account-balance"><span class="account-amount">' +
      account.balance.toLocaleString('en-US') +
      '</span> <span class="account-unit">sats</span></span><span class="account-fiat">' +
      account.fiat +
      ' <span>USD</span></span><span class="account-stats">' +
      account.stats
        .map(
          (stat) =>
            '<span><strong>' + stat[0] + '</strong><small>' + stat[1] + '</small></span>'
        )
        .join('') +
      '</span>' +
      icon('chevron', 'account-chevron')
    card.addEventListener('click', () => openAccount(account))
    accountList.appendChild(card)
  })
}

networkTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    activeNetwork = tab.dataset.network
    renderAccounts()
  })
})

renderAccounts()

let openAccountData = accounts[0]
let payjoinTimer = 0
let showChart = false
let accountTab = 0

const activity = {
  ab12cd34: [
    { type: 'receive', label: 'Salary', amount: 800000, fiat: '800.00', txid: 'a91c…4e20', conf: '842 conf • 283,270', balance: 800000 },
    { type: 'send', label: 'Rent', amount: 210000, fiat: '210.00', txid: 'b20d…91aa', conf: '610 conf • 283,502', balance: 590000 },
    { type: 'receive', label: 'Coffee refund', amount: 650000, fiat: '650.00', txid: 'c77e…10b3', conf: '128 conf • 283,984', balance: 1240000 }
  ],
  ef56ab78: [
    { type: 'receive', label: 'Cold storage', amount: 21000000, fiat: '21,000.00', txid: 'd11a…88c0', conf: '4,200 conf • 279,912', balance: 21000000 },
    { type: 'receive', label: 'Mempool', amount: 50000, fiat: '50.00', txid: 'e44f…02d1', conf: 'Unconfirmed', balance: 21050000 }
  ]
}

function bar(tx, max) {
  const colors =
    tx.type === 'receive'
      ? ['var(--soft-bar-green)', 'var(--bar-green)', 'var(--bar-gray)']
      : ['var(--soft-bar-red)', 'var(--bar-red)', 'var(--bar-gray)']
  const before = tx.type === 'receive' ? tx.balance - tx.amount : tx.balance
  const after = tx.type === 'receive' ? tx.balance : tx.balance + tx.amount
  const widths = [
    Math.max(0, before / max) * 100,
    Math.max(0, (Math.min(after, max) - before) / max) * 100
  ]
  widths.push(Math.max(0, 100 - widths[0] - widths[1]))
  return (
    '<span class="balance-bar">' +
    widths
      .map((width, index) => '<i style="width:' + width + '%;background:' + colors[index] + '"></i>')
      .join('') +
    '</span>'
  )
}

function historyChart(txs) {
  const balances = txs.map((tx) => tx.balance)
  const max = Math.max(...balances)
  const min = Math.min(...balances)
  const span = Math.max(max - min, 1)
  const points = txs.map((tx, index) => ({
    x: 28 + (index / Math.max(txs.length - 1, 1)) * 264,
    y: 24 + (1 - (tx.balance - min) / span) * 96
  }))
  let line = 'M' + points[0].x + ' ' + points[0].y
  for (let index = 1; index < points.length; index += 1) {
    line += ' H' + points[index].x + ' V' + points[index].y
  }
  return (
    '<svg class="history-chart" viewBox="0 0 320 150" aria-label="Balance history">' +
    '<path d="' +
    line +
    ' V128 H' +
    points[0].x +
    ' Z" fill="var(--soft-green)"/>' +
    '<path d="' +
    line +
    '" fill="none" stroke="var(--main-green)" stroke-width="1.5"/>' +
    points
      .map(
        (point) =>
          '<circle cx="' + point.x + '" cy="' + point.y + '" r="3" fill="var(--white)"/>'
      )
      .join('') +
    '<text x="16" y="20" fill="var(--gray-500)" font-size="9">' +
    max.toLocaleString('en-US') +
    '</text><text x="16" y="140" fill="var(--gray-500)" font-size="9">' +
    min.toLocaleString('en-US') +
    '</text></svg>'
  )
}

const coins = [
  { id: 'salary', label: 'Salary', value: 800000, fiat: '800.00', address: 'tb1q…4e20', selected: true },
  { id: 'refund', label: 'Coffee refund', value: 650000, fiat: '650.00', address: 'tb1q…10b3', selected: false },
  { id: 'change', label: 'Change', value: 210000, fiat: '210.00', address: 'tb1q…91aa', selected: false }
]
let coinView = 'list'
let outputView = 'bubbles'

function toggleCoin(id) {
  const coin = coins.find((entry) => entry.id === id)
  if (!coin) return
  coin.selected = !coin.selected
  if (!document.getElementById('view-send').hidden) renderCoins()
  if (!document.getElementById('view-account').hidden) renderAccount()
}

function utxoList() {
  return coins
    .map(
      (coin) =>
        '<button type="button" class="utxo" data-coin="' +
        coin.id +
        '"><span class="utxo-mark' +
        (coin.selected ? ' is-on' : '') +
        '">' +
        (coin.selected ? '×' : '+') +
        '</span><span class="utxo-main"><strong>' +
        coin.value.toLocaleString('en-US') +
        ' sats</strong><small>' +
        coin.fiat +
        ' USD</small></span><span class="utxo-meta">' +
        coin.address +
        '<small>' +
        coin.label +
        '</small></span></button>'
    )
    .join('')
}

function bubblePack() {
  const sizes = { salary: 124, refund: 108, change: 76 }
  return (
    '<div class="bubble-pack">' +
    coins
      .map(
        (coin) =>
          '<button type="button" class="bubble' +
          (coin.selected ? ' is-selected' : '') +
          '" data-coin="' +
          coin.id +
          '" style="width:' +
          sizes[coin.id] +
          'px;height:' +
          sizes[coin.id] +
          'px"><strong>' +
          coin.value.toLocaleString('en-US') +
          '</strong><span>' +
          coin.label +
          '</span></button>'
      )
      .join('') +
    '</div>'
  )
}

function bindCoins(root) {
  root.querySelectorAll('[data-coin]').forEach((button) => {
    button.addEventListener('click', () => toggleCoin(button.dataset.coin))
  })
}

function renderCoins() {
  const root = document.getElementById('coin-select')
  const picked = coins.filter((coin) => coin.selected).length
  root.innerHTML =
    '<div class="coin-bar"><span>Coins · ' +
    picked +
    ' selected</span><button type="button" id="coin-view" aria-label="' +
    (coinView === 'bubbles' ? 'List' : 'Bubbles') +
    '">' +
    icon(coinView === 'bubbles' ? 'menu' : 'bubbles', 'tool-icon') +
    '</button></div>' +
    (coinView === 'bubbles' ? bubblePack() : utxoList())
  document.getElementById('coin-view').addEventListener('click', () => {
    coinView = coinView === 'bubbles' ? 'list' : 'bubbles'
    renderCoins()
  })
  bindCoins(root)
}

function closeSheet() {
  document.getElementById('sheet').hidden = true
}

function openSheet(title, body, onReady) {
  const sheet = document.getElementById('sheet')
  sheet.hidden = false
  sheet.innerHTML =
    '<header class="sheet-head"><button type="button" class="back" id="sheet-close" aria-label="Close"></button><p>' +
    title +
    '</p></header><div class="sheet-body">' +
    body +
    '</div>'
  const close = document.getElementById('sheet-close')
  close.innerHTML = icon('back', 'back-mark')
  close.addEventListener('click', closeSheet)
  if (onReady) onReady(sheet)
}

function useSample(address, amount, label) {
  document.getElementById('send-address').value = address
  document.getElementById('send-amount').value = String(amount)
  document.getElementById('send-label').value = label
  closeSheet()
  show('send')
  renderCoins()
}

function openSettings() {
  openSheet(
    'Settings',
    '<button type="button" class="settings-row">Network<small>Signet</small></button>' +
      '<button type="button" class="settings-row">Currency<small>Sats</small></button>' +
      '<button type="button" class="settings-row">Charts<small>Line</small></button>' +
      '<button type="button" class="settings-row">Privacy<small>Off</small></button>'
  )
}

function openPaste() {
  openSheet(
    'Paste',
    '<p class="sheet-copy">Paste a Bitcoin address, invoice, or PSBT.</p>' +
      '<textarea class="paste-box" id="paste-box">bitcoin:tb1qpayjoin0demo0000000000000000000000?amount=0.0005&label=Coffee</textarea>' +
      '<button type="button" class="menu-button" id="paste-use"><span class="edge-left"></span><span class="edge-right"></span>Paste</button>',
    () => {
      document.getElementById('paste-use').addEventListener('click', () => {
        useSample('tb1qpayjoin0demo0000000000000000000000', 50000, 'Coffee')
      })
    }
  )
}

function openCamera() {
  openSheet(
    'Scan',
    '<p class="sheet-copy">Scan Bitcoin content.</p><div class="viewfinder">Sample invoice</div>' +
      '<button type="button" class="menu-button" id="camera-use"><span class="edge-left"></span><span class="edge-right"></span>Use scan</button>',
    () => {
      document.getElementById('camera-use').addEventListener('click', () => {
        useSample('tb1qcamera0demo000000000000000000000000', 25000, 'Scanned')
      })
    }
  )
}

function openNfc() {
  openSheet(
    'NFC',
    '<p class="sheet-copy">Hold your device near the tag.</p><div class="nfc-ring">Ready</div>' +
      '<button type="button" class="menu-button" id="nfc-use"><span class="edge-left"></span><span class="edge-right"></span>Simulate tag</button>',
    () => {
      document.getElementById('nfc-use').addEventListener('click', () => {
        useSample('tb1qnfc0demo000000000000000000000000000', 10000, 'NFC')
      })
    }
  )
}

function renderAccount() {
  const account = openAccountData
  const txs = activity[account.fingerprint]
  const max = Math.max(...txs.map((tx) => tx.balance))
  const tabs = [
    [account.stats[0][0], 'Transactions'],
    [account.stats[1][0], 'Addresses'],
    [account.stats[2][0], 'Outputs'],
    [account.stats[3][0], 'Mempool']
  ]
  const list =
    accountTab === 0
      ? txs
          .map(
            (tx) =>
              '<article class="tx-card">' +
              bar(tx, max) +
              '<p class="tx-meta"><span>' +
              tx.txid +
              '</span><span>' +
              tx.conf +
              '</span></p><div class="tx-body"><div><p class="tx-amount ' +
              tx.type +
              '">' +
              icon(tx.type === 'receive' ? 'incoming' : 'outgoing', 'tx-flow') +
              '<strong>' +
              tx.amount.toLocaleString('en-US') +
              '</strong> <span>sats</span></p><p class="tx-fiat">' +
              tx.fiat +
              ' <span>USD</span></p><p class="tx-label">' +
              tx.label +
              '</p></div><div class="tx-side"><p>' +
              tx.balance.toLocaleString('en-US') +
              ' <span>sats</span></p><p class="tx-tag">No tags</p></div></div></article>'
          )
          .join('')
      : accountTab === 1
        ? '<p class="addr">tb1q' + account.fingerprint + 'spend000000000000000000</p><p class="addr">tb1q' + account.fingerprint + 'change00000000000000000</p>'
        : accountTab === 2
          ? outputView === 'bubbles'
            ? bubblePack()
            : utxoList()
          : '<p class="tx-card"><span><strong>50,000 sats</strong><small>Unconfirmed</small></span></p>'
  document.getElementById('account-title').textContent = account.name
  document.getElementById('account-landing').innerHTML =
    '<p class="connection"><span class="dot"></span>Signet — Default <span>mempool.space</span></p>' +
    '<p class="connection">Block 284,112 · 12 sat/vB · $100,000</p>' +
    '<p class="landing-balance">' +
    account.balance.toLocaleString('en-US') +
    ' <span>sats</span></p>' +
    '<p class="landing-fiat">' +
    account.fiat +
    ' <span>USD</span></p>' +
    '<div class="action-row"><button type="button" id="send-open">Send</button><button type="button" id="paste-open" aria-label="Paste">' +
    icon('paste', 'action-icon') +
    '</button><button type="button" id="camera-open" aria-label="Camera">' +
    icon('camera', 'action-icon') +
    '</button><button type="button" id="nfc-open" aria-label="NFC">' +
    icon('nfc', 'action-icon') +
    '</button><button type="button">Receive</button></div>' +
    '<div class="stat-row">' +
    tabs
      .map(
        (tab, index) =>
          '<button type="button" class="stat' +
          (index === accountTab ? ' is-active' : '') +
          '" data-tab="' +
          index +
          '"><strong>' +
          tab[0] +
          '</strong><small>' +
          tab[1] +
          '</small></button>'
      )
      .join('') +
    '</div>' +
    '<div class="activity-bar"><span class="activity-tools">' +
    icon('refresh', 'tool-icon') +
    icon('expand', 'tool-icon') +
    '<em>Synced</em></span><span class="activity-tools">' +
    icon('search', 'tool-icon') +
    (accountTab === 2
      ? '<button type="button" class="tool-button" id="bubble-toggle" aria-label="' +
        (outputView === 'bubbles' ? 'List' : 'Bubbles') +
        '">' +
        icon(outputView === 'bubbles' ? 'menu' : 'bubbles', 'tool-icon') +
        '</button>'
      : accountTab === 0
        ? '<button type="button" class="tool-button" id="chart-toggle" aria-label="' +
          (showChart ? 'List' : 'Chart') +
          '">' +
          icon(showChart ? 'menu' : 'chart', 'tool-icon') +
          '</button>'
        : '') +
    '</span></div>' +
    (accountTab === 0 && showChart
      ? historyChart(txs)
      : '<div class="tx-list">' + list + '</div>')
  document.getElementById('send-open').addEventListener('click', () => {
    renderCoins()
    show('send')
  })
  document.getElementById('paste-open').addEventListener('click', openPaste)
  document.getElementById('camera-open').addEventListener('click', openCamera)
  document.getElementById('nfc-open').addEventListener('click', openNfc)
  bindCoins(document.getElementById('account-landing'))
  const chartToggle = document.getElementById('chart-toggle')
  if (chartToggle) {
    chartToggle.addEventListener('click', () => {
      showChart = !showChart
      renderAccount()
    })
  }
  const bubbleToggle = document.getElementById('bubble-toggle')
  if (bubbleToggle) {
    bubbleToggle.addEventListener('click', () => {
      outputView = outputView === 'bubbles' ? 'list' : 'bubbles'
      renderAccount()
    })
  }
  document.querySelectorAll('.stat').forEach((button) => {
    button.addEventListener('click', () => {
      accountTab = Number(button.dataset.tab)
      showChart = false
      renderAccount()
    })
  })
}

function openAccount(account) {
  openAccountData = account
  showChart = false
  outputView = 'bubbles'
  accountTab = 0
  renderAccount()
  show('account')
}

function renderPreview() {
  const amount = Number(document.getElementById('send-amount').value) || 0
  const fee = 420
  const change = Math.max(openAccountData.balance - amount - fee, 0)
  const label = document.getElementById('send-label').value || 'No label'
  const changeLabel = document.getElementById('change-label').value || 'Change'
  const payjoin = document.getElementById('payjoin-toggle').checked
  const address = document.getElementById('send-address').value
  document.getElementById('preview-body').innerHTML =
    signSendSankey('tx-sankey') +
    '<p class="io-line"><span>Inputs</span><strong>' +
    coins
      .filter((coin) => coin.selected)
      .map((coin) => coin.label)
      .join(', ') +
    '</strong></p><p class="io-line"><span>Output 1</span><strong>' +
    amount.toLocaleString('en-US') +
    ' sats</strong></p><p class="io-sub">' +
    label +
    '</p><p class="io-sub">' +
    address +
    '</p><p class="io-line"><span>Change</span><strong>' +
    change.toLocaleString('en-US') +
    ' sats</strong></p><p class="io-sub">' +
    changeLabel +
    '</p><p class="io-line"><span>Miner fee</span><strong>' +
    fee +
    ' sats</strong></p>' +
    (payjoin
      ? '<p class="hint">Payjoin invoice. Receiver will contribute a coin. Negotiation starts when you sign.</p>'
      : '') +
    '<button type="button" class="menu-button" id="sign-open"><span class="edge-left"></span><span class="edge-right"></span>Sign</button>'
  document.getElementById('sign-open').addEventListener('click', startSign)
}

document.getElementById('send-preview').addEventListener('click', () => {
  renderPreview()
  show('preview')
})

function startSign() {
  clearTimeout(payjoinTimer)
  const payjoin = document.getElementById('payjoin-toggle').checked
  const status = document.getElementById('sign-status')
  const broadcast = document.getElementById('broadcast')
  broadcast.disabled = true
  show('sign')
  if (!payjoin) {
    status.textContent = 'Transaction signed. Ready to broadcast.'
    broadcast.disabled = false
    return
  }
  const steps = [
    'Sending the original to the mailbox…',
    'Waiting for the receiver to contribute…',
    'Checking mailbox for the proposal…',
    'Payjoin proposal ready. Receiver contributed a coin. Review the transaction before broadcasting.'
  ]
  let step = 0
  status.textContent = steps[0]
  function next() {
    step += 1
    if (step >= steps.length) {
      broadcast.disabled = false
      return
    }
    status.textContent = steps[step]
    payjoinTimer = setTimeout(next, 700)
  }
  payjoinTimer = setTimeout(next, 700)
}

document.getElementById('broadcast').addEventListener('click', () => {
  const amount = Number(document.getElementById('send-amount').value) || 0
  const label = document.getElementById('send-label').value || 'No label'
  const payjoin = document.getElementById('payjoin-toggle').checked
  document.getElementById('sent-txid').textContent =
    'demo' + openAccountData.fingerprint + '00000000000000000000000000000000000000000000'
  document.getElementById('sent-summary').textContent =
    (payjoin ? 'Payjoin send. ' : '') +
    amount.toLocaleString('en-US') +
    ' sats · ' +
    label
  show('sent')
})

const btcInput = document.getElementById('btc-input')
const satsInput = document.getElementById('sats-input')
const usdInput = document.getElementById('usd-input')

function syncFromBtc() {
  const btc = Number(btcInput.value) || 0
  satsInput.value = Math.round(btc * SATS_PER_BTC).toLocaleString('en-US')
  usdInput.value = (btc * USD_PER_BTC).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

btcInput.addEventListener('input', syncFromBtc)
btcInput.value = '0.0124'
syncFromBtc()

const introSteps = [
  {
    title: 'Inspect Every Transaction',
    description: 'Hex-level access to raw Bitcoin transactions. Verify inputs, outputs, and scripts yourself — no trust required.',
    visual: 'hex'
  },
  {
    title: 'Visualize Your UTXOs',
    description: 'Each coin is a bubble. See size, age, and labels at a glance — then choose exactly which ones to spend.',
    visual: 'bubbles'
  },
  {
    title: 'Sign & Send, Your Way',
    description: 'Build transactions with full fee control. Air-gapped signing, multisig, and PSBTs — complete sovereignty over every sat.',
    visual: 'sankey'
  },
  {
    title: 'Every Layer of Bitcoin',
    description: 'From the base chain to Lightning and beyond — interact natively with every Bitcoin protocol layer in one place.',
    visual: 'layers'
  },
  {
    title: 'Privacy by Design',
    description: 'Full coin control, UTXO labeling, and address management give you the tools to minimize your on-chain footprint.',
    visual: 'privacy'
  },
  {
    title: 'Seamless Coordination',
    description: 'Pass PSBTs, messages, and labels between your devices and co-signers encrypted over Nostr relays (NIP-17 group).',
    visual: 'coord'
  },
  {
    title: 'Built-In Block Explorer',
    description: 'Inspect any block, transaction, or address without leaving the app or trusting a third-party server.',
    visual: 'explorer'
  }
]

function ribbonPath(sx, sy, h, tx, ty, b0, b1) {
  const half = h / 2
  const span = tx - sx
  const cx0 = sx + span * b0
  const cx1 = sx + span * b1
  return (
    'M ' + sx + ' ' + (sy - half) +
    ' C ' + cx0 + ' ' + (sy - half) + ' ' + cx1 + ' ' + (ty - half) + ' ' + tx + ' ' + (ty - half) +
    ' L ' + tx + ' ' + (ty + half) +
    ' C ' + cx1 + ' ' + (ty + half) + ' ' + cx0 + ' ' + (sy + half) + ' ' + sx + ' ' + (sy + half) +
    ' Z'
  )
}

function stackSlots(heights, top) {
  let y = top
  return heights.map((h) => {
    const slot = { h: h, ty: y + h / 2 }
    y += h
    return slot
  })
}

function signSendSankey(className) {
  const inputHeights = [8, 29, 9, 24, 10, 6]
  const outputHeights = [22, 24, 32, 8]
  const inputs = stackSlots(inputHeights, 157)
  const outputs = stackSlots(outputHeights, 157)
  const inRibbons = [
    [0.38, 0.62, 0, 62],
    [0.58, 0.4, 1, 118],
    [0.45, 0.55, 2, 178],
    [0.52, 0.44, 3, 258],
    [0.41, 0.59, 4, 322],
    [0.6, 0.38, 5, 402]
  ]
  const outRibbons = [
    [0.42, 0.58, 0, 88],
    [0.5, 0.46, 1, 195],
    [0.39, 0.6, 2, 298],
    [0.47, 0.54, 3, 385]
  ]
  const inId = className + 'In'
  const outId = className + 'Out'
  const inPaths = inRibbons
    .map((ribbon) => {
      const slot = inputs[ribbon[2]]
      return '<path fill="url(#' + inId + ')" d="' + ribbonPath(0, ribbon[3], slot.h, 168, slot.ty, ribbon[0], ribbon[1]) + '"/>'
    })
    .join('')
  const outPaths = outRibbons
    .map((ribbon) => {
      const slot = outputs[ribbon[2]]
      return '<path fill="url(#' + outId + ')" d="' + ribbonPath(206, slot.ty, slot.h, 360, ribbon[3], ribbon[0], ribbon[1]) + '"/>'
    })
    .join('')
  return (
    '<svg class="' + className + '" viewBox="0 0 360 520" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
    '<defs><linearGradient id="' + inId + '" gradientUnits="userSpaceOnUse" x1="0" x2="168" y1="0" y2="0">' +
    '<stop offset="0" stop-color="#0A0A0A"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.05"/>' +
    '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0.09"/></linearGradient>' +
    '<linearGradient id="' + outId + '" gradientUnits="userSpaceOnUse" x1="206" x2="360" y1="0" y2="0">' +
    '<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.09"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.05"/>' +
    '<stop offset="1" stop-color="#0A0A0A"/></linearGradient></defs>' +
    '<rect x="168" y="157" width="38" height="86" fill="rgba(255,255,255,0.09)"/>' +
    inPaths + outPaths + '</svg>'
  )
}

const hexRows = [
  '00000000  01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   |................|',
  '00000010  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   |................|',
  '00000020  00 00 00 00 <b>3b a3 ed fd</b> 7a 7b 12 b2 7a c7 2c 3e   |....<b>;...</b>z{..z.,>|',
  '00000030  67 76 8f 61 7f c8 1b c3 88 8a 51 32 3a 9f b8 aa   |gv.a......Q2:...|',
  '00000040  4b 1e 5e 4a 29 ab 5f 49 ff ff 00 1d 1d ac 2b 7c   |K.^J)._I......+||',
  '00000080  01 04 45 54 68 65 20 54 69 6d 65 73 20 30 33 2f   |..EThe Times 03/|',
  '00000090  4a 61 6e 2f 32 30 30 39 20 43 68 61 6e 63 65 6c   |Jan/2009 Chancel|',
  '000000a0  6c 6f 72 20 6f 6e 20 62 72 69 6e 6b 20 6f 66 20   |lor on brink of |'
]

const bubbleLayout = [
  [54, '48%', '34%', true],
  [42, '28%', '28%', true],
  [36, '68%', '30%', false],
  [30, '38%', '48%', false],
  [26, '62%', '46%', false],
  [22, '22%', '44%', false],
  [18, '78%', '42%', false],
  [16, '52%', '22%', false]
]

const explorerTx = [
  [[20, 4], [12, 10], [18, 16], [9, 22]],
  [[15, 4], [24, 10], [11, 16], [19, 22]],
  [[22, 4], [14, 10], [17, 22]],
  [[11, 4], [21, 10], [16, 16], [8, 28]],
  [[18, 4], [10, 10], [14, 22], [23, 28]],
  [[14, 4], [22, 16], [13, 22], [19, 28]],
  [[17, 4], [23, 10], [10, 16], [20, 22]],
  [[16, 10], [21, 16], [12, 22]],
  [[19, 4], [11, 10], [23, 22], [14, 28]]
]

const introVisuals = {
  hex: '<div class="hex-dump">' + hexRows.join('\n') + '</div>',
  bubbles:
    '<div class="live-bubbles">' +
    bubbleLayout
      .map(
        (bubble) =>
          '<i class="' +
          (bubble[3] ? 'is-bright' : '') +
          '" style="--r:' +
          bubble[0] +
          'px;--x:' +
          bubble[1] +
          ';--y:' +
          bubble[2] +
          '"></i>'
      )
      .join('') +
    '</div>',
  sankey: signSendSankey('sign-sankey'),
  layers:
    '<div class="layer-phone"><span>Bitcoin</span><span>Lightning</span><span>Ark</span><span>eCash</span><span>Nostr</span></div>',
  privacy:
    '<div class="privacy-rings">' +
    [0.12, 0.3, 0.5, 0.72, 0.96]
      .map((size, index) => {
        const opacity = [0.6, 0.42, 0.27, 0.16, 0.09][index]
        return '<i style="--d:' + size * 340 + 'px;--o:' + opacity + '"></i>'
      })
      .join('') +
    '</div>',
  coord:
    '<svg class="coord-graph" viewBox="0 0 360 420" aria-hidden="true">' +
    '<line x1="180" y1="160" x2="180" y2="88" stroke="rgba(255,255,255,0.35)"/>' +
    '<line x1="180" y1="160" x2="295" y2="138" stroke="rgba(255,255,255,0.35)"/>' +
    '<line x1="180" y1="160" x2="252" y2="218" stroke="rgba(255,255,255,0.35)"/>' +
    '<line x1="180" y1="160" x2="108" y2="218" stroke="rgba(255,255,255,0.35)"/>' +
    '<line x1="180" y1="160" x2="70" y2="150" stroke="rgba(255,255,255,0.35)"/>' +
    '<circle cx="180" cy="160" r="31" fill="none" stroke="rgba(255,255,255,0.7)"/>' +
    '<text x="180" y="164" fill="rgba(255,255,255,0.82)" font-size="9" text-anchor="middle">wsh(multi)</text>' +
    '<rect x="158" y="62" width="44" height="28" rx="4" fill="none" stroke="rgba(255,255,255,0.55)"/>' +
    '<rect x="273" y="120" width="38" height="24" rx="4" fill="none" stroke="rgba(255,255,255,0.45)"/>' +
    '<rect x="232" y="204" width="40" height="26" rx="4" fill="none" stroke="rgba(255,255,255,0.45)"/>' +
    '<rect x="90" y="204" width="36" height="24" rx="4" fill="none" stroke="rgba(255,255,255,0.4)"/>' +
    '<rect x="48" y="134" width="36" height="24" rx="4" fill="none" stroke="rgba(255,255,255,0.4)"/>' +
    '<text x="180" y="54" fill="rgba(255,255,255,0.7)" font-size="9" text-anchor="middle">Alice</text>' +
    '<text x="292" y="114" fill="rgba(255,255,255,0.7)" font-size="9" text-anchor="middle">Bob</text>' +
    '<text x="252" y="244" fill="rgba(255,255,255,0.7)" font-size="9" text-anchor="middle">Carol</text>' +
    '<text x="108" y="244" fill="rgba(255,255,255,0.7)" font-size="9" text-anchor="middle">Dave</text>' +
    '</svg>',
  explorer:
    '<div class="chain-stage"><div class="chain">' +
    explorerTx
      .map((block, index) => {
        const bars = block
          .map(
            (bar) =>
              '<i style="left:3px;width:' +
              bar[0] +
              'px;height:3px;top:' +
              bar[1] +
              'px"></i>'
          )
          .join('')
        const link = index < explorerTx.length - 1 ? '<span class="chain-link"></span>' : ''
        return (
          '<span class="chain-block' +
          (index === 4 ? ' is-center' : '') +
          '">' +
          bars +
          '</span>' +
          link
        )
      })
      .join('') +
    '</div><span class="chain-scan"></span></div>'
}

let introIndex = 0

function startOnboarding() {
  introIndex = 0
  const intro = document.getElementById('intro')
  if (intro) intro.classList.remove('is-splash')
  renderIntro()
  show('intro')
}

function renderIntro() {
  const step = introSteps[introIndex]
  const last = introIndex === introSteps.length - 1
  document.getElementById('intro').innerHTML =
    '<div class="intro-visual">' +
    introVisuals[step.visual] +
    '</div><p class="intro-brand">Satsigner</p><h2>' +
    step.title +
    '</h2><p class="intro-copy">' +
    step.description +
    '</p><div class="intro-dots">' +
    introSteps
      .map(
        (_, index) =>
          '<i class="' + (index === introIndex ? 'is-active' : '') + '"></i>'
      )
      .join('') +
    '</div><button type="button" class="menu-button intro-next" id="intro-next"><span class="edge-left"></span><span class="edge-right"></span>' +
    (last ? 'Finish' : 'Next') +
    '</button><div class="intro-side"><button type="button" id="intro-back"' +
    (introIndex === 0 ? ' disabled' : '') +
    '>Back</button><button type="button" id="intro-skip">Skip</button></div>'
  document.getElementById('intro-next').addEventListener('click', () => {
    if (last) finishIntro()
    else {
      introIndex += 1
      renderIntro()
    }
  })
  document.getElementById('intro-back').addEventListener('click', () => {
    if (introIndex === 0) return
    introIndex -= 1
    renderIntro()
  })
  document.getElementById('intro-skip').addEventListener('click', () => show('menu'))
}

function renderSplash() {
  const intro = document.getElementById('intro')
  intro.classList.add('is-splash')
  intro.innerHTML =
    '<div class="intro-visual">' +
    introVisuals.hex +
    '</div><div class="intro-logo"><span>SAT<br>SIGNER</span></div><p class="splash-tag">UTXO manager<br>and Message Signer</p>'
  intro.addEventListener('click', startOnboarding, { once: true })
}

function finishIntro() {
  document.getElementById('intro').innerHTML =
    '<div class="intro-logo"><span>SAT<br>SIGNER</span></div>'
  setTimeout(() => show('menu'), 700)
}

paintTabs()
renderMenu('signer')
renderSplash()
show('intro')

window.satSignerDemo = {
  open() {
    startOnboarding()
  }
}

const clock = document.querySelector('.phone-time')
if (clock) {
  const now = new Date()
  clock.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0')
}
