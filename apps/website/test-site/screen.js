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

const accountList = document.getElementById('account-list')
accounts.forEach((account) => {
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

let openAccountData = accounts[0]
let payjoinTimer = 0

function openAccount(account) {
  openAccountData = account
  document.getElementById('account-title').textContent = account.name
  document.getElementById('account-balance').textContent =
    account.balance.toLocaleString('en-US')
  show('account')
}

document.getElementById('send-open').addEventListener('click', () => show('send'))

function renderPreview() {
  const amount = Number(document.getElementById('send-amount').value) || 0
  const fee = 420
  const change = Math.max(openAccountData.balance - amount - fee, 0)
  const label = document.getElementById('send-label').value || 'No label'
  const changeLabel = document.getElementById('change-label').value || 'Change'
  const payjoin = document.getElementById('payjoin-toggle').checked
  const address = document.getElementById('send-address').value
  document.getElementById('preview-body').innerHTML =
    '<p class="io-line"><span>Output 1</span><strong>' +
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

paintTabs()
renderMenu('signer')
show('menu')
