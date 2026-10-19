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

const table = document.getElementById('table-view')
const buttons = document.querySelectorAll('[data-view]')
const stored = localStorage.getItem('screen-catalog-view') || 'list'

function setView(mode) {
  const tableMode = mode === 'table'
  list.hidden = tableMode
  table.hidden = !tableMode
  buttons.forEach((button) => {
    button.classList.toggle('is-active', button.getAttribute('data-view') === mode)
  })
  localStorage.setItem('screen-catalog-view', mode)
}

buttons.forEach((button) => {
  button.addEventListener('click', () => setView(button.getAttribute('data-view')))
})

setView(stored === 'table' ? 'table' : 'list')
