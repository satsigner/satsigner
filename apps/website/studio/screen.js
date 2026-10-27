/* Screens:
   home menu — apps/mobile/app/(authenticated)/(tabs)/(signer,explorer,converter)/index.tsx
   accounts — signer/bitcoin/accountList.tsx + SSAccountCard
   converter — converter/currency.tsx
   Icons — apps/mobile/components/icons
   Stagger: 60ms delay, 150ms, 24px. */

const STAGGER_DELAY = 60
const SATS_PER_BTC = 100000000
let USD_PER_BTC = 100000

const FIAT_LINE_COLORS = {
  USD: '#6f9a74',
  EUR: '#6a9aaa',
  GBP: '#a56b6b',
  CAD: '#b89a62',
  CHF: '#8d86a8',
  AUD: '#b88862',
  JPY: '#a67d8c'
}

const bundledPrices = {}

function satsUsd(sats) {
  return ((Number(sats) / SATS_PER_BTC) * USD_PER_BTC).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function fiatDigits(code) {
  return code === 'JPY' ? 0 : 2
}

function formatFiat(sats, price, code) {
  return ((Number(sats) / SATS_PER_BTC) * price).toLocaleString('en-US', {
    minimumFractionDigits: fiatDigits(code),
    maximumFractionDigits: fiatDigits(code)
  })
}

function fiatSpotPrice() {
  const code = chartCurrency()
  const series = bundledPrices[code]
  if (series && series.prices.length) return { code: code, price: series.prices[series.prices.length - 1] }
  if (code === 'USD') return { code: 'USD', price: USD_PER_BTC }
  return null
}

function headerQuote() {
  const spot = fiatSpotPrice()
  if (!spot) return '$' + USD_PER_BTC.toLocaleString('en-US')
  const digits = fiatDigits(spot.code)
  return spot.price.toLocaleString('en-US', { maximumFractionDigits: digits }) + ' ' + spot.code
}

function accountFiat(sats) {
  const spot = fiatSpotPrice()
  if (!spot) return satsUsd(sats) + ' <span>USD</span>'
  return formatFiat(sats, spot.price, spot.code) + ' <span>' + spot.code + '</span>'
}

function txFiatHtml(tx) {
  const spot = fiatSpotPrice()
  const code = spot ? spot.code : 'USD'
  const now = spot ? formatFiat(tx.amount, spot.price, code) : satsUsd(tx.amount)
  const unix = Math.floor(Date.now() / 1000) - (tx.conf || 0) * 600
  const thenPrice = spot ? bundledPriceAt(unix) : null
  const then = thenPrice ? formatFiat(tx.amount, thenPrice, code) : code === 'USD' ? tx.historical : ''
  return (
    '<span class="tx-price">' +
    now +
    '</span> <span class="tx-ccy">' +
    code +
    '</span>' +
    (then ? ' <span class="tx-price">(' + then + ')</span>' : '') +
    (tx.priceChange
      ? ' <span class="tx-pct ' + (tx.priceChange[0] === '+' ? 'is-up' : 'is-down') + '">' + tx.priceChange + '</span>'
      : '')
  )
}

const groups = {
  signer: {
    title: 'Signer',
    items: [
      { title: 'Bitcoin', icon: 'bitcoin', screen: 'accounts' },
      { title: 'Lightning', icon: 'lightning', screen: 'lightning' },
      { title: 'Ark', icon: 'ark', screen: 'ark' },
      { title: 'Liquid', icon: 'liquid', soon: true, upcoming: 'liquid' },
      { title: 'ECash', icon: 'ecash', screen: 'ecash' },
      { title: 'Nostr', icon: 'nostr', screen: 'nostr' }
    ]
  },
  explorer: {
    title: 'Explorer',
    items: [
      { title: 'Mempool', icon: 'mempool', screen: 'explorer-mempool' },
      { title: 'Chaintip', icon: 'chaintip', screen: 'explorer-chaintip' },
      { title: 'Block', icon: 'block', screen: 'explorer-block' },
      { title: 'Transaction', icon: 'transaction', screen: 'explorer-transaction' },
      { title: 'Address', icon: 'address', screen: 'explorer-address' },
      { title: 'Difficulty', icon: 'difficulty', screen: 'difficulty' },
      { title: 'Halving', icon: 'halving', screen: 'explorer-halving' },
      { title: 'Chain', icon: 'chain', screen: 'explorer-chain' },
      { title: 'Node', icon: 'node', screen: 'explorer-node' },
      { title: 'Network', icon: 'network', screen: 'explorer-network' }
    ]
  },
  converter: {
    title: 'Converter',
    items: [
      { title: 'Currency', icon: 'currency', screen: 'currency' },
      { title: 'Time', icon: 'time', soon: true, upcoming: 'time' },
      { title: 'Energy', icon: 'energy', screen: 'converter-energy' }
    ]
  }
}

const accounts = [
  {
    name: 'Spending',
    network: 'signet',
    balance: 1026067,
    fiat: '1,026.07',
    fingerprint: 'ab12cd34',
    watchOnly: false,
    stats: [
      ['23', 'Transactions'],
      ['28', 'Addresses'],
      ['10', 'Outputs'],
      ['24183', 'Mempool']
    ]
  },
  {
    name: 'Savings',
    network: 'signet',
    balance: 21112040,
    fiat: '21,112.04',
    fingerprint: 'ef56ab78',
    watchOnly: false,
    multisig: true,
    stats: [
      ['5', 'Transactions'],
      ['6', 'Addresses'],
      ['2', 'Outputs'],
      ['48271', 'Mempool']
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

const demoQuery = new URLSearchParams(location.search)
const isStage = Boolean(document.querySelector('.stage'))
if (demoQuery.has('embed')) document.documentElement.classList.add('is-embed')
if (demoQuery.has('bare')) document.documentElement.classList.add('is-bare')
if (demoQuery.has('device')) document.documentElement.classList.add('is-device')

let routeId = 'intro'

function show(name, route) {
  if (!views[name]) return
  Object.entries(views).forEach(([key, node]) => {
    node.hidden = key !== name
  })
  routeId = route || (name === 'menu' ? activeTab : name)
  if (isStage && !demoQuery.has('embed') && location.hash !== '#' + routeId) {
    const url = new URL(location.href)
    url.hash = routeId
    history.replaceState(null, '', url)
  }
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
      if (item.screen) go(item.screen)
      else if (item.upcoming && typeof esOpenUpcoming === 'function') esOpenUpcoming(item.upcoming)
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
    menuTab(activeTab)
  })
})

document.querySelectorAll('.detail-tabs').forEach((row) => {
  const root = row.closest('section')
  if (!root) return
  row.querySelectorAll('[data-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-panel')
      row.querySelectorAll('[data-panel]').forEach((tab) => {
        tab.classList.toggle('is-active', tab === button)
      })
      root.querySelectorAll('[data-pane]').forEach((pane) => {
        pane.hidden = pane.getAttribute('data-pane') !== id
      })
    })
  })
})

// Delegated so markup rendered later (kit screens, sheets) routes too.
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-go]')
  if (target && !target.disabled) go(target.getAttribute('data-go'))
})

const nostrConnect = document.getElementById('nostr-connect')
if (nostrConnect) {
  nostrConnect.addEventListener('click', () => {
    const label = nostrConnect.querySelector('.nostr-connect-label')
    const connected = nostrConnect.dataset.connected !== 'false'
    nostrConnect.dataset.connected = connected ? 'false' : 'true'
    if (label) label.textContent = connected ? 'Connect all' : 'Disconnect all'
  })
}

document.querySelectorAll('[data-back]').forEach((button) => {
  button.innerHTML = icon('back', 'back-mark')
  button.addEventListener('click', () => {
    if (button.closest('#view-send') && sendPhase === 'output') {
      go('coin-list')
      return
    }
    show(button.dataset.back || 'menu')
  })
})

document.querySelectorAll('.stack-header').forEach((header) => {
  if (header.querySelector('.settings') || header.closest('#view-account, #view-account-settings')) return
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'settings'
  button.dataset.settings = ''
  button.setAttribute('aria-label', 'Settings')
  header.appendChild(button)
})

document.querySelectorAll('[data-settings]').forEach((button) => {
  button.innerHTML = icon('settings', 'settings-mark')
  button.addEventListener('click', () => go('settings'))
})

document.querySelectorAll('[data-account-settings]').forEach((button) => {
  button.innerHTML = icon('key', 'settings-mark')
  button.addEventListener('click', () => go('account-settings'))
})

const phoneScreen = document.querySelector('.phone-screen')
const drawer = document.getElementById('drawer')
const navToggle = document.getElementById('nav-toggle')

function paintNavToggle() {
  const open = phoneScreen.classList.contains('is-drawer')
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Menu')
  navToggle.innerHTML = icon(open ? 'close' : 'hamburger', 'nav-mark')
}

function renderDrawer() {
  drawer.innerHTML = Object.entries(groups)
    .map(([key, group]) => {
      const items = group.items
        .map((item) => {
          const current = item.screen && (routeId === item.screen || routeId.startsWith(item.screen + '-'))
          return (
            '<button type="button" class="drawer-item' +
            (item.soon ? ' is-soon' : '') +
            (current ? ' is-current' : '') +
            '" data-drawer-tab="' +
            key +
            '"' +
            (item.screen ? ' data-drawer-screen="' + item.screen + '"' : '') +
            (item.upcoming ? ' data-drawer-upcoming="' + item.upcoming + '"' : '') +
            '>' +
            icon(item.icon, 'drawer-mark') +
            '<span>' +
            item.title +
            '</span></button>'
          )
        })
        .join('')
      return '<div class="drawer-group"><p class="drawer-label">' + group.title + '</p>' + items + '</div>'
    })
    .join('') +
    '<div class="drawer-foot">' +
    '<button type="button" class="drawer-item" data-drawer-settings>' +
    icon('settings', 'drawer-mark') +
    '<span>Settings</span></button>' +
    '<button type="button" class="drawer-item" data-drawer-about>' +
    icon('signer', 'drawer-mark') +
    '<span>About</span></button>' +
    '<p class="drawer-version">v1.0.0</p></div>'
}

function setDrawer(open) {
  phoneScreen.classList.toggle('is-drawer', open)
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true')
  paintNavToggle()
  if (open) renderDrawer()
}

if (navToggle && drawer && phoneScreen) {
navToggle.addEventListener('click', () => {
  setDrawer(!phoneScreen.classList.contains('is-drawer'))
})

document.addEventListener('click', (event) => {
  if (!phoneScreen.classList.contains('is-drawer')) return
  const path = event.composedPath()
  if (path.includes(drawer) || path.includes(navToggle)) return
  setDrawer(false)
})

phoneScreen.addEventListener('pointerdown', (event) => {
  if (!phoneScreen.classList.contains('is-drawer')) return
  if (event.target.closest('#drawer') || event.target.closest('#nav-toggle')) return
  event.preventDefault()
})

phoneScreen.addEventListener('click', (event) => {
  if (!phoneScreen.classList.contains('is-drawer')) return
  if (event.target.closest('#drawer') || event.target.closest('#nav-toggle')) return
  event.preventDefault()
  event.stopPropagation()
  setDrawer(false)
}, true)

let drawerDrag = null
drawer.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return
  drawerDrag = { y: event.clientY, top: drawer.scrollTop, moved: false, id: event.pointerId }
})
drawer.addEventListener('pointermove', (event) => {
  if (!drawerDrag || drawerDrag.id !== event.pointerId) return
  const delta = event.clientY - drawerDrag.y
  if (Math.abs(delta) > 5) {
    drawerDrag.moved = true
    drawer.classList.add('is-dragging')
    drawer.setPointerCapture(event.pointerId)
  }
  if (drawerDrag.moved) drawer.scrollTop = drawerDrag.top - delta
})
function endDrawerDrag(event) {
  if (!drawerDrag || drawerDrag.id !== event.pointerId) return
  drawer.classList.remove('is-dragging')
  const moved = drawerDrag.moved
  drawerDrag = null
  if (moved) {
    const stopClick = (clickEvent) => {
      clickEvent.stopPropagation()
      clickEvent.preventDefault()
      drawer.removeEventListener('click', stopClick, true)
    }
    drawer.addEventListener('click', stopClick, true)
  }
}
drawer.addEventListener('pointerup', endDrawerDrag)
drawer.addEventListener('pointercancel', endDrawerDrag)

drawer.addEventListener('click', (event) => {
  const item = event.target.closest('[data-drawer-tab], [data-drawer-settings], [data-drawer-about]')
  if (!item) return
  if (item.hasAttribute('data-drawer-settings')) {
    go('settings')
    return
  }
  if (item.hasAttribute('data-drawer-about')) {
    go('settings-about')
    return
  }
  const tab = item.dataset.drawerTab
  if (tab && groups[tab]) {
    activeTab = tab
    paintTabs()
    renderMenu(activeTab)
  }
  if (item.dataset.drawerScreen) {
    go(item.dataset.drawerScreen)
    return
  }
  if (item.dataset.drawerUpcoming && typeof esOpenUpcoming === 'function') {
    esOpenUpcoming(item.dataset.drawerUpcoming)
    return
  }
  show('menu', activeTab)
  setDrawer(false)
})

paintNavToggle()
}

let panDrag = null
let panCoast = 0

function panScroller(node) {
  let el = node instanceof Element ? node : null
  while (el && el !== phoneScreen) {
    const style = getComputedStyle(el)
    const scrollable = style.overflowY === 'auto' || style.overflowY === 'scroll'
    if (scrollable && el.scrollHeight > el.clientHeight + 1) return el
    el = el.parentElement
  }
  return null
}

function stopPanCoast() {
  if (!panCoast) return
  cancelAnimationFrame(panCoast)
  panCoast = 0
}

if (phoneScreen) {
  phoneScreen.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    if (event.target.closest('#drawer, input, textarea, select, canvas, .lx-count, .lx-sigs, [contenteditable]')) return
    const scroller = panScroller(event.target)
    if (!scroller) return
    stopPanCoast()
    phoneScreen.classList.add('is-panning')
    const scale = scroller.getBoundingClientRect().height / scroller.offsetHeight || 1
    panDrag = {
      y: event.clientY,
      top: scroller.scrollTop,
      moved: false,
      id: event.pointerId,
      scroller,
      scale,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0
    }
  })

  phoneScreen.addEventListener('pointermove', (event) => {
    if (!panDrag || panDrag.id !== event.pointerId) return
    const delta = event.clientY - panDrag.y
    if (!panDrag.moved && Math.abs(delta) < 6) return
    if (!panDrag.moved) {
      panDrag.moved = true
      phoneScreen.classList.add('is-dragging')
      const selection = window.getSelection()
      if (selection) selection.removeAllRanges()
      try { phoneScreen.setPointerCapture(event.pointerId) } catch (error) {}
    }
    const dt = event.timeStamp - panDrag.lastT
    if (dt > 0) panDrag.velocity = (event.clientY - panDrag.lastY) / dt / panDrag.scale
    panDrag.lastY = event.clientY
    panDrag.lastT = event.timeStamp
    panDrag.scroller.scrollTop = panDrag.top - delta / panDrag.scale
  })

  function endPan(event) {
    if (!panDrag || panDrag.id !== event.pointerId) return
    const { scroller, moved, velocity } = panDrag
    phoneScreen.classList.remove('is-panning', 'is-dragging')
    panDrag = null
    try {
      if (phoneScreen.hasPointerCapture(event.pointerId)) phoneScreen.releasePointerCapture(event.pointerId)
    } catch (error) {}
    if (!moved) return
    const stopClick = (clickEvent) => {
      clickEvent.stopPropagation()
      clickEvent.preventDefault()
      phoneScreen.removeEventListener('click', stopClick, true)
    }
    phoneScreen.addEventListener('click', stopClick, true)
    let speed = velocity
    let previous = performance.now()
    const coast = (now) => {
      const dt = Math.min(32, now - previous)
      previous = now
      scroller.scrollTop -= speed * dt
      speed *= Math.pow(0.92, dt / 16)
      if (Math.abs(speed) > 0.02) panCoast = requestAnimationFrame(coast)
      else panCoast = 0
    }
    if (Math.abs(speed) > 0.05) panCoast = requestAnimationFrame(coast)
  }

  phoneScreen.addEventListener('pointerup', endPan)
  phoneScreen.addEventListener('pointercancel', endPan)
  phoneScreen.addEventListener('selectstart', (event) => {
    if (phoneScreen.classList.contains('is-panning')) event.preventDefault()
  })
}

const accountList = document.getElementById('account-list')
const networkTabs = document.querySelectorAll('.network-tab')
const networkNames = { bitcoin: 'Bitcoin', testnet: 'Testnet', signet: 'Signet' }
let activeNetwork = 'signet'

function mempoolSats(account) {
  const mempool = account.stats.find((stat) => stat[1] === 'Mempool')
  return mempool ? Number(String(mempool[0]).replace(/,/g, '')) : 0
}

