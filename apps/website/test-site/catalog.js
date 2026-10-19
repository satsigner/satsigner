const screens = [
  { id: 'intro', name: 'Intro', view: 'view-intro', source: 'Home splash' },
  { id: 'signer', name: 'Signer', view: 'view-menu', source: 'Signer tab' },
  { id: 'explorer', name: 'Explorer', view: 'view-menu', source: 'Explorer tab' },
  { id: 'accounts', name: 'Bitcoin', view: 'view-accounts', source: 'Accounts' },
  { id: 'converter', name: 'Converter', view: 'view-converter', source: 'Currency converter' },
  { id: 'account', name: 'Account', view: 'view-account', source: 'Account overview' },
  { id: 'tx', name: 'Transaction', view: 'view-tx', source: 'Transaction details' },
  { id: 'coins', name: 'Coins', view: 'view-account', source: 'Account coins tab' },
  { id: 'chart', name: 'Chart', view: 'view-account', source: 'Account chart' },
  { id: 'send', name: 'Send', view: 'view-send', source: 'Send form' },
  { id: 'payjoin', name: 'Payjoin', view: 'view-send', source: 'Send with Payjoin' },
  { id: 'preview', name: 'Preview', view: 'view-preview', source: 'Transaction preview' },
  { id: 'sign', name: 'Sign', view: 'view-sign', source: 'Payjoin sign' },
  { id: 'sent', name: 'Sent', view: 'view-sent', source: 'Transaction broadcasted' },
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
  { id: 'multisig-setup', name: 'Multisig policy', view: 'view-multisig-setup', source: 'Key count and script' },
  { id: 'multisig-keys', name: 'Multisig keys', view: 'view-multisig-keys', source: 'Cosigner manager' },
  { id: 'multisig-key', name: 'Key settings', view: 'view-multisig-key', source: 'Generate a cosigner' },
  { id: 'multisig-settings', name: 'Multisig settings', view: 'view-multisig-settings', source: 'Account keys' },
  { id: 'multisig-sign', name: 'Multisig sign', view: 'view-multisig-sign', source: 'Collect signatures' },
  { id: 'settings', name: 'Settings', view: 'sheet', source: 'Settings sheet' }
]

const list = document.getElementById('list-view')
const tableBody = document.getElementById('screen-rows')

function previewSrc(id) {
  return '/test-site/?embed=1&device=1&screen=' + encodeURIComponent(id)
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
  const href = '/test-site/index.html#' + screen.id

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
  row.appendChild(name)

  const route = document.createElement('td')
  route.className = 'route'
  route.textContent = '#' + screen.id
  row.appendChild(route)

  const markup = document.createElement('td')
  markup.className = 'route'
  markup.textContent = screen.view
  row.appendChild(markup)

  const source = document.createElement('td')
  source.textContent = screen.source
  row.appendChild(source)
  tableBody.appendChild(row)
})

const flows = [
  ['intro', 'signer'],
  ['signer', 'explorer'],
  ['explorer', 'signer'],
  ['signer', 'converter'],
  ['signer', 'settings'],
  ['signer', 'accounts'],
  ['signer', 'lightning'],
  ['signer', 'ark'],
  ['signer', 'ecash'],
  ['signer', 'nostr'],
  ['accounts', 'account'],
  ['accounts', 'multisig-setup'],
  ['account', 'tx'],
  ['account', 'coins'],
  ['account', 'chart'],
  ['account', 'send'],
  ['account', 'multisig-settings'],
  ['send', 'payjoin'],
  ['send', 'preview'],
  ['preview', 'sign'],
  ['preview', 'multisig-sign'],
  ['sign', 'sent'],
  ['multisig-sign', 'sent'],
  ['multisig-setup', 'multisig-keys'],
  ['multisig-keys', 'multisig-key'],
  ['multisig-key', 'multisig-keys'],
  ['multisig-keys', 'account'],
  ['lightning', 'lightning-node'],
  ['lightning', 'lightning-rest'],
  ['lightning', 'lightning-rpc'],
  ['ark', 'ark-account'],
  ['ecash', 'ecash-account'],
  ['ecash', 'ecash-add'],
  ['ecash-account', 'ecash-send'],
  ['ecash-account', 'ecash-receive'],
  ['nostr', 'nostr-account'],
  ['nostr', 'nostr-add'],
  ['nostr-account', 'nostr-relays']
]

const flowLanes = [
  { name: 'Shell', ids: ['intro', 'signer', 'explorer', 'converter', 'settings'] },
  { name: 'Bitcoin', ids: ['accounts', 'account', 'tx', 'coins', 'chart', 'send', 'payjoin', 'preview', 'sign', 'sent'] },
  { name: 'Multisig', ids: ['multisig-setup', 'multisig-keys', 'multisig-key', 'multisig-settings', 'multisig-sign'] },
  { name: 'Lightning', ids: ['lightning', 'lightning-node', 'lightning-rest', 'lightning-rpc'] },
  { name: 'Ark', ids: ['ark', 'ark-account'] },
  { name: 'ECash', ids: ['ecash', 'ecash-account', 'ecash-send', 'ecash-receive', 'ecash-add'] },
  { name: 'Nostr', ids: ['nostr', 'nostr-account', 'nostr-relays', 'nostr-add'] }
]

