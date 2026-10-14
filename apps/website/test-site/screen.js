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

const introVisuals = {
  hex: '<p class="intro-hex">01000000<br>00000000<br>3ba3edfd<br>ffffffff</p>',
  bubbles:
    '<div class="intro-bubbles"><i style="width:72px;height:72px"></i><i style="width:40px;height:40px"></i><i style="width:28px;height:28px"></i></div>',
  sankey:
    '<div class="intro-sankey"><span></span><span></span><span></span></div>',
  layers:
    '<div class="intro-layers"><span>Lightning</span><span>Ark</span><span>Bitcoin</span></div>',
  privacy: '<p class="intro-privacy">Coin control</p>',
  coord: '<p class="intro-coord">NIP-17</p>',
  explorer: '<p class="intro-explorer">Block 284,112</p>'
}

let introIndex = 0

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

function finishIntro() {
  document.getElementById('intro').innerHTML =
    '<div class="intro-logo"><span>SAT<br>SIGNER</span></div>'
  setTimeout(() => show('menu'), 700)
}

paintTabs()
renderMenu('signer')
renderIntro()
show('intro')