function renderAccounts() {
  loadBundledPrices()
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
      accountFiat(account.balance) +
      '</span><span class="account-stats">' +
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
let addressView = 'table'
let addressChange = false

const activity = {
  ab12cd34: [
    {
      type: 'receive',
      label: 'Salary',
      tags: [],
      amount: 484308,
      fiat: '484.31',
      historical: '412.40',
      priceChange: '+94.0%',
      ago: 'May 24, 2026 · 5 months ago',
      txid: 'a91c8f21b04e20aa11c0d4e20aa91c8f21b04e20aa11c0d4e20aa91c8f4e20',
      conf: 22032,
      block: 870388,
      balance: 484308,
      inputs: 1,
      outputs: 1,
      size: 222,
      vsize: 141,
      weight: 561,
      fee: 168,
      version: 2
    },
    {
      type: 'send',
      label: 'Rent',
      tags: ['home'],
      amount: 89184,
      fiat: '89.18',
      historical: '198.10',
      priceChange: '+6.0%',
      ago: 'May 26, 2026 · 5 months ago',
      txid: 'b20d91aa77c0e11f44aa91b20d91aa77c0e11f44aa91b20d91aa77c0e191aa',
      conf: 21744,
      block: 870676,
      balance: 395124,
      inputs: 1,
      outputs: 2,
      size: 141,
      vsize: 110,
      weight: 438,
      fee: 242,
      version: 2
    },
    {
      type: 'receive',
      label: 'Coffee refund',
      tags: ['coffee'],
      amount: 617433,
      fiat: '617.43',
      historical: '640.20',
      priceChange: '+1.5%',
      ago: 'May 29, 2026 · 5 months ago',
      txid: 'c77e10b3aa44d90211c77e10b3aa44d90211c77e10b3aa44d90211c710b3',
      conf: 21312,
      block: 871108,
      balance: 1012557,
      inputs: 2,
      outputs: 2,
      size: 312,
      vsize: 186,
      weight: 744,
      fee: 510,
      version: 2
    },
    {
      type: 'receive',
      label: 'Books',
      tags: ['payjoin'],
      amount: 47381,
      fiat: '47.38',
      historical: '46.60',
      priceChange: '+1.6%',
      ago: 'Jun 11, 2026 · 4 months ago',
      txid: 'pj77e10b3aa44d90211c77e10b3aa44d90211c77e10b3aa44d90211c7pj77',
      conf: 19440,
      block: 872980,
      balance: 1059938,
      inputs: 2,
      outputs: 2,
      size: 372,
      vsize: 186,
      weight: 744,
      fee: 420,
      version: 2,
      payjoin: true,
      contributed: 61247,
      flowInputs: [
        { value: 61247, label: 'Savings', ours: true, from: 'a91c8f21b04e' },
        { value: 148903, label: 'Counterparty', ours: false, from: 'e44f02d199aa' }
      ],
      flowOutputs: [
        { value: 147381, label: 'Books', ours: true, to: 'tb1qbooks00001' },
        { value: 62347, label: 'Sender change', ours: false, to: 'tb1qsender009' },
        { value: 422, label: 'Miner fee', fee: true }
      ]
    },
    {
      type: 'send',
      label: 'Groceries',
      tags: ['food'],
      amount: 173906,
      fiat: '173.91',
      historical: '176.40',
      priceChange: '+2.0%',
      ago: 'Jun 14, 2026 · 4 months ago',
      txid: 'f18a00c1aa22bb33cc44dd55ee66ff7700112233445566778899aabbccddeeff',
      conf: 19008,
      block: 873412,
      balance: 886032,
      inputs: 1,
      outputs: 2,
      size: 225,
      vsize: 141,
      weight: 564,
      fee: 310,
      version: 2
    },
    {
      type: 'receive',
      label: 'Invoice',
      tags: ['work'],
      amount: 128447,
      fiat: '128.45',
      historical: '124.10',
      priceChange: '+0.7%',
      ago: 'Jun 15, 2026 · 4 months ago',
      txid: 'a12500d2bb33cc44dd55ee66ff7700112233445566778899aabbccddeeff0011',
      conf: 18864,
      block: 873556,
      balance: 1014479,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 110,
      weight: 440,
      fee: 154,
      version: 2
    },
    {
      type: 'send',
      label: 'Transit',
      tags: [],
      amount: 41873,
      fiat: '41.87',
      historical: '44.20',
      priceChange: '+1.8%',
      ago: 'Jul 4, 2026 · 4 months ago',
      txid: 'b04500e3cc44dd55ee66ff7700112233445566778899aabbccddeeff00112233',
      conf: 16128,
      block: 876292,
      balance: 972606,
      inputs: 1,
      outputs: 2,
      size: 210,
      vsize: 128,
      weight: 512,
      fee: 220,
      version: 2
    },
    {
      type: 'receive',
      label: 'Gift',
      tags: [],
      amount: 86419,
      fiat: '86.42',
      historical: '83.10',
      priceChange: '+1.1%',
      ago: 'Jul 11, 2026 · 3 months ago',
      txid: 'c08400f4dd55ee66ff7700112233445566778899aabbccddeeff001122334455',
      conf: 15120,
      block: 877300,
      balance: 1059025,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 111,
      weight: 444,
      fee: 166,
      version: 2
    },
    {
      type: 'send',
      label: 'Hardware',
      tags: ['shop'],
      amount: 312847,
      fiat: '312.85',
      historical: '318.00',
      priceChange: '+0.6%',
      ago: 'Aug 2, 2026 · 3 months ago',
      txid: 'd32000a5ee66ff7700112233445566778899aabbccddeeff0011223344556677',
      conf: 11952,
      block: 880468,
      balance: 746178,
      inputs: 2,
      outputs: 2,
      size: 340,
      vsize: 196,
      weight: 784,
      fee: 480,
      version: 2
    },
    {
      type: 'receive',
      label: 'Tips',
      tags: [],
      amount: 39114,
      fiat: '39.11',
      historical: '38.70',
      priceChange: '+1.0%',
      ago: 'Aug 6, 2026 · 3 months ago',
      txid: 'e04200b6ff7700112233445566778899aabbccddeeff00112233445566778899',
      conf: 11376,
      block: 881044,
      balance: 785292,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 110,
      weight: 437,
      fee: 140,
      version: 2
    },
    {
      type: 'send',
      label: 'Donation',
      tags: ['give'],
      amount: 90000,
      fiat: '90.00',
      historical: '89.40',
      priceChange: '+0.7%',
      ago: 'Aug 7, 2026 · 11 weeks ago',
      txid: 'f09000c700112233445566778899aabbccddeeff00112233445566778899aabb',
      conf: 11232,
      block: 881188,
      balance: 695292,
      inputs: 1,
      outputs: 2,
      size: 218,
      vsize: 132,
      weight: 528,
      fee: 240,
      version: 2
    },
    {
      type: 'send',
      label: 'Lunch',
      tags: ['food'],
      amount: 12847,
      fiat: '12.85',
      historical: '11.90',
      priceChange: '+0.8%',
      ago: 'Aug 23, 2026 · 2 months ago',
      txid: 'b01200a9112233445566778899aabbccddeeff00112233445566778899aabb01',
      conf: 8928,
      block: 883492,
      balance: 682445,
      inputs: 1,
      outputs: 2,
      size: 210,
      vsize: 128,
      weight: 512,
      fee: 180,
      version: 2
    },
    {
      type: 'receive',
      label: 'Rebate',
      tags: [],
      amount: 9641,
      fiat: '9.64',
      historical: '9.40',
      priceChange: '+1.1%',
      ago: 'Aug 31, 2026 · 8 weeks ago',
      txid: 'c00950b0112233445566778899aabbccddeeff00112233445566778899aabb02',
      conf: 7776,
      block: 884644,
      balance: 692086,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 110,
      weight: 438,
      fee: 140,
      version: 2
    },
    {
      type: 'send',
      label: 'Subscription',
      tags: [],
      amount: 4753,
      fiat: '4.75',
      historical: '4.85',
      priceChange: '+1.0%',
      ago: 'Sep 13, 2026 · 6 weeks ago',
      txid: 'd00490c1112233445566778899aabbccddeeff00112233445566778899aabb03',
      conf: 5904,
      block: 886516,
      balance: 687333,
      inputs: 1,
      outputs: 2,
      size: 208,
      vsize: 126,
      weight: 504,
      fee: 168,
      version: 2
    },
    {
      type: 'receive',
      label: 'Freelance',
      tags: ['work'],
      amount: 73816,
      fiat: '73.82',
      historical: '74.20',
      priceChange: '+1.1%',
      ago: 'Sep 16, 2026 · 5 weeks ago',
      txid: 'e07500d2112233445566778899aabbccddeeff00112233445566778899aabb04',
      conf: 5472,
      block: 886948,
      balance: 761149,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 111,
      weight: 442,
      fee: 155,
      version: 2
    },
    {
      type: 'send',
      label: 'Flight',
      tags: ['travel'],
      amount: 204391,
      fiat: '204.39',
      historical: '208.00',
      priceChange: '+1.0%',
      ago: 'Sep 29, 2026 · 25 days ago',
      txid: 'f21000e3112233445566778899aabbccddeeff00112233445566778899aabb05',
      conf: 3600,
      block: 888820,
      balance: 556758,
      inputs: 2,
      outputs: 2,
      size: 340,
      vsize: 196,
      weight: 784,
      fee: 460,
      version: 2
    },
    {
      type: 'receive',
      label: 'Refund',
      tags: [],
      amount: 41208,
      fiat: '41.21',
      historical: '41.70',
      priceChange: '+0.7%',
      ago: 'Oct 1, 2026 · 3 weeks ago',
      txid: 'a04200f4112233445566778899aabbccddeeff00112233445566778899aabb06',
      conf: 3312,
      block: 889108,
      balance: 597966,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 110,
      weight: 440,
      fee: 148,
      version: 2
    },
    {
      type: 'send',
      label: 'Pharmacy',
      tags: [],
      amount: 17642,
      fiat: '17.64',
      historical: '18.30',
      priceChange: '+1.1%',
      ago: 'Oct 12, 2026 · 12 days ago',
      txid: 'b01850a5112233445566778899aabbccddeeff00112233445566778899aabb07',
      conf: 1728,
      block: 890692,
      balance: 580324,
      inputs: 1,
      outputs: 2,
      size: 214,
      vsize: 130,
      weight: 520,
      fee: 196,
      version: 2
    },
    {
      type: 'receive',
      label: 'Split',
      tags: [],
      amount: 148773,
      fiat: '148.77',
      historical: '148.50',
      priceChange: '+1.0%',
      ago: 'Oct 17, 2026 · 7 days ago',
      txid: 'c15000b6112233445566778899aabbccddeeff00112233445566778899aabb08',
      conf: 1008,
      block: 891412,
      balance: 729097,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 111,
      weight: 444,
      fee: 160,
      version: 2
    },
    {
      type: 'send',
      label: 'Utilities',
      tags: ['home'],
      amount: 59318,
      fiat: '59.32',
      historical: '60.40',
      priceChange: '+1.0%',
      ago: 'Oct 19, 2026 · 5 days ago',
      txid: 'd06100c7112233445566778899aabbccddeeff00112233445566778899aabb09',
      conf: 720,
      block: 891700,
      balance: 669779,
      inputs: 1,
      outputs: 2,
      size: 218,
      vsize: 132,
      weight: 528,
      fee: 210,
      version: 2
    },
    {
      type: 'receive',
      label: 'Cashback',
      tags: [],
      amount: 28447,
      fiat: '28.45',
      historical: '29.60',
      priceChange: '+1.0%',
      ago: 'Oct 22, 2026 · 2 days ago',
      txid: 'e02990d8112233445566778899aabbccddeeff00112233445566778899aabb10',
      conf: 288,
      block: 892132,
      balance: 698226,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 110,
      weight: 437,
      fee: 142,
      version: 2
    },
    {
      type: 'receive',
      label: 'Bonus',
      tags: ['work'],
      amount: 327841,
      fiat: '327.84',
      historical: '330.00',
      priceChange: '+1.2%',
      ago: 'Oct 24, 2026 · today',
      txid: 'a33400d8112233445566778899aabbccddeeff00112233445566778899aabbcc',
      conf: 2,
      block: 892418,
      balance: 1026067,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 111,
      weight: 441,
      fee: 178,
      version: 2
    },
    {
      type: 'receive',
      label: 'Payment',
      tags: [],
      amount: 24183,
      fiat: '24.18',
      historical: '',
      priceChange: '',
      ago: '',
      txid: 'u02500e900aabbccddeeff00112233445566778899aabbccddeeff0011223344',
      conf: 0,
      block: 0,
      balance: 1050250,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 110,
      weight: 437,
      fee: 154,
      version: 2
    },
    {
      type: 'send',
      label: 'Invoice',
      tags: [],
      amount: 42000,
      fiat: '42.00',
      historical: '',
      priceChange: '',
      ago: '',
      txid: 'rbf000aa11bb22cc33dd44ee55ff66778899aabbccddeeff00112233445566',
      conf: 0,
      block: 0,
      rbf: true,
      balance: 1008250,
      inputs: 1,
      outputs: 1,
      size: 218,
      vsize: 141,
      weight: 564,
      fee: 310,
      version: 2
    }
  ],
  ef56ab78: [
    {
      type: 'receive',
      label: 'Cold storage',
      tags: [],
      amount: 484308,
      fiat: '484.31',
      historical: '70.00',
      priceChange: '+500%',
      ago: 'Nov 28, 2022 · 4 years ago',
      txid: 'd11a88c0ff21ab90eed11a88c0ff21ab90eed11a88c0ff21ab90eed188c0',
      conf: 205344,
      block: 687076,
      balance: 484308,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 111,
      weight: 441,
      fee: 198,
      version: 2
    },
    {
      type: 'receive',
      label: 'Deposit',
      tags: [],
      amount: 8173641,
      fiat: '8,173.64',
      historical: '2,050.00',
      priceChange: '+300%',
      ago: 'Mar 14, 2023 · 4 years ago',
      txid: 'a50000aa11bb22cc33dd44ee55ff66778899aabbccddeeff0011223344556601',
      conf: 190080,
      block: 702340,
      balance: 8657949,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 111,
      weight: 441,
      fee: 210,
      version: 2
    },
    {
      type: 'receive',
      label: 'Interest',
      tags: [],
      amount: 35184,
      fiat: '35.18',
      historical: '22.00',
      priceChange: '+59%',
      ago: 'Oct 9, 2024 · 2 years ago',
      txid: 'b12000bb22cc33dd44ee55ff66778899aabbccddeeff001122334455667702',
      conf: 107280,
      block: 785140,
      balance: 8693133,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 111,
      weight: 441,
      fee: 166,
      version: 2
    },
    {
      type: 'receive',
      label: 'Top up',
      tags: [],
      amount: 12418907,
      fiat: '12,418.91',
      historical: '8,100.00',
      priceChange: '+52%',
      ago: 'Jun 2, 2026 · 5 months ago',
      txid: 'c38000cc33dd44ee55ff66778899aabbccddeeff0011223344556677889903',
      conf: 20736,
      block: 871684,
      balance: 21112040,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 110,
      weight: 438,
      fee: 154,
      version: 2
    },
    {
      type: 'receive',
      label: '',
      tags: [],
      amount: 48271,
      fiat: '48.27',
      historical: '',
      priceChange: '',
      ago: '',
      txid: 'e44f02d199aa10cc77e44f02d199aa10cc77e44f02d199aa10cc77e402d1',
      conf: 0,
      block: 0,
      balance: 21160311,
      inputs: 1,
      outputs: 1,
      size: 192,
      vsize: 110,
      weight: 437,
      fee: 154,
      version: 2
    }
  ],
  c0ffee01: [
    {
      type: 'receive',
      label: 'Treasury',
      tags: ['vault'],
      amount: 5000000,
      fiat: '5,000.00',
      historical: '4,800.00',
      priceChange: '+4.2%',
      ago: '1 month ago',
      txid: 'd10a77ee01c0ffee01d10a77ee01c0ffee01d10a77ee01c0ffee01d10a77',
      conf: 2016,
      block: 282000,
      balance: 5000000,
      inputs: 2,
      outputs: 1,
      size: 372,
      vsize: 186,
      weight: 744,
      fee: 620,
      version: 2
    }
  ]
}

let openTxData = null

function compactTxid(txid) {
  return txid.slice(0, 4) + '...' + txid.slice(-4)
}

function confText(count, block) {
  if (count <= 0) return 'Unconfirmed'
  const countLabel = (count === 1 ? '1 conf' : count.toLocaleString('en-US') + ' confs')
  return block ? countLabel + ' • ' + block.toLocaleString('en-US') : countLabel
}

function confClass(count) {
  if (count <= 0) return 'is-unconfirmed'
  if (count < 6) return 'is-pending'
  return 'is-confirmed'
}

function pctChange(now, base) {
  if (!base || now === base) return ''
  const value = ((now - base) * 100) / base
  return (value > 0 ? '+' : '-') + Math.abs(value).toFixed(1) + '%'
}

function txCard(tx, previousBalance, max, compact) {
  const tags = tx.tags.length
    ? tx.tags
        .map((tag) => '<span class="tx-tag">' + tag + '</span>')
        .join('')
    : '<span class="tx-tag is-empty">No tags</span>'
  const balanceChange = pctChange(tx.balance, previousBalance)
  const metaLeft = tx.ago ? tx.ago + ' ' + compactTxid(tx.txid) : compactTxid(tx.txid)
  const amount = compact
    ? ss.amountDisplay({
        amount: tx.amount,
        textSize: 'xl',
        weight: 'light',
        unitSize: 'xs',
        type: tx.type,
        noColor: false,
        showSign: false,
        letterSpacing: 0
      })
    : '<strong>' + tx.amount.toLocaleString('en-US') + '</strong> <span>sats</span>'
  const balance = compact
    ? ss.styledSat({ amount: tx.balance, textSize: 'xs', type: tx.type, noColor: false, showSign: false }) +
      ' <span>sats</span>'
    : '<strong>' + tx.balance.toLocaleString('en-US') + '</strong> <span>sats</span>'
  return (
    '<button type="button" class="tx-card' +
    (compact ? ' is-compact' : '') +
    '" data-txid="' +
    tx.txid +
    '">' +
    bar(tx, max) +
    '<p class="tx-meta"><span>' +
    metaLeft +
    '</span><span class="tx-conf ' +
    confClass(tx.conf) +
    '">' +
    confText(tx.conf, tx.block) +
    '</span></p><div class="tx-body"><div class="tx-main"><p class="tx-amount ' +
    tx.type +
    '">' +
    icon(tx.type === 'receive' ? 'incoming' : 'outgoing', 'tx-flow') +
    amount +
    '</p><p class="tx-fiat">' +
    txFiatHtml(tx) +
    '</p><p class="tx-label' +
    (tx.label ? '' : ' is-empty') +
    '">' +
    (tx.label || 'NO LABEL') +
    '</p></div><div class="tx-side"><p class="tx-balance ' +
    tx.type +
    '">' +
    balance +
    '</p>' +
    (balanceChange
      ? '<p class="tx-pct ' + (balanceChange[0] === '+' ? 'is-up' : 'is-down') + '">' + balanceChange + '</p>'
      : '') +
    '<p class="tx-tags">' +
    tags +
    '</p></div></div></button>'
  )
}

const usedAddresses = {
  ab12cd34: {
    receive: [
      { index: 0, address: 'tb1qsalary0ab12cd34spend0000000000000000', label: 'Salary', balance: 484308, mempool: 0, txs: 1, utxos: 1 },
      { index: 1, address: 'tb1qcoffee0ab12cd34spend0000000000000000', label: 'Coffee refund', balance: 617433, mempool: 0, txs: 1, utxos: 1 },
      { index: 2, address: 'tb1qunused0ab12cd34spend0000000000000000', label: '', balance: 0, mempool: 0, txs: 0, utxos: 0 }
    ],
    change: [
      { index: 0, address: 'tb1qchange0ab12cd34internal00000000000000', label: 'Change', balance: 0, mempool: 0, txs: 1, utxos: 0 },
      { index: 1, address: 'tb1qspare00ab12cd34internal00000000000000', label: '', balance: 0, mempool: 0, txs: 0, utxos: 0 }
    ]
  },
  ef56ab78: {
    receive: [
      { index: 0, address: 'tb1qcold000ef56ab78spend0000000000000000', label: 'Cold storage', balance: 21112040, mempool: 0, txs: 1, utxos: 1 },
      { index: 1, address: 'tb1qpool000ef56ab78spend0000000000000000', label: '', balance: 0, mempool: 48271, txs: 1, utxos: 0 }
    ],
    change: [
      { index: 0, address: 'tb1qchange0ef56ab78internal00000000000000', label: '', balance: 0, mempool: 0, txs: 0, utxos: 0 }
    ]
  }
}

function shortAddress(address) {
  return address.slice(0, 6) + '...' + address.slice(-6)
}

function dim(value) {
  return value ? '' : ' is-dim'
}

function addressRows(account) {
  const book = usedAddresses[account.fingerprint] || usedAddresses.ab12cd34
  const rows = book[addressChange ? 'change' : 'receive'].slice()
  return rows
}

function addressTable(account) {
  const rows = addressRows(account)
    .map(
      (row) =>
        '<button type="button" class="addr-row"><span>' +
        row.index +
        '</span><span class="addr-mono">' +
        shortAddress(row.address) +
        '</span><span class="' +
        dim(row.label) +
        '">' +
        (row.label ? (row.label.length > 14 ? row.label.slice(0, 14) + '...' : row.label) : 'No label') +
        '</span><span class="' +
        dim(row.balance) +
        '">' +
        row.balance.toLocaleString('en-US') +
        '</span><span class="' +
        dim(row.txs) +
        '">' +
        row.txs +
        '</span><span class="' +
        dim(row.utxos) +
        '">' +
        row.utxos +
        '</span></button>'
    )
    .join('')
  return (
    '<div class="addr-scroll"><div class="addr-table"><div class="addr-head"><span>#</span><span>Address</span><span>Label</span><span>Sats</span><span>TXs</span><span>UTXOs</span></div>' +
    rows +
    '</div></div><button type="button" class="addr-more">Load more</button>'
  )
}

function addressCards(account) {
  const rows = addressRows(account)
    .map(
      (row, index) =>
        (index ? '<div class="tx-rule"></div>' : '') +
        '<article class="addr-card"><p>Address #' +
        row.index +
        '</p><p class="addr-full">' +
        row.address +
        '</p><div class="addr-stats"><div><span>Current balance</span><strong>' +
        row.balance.toLocaleString('en-US') +
        '</strong></div><div><span>Unconfirmed balance</span><strong>' +
        row.mempool.toLocaleString('en-US') +
        '</strong></div><div><span>Total Transactions</span><strong>' +
        row.txs +
        '</strong></div><div><span>Total UTXOs</span><strong>' +
        row.utxos +
        '</strong></div><div class="is-wide"><span>Label</span><strong class="' +
        dim(row.label) +
        '">' +
        (row.label || 'No label') +
        '</strong></div></div></article>'
    )
    .join('')
  return rows + '<button type="button" class="addr-more">Load more</button>'
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

function fiatAxisTick(value) {
  const abs = Math.abs(value)
  if (abs >= 1000000) return (value / 1000000).toFixed(abs >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'm'
  if (abs < 1000) return String(Math.round(value))
  const scaled = value / 1000
  const digits = abs >= 10000 ? 0 : abs >= 1000 ? 1 : 2
  return scaled.toFixed(digits).replace(/\.0$/, '') + 'k'
}

function chartCurrency() {
  const code = (typeof sfState !== 'undefined' && sfState.fiat) || (typeof appSettings !== 'undefined' && appSettings.fiat) || 'USD'
  return FIAT_LINE_COLORS[code] ? code : 'USD'
}

function loadBundledPrices() {
  if (loadBundledPrices.started) return
  loadBundledPrices.started = true
  Object.keys(FIAT_LINE_COLORS).forEach((code) => {
    fetch('/studio/prices/' + code.toLowerCase() + '.json')
      .then((response) => response.json())
      .then((data) => {
        bundledPrices[code] = data
        if (chartCurrency() !== code) return
        if (typeof renderAccounts === 'function') renderAccounts()
        const accountView = document.getElementById('view-account')
        if (accountView && !accountView.hidden) renderAccount()
        const txView = document.getElementById('view-tx')
        if (txView && !txView.hidden) renderTransaction()
      })
      .catch(() => {})
  })
}

function bundledSeries() {
  return bundledPrices[chartCurrency()] || null
}

function bundledPriceAt(unix) {
  const series = bundledSeries()
  if (!series || !series.times.length || unix < series.times[0]) return null
  const times = series.times
  let lo = 0
  let hi = times.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (times[mid] <= unix) lo = mid
    else hi = mid - 1
  }
  return series.prices[lo]
}

function historyChart(txs, boxW, boxH) {
  loadBundledPrices()
  const balances = txs.length ? txs.map((tx) => tx.balance) : [0]
  const max = Math.max(...balances)
  const min = 0
  const span = Math.max(max - min, 1)
  const width = Math.max(240, Math.round(boxW || 340))
  const height = Math.max(140, Math.round(boxH || 260))
  const plotTop = 36
  const floor = height - 32
  const left = 54
  const right = width - 50
  const now = Math.floor(Date.now() / 1000)
  const txUnix = (tx) => now - (tx.conf || 0) * 600
  const oldest = Math.max(...txs.map((tx) => tx.conf || 0), 144)
  const ordered = txs.slice().sort((a, b) => txUnix(a) - txUnix(b))
  const balanceAt = (unix) => {
    let balance = 0
    ordered.forEach((tx) => {
      if (txUnix(tx) <= unix) balance = tx.balance
    })
    return balance
  }
  const start = Math.min(...ordered.map(txUnix))
  const marks = new Set(ordered.map(txUnix))
  const priceSeries = bundledSeries()
  if (priceSeries) priceSeries.times.forEach((time) => {
    if (time >= start && time <= now) marks.add(time)
  })
  const fiatSamples = Array.from(marks)
    .sort((a, b) => a - b)
    .map((unix) => {
      const price = bundledPriceAt(unix)
      if (price === null) return null
      return { conf: Math.max(0, (now - unix) / 600), fiat: (balanceAt(unix) * price) / SATS_PER_BTC }
    })
    .filter(Boolean)
  const fiatValues = fiatSamples.map((sample) => sample.fiat)
  const fiatMax = Math.max(...fiatValues)
  const fiatMin = Math.min(...fiatValues)
  const fiatSpan = Math.max(fiatMax - fiatMin, 1)
  const tick = (value) => (Math.abs(value) >= 10000 ? fiatAxisTick(value) : Math.round(value).toLocaleString('en-US'))
  const yOf = (value, low, range) => plotTop + (1 - (value - low) / range) * (floor - plotTop)
  const xOfConf = (conf) => right - (conf / oldest) * (right - left)
  const byTime = txs.slice().sort((a, b) => (b.conf || 0) - (a.conf || 0))
  const points = byTime.map((tx) => ({
    x: xOfConf(tx.conf || 0),
    y: yOf(tx.balance, min, span)
  }))
  if ((byTime[byTime.length - 1].conf || 0) > 0) {
    points.push({ x: xOfConf(0), y: yOf(byTime[byTime.length - 1].balance, min, span) })
  }
  let line = 'M' + points[0].x + ' ' + points[0].y
  for (let index = 1; index < points.length; index += 1) {
    line += ' H' + points[index].x + ' V' + points[index].y
  }
  let fiatLine = ''
  fiatSamples.forEach((sample, index) => {
    const x = xOfConf(sample.conf)
    const y = yOf(sample.fiat, fiatMin, fiatSpan)
    fiatLine += (index ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)
  })
  const opts = typeof sfState !== 'undefined' && sfState.charts ? sfState.charts : null
  const showFiat = !opts || opts.showHistoricalFiatLine !== false
  const fiatColor = FIAT_LINE_COLORS[chartCurrency()]
  const fiatAxis = showFiat && fiatValues.length
    ? '<text x="' + (width - 8) + '" y="14" text-anchor="end" fill="' + fiatColor + '" font-size="10">' + chartCurrency() + '</text>' +
      '<text x="' + (width - 8) + '" y="' + (plotTop + 4) + '" text-anchor="end" fill="' + fiatColor + '" font-size="10">' +
      fiatAxisTick(fiatMax) +
      '</text><text x="' + (width - 8) + '" y="' + (floor + 3) + '" text-anchor="end" fill="' + fiatColor + '" font-size="10">' +
      fiatAxisTick(fiatMin) +
      '</text><path d="' +
      fiatLine +
      '" fill="none" stroke="' + fiatColor + '" stroke-width="1.75" stroke-linecap="butt" stroke-linejoin="miter"/>'
    : ''
  const callouts = []
  if (opts) {
    let lastX = -80
    byTime.forEach((tx) => {
      const x = xOfConf(tx.conf || 0)
      if (x - lastX < 52) return
      const lines = []
      if (opts.showLabel && tx.label) lines.push(tx.label)
      if (opts.showAmount) lines.push(Number(tx.amount).toLocaleString('en-US'))
      if (opts.showTransactionInfo) lines.push(tx.type === 'send' ? 'Sent' : 'Received')
      if (opts.showOutputField && tx.outputs) lines.push(tx.outputs + (tx.outputs === 1 ? ' output' : ' outputs'))
      if (opts.showFiatAtTxTime && tx.historical) lines.push('$' + tx.historical)
      if (opts.showFiatPercentageChange && tx.priceChange) lines.push(tx.priceChange)
      if (!lines.length) return
      lastX = x
      const y = Math.min(floor - 4, Math.max(plotTop, yOf(tx.balance, min, span) - 8 - lines.length * 11))
      lines.forEach((line, index) => {
        const gold = line.charAt(0) === '$' || line.charAt(0) === '+' || line.charAt(0) === '-'
        callouts.push(
          '<text x="' + x.toFixed(1) + '" y="' + (y + index * 11).toFixed(1) + '" fill="' + (gold ? fiatColor : '#bdbdbd') + '" font-size="8">' + line + '</text>'
        )
      })
    })
  }
  return (
    '<svg class="history-chart' +
    (opts && opts.lockZoomToXAxis ? ' is-lock-x' : '') +
    '" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '" preserveAspectRatio="none" aria-label="Balance history">' +
    '<path d="' +
    line +
    ' V' +
    floor +
    ' H' +
    points[0].x +
    ' Z" fill="rgba(255,255,255,0.14)"/>' +
    '<path d="' +
    line +
    '" fill="none" stroke="var(--white)" stroke-width="1.75" stroke-linecap="butt" stroke-linejoin="miter"/>' +
    fiatAxis +
    callouts.join('') +
    '<text x="6" y="14" fill="var(--gray-400)" font-size="10">sats</text>' +
    '<text x="6" y="' + (plotTop + 4) + '" fill="var(--gray-400)" font-size="10">' +
    tick(max) +
    '</text><text x="6" y="' +
    ((plotTop + floor) / 2 + 3) +
    '" fill="var(--gray-400)" font-size="10">' +
    tick((max + min) / 2) +
    '</text><text x="6" y="' + (floor + 3) + '" fill="var(--gray-400)" font-size="10">' +
    tick(min) +
    '</text>' +
    '</svg>'
  )
}

const coins = [
  { id: 'salary', label: 'Salary', value: 484308, fiat: '484.31', address: 'tb1q…4e20', selected: true },
  { id: 'refund', label: 'Coffee refund', value: 617433, fiat: '617.43', address: 'tb1q…10b3', selected: false },
  { id: 'change', label: 'Change', value: 213847, fiat: '213.85', address: 'tb1q…91aa', selected: false },
  { id: 'invoice', label: 'Invoice', value: 128447, fiat: '128.45', address: 'tb1q…77c1', selected: false },
  { id: 'gift', label: 'Gift', value: 86419, fiat: '86.42', address: 'tb1q…2aa9', selected: false },
  { id: 'tips', label: 'Tips', value: 39114, fiat: '39.11', address: 'tb1q…b014', selected: false },
  { id: 'dust', label: 'Dust', value: 1847, fiat: '1.85', address: 'tb1q…55e8', selected: false },
  { id: 'rebate', label: 'Rebate', value: 9641, fiat: '9.64', address: 'tb1q…c3d2', selected: false },
  { id: 'test', label: 'Test', value: 353, fiat: '0.35', address: 'tb1q…90af', selected: false },
  { id: 'spare', label: 'Spare', value: 1284, fiat: '1.28', address: 'tb1q…61bb', selected: false },
  { id: 'pending', label: 'Payment', value: 24183, fiat: '24.18', address: 'tb1q…3344', selected: false, unconfirmed: true }
]
let coinView = 'list'
let outputView = 'bubbles'
let sendPhase = 'coins'

function toggleCoin(id) {
  const coin = coins.find((entry) => entry.id === id)
  if (!coin) return
  coin.selected = !coin.selected
  if (!document.getElementById('view-account').hidden) renderAccount()
}

function utxoList() {
  return (
    '<table class="utxo-table"><thead><tr><th></th><th>Amount</th><th>Label</th><th>Address</th></tr></thead><tbody>' +
    coins
      .map(
        (coin) =>
          '<tr class="utxo' +
          (coin.selected ? ' is-on' : '') +
          '" data-coin="' +
          coin.id +
          '"><td><span class="utxo-mark' +
          (coin.selected ? ' is-on' : '') +
          '">' +
          (coin.selected ? '×' : '+') +
          '</span></td><td><strong>' +
          coin.value.toLocaleString('en-US') +
          '</strong><small>' +
          satsUsd(coin.value) +
          ' USD</small></td><td>' +
          coin.label +
          '</td><td>' +
          coin.address +
          '</td></tr>'
      )
      .join('') +
    '</tbody></table>'
  )
}

function tangentPoints(a, b, radius) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const distance = Math.hypot(dx, dy)
  const reachA = a.r + radius
  const reachB = b.r + radius
  if (!distance || distance > reachA + reachB || distance < Math.abs(reachA - reachB)) return []
  const along = (reachA * reachA + distance * distance - reachB * reachB) / (2 * reachA * distance)
  const clamped = Math.max(-1, Math.min(1, along))
  const across = Math.sqrt(Math.max(0, 1 - clamped * clamped))
  const ux = dx / distance
  const uy = dy / distance
  const px = a.x + ux * reachA * clamped
  const py = a.y + uy * reachA * clamped
  const ox = -uy * reachA * across
  const oy = ux * reachA * across
  return [
    { x: px + ox, y: py + oy },
    { x: px - ox, y: py - oy }
  ]
}

function packCoins(items, width, height) {
  const gap = 3
  const nodes = items
    .map((item) => ({ item: item, r: Math.sqrt(Math.max(item.value, 1)) + gap }))
    .sort((a, b) => b.r - a.r)
  if (!nodes.length) return []
  nodes[0].x = 0
  nodes[0].y = 0
  if (nodes[1]) {
    nodes[1].x = nodes[0].r + nodes[1].r
    nodes[1].y = 0
  }
  const placed = nodes.slice(0, Math.min(2, nodes.length))

  function overlaps(x, y, radius, ignore) {
    return placed.some((peer) => {
      if (peer === ignore) return false
      const dx = peer.x - x
      const dy = peer.y - y
      const min = peer.r + radius
      return dx * dx + dy * dy < min * min - 0.05
    })
  }

  for (let index = 2; index < nodes.length; index += 1) {
    const node = nodes[index]
    let best = null
    let bestScore = Infinity
    for (let left = 0; left < placed.length; left += 1) {
      for (let right = left + 1; right < placed.length; right += 1) {
        tangentPoints(placed[left], placed[right], node.r).forEach((point) => {
          if (overlaps(point.x, point.y, node.r)) return
          const score = point.x * point.x + point.y * point.y
          if (score < bestScore) {
            bestScore = score
            best = point
          }
        })
      }
    }
    node.x = best ? best.x : nodes[0].r + node.r
    node.y = best ? best.y : index * node.r
    placed.push(node)
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  nodes.forEach((node) => {
    const radius = node.r - gap
    minX = Math.min(minX, node.x - radius)
    minY = Math.min(minY, node.y - radius)
    maxX = Math.max(maxX, node.x + radius)
    maxY = Math.max(maxY, node.y + radius)
  })
  const boundsW = Math.max(maxX - minX, 1)
  const boundsH = Math.max(maxY - minY, 1)
  const margin = 8
  const scale = Math.min((width - margin * 2) / boundsW, (height - margin * 2) / boundsH)
  const offsetX = (width - boundsW * scale) / 2
  const offsetY = (height - boundsH * scale) / 2
  const pad = 2
  return nodes.map((node) => {
    const full = (node.r - gap) * scale
    const radius = Math.max(2, full - pad)
    return {
      item: node.item,
      d: radius * 2,
      x: offsetX + (node.x - (node.r - gap) - minX) * scale + (full - radius),
      y: offsetY + (node.y - (node.r - gap) - minY) * scale + (full - radius)
    }
  })
}

function bubblePack(enter, full) {
  const screen = document.getElementById('view-send')
  const width = full ? screen.clientWidth || 390 : 340
  const height = full ? screen.clientHeight || 844 : 360
  return (
    '<div class="coin-map"><div class="coin-map-stage">' +
    packCoins(coins, width, height)
      .map((bubble, index) => {
        const coin = bubble.item
        const showLabel = bubble.d >= 72
        const font = Math.max(7, Math.min(12, bubble.d * 0.16))
        return (
          '<button type="button" class="bubble' +
          (enter ? ' is-enter' : '') +
          (coin.selected ? ' is-selected' : '') +
          '" data-coin="' +
          coin.id +
          '" style="' +
          (enter ? 'animation-delay:' + index * 55 + 'ms;' : '') +
          'width:' +
          bubble.d +
          'px;height:' +
          bubble.d +
          'px;min-width:' +
          bubble.d +
          'px;min-height:' +
          bubble.d +
          'px;left:' +
          bubble.x +
          'px;top:' +
          bubble.y +
          'px"><strong style="font-size:' +
          font +
          'px">' +
          (bubble.d < 48 ? '' : coin.value.toLocaleString('en-US')) +
          '</strong>' +
          (showLabel ? '<span>' + coin.label + '</span>' : '') +
          '</button>'
        )
      })
      .join('') +
    '</div></div>'
  )
}

let bubbleZoomId = null
let coinClickTimer = 0

function applyBubbleZoom(map) {
  const stage = map.querySelector('.coin-map-stage')
  const zoomingIn = Boolean(bubbleZoomId)
  map.classList.toggle('is-zoomed', zoomingIn)
  map.classList.toggle('is-zoom-out', !zoomingIn)
  if (!bubbleZoomId) {
    stage.style.transform = ''
    return
  }
  const bubble = stage.querySelector('[data-coin="' + bubbleZoomId + '"]')
  if (!bubble) {
    stage.style.transform = ''
    return
  }
  const width = map.clientWidth
  const height = map.clientHeight
  const diameter = bubble.offsetWidth
  const centerX = bubble.offsetLeft + diameter / 2
  const centerY = bubble.offsetTop + diameter / 2
  const scale = Math.min(8, Math.max(1.8, (Math.min(width, height) * 0.72) / diameter))
  stage.style.transform =
    'translate(' +
    (width / 2 - scale * centerX) +
    'px, ' +
    (height / 2 - scale * centerY) +
    'px) scale(' +
    scale +
    ')'
}

function bindCoins(root) {
  root.querySelectorAll('[data-coin]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!button.classList.contains('bubble')) {
        toggleCoin(button.dataset.coin)
        return
      }
      window.clearTimeout(coinClickTimer)
      coinClickTimer = window.setTimeout(() => toggleCoin(button.dataset.coin), 240)
    })
    button.addEventListener('dblclick', (event) => {
      if (!button.classList.contains('bubble')) return
      event.preventDefault()
      window.clearTimeout(coinClickTimer)
      const map = button.closest('.coin-map')
      bubbleZoomId = bubbleZoomId ? null : button.dataset.coin
      if (map) applyBubbleZoom(map)
    })
  })
  const map = root.querySelector('.coin-map')
  if (map && bubbleZoomId) applyBubbleZoom(map)
}