const flowColumns = {
  intro: 0,
  signer: 1,
  explorer: 2,
  converter: 2,
  settings: 2,
  accounts: 1,
  account: 2,
  tx: 3,
  coins: 3,
  chart: 3,
  send: 3,
  payjoin: 4,
  preview: 4,
  sign: 5,
  sent: 6,
  'multisig-setup': 1,
  'multisig-keys': 2,
  'multisig-key': 3,
  'multisig-settings': 3,
  'multisig-sign': 5,
  lightning: 1,
  'lightning-node': 2,
  'lightning-rest': 2,
  'lightning-rpc': 2,
  ark: 1,
  'ark-account': 2,
  ecash: 1,
  'ecash-account': 2,
  'ecash-send': 3,
  'ecash-receive': 3,
  'ecash-add': 2,
  nostr: 1,
  'nostr-account': 2,
  'nostr-relays': 3,
  'nostr-add': 2
}

function renderFlow() {
  const root = document.getElementById('flow-view')
  const nodeW = 156
  const nodeH = 52
  const colW = 196
  const rowH = 68
  const padX = 108
  const padY = 28
  const slots = {}
  flowLanes.forEach((lane) => {
    const rows = {}
    lane.ids.forEach((id) => {
      const column = flowColumns[id]
      rows[column] = rows[column] || []
      const row = rows[column].length
      rows[column].push(id)
      slots[id] = { column, row }
    })
  })
  let y = padY
  const laneMeta = flowLanes.map((lane) => {
    const height = Math.max(...lane.ids.map((id) => slots[id].row + 1)) * rowH
    const meta = { name: lane.name, y, height }
    y += height + 28
    return meta
  })
  const laneY = Object.fromEntries(flowLanes.map((lane, index) => [lane.name, laneMeta[index].y]))
  const laneOf = {}
  flowLanes.forEach((lane) => lane.ids.forEach((id) => (laneOf[id] = lane.name)))
  const boxes = {}
  screens.forEach((screen) => {
    const slot = slots[screen.id]
    boxes[screen.id] = {
      x: padX + slot.column * colW,
      y: laneY[laneOf[screen.id]] + slot.row * rowH,
      w: nodeW,
      h: nodeH
    }
  })
  const width = padX + 7 * colW
  const height = y
  root.innerHTML = ''
  const canvas = document.createElement('div')
  canvas.className = 'flow-canvas'
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
  flows.forEach(([from, to]) => {
    const a = boxes[from]
    const b = boxes[to]
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const x1 = a.x + a.w
    const y1 = a.y + a.h / 2
    const x2 = b.x
    const y2 = b.y + b.h / 2
    const bend = Math.max(28, Math.abs(x2 - x1) / 2)
    const start = x2 >= x1 ? x1 : a.x
    const end = x2 >= x1 ? x2 : b.x + b.w
    path.setAttribute('d', 'M ' + start + ' ' + y1 + ' C ' + (start + (x2 >= x1 ? bend : -bend)) + ' ' + y1 + ', ' + (end - (x2 >= x1 ? bend : -bend)) + ' ' + y2 + ', ' + end + ' ' + y2)
    path.setAttribute('class', 'flow-edge')
    path.dataset.from = from
    path.dataset.to = to
    svg.appendChild(path)
  })
  canvas.appendChild(svg)
  laneMeta.forEach((lane) => {
    const label = document.createElement('p')
    label.className = 'flow-lane'
    label.style.left = '0'
    label.style.top = lane.y + 16 + 'px'
    label.textContent = lane.name
    canvas.appendChild(label)
  })
  screens.forEach((screen) => {
    const box = boxes[screen.id]
    const link = document.createElement('a')
    link.className = 'flow-node'
    link.href = '/test-site/index.html#' + screen.id
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
  root.appendChild(canvas)
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

renderFlow()

const table = document.getElementById('table-view')
const flow = document.getElementById('flow-view')
const phone = document.getElementById('phone-view')
const buttons = document.querySelectorAll('[data-view]')
const stored = localStorage.getItem('screen-catalog-view') || 'list'

function setView(mode) {
  list.hidden = mode !== 'list'
  table.hidden = mode !== 'table'
  flow.hidden = mode !== 'flow'
  phone.hidden = mode !== 'phone'
  buttons.forEach((button) => {
    button.classList.toggle('is-active', button.getAttribute('data-view') === mode)
  })
  localStorage.setItem('screen-catalog-view', mode)
}

buttons.forEach((button) => {
  button.addEventListener('click', () => setView(button.getAttribute('data-view')))
})

setView(stored === 'table' || stored === 'flow' || stored === 'phone' ? stored : 'list')