function openSend() {
  sendPhase = 'output'
  document.getElementById('view-send').classList.remove('is-bubbles')
  document.getElementById('send-title').textContent = openAccountData ? openAccountData.name : 'Spending'
  renderIo()
  show('send')
}

// ioPreview.tsx — the transaction builder. `draft` mirrors the transactionBuilder store.
const draft = {
  outputs: [{ id: 1, amount: 50000, to: 'tb1qpayjoin0demo0000000000000000000000', label: 'Coffee' }],
  feeRate: 2.2,
  autoSelect: 'user',
  editing: null
}
// Set by a fee replacement (bump, cancel-to-self, or CPFP) before go('send').
let replacementDraft = null
let enteringReplacement = false

function loadReplacement(kind, tx) {
  const book = (typeof usedAddresses !== 'undefined' && usedAddresses[openAccountData.fingerprint]) || usedAddresses.ab12cd34
  const fresh = (book.receive.find((row) => !row.balance && !row.txs) || book.receive[book.receive.length - 1]).address
  const floor = Math.round((tx.fee / tx.vsize) * 10) / 10 + 1
  replacementDraft = { kind, feeFloor: floor }
  draft.feeRate = floor
  sendOptions.rbf = kind !== 'cpfp'
  coins.forEach((coin) => {
    coin.selected = kind === 'cpfp' ? Boolean(coin.unconfirmed) : coin.id === 'salary'
  })
  if (kind === 'bump') {
    draft.outputs = [{ id: 1, amount: tx.amount, to: 'tb1qinvoice0demo000000000000000000000', label: tx.label || 'Payment' }]
  } else {
    const totGuess = 11 + 68 + 31
    const fee = Math.ceil(totGuess * floor)
    const returned = Math.max(546, (kind === 'cancel' ? tx.amount + tx.fee : tx.amount) - fee)
    draft.outputs = [{ id: 1, amount: returned, to: fresh, label: kind === 'cancel' ? t('transaction.feeReplacement.cancel.action') : t('transaction.feeReplacement.cpfp') }]
  }
  enteringReplacement = true
  go('send')
  enteringReplacement = false
}
let BLOCK_HEIGHT = 892417
let NEXT_BLOCK_FEE = 3

function draftTotals() {
  const inputs = coins.filter((coin) => coin.selected)
  const inValue = inputs.reduce((sum, coin) => sum + coin.value, 0)
  const outValue = draft.outputs.reduce((sum, out) => sum + out.amount, 0)
  const vsize = 11 + 68 * Math.max(inputs.length, 1) + 31 * (draft.outputs.length + 1)
  const fee = Math.round(vsize * draft.feeRate)
  const change = inValue - outValue - fee
  const spendable = coins.filter((coin) => !coin.excluded).reduce((sum, coin) => sum + coin.value, 0)
  return { inputs, inValue, outValue, vsize, fee, change, spendable, underfunded: change < 0 }
}

function draftTx(tot) {
  return {
    type: 'send',
    txid: 'draft0' + tot.inputs.length + draft.outputs.length,
    amount: tot.outValue,
    fee: tot.fee,
    size: tot.vsize + 30,
    vsize: tot.vsize,
    inputs: tot.inputs.length,
    outputs: draft.outputs.length + (tot.change > 0 ? 1 : 0),
    flowInputs: tot.inputs.map((coin) => ({ value: coin.value, label: coin.label, ours: true, from: coin.address })),
    flowOutputs: draft.outputs
      .map((out) => ({ value: out.amount, label: out.label || t('common.noLabel'), ours: false, to: out.to }))
      .concat(tot.change > 0 ? [{ value: tot.change, label: 'Change', ours: true, to: 'tb1qchange0001' }] : [])
      .concat([{ value: tot.fee, label: 'Miner fee', fee: true }])
  }
}

// Load history swaps the builder's chart for the multi-hop diagram in place, like ioPreview.tsx.
let ioHistory = false

function ioChart(tot, tx) {
  if (typeof sfState !== 'undefined' && sfState.charts && !sfState.charts.showTransactionFlowChart) return ''
  if (!tot.inputs.length) return ''
  if (ioHistory && typeof ltHistorySvg === 'function') {
    const model = ltHistoryModel()
    if (model) return '<div class="io-history" id="io-history-scroll">' + ltHistorySvg(model) + '</div>'
  }
  return txDetailSankey(tx)
}

function renderIo() {
  const root = document.getElementById('io-preview')
  const accountsBody = document.querySelector('#view-send > .accounts-body')
  accountsBody.hidden = true
  root.hidden = false
  const tot = draftTotals()
  const gray = (n, v) => ss.text({ size: 'xxs', as: 'span', style: 'color:var(--gray-' + n + ')' }, String(v))
  const fiat = (sats) => ((sats / SATS_PER_BTC) * USD_PER_BTC).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const tx = draftTx(tot)
  const autoTitle = (k) => t('transaction.build.options.autoSelect.utxos.' + k + '.title')

  root.innerHTML =
    '<div class="io-chart' + (ioHistory ? ' is-history' : '') + '">' + ioChart(tot, tx) + '</div>' +
    '<div class="io-top">' +
    ss.vstack({ gap: 'xs', itemsCenter: true },
      ss.hstack({ gap: 'xxs', className: 'io-chaintip', go: 'explorer-chaintip' },
        gray(500, 'Block '), gray('white', BLOCK_HEIGHT.toLocaleString('en-US')).replace('var(--gray-white)', 'var(--white)'),
        '<i style="width:8px"></i>', gray(500, '~'), gray(200, NEXT_BLOCK_FEE), gray(500, ' sat/vB'),
        '<i style="width:12px"></i>', gray(200, USD_PER_BTC.toLocaleString('en-US')), gray(500, ' USD')),
      ss.hstack({ gap: 'sm', style: 'flex-wrap:wrap;justify-content:center' },
        ss.hstack({ gap: 'xxs' }, gray(75, tot.inputs.length), gray(400, t('common.of').toLowerCase()), gray(75, coins.filter((coin) => !coin.excluded).length),
          gray(400, t('common.selected').toLowerCase()), gray(400, t('common.separator')), gray(75, autoTitle(draft.autoSelect))),
        ss.hstack({ gap: 'xs' }, gray(400, t('common.total')), gray(75, tot.spendable.toLocaleString('en-US')), gray(400, t('bitcoin.sats')),
          gray(75, fiat(tot.spendable)), gray(400, 'USD'))),
      tot.underfunded ? ss.text({ size: 'xxs', style: 'color:var(--warning);margin-top:-2px' }, t('transaction.error.insufficientInputs')) : '',
      replacementDraft && replacementDraft.kind === 'cpfp' && tot.inputs.length > 0 && tot.inputs.every((coin) => coin.unconfirmed)
        ? ss.text({ size: 'sm', color: 'muted', center: true }, t('transaction.feeReplacement.note.cpfp'))
        : replacementDraft && replacementDraft.kind === 'cancel'
          ? ss.text({ size: 'sm', color: 'muted', center: true }, t('transaction.feeReplacement.note.cancel'))
          : '',
      ss.vstack({ gap: 'xxs', itemsCenter: true },
        ss.hstack({ gap: 'xs', style: 'align-items:baseline' },
          ss.text({ size: '5xl', weight: 'ultralight', style: 'line-height:44px' }, tot.inValue.toLocaleString('en-US')),
          ss.text({ size: 'lg', color: 'muted' }, t('bitcoin.sats'))),
        ss.hstack({ gap: 'xs', style: 'align-items:baseline' },
          ss.text({ color: 'muted' }, fiat(tot.inValue)),
          ss.text({ size: 'xxs', style: 'color:var(--gray-500)' }, 'USD')))) +
    '</div>' +
    '<div class="io-bottom">' +
    ss.vstack({ gap: 'xs' },
      ss.hstack({ justifyBetween: true, style: 'margin-bottom:var(--layout-v-stack-gap-sm)' },
        ioHistory
          ? '<i></i>'
          : '<button type="button" class="io-link" id="io-history">' + ss.icon('chevronLeft', { width: 3, height: 6 }) + ss.icon('chevronLeft', { width: 3, height: 6 }) + '<span>' + t('transaction.loadHistory').toUpperCase() + '</span></button>',
        document.getElementById('payjoin-toggle').checked
          ? '<button type="button" class="io-link" id="io-payjoin"><span>' + t('transaction.build.payjoin.data.open').toUpperCase() + '</span>' + ss.icon('chevronRight', { width: 3, height: 6 }) + ss.icon('chevronRight', { width: 3, height: 6 }) + '</button>'
          : ''),
      ss.vstack({ gap: 'xs' },
        (sendOptions.rbf || tot.inputs.some((coin) => coin.unconfirmed))
          ? ss.hstack({ gap: 'sm' },
              sendOptions.rbf ? ss.text({ uppercase: true, color: 'muted', size: 'xs' }, t('transaction.feeReplacement.flag.rbf')) : '',
              tot.inputs.some((coin) => coin.unconfirmed) ? ss.text({ uppercase: true, color: 'muted', size: 'xs' }, t('transaction.feeReplacement.flag.cpfp')) : '')
          : '',
        ss.hstack({ gap: 'xs' },
          ss.button({ variant: 'outline', label: t('transaction.build.toolbar.input'), className: 'io-tool', id: 'io-inputs' }),
          ss.button({ variant: 'outline', label: t('transaction.build.toolbar.options'), className: 'io-tool', id: 'io-options' }),
          ss.button({ variant: 'outline', label: t('transaction.build.toolbar.fee'), className: 'io-tool', id: 'io-fee' }),
          ss.button({ variant: 'outline', label: t('transaction.build.toolbar.output'), className: 'io-tool', id: 'io-add-output' })),
        ss.hstack({ gap: 'xs' },
          ss.button({ variant: 'outline', label: t('transaction.discard'), className: 'io-tool', id: 'io-discard' }),
          ss.button({
            variant: 'secondary',
            label: draft.outputs.length ? t('transaction.build.toolbar.preview') : t('transaction.build.add.output.title'),
            style: 'flex:1',
            id: draft.outputs.length ? 'io-preview-go' : 'io-add-output',
            disabled: tot.underfunded && draft.outputs.length > 0
          })))) +
    '</div>'
  document.getElementById('io-overlays').innerHTML = renderIoSheets(tot, autoTitle)
  const history = document.getElementById('io-history-scroll')
  // Open on the newest hops (inputs → tx → outputs); older hops are a scroll to the left.
  if (history) requestAnimationFrame(() => { history.scrollLeft = Math.max(Number(history.firstElementChild.dataset.focus) || 0, history.scrollWidth - history.clientWidth) })
}

function renderIoSheets(tot, autoTitle) {
  const describe = (k) => t('transaction.build.options.autoSelect.utxos.' + k + '.description')
  return ss.bottomSheet({ id: 'io-options-sheet', title: t('transaction.build.options.title') },
      ss.vstack({ gap: 'xs' },
        ss.text({ color: 'muted', uppercase: true }, t('transaction.build.options.autoSelect.utxos.label')),
        ss.hstack({ gap: 'xs' }, ['user', 'privacy', 'efficiency'].map((k) =>
          ss.radio({ variant: 'outline', label: autoTitle(k), group: 'io-auto', selected: draft.autoSelect === k, style: 'flex:1', data: { auto: k } }))),
        ss.text({ color: 'muted', id: 'io-auto-desc' }, describe(draft.autoSelect))),
      ss.vstack({},
        ss.hstack({},
          ss.button({ variant: 'outline', label: t('transaction.build.options.feeControl'), style: 'flex-grow:1;width:45%', go: 'fee-management' }),
          ss.button({ variant: 'outline', label: t('transaction.build.options.timelock'), style: 'flex-grow:1;width:45%', go: 'timelock' })),
        ss.button({ variant: 'outline', label: t('transaction.build.options.importOutputs.title'), go: 'import-outputs' }))) +
    ss.bottomSheet({ id: 'io-fee-sheet', title: t('transaction.build.update.fee.title'), height: '62%' },
      ss.feeInput({ value: draft.feeRate, vbytes: tot.vsize, max: 40, min: replacementDraft ? replacementDraft.feeFloor : 1 }),
      ss.button({ variant: 'secondary', label: t('transaction.build.set.fee'), id: 'io-set-fee' }),
      ss.button({ variant: 'ghost', label: t('common.cancel'), data: { 'ss-close': '' } })) +
    ss.bottomSheet({ id: 'io-payjoin-sheet', title: t('transaction.build.payjoin.data.title'), height: '70%' },
      ss.vstack({ gap: 'md' },
        [['address', draft.outputs[0] ? draft.outputs[0].to : ''], ['amount', (draft.outputs[0] ? draft.outputs[0].amount : 0).toLocaleString('en-US') + ' ' + t('bitcoin.sats')],
          ['endpointKind', t('transaction.build.payjoin.data.bip77')], ['endpoint', 'https://payjo.in/demo']].map(([k, v]) =>
          ss.vstack({ gap: 'xs' }, ss.text({ color: 'muted', uppercase: true, size: 'xs' }, t('transaction.build.payjoin.data.' + k)), ss.text({ style: 'word-break:break-all' }, v))),
        ss.button({ variant: 'ghost', label: t('common.close'), data: { 'ss-close': '' } }))) +
    renderOutputModal2()
}

function renderOutputModal2() {
  const tot = draftTotals()
  const editing = draft.outputs.find((out) => out.id === draft.editing)
  const number = editing ? draft.outputs.indexOf(editing) + 1 : draft.outputs.length + 1
  const own = editing ? editing.amount : 0
  const remaining = tot.inValue - tot.outValue + own - tot.fee
  return ss.modal({ id: 'io-output-modal', fullOpacity: true, showLabel: true, label: t('common.cancel') },
    ss.vstack({ gap: 'lg', widthFull: true, style: 'overflow:auto' },
      ss.vstack({ itemsCenter: true }, ss.text({ uppercase: true }, t('transaction.build.add.output.number', { number: number }))),
      ss.vstack({ gap: 'md' },
        ss.amountInput({ min: 546, max: Math.max(remaining, 546), value: editing ? editing.amount : Math.min(50000, Math.max(remaining, 546)), remainingSats: remaining }),
        ss.vstack({},
          ss.textInput({ placeholder: t('transaction.address'), align: 'left', multiline: true, mono: true, value: editing ? editing.to : '', className: 'io-address', name: 'to' }),
          ss.hstack({ gap: 'md' },
            ss.button({ variant: 'outline', label: t('common.paste'), style: 'flex:1', id: 'io-paste' }),
            ss.button({ variant: 'outline', label: t('camera.scanQRCode'), style: 'flex:1', id: 'io-paste' }))),
        ss.textInput({ placeholder: t('transaction.build.add.label.title'), align: 'left', multiline: true, value: editing ? editing.label : '', className: 'io-label', name: 'label' }),
        ss.hstack({},
          ss.button({ variant: 'danger', label: t('transaction.build.remove.output.title'), style: 'flex:1', disabled: !editing, id: 'io-remove-output' }),
          ss.button({ variant: 'secondary', label: t('transaction.build.save.output.title'), style: 'flex:1', id: 'io-save-output' })))))
}

function openOutputModal(id) {
  draft.editing = id || null
  const old = document.getElementById('io-output-modal')
  old.outerHTML = renderOutputModal2()
  ss.open('io-output-modal')
}

document.getElementById('view-send').addEventListener('click', (e) => {
  const hit = (sel) => e.target.closest(sel)
  if (hit('#io-inputs')) go('coin-list')
  if (hit('#io-options')) ss.open('io-options-sheet')
  if (hit('#io-fee')) ss.open('io-fee-sheet')
  if (hit('#io-payjoin')) ss.open('io-payjoin-sheet')
  if (hit('#io-add-output')) openOutputModal(null)
  if (hit('#io-discard')) {
    draft.outputs = []
    replacementDraft = null
    go('account')
  }
  if (hit('[data-auto]')) {
    draft.autoSelect = hit('[data-auto]').dataset.auto
    document.getElementById('io-auto-desc').textContent = t('transaction.build.options.autoSelect.utxos.' + draft.autoSelect + '.description')
  }
  if (hit('#io-set-fee')) {
    draft.feeRate = Number(document.querySelector('#io-fee-sheet [data-ss-fee]').dataset.value || draft.feeRate)
    renderIo()
  }
  if (hit('#io-paste')) {
    document.querySelector('#io-output-modal .io-address textarea').value = 'tb1qpayjoin0demo0000000000000000000000'
    ss.toast(t('common.paste'), document.getElementById('io-output-modal'))
  }
  if (hit('#io-remove-output')) {
    draft.outputs = draft.outputs.filter((out) => out.id !== draft.editing)
    renderIo()
  }
  if (hit('#io-save-output')) {
    const modal = document.getElementById('io-output-modal')
    const amount = Number(modal.querySelector('[data-ss-amount]').dataset.value || modal.querySelector('.ss-ghost-field').value)
    const to = modal.querySelector('.io-address textarea').value.trim() || 'tb1qdemo0output000000000000000000000'
    const label = modal.querySelector('.io-label textarea').value.trim()
    const existing = draft.outputs.find((out) => out.id === draft.editing)
    if (existing) Object.assign(existing, { amount, to, label })
    else draft.outputs.push({ id: Date.now(), amount, to, label })
    renderIo()
  }
  if (hit('#io-history')) {
    ioHistory = true
    renderIo()
  }
  if (hit('#io-preview-go')) {
    renderPreview()
    show('preview')
  }
})

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
  draft.outputs = [{ id: Date.now(), amount: amount, to: address, label: label }]
  closeSheet()
  openSend('output')
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

function renderAccountSettings() {
  const account = openAccountData
  const root = document.getElementById('account-settings')
  document.getElementById('account-settings-title').textContent = account.name
  const pair = (label, value) =>
    '<p class="acct-row"><span>' + label + '</span><span>' + value + '</span></p>'
  root.innerHTML =
    '<p class="acct-kicker">Account Settings and Tools</p>' +
    '<label class="acct-name">Name<input value="' +
    account.name +
    '" readonly></label>' +
    '<div class="acct-table">' +
    '<p class="acct-row"><span>Fingerprint</span><span class="acct-print"><i style="background:#' +
    account.fingerprint.slice(0, 6) +
    '"></i>' +
    account.fingerprint +
    '</span></p>' +
    pair('Created on', '12 Mar 2024') +
    '<p class="acct-row" data-go="account-birthday" role="button"><span>Wallet Birthday</span><span>' +
    (typeof bsState === 'function' && bsState().birthday ? bsState().birthday : 'Not set') +
    icon('chevron', 'acct-chevron') +
    '</span></p>' +
    pair('Network', account.network) +
    pair('Policy Type', account.multisig ? 'Multi-Signature' : account.watchOnly ? 'Watch Only' : 'Single Signature') +
    pair('Script', account.multisig ? 'Native SegWit (P2WSH)' : 'Native SegWit') +
    pair('Derivation path', account.multisig ? "m/48'/1'/0'/2'" : "m/84'/1'/0'") +
    pair('Labeled Transactions', '2 <em>of</em> ' + account.stats[0][0]) +
    pair('Labeled UTXOs', '1 <em>of</em> ' + account.stats[2][0]) +
    pair('Labeled Addresses', '3 <em>of</em> ' + account.stats[1][0]) +
    '</div>' +
    '<button type="button" class="menu-button is-outline" data-go="account-nostr"><span class="edge-left"></span><span class="edge-right"></span>Nostr Sync</button>' +
    '<div class="acct-pair"><button type="button" class="menu-button" data-go="account-export-labels"><span class="edge-left"></span><span class="edge-right"></span>Export labels</button><button type="button" class="menu-button" data-go="account-import-labels"><span class="edge-left"></span><span class="edge-right"></span>Import labels</button></div>' +
    '<button type="button" class="menu-button" data-go="account-export-seed-words"><span class="edge-left"></span><span class="edge-right"></span>View mnemonic</button>' +
    '<div class="acct-pair"><button type="button" class="menu-button" data-go="account-export-descriptors"><span class="edge-left"></span><span class="edge-right"></span>Descriptors</button><button type="button" class="menu-button" data-go="account-export-pubkeys"><span class="edge-left"></span><span class="edge-right"></span>Public Keys</button></div>' +
    '<div class="acct-actions"><button type="button" class="menu-button is-outline"><span class="edge-left"></span><span class="edge-right"></span>Rescan Wallet</button><button type="button" class="menu-button is-danger"><span class="edge-left"></span><span class="edge-right"></span>Delete Account</button><button type="button" class="menu-button is-save"><span class="edge-left"></span><span class="edge-right"></span>Save</button></div>'
}

function renderAccount() {
  loadBundledPrices()
  const account = openAccountData
  const txs = activity[account.fingerprint]
  const max = Math.max(...txs.map((tx) => tx.balance))
  const tabs = [
    [account.stats[0][0], 'Total\nTransactions'],
    [account.stats[1][0], 'Used\nAddresses'],
    [account.stats[2][0], 'Spendable\nOutputs'],
    [account.stats[3][0], 'Sats in\nMempool']
  ]
  const landing = document.getElementById('account-landing')
  const enterBubbles = outputView === 'bubbles' && !landing.querySelector('.coin-map')
  const visibleTxs = accountTab === 3 ? txs.filter((tx) => tx.conf <= 0) : txs
  const list =
    accountTab === 0 || accountTab === 3
      ? visibleTxs.length
          ? visibleTxs
              .map((tx) => {
                const index = txs.indexOf(tx)
                const previous = index <= 0 ? 0 : txs[index - 1].balance
                return txCard(tx, previous, max)
              })
              .join('')
          : '<p class="tx-empty">No transactions</p>'
      : accountTab === 1
        ? (addressView === 'table' ? addressTable(account) : addressCards(account))
        : outputView === 'bubbles'
          ? bubblePack(enterBubbles)
          : utxoList()
  document.getElementById('account-title').textContent = account.name
  document.getElementById('account-landing').innerHTML =
    '<p class="connection"><span class="dot"></span>Signet — Default <span>mempool.space</span></p>' +
    '<p class="connection">Block ' + BLOCK_HEIGHT.toLocaleString('en-US') + ' · ' + NEXT_BLOCK_FEE + ' sat/vB · ' + headerQuote() + '</p>' +
    '<p class="landing-balance">' +
    account.balance.toLocaleString('en-US') +
    ' <span>sats</span></p>' +
    '<p class="landing-fiat">' +
    accountFiat(account.balance) +
    '</p>' +
    '<div class="action-row"><button type="button" id="send-open">Send</button><button type="button" id="paste-open" aria-label="Paste">' +
    icon('paste', 'action-icon') +
    '</button><button type="button" id="camera-open" aria-label="Camera">' +
    icon('camera', 'action-icon') +
    '</button><button type="button" id="nfc-open" aria-label="NFC">' +
    icon('nfc', 'action-icon') +
    '</button><button type="button" data-go="account-receive">Receive</button></div>' +
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
    (accountTab === 1
      ? '<div class="activity-bar"><span class="activity-tools">' +
        icon('refresh', 'tool-icon') +
        icon('expand', 'tool-icon') +
        '</span><span class="addr-path"><em>Path</em> m/84&#39;/1&#39;/0&#39;/' +
        (addressChange ? '1' : '0') +
        '</span><span class="activity-tools"><button type="button" class="tool-button" id="address-view" aria-label="' +
        (addressView === 'table' ? 'List' : 'Table') +
        '">' +
        icon(addressView === 'table' ? 'menu' : 'chart', 'tool-icon') +
        '</button></span></div><div class="addr-switch"><button type="button" class="' +
        (addressChange ? '' : 'is-on') +
        '" data-chain="receive">Receive</button><button type="button" class="' +
        (addressChange ? 'is-on' : '') +
        '" data-chain="change">Change</button></div>'
      : '<div class="activity-bar"><span class="activity-tools">' +
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
        '</span></div>') +
    (accountTab === 0 && showChart
      ? '<div class="chart-host"></div>'
      : '<div class="tx-list">' + list + '</div>')
  const chartHost = document.querySelector('#account-landing .chart-host')
  if (chartHost) chartHost.innerHTML = historyChart(txs, chartHost.clientWidth, chartHost.clientHeight)
  document.getElementById('send-open').addEventListener('click', () => go('coin-list'))
  const openMultisig = document.getElementById('open-multisig')
  if (openMultisig) openMultisig.addEventListener('click', () => go('multisig-settings'))
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
      if (outputView === 'list') bubbleZoomId = null
      renderAccount()
    })
  }
  document.querySelectorAll('.tx-card[data-txid]').forEach((card) => {
    card.addEventListener('click', () => {
      const tx = txs.find((item) => item.txid === card.dataset.txid)
      if (tx) openTransaction(tx)
    })
  })
  const addressToggle = document.getElementById('address-view')
  if (addressToggle) {
    addressToggle.addEventListener('click', () => {
      addressView = addressView === 'table' ? 'list' : 'table'
      renderAccount()
    })
  }
  document.querySelectorAll('[data-chain]').forEach((button) => {
    button.addEventListener('click', () => {
      addressChange = button.dataset.chain === 'change'
      renderAccount()
    })
  })
  document.querySelectorAll('.stat').forEach((button) => {
    button.addEventListener('click', () => {
      accountTab = Number(button.dataset.tab)
      showChart = false
      renderAccount()
    })
  })
}

function detailItem(label, value, extra) {
  return (
    '<div class="tx-detail' +
    (extra || '') +
    '"><span>' +
    label +
    '</span><strong>' +
    value +
    '</strong></div>'
  )
}

function renderTransaction() {
  const tx = openTxData
  if (!tx) return
  const feeRate = (tx.fee / tx.size).toFixed(2)
  const feeVrate = (tx.fee / tx.vsize).toFixed(2)
  const tagLine = tx.tags.length
    ? tx.tags.map((tag) => '<span class="tx-tag">' + tag + '</span>').join('')
    : ''
  const labelLine = tx.label
    ? '<span class="tx-detail-label">' + tx.label + '</span>' + tagLine
    : '<span class="tx-placeholder">No label</span><span class="tx-placeholder-dot">·</span><span class="tx-placeholder">No tags</span>'
  document.getElementById('tx-body').innerHTML =
    '<div class="tx-hero">' +
    (tx.ago ? '<p class="tx-ago">' + tx.ago + '</p>' : '') +
    '<p class="tx-amount ' +
    tx.type +
    '">' +
    icon(tx.type === 'receive' ? 'incoming' : 'outgoing', 'tx-flow') +
    '<strong>' +
    tx.amount.toLocaleString('en-US') +
    '</strong> <span class="tx-unit">sats</span></p><p class="tx-fiat">' +
    txFiatHtml(tx) +
    '</p>' +
    (tx.payjoin && tx.contributed
      ? '<p class="tx-contributed">Contributed ' + tx.contributed.toLocaleString('en-US') + ' sats</p>'
      : '') +
    '<p class="tx-io"><span class="tx-conf ' +
    confClass(tx.conf) +
    '">' +
    confText(tx.conf, 0) +
    '</span><span><em>from</em> ' +
    tx.inputs +
    (tx.inputs === 1 ? ' input' : ' inputs') +
    '</span><span><em>to</em> ' +
    tx.outputs +
    (tx.outputs === 1 ? ' output' : ' outputs') +
    '</span></p></div>' +
    '<div class="tx-rule"></div>' +
    '<div class="tx-label-row" role="button" onclick="baOpenTxLabel(openTxData)"><div><span class="tx-kicker">Label</span><p>' +
    labelLine +
    '</p></div><span class="tx-pencil" aria-hidden="true"></span></div>' +
    '<div class="tx-rule"></div>' +
    '<p class="tx-kicker">Transaction flow</p>' +
    (tx.payjoin ? '<p class="tx-payjoin">Possible Payjoin (mixed ownership)</p>' : '') +
    txDetailSankey(tx) +
    '<div class="tx-rule"></div>' +
    '<div class="tx-grid">' +
    detailItem('Block', tx.block ? tx.block.toLocaleString('en-US') : '-', ' is-wide') +
    detailItem('Hash', tx.txid, ' is-wide is-mono') +
    detailItem('Raw size', tx.size + ' <small>bytes</small>') +
    detailItem('Weight', String(tx.weight)) +
    detailItem('Virtual size', String(tx.vsize)) +
    detailItem('Fee', tx.fee + ' <small>sats</small>') +
    detailItem('Fee sat/b', feeRate) +
    detailItem('Fee sat/vb', feeVrate) +
    detailItem('Version', String(tx.version)) +
    detailItem('Total inputs', String(tx.inputs)) +
    detailItem('Total outputs', String(tx.outputs)) +
    '</div><div class="tx-rule"></div>' +
    '<p class="tx-kicker">Decoded</p>' +
    '<p class="tx-decode-tools"><span>List</span><span>Bytes</span><span class="is-on">Decoded</span><span>Raw</span><span>Hex</span><span>ASCII</span></p>' +
    '<p class="tx-decode"><span>Version</span>2</p>' +
    '<p class="tx-decode"><span>Input count</span>' +
    tx.inputs +
    '</p><p class="tx-decode"><span>Output count</span>' +
    tx.outputs +
    '</p><div class="tx-io-block"><div class="tx-rule"></div><h3>Input 0</h3>' +
    '<p class="tx-decode"><span>Previous transaction output hash</span><code>' +
    tx.txid +
    '</code></p><p class="tx-decode"><span>Output index in transaction</span>0</p>' +
    '<p class="tx-decode"><span>Sequence</span>4294967293</p></div>' +
    '<div class="tx-io-block"><div class="tx-rule"></div><h3>Output 0</h3>' +
    '<p class="tx-decode"><span>Address</span><code>tb1q' +
    tx.txid.slice(0, 8) +
    'demo000000000000000000</code></p>' +
    '<p class="tx-decode"><span>Value</span>' +
    tx.amount.toLocaleString('en-US') +
    ' sats</p></div>'
}

function openTransaction(tx) {
  openTxData = tx
  renderTransaction()
  show('tx', 'tx')
}

function openAccount(account) {
  openAccountData = account
  showChart = false
  outputView = 'bubbles'
  accountTab = 0
  renderAccount()
  show('account')
}

function renderBuilder() {
  document.getElementById('preview-title').textContent = 'Transaction'
  const amount = 210000
  const fee = 242
  const change = 589758
  const tx = {
    type: 'send',
    label: 'Rent',
    txid: 'b20d91aa77c0e11f44aa91b20d91aa77c0e11f44aa91b20d91aa77c0e191aa',
    inputs: 1,
    outputs: 2,
    amount: amount,
    fee: fee,
    size: 141,
    vsize: 110,
    flowInputs: [{ value: amount + change + fee, label: 'Salary', ours: true, from: 'a91c8f21b04e' }],
    flowOutputs: [
      { value: amount, label: 'Rent', ours: false, to: 'tb1qrent000001' },
      { value: change, label: 'Change', ours: true, to: 'tb1qchange0001' },
      { value: fee, label: 'Miner fee', fee: true }
    ]
  }
  document.getElementById('preview-body').innerHTML =
    txDetailSankey(tx) +
    '<p class="io-line"><span>Input</span><strong>Salary · 800,000 sats</strong></p>' +
    '<p class="io-line"><span>Output</span><strong>Rent · 210,000 sats</strong></p>' +
    '<p class="io-line"><span>Change</span><strong>589,758 sats</strong></p>' +
    '<p class="io-line"><span>Miner fee</span><strong>242 sats · 2.20 sat/vB</strong></p>'
}

function renderDecoded() {
  document.getElementById('preview-title').textContent = 'Decoded'
  document.getElementById('preview-body').innerHTML = decodedMarkup()
}

function decodedMarkup() {
  const groups = [
    ['#ffffff', '02000000'],
    ['#888888', '00'],
    ['#ffffff', '01'],
    ['#888888', '01'],
    ['#E01919', 'a91c8f21b04e20aa11c0d4e20aa91c8f21b04e20aa11c0d4e20aa91c8f4e20'],
    ['#860B0B', '00000000'],
    ['#DD9595', '00'],
    ['#860B0B', 'fdffffff'],
    ['#aaaaaa', '02'],
    ['#07BC03', '9034030000000000'],
    ['#93CC92', '16'],
    ['#608A64', '0014b20d91aa77c0e11f44aa91b20d91aa77c0e191'],
    ['#07BC03', '7e00010000000000'],
    ['#93CC92', '16'],
    ['#608A64', '0014c77e10b3aa44d90211c77e10b3aa44d90211c7'],
    ['#888888', '02'],
    ['#C13939', '21'],
    ['#C13939', '02a91c8f21b04e20aa11c0d4e20aa91c8f21b04e20aa11c0d4e20aa91c8f21'],
    ['#8F5252', '4730440220b77e10b3aa44d90211c77e10b3aa44d90211c77e10b3aa44d90211c710b3'],
    ['#eeeeee', '00000000']
  ]
  const bytes = groups
    .map((group) => {
      let marks = ''
      for (let index = 0; index < group[1].length; index += 2) {
        marks += '<i style="color:' + group[0] + '">' + group[1].slice(index, index + 2) + '</i>'
      }
      return marks
    })
    .join('')
  const legend = [
    ['#ffffff', 'Version'],
    ['#888888', 'Marker'],
    ['#E01919', 'Previous output'],
    ['#860B0B', 'Index'],
    ['#07BC03', 'Value'],
    ['#608A64', 'Script'],
    ['#C13939', 'Witness pubkey'],
    ['#8F5252', 'Signature'],
    ['#eeeeee', 'Locktime']
  ]
    .map((item) => '<span style="color:' + item[0] + '">' + item[1] + '</span>')
    .join('')
  return (
    '<p class="tx-decode-tools"><span>List</span><span class="is-on">Bytes</span><span class="is-on">Decoded</span><span>Raw</span><span>Hex</span><span>ASCII</span></p>' +
    '<p class="decode-bytes">' +
    bytes +
    '</p><p class="decode-legend">' +
    legend +
    '</p>'
  )
}

// previewTransaction.tsx — txid, contents diagram, decoded bytes, sign / export.
let previewTxid = ''

function renderPreview() {
  const tot = draftTotals()
  const tn = (k) => t('transaction.build.preview.' + k)
  const payjoin = document.getElementById('payjoin-toggle').checked
  const first = draft.outputs[0]
  const watchOnly = openAccountData.watchOnly
  previewTxid = demoTxid(openAccountData.fingerprint + JSON.stringify(draft) + tot.fee)
  document.getElementById('preview-title').textContent = openAccountData.name
  const section = (title, body) => ss.vstack({ gap: 'xxs' }, ss.text({ color: 'muted', uppercase: true }, title), body)
  const note = payjoin && first
    ? ss.vstack({ gap: 'xs', style: 'padding:4px 0' },
        ss.text({ size: 'xs', uppercase: true, color: 'muted', center: true }, t('transaction.build.payjoin.previewNote.title')),
        ss.text({ weight: 'light', center: true },
          [t('transaction.build.payjoin.data.bip77'), first.amount.toLocaleString('en-US') + ' ' + t('bitcoin.sats'), first.label, ss.shortId(first.to)].filter(Boolean).join(' · ')),
        ss.text({ size: 'xs', center: true, style: 'color:var(--gray-500)' }, t('transaction.build.payjoin.previewNote.hint')))
    : ''
  const actions = watchOnly
    ? ss.vstack({ gap: 'sm' },
        ss.text({ color: 'muted', center: true, uppercase: true }, t('transaction.preview.exportUnsigned')),
        ss.hstack({ gap: 'xxs', justifyBetween: true },
          ss.clipboardCopy({ text: 'cHNidP8BAH' + previewTxid }, ss.button({ variant: 'outline', label: t('common.copy') })),
          ss.button({ variant: 'outline', label: 'Show QR', go: 'psbt-qr' })))
    : ss.button({
        variant: 'secondary',
        label: openAccountData.multisig ? t('transaction.preview.checkAllSignatures') : t('sign.transaction'),
        id: 'sign-open',
        disabled: tot.underfunded || !draft.outputs.length
      })
  document.getElementById('preview-body').innerHTML = ss.vstack({ justifyBetween: true, gap: 'lg' },
    ss.vstack({},
      note,
      section(t('transaction.id'), ss.txid({ value: previewTxid, size: 'lg' })),
      section(tn('contents'), '<div style="overflow:hidden">' + txDetailSankey(draftTx(tot)) + '</div>'),
      section(tn('decoded'), decodedMarkup())),
    actions)
  const sign = document.getElementById('sign-open')
  if (sign)
    sign.addEventListener('click', () => {
      if (openAccountData.multisig) go('multisig-sign')
      else startSign()
    })
}


let psbtQrTimer = 0

function qrMarkup(seed) {
  const n = 25
  const cells = new Array(n * n).fill(0)
  const reserved = new Array(n * n).fill(false)
  function finder(x, y) {
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const edge = row === 0 || col === 0 || row === 6 || col === 6
        const core = row >= 2 && row <= 4 && col >= 2 && col <= 4
        const index = (y + row) * n + (x + col)
        cells[index] = edge || core ? 1 : 0
        reserved[index] = true
      }
    }
  }
  finder(0, 0)
  finder(n - 7, 0)
  finder(0, n - 7)
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 33 + seed.charCodeAt(i)) >>> 0
  for (let i = 0; i < cells.length; i += 1) {
    if (reserved[i]) continue
    hash = (hash * 1664525 + 1013904223) >>> 0
    cells[i] = (hash >>> 24) & 1
  }
  const rects = cells
    .map((on, index) => {
      if (!on) return ''
      const x = index % n
      const y = Math.floor(index / n)
      return '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>'
    })
    .join('')
  return '<svg viewBox="0 0 ' + n + ' ' + n + '" role="img" aria-label="PSBT QR">' + rects + '</svg>'
}

function renderPsbtQr() {
  clearInterval(psbtQrTimer)
  const root = document.getElementById('psbt-qr')
  const parts = [
    'ur:crypto-psbt/1-3/lpadaxcssoytjytahd',
    'ur:crypto-psbt/2-3/lpcssratcssgcywzjo',
    'ur:crypto-psbt/3-3/hdosjojkidjyzmadlp'
  ]
  let index = 0
  function paint() {
    root.innerHTML =
      '<div class="psbt-qr-card">' +
      qrMarkup(parts[index]) +
      '</div><p class="psbt-qr-part">ur:crypto-psbt/' +
      (index + 1) +
      '-' +
      parts.length +
      '</p><p class="psbt-qr-hint">Animated UQR — scan until the other device has the PSBT.</p>' +
      '<button type="button" class="menu-button" id="psbt-qr-close"><span class="edge-left"></span><span class="edge-right"></span>Close</button>'
    root.querySelector('#psbt-qr-close').addEventListener('click', () => go('preview'))
  }
  paint()
  psbtQrTimer = setInterval(() => {
    index = (index + 1) % parts.length
    const part = root.querySelector('.psbt-qr-part')
    const card = root.querySelector('.psbt-qr-card')
    if (!part || !card) {
      clearInterval(psbtQrTimer)
      return
    }
    part.textContent = 'ur:crypto-psbt/' + (index + 1) + '-' + parts.length
    card.innerHTML = qrMarkup(parts[index])
  }, 280)
}

// signTransaction.tsx — payjoin wait, signing, signed, broadcast. Fixture txid, nothing leaves the page.
const signState = { payjoin: false, phase: 'signing', status: '', hint: '', txid: '', amount: 0, label: '' }

function demoTxid(seed) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0
  let out = ''
  for (let i = 0; out.length < 64; i += 1) {
    h = Math.imul(h ^ (i + 1), 16777619) >>> 0
    h = (h ^ (h >>> 13)) >>> 0
    out += h.toString(16).padStart(8, '0')
  }
  return out.slice(0, 64)
}

function renderSign() {
  const st = signState
  const tn = (k) => t('transaction.build.sign.' + k)
  const multisig = openAccountData && openAccountData.multisig
  const waiting = st.phase === 'payjoin'
  const signed = st.phase === 'signed'
  const head = waiting
    ? ss.vstack({ gap: 'lg', itemsCenter: true },
        ss.text({ size: 'md', uppercase: true, weight: 'light' }, t('transaction.payjoin.send')),
        ss.orbitLoader({ size: 160 }),
        ss.vstack({ gap: 'sm', itemsCenter: true },
          ss.text({ size: 'md', center: true }, st.status),
          ss.text({ color: 'muted', center: true }, t(st.hint))))
    : ss.vstack({ itemsCenter: true },
        ss.text({ size: 'md', uppercase: true, weight: 'light' }, signed ? (multisig ? tn('readyToBroadcast') : tn('signed')) : tn('signing')),
        signed ? ss.successCheck({ variant: 'outline' }) : ss.orbitLoader({ size: 160 }),
        signed && st.payjoin
          ? ss.vstack({ gap: 'xs', itemsCenter: true },
              ss.text({ color: 'muted', center: true }, t('transaction.build.payjoin.success')),
              ss.text({ color: 'muted', center: true }, t('transaction.build.payjoin.reviewHint')))
          : '')
  const details = waiting
    ? ''
    : ss.vstack({},
        ss.vstack({ gap: 'xxs' }, ss.text({ color: 'muted', uppercase: true }, t('transaction.id')), ss.txid({ value: st.txid, size: 'lg' })),
        ss.vstack({ gap: 'xxs' }, ss.text({ color: 'muted', uppercase: true }, t('transaction.build.preview.contents')), signSendSankey('tx-sankey')),
        ss.vstack({ gap: 'xxs' }, ss.text({ color: 'muted', uppercase: true }, tn('transaction')),
          ss.text({ type: 'mono', size: 'xs', color: 'muted', style: 'word-break:break-all' }, '0200000000010' + st.txid + st.txid.slice(0, 40) + '…')))
  const actions = waiting
    ? ss.vstack({},
        ss.button({ label: t('transaction.build.payjoin.openAccounts'), variant: 'secondary', go: 'accounts' }),
        ss.button({ label: t('transaction.build.payjoin.checkResponse'), variant: 'ghost', id: 'payjoin-check' }),
        ss.button({ label: t('transaction.build.payjoin.skip'), variant: 'ghost', id: 'payjoin-skip' }))
    : ss.vstack({},
        ss.button({ label: t('send.broadcast'), variant: 'secondary', disabled: !signed, id: 'broadcast' }),
        signed ? ss.button({ label: tn('copySignedTx'), variant: 'ghost', data: { 'ss-copy': st.txid } }) : '')
  document.getElementById('sign-title').textContent = openAccountData ? openAccountData.name : ''
  document.getElementById('sign-body').innerHTML = ss.vstack({ justifyBetween: true, gap: 'lg' }, ss.vstack({ gap: 'lg' }, head, details), actions)
}

function startSign() {
  clearTimeout(payjoinTimer)
  const payjoin = document.getElementById('payjoin-toggle').checked
  Object.assign(signState, {
    payjoin,
    phase: payjoin ? 'payjoin' : 'signing',
    status: t('transaction.build.payjoin.stage.postingOriginal'),
    hint: 'transaction.build.payjoin.stage.postingOriginalHint',
    amount: draft.outputs.reduce((sum, out) => sum + out.amount, 0),
    label: draft.outputs.map((out) => out.label).filter(Boolean).join(', '),
    txid: previewTxid || demoTxid((openAccountData ? openAccountData.fingerprint : 'demo') + Date.now())
  })
  renderSign()
  show('sign')
  const stages = payjoin
    ? [
        ['transaction.build.payjoin.waitingReceiver', 'transaction.build.payjoin.waitingReceiverHint'],
        ['transaction.build.payjoin.stage.checkingProposal', 'transaction.build.payjoin.stage.checkingProposalHint'],
        null
      ]
    : [null]
  let i = 0
  function next() {
    const key = stages[i++]
    if (key) {
      signState.status = t(key[0])
      signState.hint = key[1]
    }
    else signState.phase = signState.phase === 'payjoin' ? 'signing' : 'signed'
    renderSign()
    if (signState.phase !== 'signed') payjoinTimer = setTimeout(next, 900)
  }
  payjoinTimer = setTimeout(next, 900)
}

document.getElementById('sign-body').addEventListener('click', (e) => {
  if (e.target.closest('#payjoin-skip')) {
    clearTimeout(payjoinTimer)
    signState.payjoin = false
    signState.phase = 'signing'
    renderSign()
    payjoinTimer = setTimeout(() => {
      signState.phase = 'signed'
      renderSign()
    }, 900)
  }
  if (e.target.closest('#payjoin-check')) ss.toast(signState.status, document.getElementById('view-sign'))
  if (e.target.closest('#broadcast')) {
    const button = e.target.closest('#broadcast')
    button.disabled = true
    button.innerHTML = '<span class="ss-spinner"></span>'
    recordBroadcast()
    setTimeout(() => renderSent(signState.txid), 700)
  }
})

// The broadcast shows up in the account as an unconfirmed send, so "Back to account home"
// lands on it. Marked `broadcast` so the demo reset can take it back out.
function recordBroadcast() {
  const account = openAccountData
  const list = account && activity[account.fingerprint]
  if (!list || list.some((tx) => tx.txid === signState.txid)) return
  const tot = draftTotals()
  const amount = signState.amount
  const spent = amount + tot.fee
  const before = list.length ? list[list.length - 1].balance : account.balance
  list.push({
    type: 'send',
    label: signState.label,
    tags: [],
    amount,
    fiat: satsUsd(amount),
    historical: '',
    priceChange: '',
    ago: '',
    txid: signState.txid,
    conf: 0,
    block: 0,
    balance: before - spent,
    inputs: Math.max(tot.inputs.length, 1),
    outputs: draft.outputs.length + 1,
    size: tot.vsize + 80,
    vsize: tot.vsize,
    weight: tot.vsize * 4,
    fee: tot.fee,
    version: 2,
    broadcast: { spent, stats: account.stats.map((row) => row.slice()) }
  })
  account.balance -= spent
  account.fiat = satsUsd(account.balance)
  account.stats[0][0] = String(Number(account.stats[0][0]) + 1)
}

function undoBroadcasts() {
  accounts.forEach((account) => {
    const list = activity[account.fingerprint] || []
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const sent = list[i].broadcast
      if (!sent) continue
      account.balance += sent.spent
      account.fiat = satsUsd(account.balance)
      account.stats = sent.stats
      list.splice(i, 1)
    }
  })
}

// transactionConfirmation.tsx
function renderSent(txid) {
  document.getElementById('sent-title').textContent = openAccountData ? openAccountData.name : ''
  document.getElementById('sent-body').innerHTML =
    ss.vstack({ justifyBetween: true },
      ss.vstack({ gap: 'lg', itemsCenter: true, style: 'padding-top:24px' },
        ss.successCheck(),
        ss.text({ size: 'md', uppercase: true, weight: 'light', className: 'ss-enter', style: 'animation-delay:500ms' }, t('sent.broadcasted')),
        ss.vstack({ gap: 'none', itemsCenter: true, className: 'ss-enter', style: 'animation-delay:800ms' },
          ss.text({ color: 'muted', uppercase: true }, t('transaction.id')),
          ss.text({}, ss.shortId(txid)))),
      ss.vstack({ className: 'ss-enter', style: 'animation-delay:1100ms' },
        ss.clipboardCopy({ text: txid }, ss.button({ variant: 'outline', label: t('sent.copyTransactionId') })),
        ss.button({ variant: 'outline', label: t('sent.viewOnMempool'), id: 'sent-mempool' }),
        ss.button({ variant: 'secondary', label: t('common.backToAccountHome'), go: 'account' }))) +
    ss.modal({ id: 'sent-external', fullOpacity: true, showLabel: false },
      ss.vstack({ justifyBetween: true, widthFull: true, style: 'flex:1' },
        ss.vstack({ gap: 'lg', itemsCenter: true, style: 'margin:auto 0' },
          ss.text({ uppercase: true, weight: 'bold' }, t('common.warning')),
          ss.text({ color: 'muted', center: true }, t('sent.externalWebsiteWarning'))),
        ss.vstack({ gap: 'md' },
          ss.button({ variant: 'danger', label: t('common.open'), data: { 'ss-close': '' } }),
          ss.button({ variant: 'ghost', label: t('common.cancel'), data: { 'ss-close': '' } }))))
  show('sent', 'sent')
}

document.getElementById('sent-body').addEventListener('click', (e) => {
  if (e.target.closest('#sent-mempool')) ss.open('sent-external')
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

function txRibbon(x1, y1, w1, x2, y2, w2) {
  const span = Math.abs(x2 - x1)
  const control = Math.min(span * 0.4, 60)
  const dir = x2 >= x1 ? 1 : -1
  return (
    'M ' + x1 + ' ' + y1 +
    ' L ' + x1 + ' ' + (y1 + w1) +
    ' C ' + (x1 + dir * control) + ' ' + (y1 + w1) + ' ' + (x2 - dir * control) + ' ' + (y2 + w2) + ' ' + x2 + ' ' + (y2 + w2) +
    ' L ' + x2 + ' ' + y2 +
    ' C ' + (x2 - dir * control) + ' ' + y2 + ' ' + (x1 + dir * control) + ' ' + y1 + ' ' + x1 + ' ' + y1 +
    ' Z'
  )
}

function splitFlow(total, count) {
  if (count <= 1) return [total]
  const parts = []
  let left = total
  for (let index = 0; index < count - 1; index += 1) {
    const share = index === 0 ? 0.64 : (0.36 / (count - 1))
    const part = Math.max(1, Math.round(total * share))
    parts.push(Math.min(part, left - (count - index - 1)))
    left -= parts[parts.length - 1]
  }
  parts.push(Math.max(left, 1))
  return parts
}

function shortId(id) {
  return id.slice(0, 5) + '…' + id.slice(-4)
}

function flowLabel(lines, x, y, anchor) {
  return lines
    .map((line, index) => {
      return (
        '<text x="' + x + '" y="' + (y + index * 13) + '" text-anchor="' + anchor + '" fill="' + line.color + '" font-size="' + line.size + '" font-weight="' + (line.weight || 500) + '">' +
        line.text +
        '</text>'
      )
    })
    .join('')
}

let txSankeyCount = 0

function txDetailSankey(tx) {
  const flowInputs = tx.flowInputs
  const flowOutputs = tx.flowOutputs
  const inputCount = flowInputs ? flowInputs.length : Math.max(tx.inputs, 1)
  const outputCount = flowOutputs ? flowOutputs.filter((item) => !item.fee).length : Math.max(tx.outputs, 1)
  const changePool = tx.type === 'send' && outputCount > 1 ? Math.round(tx.amount * 0.42) : 0
  const inputValues = flowInputs
    ? flowInputs.map((item) => item.value)
    : splitFlow(tx.amount + tx.fee + changePool, inputCount)
  const outputValues = flowOutputs
    ? flowOutputs.filter((item) => !item.fee).map((item) => item.value)
    : tx.type === 'receive'
      ? splitFlow(tx.amount, outputCount)
      : outputCount === 1
        ? [tx.amount]
        : [tx.amount].concat(splitFlow(changePool, outputCount - 1))
  const rightValues = flowOutputs ? flowOutputs.map((item) => item.value) : outputValues.concat([tx.fee])
  const row = 68
  const rows = Math.max(inputCount, rightValues.length)
  let height = rows * row + 8
  const blockX = 146
  const blockW = 50
  const leftX = 108
  const rightX = 246
  // Unique per render: the same tx can be drawn in two views and gradient ids must not collide.
  const gid = 'flow' + String(tx.txid || 'tx').slice(0, 6).replace(/\W/g, '') + ++txSankeyCount
  const throughput = inputValues.reduce((sum, value) => sum + value, 0)
  const band = Math.min(100, Math.max(34, Math.round(18 * Math.log10(Math.max(throughput, 10)))))

  function linearShare(values, totalPx) {
    const sum = values.reduce((total, value) => total + value, 0) || 1
    const widths = values.map((value) => Math.max((value / sum) * totalPx, 2))
    const scaled = widths.reduce((total, value) => total + value, 0)
    return widths.map((value) => (value / scaled) * totalPx)
  }

  const inH = linearShare(inputValues, band)
  const rightH = linearShare(rightValues, band)
  const need = (hs) => hs.reduce((sum, h) => sum + Math.max(h, 40) + 6, 0) + 24
  height = Math.max(height, need(inH), need(rightH), band + 24)
  const blockY = Math.max(4, (height - band) / 2)

  function stack(heights, y0) {
    let y = y0
    return heights.map((h) => {
      const slot = { y: y, h: h }
      y += h
      return slot
    })
  }

  // Ribbon ends stack in slots at least one label tall, so labels and ribbons never overlap.
  function endLayout(heights) {
    const gap = 6
    const slots = heights.map((h) => Math.max(h, 40))
    const total = slots.reduce((sum, h) => sum + h, 0) + gap * (slots.length - 1)
    let y = (height - total) / 2
    return slots.map((slot, i) => {
      const mid = y + slot / 2
      y += slot + gap
      return mid
    })
  }
  const inMid = endLayout(inH)
  const rightMid = endLayout(rightH)


  const inSlots = stack(inH, blockY)
  const rightSlots = stack(rightH, blockY)

  const inputPaths = inSlots
    .map((slot, index) => {
      const y = inMid[index] - slot.h / 2
      // App (SSSankeyLinks): every current-tx input ribbon is gray[900] → gray[200].
      const fill = 'url(#' + gid + 'In)'
      return '<path fill="' + fill + '" d="' + txRibbon(leftX, y, slot.h, blockX, slot.y, slot.h) + '"/>'
    })
    .join('')

  const outputPaths = rightSlots
    .map((slot, index) => {
      const y = rightMid[index] - slot.h / 2
      const isFee = index === rightSlots.length - 1
      const flow = flowOutputs && flowOutputs[index]
      const ours = flow ? !!flow.ours && !flow.fee : !isFee && (tx.type === 'receive' ? index === 0 : index > 0)
      // App: change stays solid white; payments and the fee fade to gray[900] at the far end.
      const fill = ours ? 'url(#' + gid + 'Mine)' : 'url(#' + gid + 'Fee)'
      return '<path fill="' + fill + '" d="' + txRibbon(blockX + blockW, slot.y, slot.h, rightX, y, slot.h) + '"/>'
    })
    .join('')

  const inputCards = inputValues
    .map((value, index) => {
      const flow = flowInputs && flowInputs[index]
      const named = flow ? flow.ours : index === 0 && tx.type === 'send' && tx.label
      const name = flow ? flow.label : named ? tx.label : 'Previous'
      const y = inMid[index] - 9
      return flowLabel(
        [
          { text: value.toLocaleString('en-US') + ' sats', color: '#FFFFFF', size: 12, weight: 650 },
          { text: 'from ' + shortId(flow ? flow.from : tx.txid), color: '#8A8A8A', size: 8 },
          { text: name, color: named ? '#A7FFAF' : '#FF7171', size: 10, weight: 700 }
        ],
        2,
        y,
        'start'
      )
    })
    .join('')

  const outputCards = rightValues
    .map((value, index) => {
      const flow = flowOutputs && flowOutputs[index]
      const isFee = flow ? !!flow.fee : index === rightValues.length - 1
      const ours = flow ? !!flow.ours : !isFee && (tx.type === 'receive' ? index === 0 : index > 0)
      const name = flow
        ? flow.label
        : isFee
          ? 'Miner fee'
          : tx.type === 'receive'
            ? index === 0
              ? tx.label || 'Receive'
              : 'Change'
            : index > 0
              ? 'Change'
              : tx.label || 'Payment'
      const y = rightMid[index] - 9
      const lines = [
        { text: value.toLocaleString('en-US') + ' sats', color: '#FFFFFF', size: 12, weight: 650 },
        {
          text: isFee
            ? (tx.fee / tx.vsize).toFixed(2) + ' sat/vB'
            : 'to ' + shortId(flow && flow.to ? flow.to : 'tb1q' + tx.txid.slice(0, 12)),
          color: '#8A8A8A',
          size: 8
        },
        { text: name, color: ours ? '#A7FFAF' : '#FF7171', size: 10, weight: 700 }
      ]
      return flowLabel(lines, rightX + 8, y, 'start')
    })
    .join('')

  const stripH = Math.min(band, Math.max(34, tx.size * 0.1))
  return (
    '<svg class="tx-sankey" viewBox="0 0 360 ' + height + '" role="img" aria-label="Transaction flow">' +
    '<defs>' +
    '<linearGradient id="' + gid + 'In" x1="' + leftX + '" x2="' + blockX + '" y1="0" y2="0" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#111111"/><stop offset="1" stop-color="#828282"/></linearGradient>' +
    '<linearGradient id="' + gid + 'OwnIn" x1="' + leftX + '" x2="' + blockX + '" y1="0" y2="0" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#14301A"/><stop offset="1" stop-color="#828282"/></linearGradient>' +
    '<linearGradient id="' + gid + 'ForeignIn" x1="' + leftX + '" x2="' + blockX + '" y1="0" y2="0" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#3A1515"/><stop offset="1" stop-color="#828282"/></linearGradient>' +
    '<linearGradient id="' + gid + 'Mine" x1="' + (blockX + blockW) + '" x2="' + rightX + '" y1="0" y2="0" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>' +
    '<linearGradient id="' + gid + 'Pay" x1="' + (blockX + blockW) + '" x2="' + rightX + '" y1="0" y2="0" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.9" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D98A8A"/></linearGradient>' +
    '<linearGradient id="' + gid + 'Fee" x1="' + (blockX + blockW) + '" x2="' + rightX + '" y1="0" y2="0" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.3" stop-color="#FFFFFF"/><stop offset="1" stop-color="#111111"/></linearGradient>' +
    '<linearGradient id="' + gid + 'Block" x1="' + blockX + '" x2="' + (blockX + blockW) + '" y1="0" y2="0" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#828282"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>' +
    '</defs>' +
    inputPaths + outputPaths +
    '<rect x="' + blockX + '" y="' + blockY + '" width="' + blockW + '" height="' + band + '" fill="url(#' + gid + 'Block)"/>' +
    '<rect x="' + (blockX + blockW / 6) + '" y="' + blockY + '" width="' + (blockW / 1.5) + '" height="' + stripH + '" fill="#515151" opacity="0.6"/>' +
    inputCards + outputCards +
    '</svg>'
  )
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
      return '<path fill="url(#' + inId + ')" d="' + ribbonPath(0, ribbon[3], slot.h, 144, slot.ty, ribbon[0], ribbon[1]) + '"/>'
    })
    .join('')
  const outPaths = outRibbons
    .map((ribbon) => {
      const slot = outputs[ribbon[2]]
      return '<path fill="url(#' + outId + ')" d="' + ribbonPath(216, slot.ty, slot.h, 360, ribbon[3], ribbon[0], ribbon[1]) + '"/>'
    })
    .join('')
  return (
    '<svg class="' + className + '" viewBox="0 0 360 520" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
    '<defs><linearGradient id="' + inId + '" gradientUnits="userSpaceOnUse" x1="0" x2="144" y1="0" y2="0">' +
    '<stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>' +
    '<stop offset="0.42" stop-color="#FFFFFF" stop-opacity="0.02"/>' +
    '<stop offset="0.62" stop-color="#FFFFFF" stop-opacity="0.09"/>' +
    '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0.09"/></linearGradient>' +
    '<linearGradient id="' + outId + '" gradientUnits="userSpaceOnUse" x1="216" x2="360" y1="0" y2="0">' +
    '<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.09"/>' +
    '<stop offset="0.38" stop-color="#FFFFFF" stop-opacity="0.09"/>' +
    '<stop offset="0.58" stop-color="#FFFFFF" stop-opacity="0.02"/>' +
    '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs>' +
    '<rect x="144" y="157" width="72" height="86" fill="rgba(255,255,255,0.09)"/>' +
    inPaths + outPaths + '</svg>'
  )
}

const splashSource = [
  '// apps/mobile/api/bdk.ts',
  'function buildTransaction(',
  '  wallet: BdkWallet,',
  '  data: {',
  '    inputs: Utxo[]',
  '    outputs: Output[]',
  '    fee: number',
  '    options: {',
  '      rbf: boolean',
  '    }',
  '  }',
  '): Promise<PsbtLike> {',
  '  const txBuilder = new BdkTxBuilder()',
  '  txBuilder.addUtxos(',
  '    data.inputs.map((utxo) => ({ txid: utxo.txid, vout: utxo.vout }))',
  '  )',
  '  txBuilder.manuallySelectedOnly()',
  '  for (const output of data.outputs) {',
  '    txBuilder.addRecipient(output.to, output.amount)',
  '  }',
  '  txBuilder.feeAbsolute(data.fee)',
  '  if (data.options.rbf) {',
  '    txBuilder.enableRbf()',
  '  }',
  '  return txBuilder.finish(wallet)',
  '}',
  '',
  'function signTransaction(psbt: PsbtLike, wallet: BdkWallet): boolean {',
  '  const signed = wallet.sign(psbt)',
  '  wallet.persist()',
  '  return signed',
  '}',
  '',
  'function broadcastTransaction(',
  '  wallet: BdkWallet,',
  '  psbt: PsbtLike,',
  '  backend: Backend,',
  '  url: string,',
  '  rpcCredentials?: RpcCredentials',
  '): Promise<string> {',
  "  if (backend === 'electrum') {",
  '    return wallet.broadcastWithElectrum(url, psbt)',
  '  }',
  "  if (backend === 'rpc') {",
  '    const rpcClient = new BdkRpcClient({',
  '      auth: rpcCredentials',
  '        ? {',
  '            password: rpcCredentials.password,',
  "            type: 'userPass',",
  '            username: rpcCredentials.username',
  '          }',
  "        : { type: 'none' },",
  '      url: adjustRpcUrl(url)',
  '    })',
  '    return wallet.broadcastWithRpc(rpcClient, psbt)',
  '  }',
  '  return wallet.broadcastWithEsplora(url, psbt)',
  '}',
  '',
  '// apps/mobile/utils/descriptor.ts',
  'export function descriptorHasPrivateKeyMaterial(descriptor: string): boolean {',
  '  const lower = descriptor.toLowerCase()',
  '  return BDK_PRIVATE_EXTENDED_KEY_PREFIXES.some((prefix) =>',
  '    lower.includes(prefix)',
  '  )',
  '}',
  '',
  'export class PrivateKeyDescriptorError extends Error {',
  "  name = 'PrivateKeyDescriptorError'",
  '}',
  '',
  'export function getCleanXpub(xpubWithPrefix: string): string {',
  '  const xpubMatch = xpubWithPrefix.match(/\\]([txyzuv]pub[a-zA-Z0-9]{107})$/)',
  '  return xpubMatch ? xpubMatch[1] : xpubWithPrefix',
  '}',
  '',
  'export function getOriginDerivation(text: string) {',
  '  const originMatch = text.match(/^\\[([0-9a-fA-F]{8})\\/([^\\]]+)\\]/)',
  '  if (!originMatch) return null',
  '  const derivation = originMatch.at(2)',
  '  if (!derivation) return null',
  '  return { fingerprint: originMatch[1], derivation }',
  '}',
  '',
  '// apps/mobile/api/payjoin.ts',
  'async function sendPayjoin(params: {',
  '  payjoinUri: string',
  '  originalPsbtBase64: string',
  '  paymentAmountSats: number',
  '  outputScriptsHex: string[]',
  '  callbacks: PayjoinWalletCallbacks',
  '}): Promise<PayjoinSendResult> {',
  '  const parsed = parsePayjoinUri(params.payjoinUri)',
  '  if (!parsed.isValid || !parsed.params) {',
  '    return {',
  "      error: parsed.error ?? 'invalid payjoin uri',",
  '      fallbackAllowed: true,',
  '      ok: false,',
  '      originalPsbtBase64: params.originalPsbtBase64',
  '    }',
  '  }',
  '  if (isSelfTransfer({',
  '    isScriptOwned: (scriptHex) => {',
  '      const result = params.callbacks.isScriptOwned(scriptHex)',
  "      return typeof result === 'boolean' ? result : false",
  '    },',
  '    outputScriptsHex: params.outputScriptsHex',
  '  })) {',
  '    return {',
  '      ok: true,',
  '      originalPsbtBase64: params.originalPsbtBase64,',
  "      reason: 'self-transfer',",
  '      usedPayjoin: false',
  '    }',
  '  }',
  '  const endpointKind = parsed.endpointKind ?? detectEndpointKind(parsed.params.pj)',
  '  const disableOutputSubstitution = (parsed.params.pjos ?? PAYJOIN_DEFAULT_PJOS) === 0',
  "  if (endpointKind === 'bip78') {",
  '    return await sendBip78({',
  '      callbacks: params.callbacks,',
  '      disableOutputSubstitution,',
  '      endpoint: parsed.params.pj,',
  '      originalPsbtBase64: params.originalPsbtBase64,',
  '      outputScriptsHex: params.outputScriptsHex,',
  '      payjoinUri: params.payjoinUri,',
  '      paymentAmountSats: params.paymentAmountSats',
  '    })',
  '  }',
  '  return await sendBip77({',
  '    callbacks: params.callbacks,',
  '    disableOutputSubstitution,',
  '    originalPsbtBase64: params.originalPsbtBase64,',
  '    outputScriptsHex: params.outputScriptsHex,',
  '    payjoinUri: params.payjoinUri,',
  '    paymentAmountSats: params.paymentAmountSats',
  '  })',
  '}'
].join('\n')

function escapeSplashText(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const hexRows = [
  '00000000  <b data-mark="version">01 00 00 00</b> 00 00 00 00 00 00 00 00 00 00 00 00   |................|',
  '00000010  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   |................|',
  '00000020  00 00 00 00 <b data-mark="merkle">3b a3 ed fd</b> 7a 7b 12 b2 7a c7 2c 3e   |....<b data-mark="merkle">;...</b>z{..z.,>|',
  '00000030  67 76 8f 61 7f c8 1b c3 88 8a 51 32 3a 9f b8 aa   |gv.a......Q2:...|',
  '00000040  4b 1e 5e 4a <b data-mark="time">29 ab 5f 49</b> <b data-mark="bits">ff ff 00 1d</b> <b data-mark="nonce">1d ac 2b 7c</b>   |K.^J<b data-mark="time">)._I</b><b data-mark="bits">....</b><b data-mark="nonce">..+|</b>|',
  '00000080  01 04 <b data-mark="headline">45 54 68 65 20 54 69 6d 65 73</b> 20 30 33 2f   |..<b data-mark="headline">EThe Times</b> 03/|',
  '00000090  <b data-mark="date">4a 61 6e 2f 32 30 30 39</b> 20 <b data-mark="news">43 68 61 6e 63 65 6c</b>   |<b data-mark="date">Jan/2009</b> <b data-mark="news">Chancel</b>|',
  '000000a0  <b data-mark="news">6c 6f 72 20 6f 6e 20 62 72 69 6e 6b 20 6f 66 20</b>   |<b data-mark="news">lor on brink of </b>|'
]

let hexTimer = 0

function stopHexHighlight() {
  if (!hexTimer) return
  clearInterval(hexTimer)
  hexTimer = 0
}

function startHexHighlight() {
  stopHexHighlight()
  const dump = document.querySelector('.hex-dump')
  if (!dump) return
  const marks = Array.from(dump.querySelectorAll('b'))
  const ids = []
  marks.forEach((mark) => {
    if (ids.indexOf(mark.dataset.mark) === -1) ids.push(mark.dataset.mark)
  })
  if (!ids.length) return
  let index = 0
  const paint = () => {
    const current = ids[index]
    marks.forEach((mark) => mark.classList.toggle('is-on', mark.dataset.mark === current))
  }
  paint()
  hexTimer = setInterval(() => {
    index = (index + 1) % ids.length
    paint()
  }, 1100)
}

function packIntroBubbles(values) {
  const screenW = 390
  const screenH = 844
  const packW = screenW * 0.9
  const packH = screenH * 0.48
  const offsetX = (screenW - packW) / 2
  const offsetY = screenH * 0.12
  const padding = 6
  const nodes = values
    .map((value) => ({ value: value, r: Math.sqrt(value) }))
    .sort((a, b) => b.r - a.r)
  nodes[0].x = 0
  nodes[0].y = 0
  const placed = [nodes[0]]

  function hits(x, y, r) {
    return placed.some((peer) => {
      const dx = peer.x - x
      const dy = peer.y - y
      const min = peer.r + r
      return dx * dx + dy * dy < min * min - 0.01
    })
  }

  for (let index = 1; index < nodes.length; index += 1) {
    const node = nodes[index]
    let best = null
    let bestScore = Infinity
    placed.forEach((peer) => {
      const dist = peer.r + node.r + 0.6
      for (let step = 0; step < 36; step += 1) {
        const angle = (Math.PI * 2 * step) / 36 + index
        const x = peer.x + Math.cos(angle) * dist
        const y = peer.y + Math.sin(angle) * dist
        if (hits(x, y, node.r)) continue
        const score = x * x + y * y
        if (score < bestScore) {
          bestScore = score
          best = { x: x, y: y }
        }
      }
    })
    node.x = best ? best.x : 0
    node.y = best ? best.y : placed.length * node.r
    placed.push(node)
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  nodes.forEach((node) => {
    minX = Math.min(minX, node.x - node.r)
    minY = Math.min(minY, node.y - node.r)
    maxX = Math.max(maxX, node.x + node.r)
    maxY = Math.max(maxY, node.y + node.r)
  })
  const boundsW = Math.max(maxX - minX, 1)
  const boundsH = Math.max(maxY - minY, 1)
  const scale = Math.min((packW - padding) / boundsW, (packH - padding) / boundsH)
  return nodes.map((node) => ({
    d: node.r * 2 * scale,
    x: offsetX + (node.x - minX) * scale + (packW - boundsW * scale) / 2,
    y: offsetY + (node.y - minY) * scale + (packH - boundsH * scale) / 2
  }))
}

const bubbleLayout = packIntroBubbles([900, 600, 320, 160, 80, 45, 25, 12, 5])
const bubbleMax = Math.max.apply(null, bubbleLayout.map((bubble) => bubble.d))

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
          (bubble.d / bubbleMax >= 0.45 ? 'is-bright' : '') +
          '" style="--r:' +
          bubble.d +
          'px;--x:' +
          bubble.x +
          'px;--y:' +
          bubble.y +
          'px"></i>'
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
  if (intro) {
    intro.classList.remove('is-splash')
    intro.removeEventListener('click', startOnboarding)
  }
  renderIntro()
  show('intro')
}

function renderIntro() {
  stopHexHighlight()
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
  document.getElementById('intro-next').addEventListener('click', (event) => {
    event.stopPropagation()
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
  if (step.visual === 'hex') startHexHighlight()
}

function renderSplash() {
  stopHexHighlight()
  const intro = document.getElementById('intro')
  intro.classList.add('is-splash')
  intro.innerHTML =
    '<div class="splash-code" aria-hidden="true">' +
    escapeSplashText(splashSource) +
    '</div><div class="intro-logo"><span>SAT<br>SIGNER</span></div>'
  intro.addEventListener('click', startOnboarding, { once: true })
}

function finishIntro() {
  stopHexHighlight()
  document.getElementById('intro').innerHTML =
    '<div class="intro-logo"><span>SAT<br>SIGNER</span></div>'
  setTimeout(() => menuTab('signer'), 700)
}

function menuTab(tab) {
  activeTab = tab
  paintTabs()
  renderMenu(tab)
  show('menu', tab)
}

const multisigKeys = [
  { name: 'Phone', source: 'This device', fingerprint: 'a1b2c3d4', pub: 'tpub…4k2a', seed: true, signed: true },
  { name: 'Laptop', source: 'Imported descriptor', fingerprint: 'e5f6a7b8', pub: 'tpub…91cd', seed: false, signed: false },
  { name: 'Hardware', source: 'Extended public key', fingerprint: '9c0d1e2f', pub: 'tpub…0b77', seed: false, signed: false }
]

let msigRequired = 2
let msigTotal = 3
let msigScript = 'Native SegWit (P2WSH)'

function edges(label) {
  return '<span class="edge-left"></span><span class="edge-right"></span>' + label
}

function msigKeyRow(key, index, mode) {
  const empty = !key.fingerprint
  return (
    '<button type="button" class="msig-key" data-msig="' +
    index +
    '"><span class="msig-mark' +
    (empty ? ' is-empty' : key.seed ? ' is-seed' : '') +
    '"></span><span class="msig-key-copy"><em>Key ' +
    (index + 1) +
    (mode === 'sign' ? (key.signed ? ' · Signed' : ' · Unsigned') : '') +
    '</em><strong>' +
    (key.name || 'No label') +
    '</strong><small>' +
    (key.source || 'Add or generate') +
    '</small></span><span class="msig-key-ids"><em>' +
    (key.fingerprint || 'Fingerprint') +
    '</em><small>' +
    (key.pub || 'Public key') +
    '</small></span></button><div class="msig-panel" data-msig-panel="' +
    index +
    '" hidden></div>'
  )
}

function fillPanel(panel, index, mode) {
  const key = multisigKeys[index]
  if (mode === 'setup') {
    if (!key.fingerprint) {
      panel.innerHTML =
        '<label class="field"><span>Key name</span><input data-key-name value="' +
        (key.name || '') +
        '"></label>' +
        '<button type="button" class="menu-button" data-generate="' +
        index +
        '">' +
        edges('Generate new secret seed') +
        '</button><button type="button" class="menu-button">' +
        edges('Import mnemonic') +
        '</button><button type="button" class="menu-button">' +
        edges('Import descriptor') +
        '</button><button type="button" class="menu-button">' +
        edges('Import extended public key') +
        '</button>'
      const generate = panel.querySelector('[data-generate]')
      generate.addEventListener('click', () => {
        const name = panel.querySelector('[data-key-name]').value.trim()
        if (!name) return
        key.name = name
        go('multisig-key')
      })
      return
    }
  }
  if (mode === 'sign') {
    panel.innerHTML = key.signed
      ? '<button type="button" class="menu-button">' +
        edges('Copy PSBT') +
        '</button><button type="button" class="menu-button">' +
        edges('Show QR') +
        '</button><button type="button" class="menu-button">' +
        edges('USB') +
        '</button><button type="button" class="menu-button">' +
        edges('Share with group') +
        '</button>'
      : '<button type="button" class="menu-button" data-local-sign="' +
        index +
        '">' +
        edges('Sign with this device') +
        '</button><button type="button" class="menu-button" data-mark-signed="' +
        index +
        '">' +
        edges('Sign with seed words') +
        '</button><button type="button" class="menu-button">' +
        edges('Copy unsigned PSBT') +
        '</button><button type="button" class="menu-button" data-mark-signed="' +
        index +
        '">' +
        edges('Paste signature') +
        '</button><button type="button" class="menu-button" data-mark-signed="' +
        index +
        '">' +
        edges('Scan QR') +
        '</button><button type="button" class="menu-button">' +
        edges('Fetch from group') +
        '</button>'
    panel.querySelectorAll('[data-local-sign], [data-mark-signed]').forEach((button) => {
      button.addEventListener('click', () => {
        key.signed = true
        renderMultisigSign()
      })
    })
    return
  }
  panel.innerHTML =
    (key.seed
      ? '<button type="button" class="menu-button">' + edges('View seed words') + '</button>'
      : '') +
    '<button type="button" class="menu-button">' +
    edges('Share extended public key') +
    '</button><button type="button" class="menu-button">' +
    edges('Share descriptor') +
    '</button>' +
    (key.seed
      ? '<button type="button" class="menu-button" data-drop="' +
        index +
        '">' +
        edges('Drop seed from this device') +
        '</button>'
      : '') +
    '<button type="button" class="menu-button" data-reset="' +
    index +
    '">' +
    edges('Reset key') +
    '</button>'
  const drop = panel.querySelector('[data-drop]')
  if (drop) {
    drop.addEventListener('click', () => {
      key.seed = false
      key.source = 'Public key only'
      renderMultisigSettings()
    })
  }
  const reset = panel.querySelector('[data-reset]')
  if (reset) {
    reset.addEventListener('click', () => {
      key.name = ''
      key.source = ''
      key.fingerprint = ''
      key.pub = ''
      key.seed = false
      renderMultisigSettings()
    })
  }
}

function bindMsig(root, mode) {
  root.querySelectorAll('.msig-key').forEach((button) => {
    button.addEventListener('click', () => {
      const index = button.dataset.msig
      const panel = root.querySelector('[data-msig-panel="' + index + '"]')
      const open = panel.hidden
      root.querySelectorAll('.msig-panel').forEach((item) => {
        item.hidden = true
      })
      panel.hidden = !open
      if (!panel.hidden && !panel.childElementCount) fillPanel(panel, Number(index), mode)
    })
  })
}

function pips(on, total) {
  return (
    '<div class="msig-dots">' +
    Array.from({ length: total }, (_, index) => '<span class="msig-pip' + (index < on ? ' is-on' : '') + '"></span>').join('') +
    '</div>'
  )
}

function renderMultisigSetup() {
  const root = document.getElementById('multisig-setup')
  root.innerHTML =
    '<p class="field-label">Policy</p><p class="msig-count">Multisignature</p>' +
    '<p class="field-label">Signatures required</p><div class="msig-stepper"><button type="button" id="req-down" aria-label="Fewer signatures">−</button><strong id="req-value">' +
    msigRequired +
    ' of ' +
    msigTotal +
    '</strong><button type="button" id="req-up" aria-label="More signatures">+</button></div>' +
    '<p class="field-label">Keys</p><div class="msig-stepper"><button type="button" id="keys-down" aria-label="Fewer keys">−</button><strong>' +
    msigTotal +
    '</strong><button type="button" id="keys-up" aria-label="More keys">+</button></div>' +
    '<p class="field-label">Script</p><button type="button" class="menu-button" id="script-cycle">' +
    edges(msigScript) +
    '</button><button type="button" class="menu-button" id="import-descriptor">' +
    edges('Import descriptor') +
    '</button><button type="button" class="menu-button" id="msig-continue">' +
    edges('Continue') +
    '</button>'
  root.querySelector('#req-down').addEventListener('click', () => {
    msigRequired = Math.max(1, msigRequired - 1)
    renderMultisigSetup()
  })
  root.querySelector('#req-up').addEventListener('click', () => {
    msigRequired = Math.min(msigTotal, msigRequired + 1)
    renderMultisigSetup()
  })
  root.querySelector('#keys-down').addEventListener('click', () => {
    msigTotal = Math.max(2, msigTotal - 1)
    msigRequired = Math.min(msigRequired, msigTotal)
    renderMultisigSetup()
  })
  root.querySelector('#keys-up').addEventListener('click', () => {
    msigTotal = Math.min(15, msigTotal + 1)
    renderMultisigSetup()
  })
  root.querySelector('#script-cycle').addEventListener('click', () => {
    const scripts = ['Native SegWit (P2WSH)', 'Nested SegWit (P2SH-P2WSH)', 'Taproot (P2TR)', 'Legacy (P2SH)']
    msigScript = scripts[(scripts.indexOf(msigScript) + 1) % scripts.length]
    renderMultisigSetup()
  })
  root.querySelector('#import-descriptor').addEventListener('click', () => go('add-multisig-import-descriptor'))
  root.querySelector('#msig-continue').addEventListener('click', () => go('multisig-keys'))
}

function renderMultisigKeys() {
  const root = document.getElementById('multisig-keys')
  while (multisigKeys.length < msigTotal) {
    multisigKeys.push({ name: '', source: '', fingerprint: '', pub: '', seed: false, signed: false })
  }
  const shown = multisigKeys.slice(0, msigTotal)
  const ready = shown.every((key) => key.fingerprint)
  root.innerHTML =
    '<p class="msig-count">' +
    msigRequired +
    ' of ' +
    msigTotal +
    '</p>' +
    pips(0, msigTotal) +
    '<p class="hint">Add or generate keys</p><div class="msig-keys">' +
    shown.map((key, index) => msigKeyRow(key, index, 'setup')).join('') +
    '</div><button type="button" class="menu-button' +
    (ready ? '' : ' is-off') +
    '" id="msig-confirm"' +
    (ready ? '' : ' disabled') +
    '>' +
    edges('Confirm') +
    '</button>'
  bindMsig(root, 'setup')
  if (ready) {
    root.querySelector('#msig-confirm').addEventListener('click', () => {
      openAccountData = accounts.find((account) => account.multisig)
      go('add-multisig-finish')
    })
  }
}

function renderMultisigKey() {
  const root = document.getElementById('multisig-key')
  root.innerHTML =
    '<p class="field-label">Policy</p><p class="hint">Multisignature</p>' +
    '<p class="field-label">Key</p><p class="hint">1 of ' +
    msigTotal +
    '</p><p class="field-label">Mnemonic</p><button type="button" class="menu-button" id="word-cycle">' +
    edges('24 words') +
    '</button><p class="field-label">Entropy</p><button type="button" class="menu-button" id="entropy-cycle">' +
    edges('No extra entropy') +
    '</button><button type="button" class="menu-button" id="generate-key">' +
    edges('Generate') +
    '</button>'
  const words = ['24 words', '21 words', '18 words', '15 words', '12 words']
  const entropy = ['No extra entropy', 'Coin flips', 'Dice rolls', 'Drawing']
  let word = 0
  let ent = 0
  root.querySelector('#word-cycle').addEventListener('click', () => {
    word = (word + 1) % words.length
    root.querySelector('#word-cycle').lastChild.textContent = words[word]
  })
  root.querySelector('#entropy-cycle').addEventListener('click', () => {
    ent = (ent + 1) % entropy.length
    root.querySelector('#entropy-cycle').lastChild.textContent = entropy[ent]
  })
  root.querySelector('#generate-key').addEventListener('click', () => {
    multisigKeys[0].name = multisigKeys[0].name || 'Phone'
    multisigKeys[0].source = 'This device'
    multisigKeys[0].fingerprint = 'a1b2c3d4'
    multisigKeys[0].pub = 'tpub…4k2a'
    multisigKeys[0].seed = true
    go('add-generate-mnemonic')
  })
}

function renderMultisigSettings() {
  const root = document.getElementById('multisig-settings')
  root.innerHTML =
    '<p class="field-label">Policy</p><p class="msig-count">2 of 3</p>' +
    pips(3, 3) +
    '<p class="field-label">Script</p><p class="hint">Native SegWit (P2WSH)</p>' +
    '<p class="field-label">Cosigners</p><div class="msig-keys">' +
    multisigKeys.map((key, index) => msigKeyRow(key, index, 'settings')).join('') +
    '</div><p class="hint">Demo only. Seeds stay on this page.</p>'
  bindMsig(root, 'settings')
}

function renderMultisigSign() {
  openAccountData = accounts.find((account) => account.multisig) || openAccountData
  const signed = multisigKeys.filter((key) => key.signed).length
  const ready = signed >= 2
  const root = document.getElementById('multisig-sign')
  root.innerHTML =
    '<p class="io-line"><span>Output</span><strong>50,000 sats</strong></p><p class="io-sub">Coffee</p><p class="io-line"><span>Miner fee</span><strong>620 sats</strong></p>' +
    '<p class="field-label">Signatures required</p><p class="msig-count">2 of 3</p>' +
    pips(signed, 3) +
    '<div class="msig-keys">' +
    multisigKeys.map((key, index) => msigKeyRow(key, index, 'sign')).join('') +
    '</div><p class="collected">Signatures collected: ' +
    signed +
    ' / 2</p><button type="button" class="menu-button' +
    (ready ? '' : ' is-off') +
    '" id="check-sigs"' +
    (ready ? '' : ' disabled') +
    '>' +
    edges('Check all signatures') +
    '</button><button type="button" class="menu-button">' +
    edges('Share with group') +
    '</button>'
  bindMsig(root, 'sign')
  const check = root.querySelector('#check-sigs')
  if (ready) {
    check.addEventListener('click', () => {
      renderSent(demoTxid('multisig' + openAccountData.fingerprint))
    })
  }
}

let newAccountName = 'Spending'
let newAccountPolicy = 'singlesig'

function renderNewAccount() {
  const root = document.getElementById('new-account')
  const policies = [
    ['singlesig', 'Single signature', 'One key spends'],
    ['multisig', 'Multisignature', 'Several keys must sign'],
    ['watchonly', 'Watch only', 'Track a wallet without the seed']
  ]
  root.innerHTML =
    '<label class="field"><span>Name</span><input id="new-account-name" value="' +
    newAccountName +
    '"></label><p class="field-label">Policy</p>' +
    policies
      .map(
        (policy) =>
          '<button type="button" class="policy-option' +
          (newAccountPolicy === policy[0] ? ' is-on' : '') +
          '" data-policy="' +
          policy[0] +
          '"><strong>' +
          policy[1] +
          '</strong><span>' +
          policy[2] +
          '</span></button>'
      )
      .join('') +
    '<button type="button" class="menu-button" id="new-account-continue">' +
    edges('Continue') +
    '</button>'
  root.querySelector('#new-account-name').addEventListener('input', (event) => {
    newAccountName = event.target.value || 'Spending'
  })
  root.querySelectorAll('[data-policy]').forEach((button) => {
    button.addEventListener('click', () => {
      newAccountPolicy = button.getAttribute('data-policy')
      renderNewAccount()
    })
  })
  root.querySelector('#new-account-continue').addEventListener('click', () => {
    if (newAccountPolicy === 'multisig') go('multisig-setup')
    else if (newAccountPolicy === 'watchonly') go('add-watch-only')
    else go('new-singlesig')
  })
}

function renderNewSinglesig() {
  document.getElementById('new-singlesig-title').textContent = newAccountName
  const root = document.getElementById('new-singlesig')
  root.innerHTML =
    '<p class="field-label">Policy</p><p class="hint">Single signature</p>' +
    '<p class="field-label">Entropy</p><p class="hint">Add your own randomness, then the app mixes it into the seed.</p>' +
    '<button type="button" class="menu-button" data-entropy="entropy-dice">' +
    edges('Dice rolls') +
    '</button><button type="button" class="menu-button" data-entropy="entropy-coin">' +
    edges('Coin flips') +
    '</button><button type="button" class="menu-button" data-entropy="entropy-drawing">' +
    edges('Drawing') +
    '</button><button type="button" class="menu-button" id="entropy-none">' +
    edges('No extra entropy') +
    '</button><button type="button" class="menu-button is-outline" data-go="add-import-mnemonic">' +
    edges(t('account.import.title2')) +
    '</button>'
  root.querySelectorAll('[data-entropy]').forEach((button) => {
    button.addEventListener('click', () => go(button.getAttribute('data-entropy')))
  })
  root.querySelector('#entropy-none').addEventListener('click', () => go('add-generate-mnemonic'))
}

function entropyBits(values) {
  if (!values.length) return '—'
  return values
    .map((value) => Number(value).toString(2).padStart(3, '0'))
    .join(' ')
}

function renderEntropyDice() {
  const root = document.getElementById('entropy-dice')
  const total = 6
  const rolls = []
  function paint() {
    root.innerHTML =
      '<p class="entropy-bits">' +
      entropyBits(rolls) +
      '</p><p class="entropy-count">' +
      rolls.length +
      '</p><p class="entropy-of">of ' +
      total +
      '</p><p class="hint">Tap the face you rolled. Demo stops at six rolls.</p><div class="dice-pad">' +
      [1, 2, 3, 4, 5, 6]
        .map((face) => '<button type="button" class="die" data-face="' + face + '">' + face + '</button>')
        .join('') +
      '</div><button type="button" class="menu-button" id="dice-undo">' +
      edges('Undo') +
      '</button><button type="button" class="menu-button' +
      (rolls.length >= total ? '' : ' is-off') +
      '" id="dice-done"' +
      (rolls.length >= total ? '' : ' disabled') +
      '>' +
      edges('Continue') +
      '</button>'
    root.querySelectorAll('[data-face]').forEach((button) => {
      button.addEventListener('click', () => {
        if (rolls.length >= total) return
        rolls.push(Number(button.getAttribute('data-face')))
        paint()
      })
    })
    root.querySelector('#dice-undo').addEventListener('click', () => {
      rolls.pop()
      paint()
    })
    if (rolls.length >= total) {
      root.querySelector('#dice-done').addEventListener('click', () => go('add-generate-mnemonic'))
    }
  }
  paint()
}

function renderEntropyCoin() {
  const root = document.getElementById('entropy-coin')
  const total = 8
  const flips = []
  function paint() {
    root.innerHTML =
      '<p class="entropy-bits">' +
      (flips.length ? flips.join(' ') : '—') +
      '</p><p class="entropy-count">' +
      flips.length +
      '</p><p class="entropy-of">of ' +
      total +
      '</p><p class="hint">Heads is 0. Tails is 1. Demo stops at eight flips.</p><div class="coin-pad">' +
      '<button type="button" class="coin-face" data-flip="0">Heads</button>' +
      '<button type="button" class="coin-face" data-flip="1">Tails</button></div>' +
      '<button type="button" class="menu-button" id="coin-undo">' +
      edges('Undo') +
      '</button><button type="button" class="menu-button' +
      (flips.length >= total ? '' : ' is-off') +
      '" id="coin-done"' +
      (flips.length >= total ? '' : ' disabled') +
      '>' +
      edges('Continue') +
      '</button>'
    root.querySelectorAll('[data-flip]').forEach((button) => {
      button.addEventListener('click', () => {
        if (flips.length >= total) return
        flips.push(button.getAttribute('data-flip'))
        paint()
      })
    })
    root.querySelector('#coin-undo').addEventListener('click', () => {
      flips.pop()
      paint()
    })
    if (flips.length >= total) {
      root.querySelector('#coin-done').addEventListener('click', () => go('add-generate-mnemonic'))
    }
  }
  paint()
}

function renderEntropyDrawing() {
  const root = document.getElementById('entropy-drawing')
  const total = 24
  let samples = 0
  root.innerHTML =
    '<p class="entropy-bits" id="draw-bits">—</p><p class="entropy-count" id="draw-count">0</p><p class="entropy-of">of ' +
    total +
    ' bits</p><p class="hint">Draw in the box. Each stroke adds demo entropy.</p><canvas class="draw-pad" id="draw-pad"></canvas><button type="button" class="menu-button" id="draw-clear">' +
    edges('Clear') +
    '</button><button type="button" class="menu-button is-off" id="draw-done" disabled>' +
    edges('Continue') +
    '</button>'
  const canvas = root.querySelector('#draw-pad')
  const ctx = canvas.getContext('2d')
  function fit() {
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
  }
  fit()
  let drawing = false
  function point(event) {
    const rect = canvas.getBoundingClientRect()
    const source = event.touches ? event.touches[0] : event
    return { x: source.clientX - rect.left, y: source.clientY - rect.top }
  }
  function mark(pos) {
    if (samples >= total) return
    samples += 1
    root.querySelector('#draw-count').textContent = String(samples)
    root.querySelector('#draw-bits').textContent = (pos.x.toString(2) + pos.y.toString(2)).slice(0, 24)
    if (samples >= total) {
      const done = root.querySelector('#draw-done')
      done.disabled = false
      done.classList.remove('is-off')
    }
  }
  canvas.addEventListener('pointerdown', (event) => {
    drawing = true
    const pos = point(event)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    mark(pos)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return
    const pos = point(event)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    mark(pos)
  })
  canvas.addEventListener('pointerup', () => {
    drawing = false
  })
  root.querySelector('#draw-clear').addEventListener('click', () => {
    samples = 0
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    root.querySelector('#draw-count').textContent = '0'
    root.querySelector('#draw-bits').textContent = '—'
    const done = root.querySelector('#draw-done')
    done.disabled = true
    done.classList.add('is-off')
  })
  root.querySelector('#draw-done').addEventListener('click', () => {
    if (samples >= total) go('add-generate-mnemonic')
  })
}

document.querySelector('.add-account').addEventListener('click', () => go('new-account'))

function difficultySpiral(times) {
  const growth = 0.97
  const step = 0.055
  let phi = 1 / growth
  let arc = growth * (Math.asinh(phi) + phi * Math.sqrt(phi * phi + 1))
  const points = []
  times.forEach((gap, index) => {
    if (index !== 0 && index !== times.length - 1) arc += gap * step
    phi = Math.sqrt(Math.max(arc * growth, 0))
    const radius = growth * phi
    points.push({
      x: radius * Math.cos(phi),
      y: radius * Math.sin(phi),
      rotation: phi
    })
  })
  const limit = 190
  const scale = 148 / limit
  const cx = 180
  const cy = 160
  const marks = [180]
    .map((radius) => {
      const r = radius * scale
      return (
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.28)" stroke-dasharray="2 3"/>' +
        '<text x="' + cx + '" y="' + (cy - r - 4) + '" fill="#8A8A8A" font-size="8" text-anchor="middle">1 WEEK</text>'
      )
    })
    .join('')
  const blocks = points
    .map((point) => {
      const x = cx + point.x * scale
      const y = cy + point.y * scale
      return (
        '<rect x="-2.2" y="-2.2" width="4.4" height="4.4" fill="#F2F2F2" transform="translate(' +
        x.toFixed(1) +
        ' ' +
        y.toFixed(1) +
        ') rotate(' +
        ((point.rotation * 180) / Math.PI).toFixed(1) +
        ')"/>'
      )
    })
    .join('')
  return (
    '<svg class="difficulty-spiral" viewBox="0 0 360 320" role="img" aria-label="Difficulty epoch spiral">' +
    marks +
    blocks +
    '</svg>'
  )
}

function renderDifficulty() {
  const times = '0,77,1498,1893,1369,392,173,315,66,644,484,443,845,6,556,227,564,212,458,371,1786,1100,70,830,17,723,541,593,859,14,305,720,0,494,196,436,586,322,253,960,113,60,119,1121,367,649,1541,104,239,725,1155,911,725,406,1600,887,1444,73,342,747,0,903,580,406,0,1187,192,266,412,646,479,2464,1836,268,1042,956,403,141,203,1304,1008,368,933,1517,150,130,356,571,398,51,99,465,960,346,975,706,153,321,332,1561,608,1338,112,0,1231,804,237,673,165,306,360,444,38,168,743,276,3043,935,189,100,221,186,3121,277,354,1513,0,605,1201,405,458,525,599,171,753,541,368,0,65,381,198,454,160,54,819,244,508,801,488,269,54,543,1080,221,2,166,601,1912,82,225,1040,62,635,881,74,1189,111,200,551,2435,318,2173,442,0,410,0,286,473,721,130,89,161,1260,627,5,2318,405,1886,1467,653,454,831,1325,5,365,927,2033,1586,1131,203,2199,717,225,282,201,746,462,840,1691,0,479,0,799,457,342,137,1082,158,1831,1596,1488,0,108,209,733,96,1141,1359,36,760,360,237,1516,574,787,0,174,1393,205,478,836,3459,591,1506,1438,166,680,375,2002,157,1202,364,645,144,649,483,276,552,550,0,584,155,199,53,535,430,291,346,7,18,211,857,1294,561,937,241,661,56,79,155,81,1187,1043,1436,410,59,14,1142,327,1062,647,471,133,703,18,32,912,1350,0,226,176,264,356,844,563,89,207,0,282,363,1528,647,580,178,778,40,461,377,185,1201,129,142,2049,846,23,735,592,1300,94,124,223,267,66,556,72,603,128,135,112,305,198,2074,1506,847,365,580,181,22,396,177,218,286,487,756,590,983,325,475,687,485,904,554,634,129,59,418,640,458,1642,465,72,408,168,886,236,187,29,410,252,1399,524,17,686,0,29,2240,39,93,84,177,587,1750,512,1593,113,3521,1218,963,563,786,1759,576,581,165,453,213,430,3931,2,24,356,893,456,914,233,749,293,1001,772,0,17,1889,200,2406,327,148,1616,908,818,494,252,71,917,452,313,587,145,176,286,468,172,105,76,502,1347,254,366,60,193,10,44,195,80,45,332,40,170,118,488,752,645,372,1422,1998,932,114,265,78,158,302,18,71,2085,1277,708,216,845,1004,3,342,1465,368,459,222,355,1555,331,33,152,936,1522,31,260,310,103,134,394,422,235,417,51,361,1007,243,1686,207,759,1546,909,248,156,224,183,1467,193,30,107,492,208,416'.split(',').map(Number)
  document.getElementById('difficulty').innerHTML =
    '<p class="difficulty-tip">140,577,680,051,920</p>' +
    '<p class="difficulty-meta">Block height 972,231</p>' +
    '<div class="difficulty-row">' +
    '<p class="difficulty-stat"><strong>~9.6 minutes</strong><span>Average block time</span></p>' +
    '<p class="difficulty-stat is-end"><strong>~10.0 days</strong><span>Next adjustment</span></p>' +
    '</div>' +
    '<p class="difficulty-source">mempool.space</p>' +
    difficultySpiral(times) +
    '<p class="difficulty-range">Epoch 482 · blocks 971,712–972,231</p>'
}

function renderScriptSelect() {
  const scripts = [
    ['P2PKH', 'Legacy (P2PKH)'],
    ['P2SH-P2WPKH', 'Nested SegWit (P2SH-P2WPKH)'],
    ['P2WPKH', 'Native SegWit (P2WPKH)'],
    ['P2TR', 'Taproot (P2TR)']
  ]
  let selected = 'P2WPKH'
  function paint(sheet) {
    const body = sheet.querySelector('.sheet-body')
    body.innerHTML =
      '<p class="sheet-copy">P2WPKH — Native SegWit. Locks bitcoin to a witness program.</p>' +
      scripts
        .map(
          (script) =>
            '<button type="button" class="policy-option' +
            (selected === script[0] ? ' is-on' : '') +
            '" data-script="' +
            script[0] +
            '"><strong>' +
            script[1] +
            '</strong></button>'
        )
        .join('')
    body.querySelectorAll('[data-script]').forEach((button) => {
      button.addEventListener('click', () => {
        selected = button.getAttribute('data-script')
        const chosen = scripts.find((script) => script[0] === selected)
        body.querySelector('.sheet-copy').textContent =
          selected + ' — ' + chosen[1].replace(' (' + selected + ')', '') + '.'
        body.querySelectorAll('[data-script]').forEach((row) => {
          row.classList.toggle('is-on', row.getAttribute('data-script') === selected)
        })
      })
    })
  }
  menuTab('signer')
  openSheet('Script', '', paint)
  document.getElementById('sheet').classList.add('is-script')
}

function go(id) {
  ioHistory = false
  // Load history lives inside the builder (ioPreview.tsx); only the explorer keeps the standalone view.
  if (id === 'builder' && routeId !== 'explorer-transaction-detail') {
    go('send')
    ioHistory = true
    renderIo()
    return true
  }
  if (phoneScreen.classList.contains('is-drawer') && id !== 'session') setDrawer(false)
  if (typeof kitScreens !== 'undefined' && kitScreens[id]) {
    openKitScreen(id)
    return true
  }
  if (id === 'intro') {
    renderSplash()
    show('intro', 'intro')
    return true
  }
  if (id === 'menu' || id === 'signer') {
    menuTab('signer')
    return true
  }
  if (id === 'difficulty') {
    renderDifficulty()
    show('difficulty', 'difficulty')
    return true
  }
  if (id === 'explorer') {
    menuTab('explorer')
    return true
  }
  if (id === 'accounts') {
    renderAccounts()
    show('accounts', 'accounts')
    return true
  }
  if (id === 'converter') {
    menuTab('converter')
    return true
  }
  if (id === 'currency') {
    activeTab = 'converter'
    paintTabs()
    renderMenu('converter')
    syncFromBtc()
    show('converter', 'currency')
    return true
  }
  if (id === 'tx' || id === 'payjoin-tx') {
    openAccountData = accounts[0]
    const list = activity[openAccountData.fingerprint]
    openTransaction(id === 'payjoin-tx' ? list.find((item) => item.payjoin) || list[0] : list[0])
    return true
  }
  if (id === 'account' || id === 'coins' || id === 'chart') {
    openAccountData = accounts[0]
    showChart = id === 'chart'
    outputView = 'bubbles'
    accountTab = id === 'coins' ? 2 : 0
    renderAccount()
    show('account', id)
    return true
  }
  if (id === 'account-settings') {
    renderAccountSettings()
    show('account-settings', 'account-settings')
    return true
  }
  if (id === 'output') {
    openAccountData = accounts[0]
    openSend('output')
    openOutputModal(draft.outputs[0] ? draft.outputs[0].id : null)
    show('send', 'output')
    return true
  }
  if ((id === 'send' || id === 'payjoin') && !enteringReplacement && !['fee-management', 'timelock', 'import-outputs'].includes(routeId)) replacementDraft = null
  if (id === 'send' || id === 'payjoin') {
    openAccountData = accounts[0]
    document.getElementById('payjoin-toggle').checked = true
    openSend('output')
    show('send', id === 'payjoin' ? 'payjoin' : 'send')
    return true
  }
  if (id === 'builder') {
    openAccountData = accounts[0]
    renderBuilder()
    show('preview', 'builder')
    return true
  }
  if (id === 'preview') {
    openAccountData = accounts[0]
    renderDecoded()
    show('preview', 'preview')
    return true
  }
  if (id === 'psbt-qr') {
    renderPsbtQr()
    show('psbt-qr', 'psbt-qr')
    return true
  }
  if (id === 'sign') {
    openAccountData = accounts[0]
    document.getElementById('payjoin-toggle').checked = true
    startSign()
    show('sign', 'sign')
    return true
  }
  if (id === 'sent') {
    openAccountData = accounts[0]
    renderSent(demoTxid('sent' + openAccountData.fingerprint))
    return true
  }
  if (
    id === 'duress' ||
    id === 'seed-drop' ||
    id === 'ark' ||
    id === 'ark-account' ||
    id === 'lightning' ||
    id === 'lightning-node' ||
    id === 'lightning-rest' ||
    id === 'lightning-rpc' ||
    id === 'ecash' ||
    id === 'ecash-account' ||
    id === 'ecash-send' ||
    id === 'ecash-receive' ||
    id === 'ecash-add' ||
    id === 'nostr' ||
    id === 'nostr-account' ||
    id === 'nostr-relays' ||
    id === 'nostr-add'
  ) {
    show(id, id)
    return true
  }
  if (id === 'new-account') {
    renderNewAccount()
    show('new-account', 'new-account')
    return true
  }
  if (id === 'new-singlesig') {
    renderNewSinglesig()
    show('new-singlesig', 'new-singlesig')
    return true
  }
  if (id === 'entropy-dice') {
    renderEntropyDice()
    show('entropy-dice', 'entropy-dice')
    return true
  }
  if (id === 'entropy-coin') {
    renderEntropyCoin()
    show('entropy-coin', 'entropy-coin')
    return true
  }
  if (id === 'entropy-drawing') {
    renderEntropyDrawing()
    show('entropy-drawing', 'entropy-drawing')
    return true
  }
  if (id === 'multisig-setup') {
    renderMultisigSetup()
    show('multisig-setup', 'multisig-setup')
    return true
  }
  if (id === 'multisig-keys') {
    renderMultisigKeys()
    show('multisig-keys', 'multisig-keys')
    return true
  }
  if (id === 'multisig-key') {
    renderMultisigKey()
    show('multisig-key', 'multisig-key')
    return true
  }
  if (id === 'multisig-settings') {
    openAccountData = accounts.find((account) => account.multisig) || accounts[0]
    renderMultisigSettings()
    show('multisig-settings', 'multisig-settings')
    return true
  }
  if (id === 'multisig-sign') {
    openAccountData = accounts.find((account) => account.multisig) || accounts[0]
    multisigKeys[0].signed = true
    multisigKeys[1].signed = false
    multisigKeys[2].signed = false
    renderMultisigSign()
    show('multisig-sign', 'multisig-sign')
    return true
  }
  if (id === 'script') {
    renderScriptSelect()
    routeId = 'script'
    if (isStage && !demoQuery.has('embed')) history.replaceState(null, '', location.pathname + location.search + '#script')
    return true
  }


  return false
}

const requested = isStage
  ? (location.hash || '').replace(/^#/, '') || demoQuery.get('screen') || ''
  : ''

// Route after every script has run, so screens registered in screens.js resolve too.
document.addEventListener('DOMContentLoaded', () => {
  // Always draw the menu and tab bar: deep links (e.g. #intro in the homepage hero) reach them later.
  paintTabs()
  renderMenu('signer')
  if (!go(requested)) {
    renderSplash()
    show('intro')
  }
  // ?scroll=<selector>: scroll that element into view inside the screen (homepage feature cards)
  const scrollTo = demoQuery.get('scroll')
  if (scrollTo) {
    setTimeout(() => {
      const target = [...document.querySelectorAll('.phone-screen > section:not([hidden]) ' + scrollTo)][0]
      let box = target && target.parentElement
      while (box && box.scrollHeight <= box.clientHeight + 1) box = box.parentElement
      if (target && box) box.scrollTop += target.getBoundingClientRect().top - box.getBoundingClientRect().top - 24
    }, 150)
  }
})

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (!event.data || event.data.type !== 'satsigner' || !event.data.play) return
  go(routeId)
})

const stageHome = document.getElementById('stage-home')
const stagePlay = document.getElementById('stage-play')
const demoCursor = document.getElementById('demo-cursor')
let demoToken = 0
let demoTimer = 0
let demoRunId = 0

function notifyDemo(playing) {
  if (window.parent === window) return
  window.parent.postMessage({ type: 'satsigner-demo', playing: playing, run: demoRunId }, location.origin)
}

function waitDemo(ms, token) {
  return new Promise((resolve) => {
    demoTimer = setTimeout(() => resolve(token === demoToken), ms)
  })
}

function hideDemoCursor() {
  if (!demoCursor) return
  demoCursor.classList.remove('is-on', 'is-pressing')
  demoCursor.hidden = true
}

function stopDemo() {
  demoToken += 1
  clearTimeout(demoTimer)
  hideDemoCursor()
  document.documentElement.classList.remove('is-demo')
  if (stagePlay) {
    stagePlay.textContent = 'Play'
    stagePlay.setAttribute('aria-pressed', 'false')
    stagePlay.parentElement.classList.remove('is-playing')
  }
  notifyDemo(false)
}

function demoTarget(selector) {
  const list = typeof selector === 'string' ? [...document.querySelectorAll(selector)] : [selector]
  for (const target of list) {
    if (!target || target.closest('[hidden]') || target.disabled) continue
    const box = target.getBoundingClientRect()
    if (box.width >= 1 && box.height >= 1) return target
  }
  return null
}

function demoScroller(target) {
  for (let box = target.parentElement; box && box !== document.body; box = box.parentElement) {
    const overflow = getComputedStyle(box).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && box.scrollHeight > box.clientHeight + 1) return box
  }
  return null
}

// Scrolls like a thumb would: only when the target is out of comfortable view, and eased
// over a time that grows with the distance. Resolves once the scroll settles.
async function revealDemoTarget(target, token) {
  const box = demoScroller(target)
  if (!box) return true
  const screen = document.querySelector('.phone-screen')
  const view = box.getBoundingClientRect()
  const frame = screen ? screen.getBoundingClientRect() : view
  const top = Math.max(view.top, frame.top)
  const bottom = Math.min(view.bottom, frame.bottom)
  const rect = target.getBoundingClientRect()
  const margin = 72
  if (rect.top >= top + margin && rect.bottom <= bottom - margin) return true
  const from = box.scrollTop
  const max = box.scrollHeight - box.clientHeight
  const to = Math.max(0, Math.min(max, from + rect.top - top - (bottom - top - rect.height) / 2))
  const distance = Math.abs(to - from)
  if (distance < 2) return true
  const duration = Math.min(900, 320 + distance * 0.6)
  const start = performance.now()
  await new Promise((resolve) => {
    const frameStep = (now) => {
      if (token !== demoToken) return resolve()
      const p = Math.min(1, (now - start) / duration)
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
      box.scrollTop = from + (to - from) * eased
      if (p < 1) requestAnimationFrame(frameStep)
      else resolve()
    }
    requestAnimationFrame(frameStep)
  })
  return waitDemo(120, token)
}

// `quick` moves the cursor faster, for runs of repeated taps like seed word confirmation.
async function pressDemo(token, selector, quick = false) {
  if (token !== demoToken) return false
  const screen = document.querySelector('.phone-screen')
  const target = demoTarget(selector)
  if (!demoCursor || !screen || !target) return false
  if (!(await revealDemoTarget(target, token))) return false
  const box = target.getBoundingClientRect()
  const frame = screen.getBoundingClientRect()
  demoCursor.hidden = false
  demoCursor.classList.add('is-on')
  demoCursor.classList.toggle('is-quick', quick)
  demoCursor.classList.remove('is-pressing')
  demoCursor.style.left = box.left + box.width / 2 - frame.left + 'px'
  demoCursor.style.top = box.top + box.height / 2 - frame.top + 'px'
  if (!(await waitDemo(quick ? 240 : 480, token))) return false
  demoCursor.classList.add('is-pressing')
  if (!(await waitDemo(quick ? 110 : 160, token))) return false
  demoCursor.classList.remove('is-pressing')
  return token === demoToken
}

async function tapDemo(token, selector, hold = 1400, quick = false) {
  const target = demoTarget(selector)
  if (!target || !(await pressDemo(token, target, quick))) return false
  target.click()
  return waitDemo(hold, token)
}

// Types like a person: one character at a time. Kit screens can re-render on every
// keystroke (new-account does), so the field is looked up again each time.
async function typeDemo(token, selector, text) {
  if (!(await pressDemo(token, selector))) return false
  for (let i = 1; i <= text.length; i += 1) {
    const field = demoTarget(selector)
    if (!field) return false
    field.focus()
    field.value = text.slice(0, i)
    field.dispatchEvent(new Event('input', { bubbles: true }))
    if (!(await waitDemo(70, token))) return false
  }
  const field = demoTarget(selector)
  if (field) {
    field.dispatchEvent(new Event('change', { bubbles: true }))
    field.blur()
  }
  return waitDemo(600, token)
}

// Drags an ss.amountInput slider to `sats` over a few frames.
async function slideDemo(token, selector, sats) {
  if (!(await pressDemo(token, selector))) return false
  const slider = demoTarget(selector)
  if (!slider) return false
  const from = Number(slider.value)
  for (let step = 1; step <= 12; step += 1) {
    slider.value = Math.round(from + ((sats - from) * step) / 12)
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    if (!(await waitDemo(40, token))) return false
  }
  return waitDemo(700, token)
}

// Waits for async UI (signing, redeeming, finishing) to show `selector` or satisfy a check.
async function untilDemo(token, selector, timeout = 8000) {
  for (let waited = 0; waited < timeout; waited += 200) {
    if (typeof selector === 'function' ? selector() : demoTarget(selector)) return waitDemo(500, token)
    if (!(await waitDemo(200, token))) return false
  }
  return false
}

async function demoSteps(steps) {
  for (const step of steps) {
    if (await step()) continue
    if (document.documentElement.classList.contains('is-demo')) console.warn('Demo stopped at', String(step), 'on', routeId)
    return false
  }
  return true
}

const demoOnScreen = (id) => () => routeId === id

// Each run starts from the same fixtures, so a flow can be replayed and a stopped flow
// doesn't leak into the next one.
function resetDemoState() {
  closeSheet()
  setDrawer(false)
  document.querySelectorAll('.ss-modal:not([hidden]), .bd-warning:not([hidden]), .bd-gradient-modal:not([hidden])').forEach((node) => node.setAttribute('hidden', ''))
  for (let i = accounts.length - 1; i >= 0; i -= 1) if (accounts[i].created) accounts.splice(i, 1)
  undoBroadcasts()
  coins.forEach((coin) => (coin.selected = coin.id === 'salary'))
  activeNetwork = 'signet'
  newAccountName = 'Spending'
  newAccountPolicy = 'singlesig'
  Object.assign(lxState, { typedName: '', words: 24, keyWords: 24, entropy: 'none', keyEntropy: 'none', keyIndex: 0, expanded: null, pending: null })
  Object.assign(bdState, { wordIndex: 0, choice: 0, keyIndex: 0, passphrase: '', importWords: Array(12).fill(''), activeWord: null })
  msigRequired = 2
  msigTotal = 3
  multisigKeys.forEach((key) => Object.assign(key, { name: '', source: '', fingerprint: '', pub: '', seed: false, signed: false, creationType: null }))
  draft.outputs = []
  draft.feeRate = 2.2
  draft.editing = null
  replacementDraft = null
  Object.assign(esReceive, { tab: 'ecash', token: '', redeemed: false, amount: '', fiatMode: false, memo: '', quote: '', status: 'pending' })
  esState.proofs = esState.proofs.filter((proof) => !proof.added)
  esState.transactions = esState.transactions.filter((tx) => !tx.added)
  alArk.boardTab = 'address'
  alArk.boardAmount = 50000
  alArk.pendingBoards = alArk.pendingBoards.filter((board) => !board.added)
  for (let i = alMovements.length - 1; i >= 0; i -= 1) {
    if (!alMovements[i].added) continue
    alArk.account.pending -= alMovements[i].amount
    alMovements.splice(i, 1)
  }
}

async function playDemo(flow, runId) {
  const run = DEMO_FLOWS[flow] || DEMO_FLOWS.send
  demoRunId = runId || 0
  demoToken += 1
  const token = demoToken
  clearTimeout(demoTimer)
  document.documentElement.classList.add('is-demo')
  stagePlay.textContent = 'Stop'
  stagePlay.setAttribute('aria-pressed', 'true')
  stagePlay.parentElement.classList.add('is-playing')
  resetDemoState()
  go('signer')
  if (!(await waitDemo(500, token))) return false

  const ok = await run(token)
  if (token === demoToken) stopDemo()
  return ok
}

// Confirms every seed word by picking the right candidate, then acknowledges the warning.
// Multisig keys skip the warning and return to the key manager instead.
async function confirmSeedDemo(token) {
  for (let i = 0; i < BD_MNEMONIC.length; i += 1) {
    const pick = bdCandidates(i).indexOf(BD_MNEMONIC[i]) + 1
    if (!(await tapDemo(token, '#kit-body [data-choice="' + pick + '"]', 420, true))) return false
    if (!(await tapDemo(token, '#bd-next', 200, true))) return false
  }
  return true
}

// Opens a mnemonic length select (lx-words / lx-key-words) and picks 12 words, matching the
// 12-word seed the generate screens show.
const twelveWordsDemo = (token, id) => [
  () => tapDemo(token, '#kit-body [data-open="' + id + '"]', 900),
  () => tapDemo(token, '#' + id + ' [data-ss-radio][data-value="12"]', 900),
  () => tapDemo(token, '#' + id + ' [data-lx-select="' + id + '"]')
]

const openBitcoinDemo = (token) => [
  () => tapDemo(token, '#menu-list .menu-button'),
  () => untilDemo(token, demoOnScreen('accounts'))
]

const newAccountDemo = (token, name, policy) => [
  ...openBitcoinDemo(token),
  () => tapDemo(token, '#kit-body [data-go="new-account"]'),
  () => typeDemo(token, '#kit-body .lx-account-name input', name),
  ...(policy ? [() => tapDemo(token, '#kit-body [data-policy="' + policy + '"]', 900)] : []),
  () => tapDemo(token, '#lx-continue')
]

const DEMO_FLOWS = {
  send: (token) =>
    demoSteps([
      ...openBitcoinDemo(token),
      () => tapDemo(token, '#kit-body [data-lb-account]'),
      () => tapDemo(token, '#kit-body [data-lb-send]'),
      () => tapDemo(token, '#kit-body [data-coin]', 900),
      () => tapDemo(token, '#coin-use'),
      () => tapDemo(token, '#io-add-output'),
      () => tapDemo(token, '#io-output-modal #io-paste', 900),
      () => slideDemo(token, '#io-output-modal .ss-slider', 42000),
      () => typeDemo(token, '#io-output-modal .io-label textarea', 'Coffee'),
      () => tapDemo(token, '#io-save-output'),
      () => tapDemo(token, '#io-preview-go'),
      () => tapDemo(token, '#sign-open'),
      () => untilDemo(token, '#broadcast', 12000),
      () => tapDemo(token, '#broadcast'),
      () => untilDemo(token, '#sent-body [data-go="account"]'),
      () => waitDemo(1400, token),
      () => tapDemo(token, '#sent-body [data-go="account"]', 1600)
    ]),
  account: (token) =>
    demoSteps([
      ...newAccountDemo(token, 'Holiday'),
      ...twelveWordsDemo(token, 'lx-words'),
      () => tapDemo(token, '#lx-generate', 1800),
      () => tapDemo(token, '#bd-confirm'),
      () => confirmSeedDemo(token),
      () => untilDemo(token, '#bd-ack'),
      () => waitDemo(1200, token),
      () => tapDemo(token, '#bd-ack'),
      () => untilDemo(token, demoOnScreen('add-created')),
      () => waitDemo(800, token),
      () => tapDemo(token, '#bd-goto', 1800)
    ]),
  import: (token) =>
    demoSteps([
      ...newAccountDemo(token, 'Restored'),
      () => tapDemo(token, '#lx-import'),
      () => tapDemo(token, '#bd-paste', 1600),
      () => tapDemo(token, '#bd-import'),
      () => untilDemo(token, demoOnScreen('add-created')),
      () => waitDemo(800, token),
      () => tapDemo(token, '#bd-goto', 1800)
    ]),
  multisig: (token) => {
    const importKey = (index, name) => [
      () => tapDemo(token, '#kit-body [data-lx-toggle="' + index + '"]', 700),
      () => typeDemo(token, '#kit-body .lx-key-name[data-key="' + index + '"] input', name),
      () => tapDemo(token, '#kit-body [data-act="import-xpub"][data-i="' + index + '"]'),
      () => tapDemo(token, '#bd-paste', 900),
      () => tapDemo(token, '#bd-paste-fp', 900),
      () => tapDemo(token, '#bd-confirm'),
      () => untilDemo(token, demoOnScreen('multisig-keys'))
    ]
    return demoSteps([
      ...newAccountDemo(token, 'Family vault', 'multisig'),
      () => untilDemo(token, demoOnScreen('multisig-setup')),
      () => tapDemo(token, '#lx-msig-continue'),
      () => tapDemo(token, '#kit-body [data-lx-toggle="0"]', 700),
      () => typeDemo(token, '#kit-body .lx-key-name[data-key="0"] input', 'Phone'),
      () => tapDemo(token, '#kit-body [data-act="generate"][data-i="0"]'),
      ...twelveWordsDemo(token, 'lx-key-words'),
      () => tapDemo(token, '#lx-key-generate', 1800),
      () => tapDemo(token, '#bd-confirm'),
      () => confirmSeedDemo(token),
      () => untilDemo(token, demoOnScreen('multisig-keys')),
      ...importKey(1, 'Laptop'),
      ...importKey(2, 'Hardware'),
      () => tapDemo(token, '#lx-msig-confirm'),
      () => untilDemo(token, '#kit-body #bd-goto'),
      () => waitDemo(800, token),
      () => tapDemo(token, '#kit-body #bd-goto', 1800)
    ])
  },
  nostr: (token) =>
    demoSteps([
      ...openBitcoinDemo(token),
      () => tapDemo(token, '#kit-body [data-lb-account]'),
      () => {
        bsNostrFresh()
        return true
      },
      () => tapDemo(token, '#view-kit .lb-header-extra'),
      () => tapDemo(token, '#kit-body [data-go="account-nostr"]'),
      () => tapDemo(token, '#kit-body #bs-create-key', 1800),
      () => tapDemo(token, '#kit-body [data-go="account-nostr-relays"]'),
      () => tapDemo(token, '#kit-body [data-relay="wss://relay.damus.io"]', 700),
      () => tapDemo(token, '#kit-body [data-relay="wss://nos.lol"]', 700),
      () => tapDemo(token, '#kit-body [data-relay="wss://relay.primal.net"]', 700),
      () => tapDemo(token, '#kit-body #bs-save-relays'),
      () => tapDemo(token, '#kit-body #bs-sync-toggle'),
      () => untilDemo(token, () => !bsState().nostr.syncing),
      () => waitDemo(1200, token),
      () => tapDemo(token, '#kit-body [data-trust="' + bsState().nostr.members[1].npub + '"]'),
      () => tapDemo(token, '#bs-trust-yes', 2200)
    ]),
  ecash: (token) =>
    demoSteps([
      () => tapDemo(token, '#menu-list .menu-item:nth-child(5) .menu-button'),
      () => tapDemo(token, '#kit-body [data-go="ecash-account"]'),
      () => tapDemo(token, '#kit-body [data-lh-act="receive"]'),
      () => tapDemo(token, '#kit-body #es-paste-token', 1600),
      () => tapDemo(token, '#kit-body #es-redeem'),
      () => untilDemo(token, () => esReceive.redeemed),
      () => waitDemo(800, token),
      () => tapDemo(token, '#kit-body [data-es-tab][data-value="lightning"]'),
      () => typeDemo(token, '#kit-body #es-amount input, #kit-body input#es-amount', '5000'),
      () => tapDemo(token, '#kit-body #es-invoice-btn', 1800),
      () => untilDemo(token, () => esReceive.status === 'paid'),
      () => waitDemo(1200, token),
      () => tapDemo(token, '#view-kit .back, #view-kit [data-kit-back]', 1600)
    ]),
  ark: (token) =>
    demoSteps([
      () => tapDemo(token, '#menu-list .menu-item:nth-child(3) .menu-button'),
      () => tapDemo(token, '#kit-body [data-go="ark-account"]'),
      () => tapDemo(token, '#view-kit [data-go="ark-settings"]'),
      () => tapDemo(token, '#kit-body [data-go="ark-board"]'),
      () => slideDemo(token, '#kit-body .ss-slider', 120000),
      () => tapDemo(token, '#kit-body #al-board-go'),
      () => untilDemo(token, demoOnScreen('ark-account')),
      () => waitDemo(1600, token)
    ])
}
if (stageHome) {
  stageHome.addEventListener('click', () => {
    stopDemo()
    closeSheet()
    setDrawer(false)
    go('intro')
  })
}

if (stagePlay) {
  stagePlay.addEventListener('click', () => {
    if (stagePlay.getAttribute('aria-pressed') === 'true') stopDemo()
  })
  stagePlay.parentElement.querySelectorAll('[data-flow]').forEach((button) => {
    button.addEventListener('click', () => {
      if (stagePlay.getAttribute('aria-pressed') === 'true') return
      playDemo(button.getAttribute('data-flow'))
    })
  })
}

window.satSignerDemo = {
  open(screen) {
    if (screen) go(screen)
    else startOnboarding()
  },
  play(flow, runId) {
    return playDemo(DEMO_FLOWS[flow] ? flow : 'send', runId)
  },
  stop: stopDemo
}

const clock = document.querySelector('.phone-time')
if (clock) {
  const now = new Date()
  clock.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0')
}
