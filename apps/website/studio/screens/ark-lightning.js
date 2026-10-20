/* Ark and Lightning — app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ark/* and .../lightning/*
   Screens registered with registerScreen() (screens.js). The landing views (go('ark'), 'ark-account',
   'lightning', 'lightning-node', 'lightning-rest', 'lightning-rpc') are hand-ported in screen.js.
   Fixture data only: no Ark server, no LND node. Local helpers and state use the `al` prefix. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  /* SSPairedTabs — components/SSPairedTabs.tsx */
  .al-tabs { display: flex; gap: var(--layout-h-stack-gap-md); }
  .al-tab { flex: 1; min-width: 0; height: var(--sizes-button-height); padding: 0 8px; border: 1px solid var(--gray-900); border-radius: var(--sizes-button-border-radius); background: var(--gray-900); color: var(--gray-50); font: inherit; font-size: var(--sizes-text-font-size-sm); font-weight: var(--sizes-text-font-weight-medium); text-transform: uppercase; cursor: pointer; }
  .al-tab.is-on { border-color: var(--gray-75); background: var(--transparent); color: var(--white); }
  .al-tab:active { opacity: 0.88; }
  /* addressBox / destinationBox / codeBox */
  .al-box { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid var(--gray-800); border-radius: 8px; background: var(--gray-900); word-break: break-all; }
  .al-mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .al-pad { padding: 20px 0 60px; }
  .al-warn { color: var(--warning); }
  .al-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--gray-850); }
  .al-row > :last-child { text-align: right; word-break: break-all; }
  .al-pending-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--gray-800); }
  .al-qr { display: flex; flex-direction: column; align-items: center; gap: var(--layout-v-stack-gap-md); padding: 20px 0; }
  .al-qr > .ss-qr { margin-bottom: 4px; }
  .al-qr > .ss-copy, .al-qr > .al-box, .al-qr > .ss-button, .al-actions > .ss-copy { display: block; width: 100%; }
  .al-pad .ss-details .ss-text { word-break: break-all; }
  .al-actions { display: flex; gap: var(--layout-h-stack-gap-sm); }
  .al-actions > * { flex: 1; }
  /* SSArkMovementIcon */
  .al-move-icon { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border: 1px solid var(--gray-600); border-radius: 50%; color: var(--white); font-size: 24px; font-weight: 200; }
  .al-move-icon.is-receive { color: var(--main-green); border-color: var(--soft-bar-green); }
  .al-move-icon.is-send, .al-move-icon.is-offboard { color: var(--main-red); border-color: var(--soft-bar-red); }
  .al-move-icon .al-bolt { position: absolute; right: -4px; bottom: -4px; width: 18px; height: 18px; padding: 3px; box-sizing: border-box; border-radius: 50%; background: var(--gray-950); color: var(--warning); }
  /* SSLightningChannelLiquidityBar */
  .al-liq-track { display: flex; height: 6px; overflow: hidden; border-radius: 3px; background: var(--gray-850); }
  .al-liq-track i { display: block; min-width: 2px; }
  .al-chip { display: inline-block; margin: 0 6px 6px 0; padding: 6px 10px; border: 1px solid var(--gray-700); border-radius: 14px; background: none; color: var(--gray-75); font: inherit; font-size: var(--sizes-text-font-size-xs); cursor: pointer; }
  .al-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; padding: 10px 0; border-bottom: 1px solid var(--gray-850); }
  .al-pair > :nth-child(even) { text-align: right; }
  .al-single { padding: 10px 0; border-bottom: 1px solid var(--gray-850); }
  .al-section { color: var(--gray-300); font-size: var(--sizes-text-font-size-xs); font-weight: var(--sizes-text-font-weight-medium); text-transform: uppercase; letter-spacing: 1px; padding-bottom: 6px; border-bottom: 1px solid var(--gray-800); }
  .al-hop { display: flex; align-items: center; gap: 6px; overflow-x: auto; padding: 8px 0; }
  .al-hop-node { flex: none; padding: 6px 8px; border: 1px solid var(--gray-700); border-radius: 6px; font-size: var(--sizes-text-font-size-xs); }
  .al-hop-arrow { flex: none; color: var(--gray-500); font-size: var(--sizes-text-font-size-xxs); }
  .al-badge { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: var(--sizes-text-font-size-xs); text-transform: uppercase; }
  .al-badge.is-ok { background: rgba(167, 255, 175, 0.12); color: var(--main-green); }
  .al-badge.is-pending { background: rgba(220, 187, 19, 0.12); color: var(--warning); }
  .al-history { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--gray-850); }
  .al-textarea textarea { height: 110px; }
  .al-backup textarea { height: 160px; font-size: 12px; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .al-select-toggle { border: 0; padding: 0; background: none; color: var(--gray-75); font: inherit; font-size: var(--sizes-text-font-size-xs); text-decoration: underline; cursor: pointer; }
  .al-vtxo { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--gray-850); }
  .al-vtxo .ss-checkbox { flex: 1; }
  .al-vtxo .ss-checkbox .ss-text.s-lg { font-size: var(--sizes-text-font-size-sm); }
  .al-vtxo-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  </style>`
)

// --- shared helpers ------------------------------------------------------------------

const alFmt = (n) => Number(n).toLocaleString('en-US')
const alUsd = (sats) => ((sats / SATS_PER_BTC) * USD_PER_BTC).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const alSats = () => t('bitcoin.sats')
const alTrunc = (v, n = 12) => (v.length > n * 2 + 3 ? `${v.slice(0, n)}…${v.slice(-n)}` : v)
const alWhen = (ms) => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const alHex = (seed, len = 64) => (typeof demoTxid === 'function' ? demoTxid(seed) : seed.padEnd(64, '0')).repeat(4).slice(0, len)

// SSPairedTabs: data-al-tab="<group>:<key>"
function alTabs(group, tabs, active) {
  return `<div class="al-tabs" role="tablist">${tabs
    .map(([key, label]) => `<button type="button" role="tab" class="al-tab${key === active ? ' is-on' : ''}" data-al-tab="${group}:${key}">${ss.esc(label)}</button>`)
    .join('')}</div>`
}

const alLabel = (text) => ss.text({ color: 'muted', size: 'xs', uppercase: true }, text)
const alBox = (text, mono) => `<div class="al-box">${ss.text({ size: 'sm', className: mono === false ? '' : 'al-mono' }, ss.esc(text))}</div>`

// SSShareableQR with an address box and Copy (ark/receive.tsx layout)
function alQrBlock(value, extra) {
  return `<div class="al-qr">${ss.qr({ value, size: 280 })}${alBox(value)}${extra || ''}${ss.clipboardCopy({ text: value }, ss.button({ label: t('common.copy'), variant: 'outline' }))}</div>`
}

// ArkInvoiceStats (pay-invoice.tsx)
function alInvoiceStats(amount, fee) {
  if (amount <= 0) return ''
  return ss.vstack({ gap: 'xs' },
    ss.hstack({ justifyBetween: true }, alLabel(t('ark.send.fee')), ss.text({ size: 'xs' }, `${alFmt(fee)} ${alSats()}`)),
    ss.hstack({ justifyBetween: true, style: 'align-items:flex-start' },
      alLabel(t('ark.send.total')),
      ss.vstack({ gap: 'none', style: 'align-items:flex-end' },
        ss.text({ size: 'xs' }, `${alFmt(amount + fee)} ${alSats()}`),
        ss.text({ size: 'xs', color: 'muted' }, `${alUsd(amount + fee)} USD`))))
}

// Re-render the current kit screen in place.
const alRefresh = () => openKitScreen(kitCurrent)

// Each registered screen gets one delegated click handler on its fresh body.
function alOn(body, map) {
  body.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-al-tab]')
    if (tab && map.tab) {
      const [group, key] = tab.dataset.alTab.split(':')
      return map.tab(group, key)
    }
    for (const [sel, fn] of Object.entries(map)) {
      if (sel === 'tab') continue
      const el = e.target.closest(sel)
      if (el) return fn(el, e)
    }
  })
}

function alBusy(button, done, ms = 900) {
  button.disabled = true
  button.innerHTML = '<span class="ss-spinner"></span>'
  setTimeout(done, ms)
}

// --- Ark fixtures -----------------------------------------------------------------------

const alArk = {
  account: { name: 'Spending', server: 'Second', network: 'signet', balance: 120000, pending: 4000 },
  address: 'tark1qp6ftv8ef7rzzlp3zmr2n7ktq7yv0w6l9xjunmlgh4d3qsjk8xhs6ux0kswcz5aw5v4r0hy7qnmqpqa5dr',
  onchainAddress: 'tb1pq8ark0board5lr6q2ym9w3gk3a3fu6nt8gj7wqsmh4csp9fvj4kq9u2e5c',
  addressIndex: 0,
  receiveTab: 'ark',
  invoice: null,
  invoiceAmount: 25000,
  invoiceDescription: '',
  sendDestination: '',
  draft: null,
  confirmAmount: '',
  comment: '',
  lnurlPhase: 'ready',
  lnurlAmount: '15000',
  movementId: 1,
  addr: null,
  labels: {},
  boardTab: 'address',
  boardAmount: 50000,
  pendingBoards: [{ vtxoId: 'b1', amountSats: 60000, txid: '9f2c7e41a0b6d8e3f15c2a7b9d4e6f0182c3a5b7d9e1f3a5c7e9b1d3f5a7c9e1' }],
  offboardAddress: '',
  offboardSelected: new Set(),
  create: { name: '', network: 'signet', server: 'second', bitcoin: 'spending', createBitcoin: false },
  vtxos: [
    { id: 'a1f3c9e0d2b4…:0', fullId: 'a1f3c9e0d2b4f6a8c0e2d4b6f8a0c2e4d6b8f0a2c4e6d8b0f2a4c6e8d0b2f4a6:0', amountSats: 80000, state: 'Spendable' },
    { id: 'c7e2a9b4f1d6…:1', fullId: 'c7e2a9b4f1d6e3c8a5b2f9d6e3c0a7b4f1d8e5c2a9b6f3d0e7c4a1b8f5d2e9c6:1', amountSats: 40000, state: 'Spendable' },
    { id: 'e5b8d1a4c7f0…:0', fullId: 'e5b8d1a4c7f0b3e6d9a2c5f8b1e4d7a0c3f6b9e2d5a8c1f4b7e0d3a6c9f2b5e8:0', amountSats: 4000, state: 'Pending' }
  ]
}

const alNow = Date.UTC(2026, 9, 20, 14)
const alMovements = [
  { id: 1, kind: 'receive', amount: 80000, status: 'successful', lightning: false, subsystem: ['arkoor', 'receive'], fee: 0, at: alNow - 864e5, txids: [], sent: [], received: ['tark1qreceive0demo00x4c8'], inputs: [], outputs: ['a1f3c9e0d2b4f6a8:0'], exited: [] },
  { id: 2, kind: 'send', amount: -20000, status: 'successful', lightning: true, subsystem: ['lightning', 'send'], fee: 120, at: alNow - 3 * 864e5, txids: [], sent: ['lnbc200u1pdemo0satsigner0invoice0kq'], received: [], inputs: ['b2c4d6e8f0a2:1'], outputs: ['c7e2a9b4f1d6:1'], exited: [] },
  { id: 3, kind: 'board', amount: 60000, status: 'pending', lightning: false, subsystem: ['board', 'onchain'], fee: 210, at: alNow - 2 * 36e5, txids: ['9f2c7e41a0b6d8e3f15c2a7b9d4e6f0182c3a5b7d9e1f3a5c7e9b1d3f5a7c9e1'], sent: [], received: [], inputs: [], outputs: ['e5b8d1a4c7f0:0'], exited: [] },
  { id: 4, kind: 'refresh', amount: 0, status: 'successful', lightning: false, subsystem: ['round', 'refresh'], fee: 420, at: alNow - 7 * 864e5, txids: [], sent: [], received: [], inputs: ['d1e3f5a7b9c1:0', 'f3a5b7c9d1e3:1'], outputs: ['a1f3c9e0d2b4:0'], exited: [] }
]

const alMovement = () => alMovements.find((m) => m.id === alArk.movementId) || alMovements[0]

function alOpenMovement(id) {
  alArk.movementId = id
  go('ark-movement')
}

function alOpenAddressLabel(addr) {
  alArk.addr = addr
  go('ark-address-label')
}

// SSArkMovementIcon (approximation): arrow in a ring, bolt badge for lightning.
function alMoveIcon(m) {
  const glyph = { receive: '↓', board: '↓', send: '↑', offboard: '↑', refresh: '↻' }[m.kind] || '·'
  return `<span class="al-move-icon is-${m.kind}">${glyph}${m.lightning ? `<span class="al-bolt">${ss.icon('lightning', { size: 12 })}</span>` : ''}</span>`
}

const alStatusColor = (s) => ({ pending: 'var(--warning)', successful: 'var(--soft-bar-green)', failed: 'var(--error)', canceled: 'var(--error)' })[s] || 'var(--gray-400)'

// MovementSummary (movement/[movementId]/index.tsx)
function alMovementSummary(m) {
  const type = m.kind === 'receive' || m.kind === 'board' ? 'receive' : 'send'
  return ss.vstack({ itemsCenter: true, gap: 'sm', style: 'padding-top:12px' },
    alMoveIcon(m),
    ss.hstack({ gap: 'xs', style: 'align-items:baseline' },
      m.kind === 'refresh' && m.amount === 0
        ? ss.text({ size: '2xl', weight: 'light', color: 'muted' }, t('ark.movement.refreshLabel'))
        : ss.amountDisplay({ amount: Math.abs(m.amount), textSize: '4xl', weight: 'ultralight', noColor: m.kind === 'refresh', type, showSign: false, unitSize: 'lg' })),
    m.amount !== 0 && m.kind !== 'refresh' ? ss.text({ color: 'muted' }, `${alUsd(Math.abs(m.amount))} USD`) : '',
    ss.text({ uppercase: true, size: 'xs', style: `color:${alStatusColor(m.status)}` }, t('ark.movement.status.' + m.status)))
}

// SSLabelInput, reusing the Bitcoin account kit helpers when they're loaded.
function alLabelEditor(key) {
  const cur = alArk.labels[key] || { label: '', tags: [] }
  if (typeof baLabelInput === 'function') return baLabelInput(cur.label, cur.tags)
  return ss.vstack({ gap: 'sm' },
    ss.text({ uppercase: true }, t('common.label')),
    ss.textInput({ align: 'left', multiline: true, value: cur.label, className: 'al-label-input' }),
    ss.button({ label: t('common.save'), variant: 'secondary', id: 'ba-save' }),
    ss.button({ label: t('common.cancel'), variant: 'ghost', id: 'ba-cancel' }))
}

function alBindLabelEditor(body, key, back) {
  const save = (v) => {
    alArk.labels[key] = v
    go(back)
  }
  if (typeof baBindLabelInput === 'function') return baBindLabelInput(body, save, () => go(back))
  body.querySelector('#ba-save').onclick = () => save({ label: body.querySelector('.al-label-input textarea').value.trim(), tags: [] })
  body.querySelector('#ba-cancel').onclick = () => go(back)
}

// --- Ark screens ------------------------------------------------------------------------

const AL_ARK = 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ark/'

// account/add/index.tsx
registerScreen('ark-add', {
  source: AL_ARK + 'account/add/index.tsx',
  title: () => t('ark.account.create'),
  back: 'ark',
  render: () => {
    const c = alArk.create
    const radio = (label, group, value, current) =>
      ss.radio({ label, group: 'al-' + group, selected: value === current, data: { 'al-pick': `${group}:${value}` } })
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t('ark.account.name')),
        ss.textInput({ value: c.name, placeholder: t('ark.account.namePlaceholder'), className: 'al-name', name: 'name' })),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t('ark.account.network')),
        ss.vstack({ gap: 'xs' }, radio(t('ark.network.bitcoin'), 'network', 'bitcoin', c.network), radio(t('ark.network.signet'), 'network', 'signet', c.network))),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t('ark.account.server')),
        ss.vstack({ gap: 'xs' }, radio('Second', 'server', 'second', c.server), radio('Ark Labs', 'server', 'arklabs', c.server))),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t('ark.account.bitcoinSource')),
        ss.text({ color: 'muted' }, t('ark.account.bitcoinSourceDescription')),
        ss.vstack({ gap: 'xs' },
          alLabel(t('ark.account.existingWallet')),
          accounts.filter((a) => !a.watchOnly).map((a) => radio(a.name, 'bitcoin', a.name.toLowerCase(), c.createBitcoin ? '' : c.bitcoin)).join('')),
        ss.radio({ label: t('ark.account.createBitcoinToggle'), selected: c.createBitcoin, data: { 'al-pick': 'createBitcoin:toggle' } })),
      ss.vstack({ gap: 'sm', style: 'padding-top:12px' },
        ss.button({ label: t('ark.account.create'), variant: 'gradient', id: 'al-create', disabled: !c.name.trim() }),
        ss.button({ label: t('common.back'), variant: 'subtle', go: 'ark' })))
  },
  bind: (body) => {
    const c = alArk.create
    const name = body.querySelector('.al-name input')
    name.addEventListener('input', () => {
      c.name = name.value
      body.querySelector('#al-create').disabled = !c.name.trim()
    })
    alOn(body, {
      '[data-al-pick]': (el) => {
        const [group, value] = el.dataset.alPick.split(':')
        if (group === 'createBitcoin') c.createBitcoin = !c.createBitcoin
        else {
          c[group] = value
          if (group === 'bitcoin') c.createBitcoin = false
        }
        alRefresh()
      },
      '#al-create': (el) =>
        alBusy(el, () => {
          alArk.account.name = c.name.trim() || alArk.account.name
          go('ark-account')
        }, 1200)
    })
  }
})

// receive.tsx (also account/[id]/receive.tsx, which re-exports it)
function alRenderReceive() {
  const tab = alArk.receiveTab
  let body = ''
  if (tab === 'ark') {
    body = ss.vstack({ gap: 'md' },
      alQrBlock(alArk.address),
      ss.button({ label: t('ark.receive.generateNewAddress'), variant: 'subtle', id: 'al-new-address' }))
  } else if (tab === 'lightning') {
    body = alArk.invoice
      ? ss.vstack({ gap: 'md' },
          alQrBlock(alArk.invoice.invoice, ss.text({ color: 'muted', center: true }, `${alFmt(alArk.invoice.amountSats)} ${alSats()}`)),
          ss.button({ label: t('ark.receive.newInvoice'), variant: 'subtle', id: 'al-new-invoice' }))
      : ss.vstack({ gap: 'md' },
          ss.vstack({ gap: 'xs' },
            alLabel(`${t('ark.receive.amount')} (${alSats()})`),
            ss.amountInput({ min: 546, max: 1000000, value: alArk.invoiceAmount })),
          ss.vstack({ gap: 'xs' },
            alLabel(t('ark.receive.description')),
            ss.textInput({ align: 'left', value: alArk.invoiceDescription, placeholder: t('ark.receive.descriptionPlaceholder'), className: 'al-desc' })),
          ss.button({ label: t('ark.receive.createInvoice'), variant: 'gradient', id: 'al-create-invoice' }))
  } else {
    body = ss.vstack({ gap: 'md' },
      ss.text({ color: 'muted', size: 'xs' }, t('ark.receive.onchain.description')),
      alQrBlock(alArk.onchainAddress),
      ss.text({ color: 'muted', size: 'xs', center: true }, t('ark.receive.onchain.minAmount', { amount: alFmt(20000), unit: alSats() })),
      ss.text({ color: 'muted', center: true }, t('ark.receive.onchain.waitingForFunds')),
      alArk.pendingBoards.length
        ? ss.vstack({ gap: 'xs' },
            alLabel(t('ark.board.pendingTitle')),
            ss.text({ color: 'muted', size: 'xs' }, t('ark.board.pendingConfirmations', { count: 2 })),
            alArk.pendingBoards.map((p) => `<div class="al-pending-row">${ss.text({}, `${alFmt(p.amountSats)} ${alSats()}`)}${ss.text({ color: 'muted', size: 'xs', className: 'al-mono' }, alTrunc(p.txid, 8))}</div>`).join(''))
        : '')
  }
  return ss.vstack({ gap: 'lg', className: 'al-pad' },
    alTabs('receive', [['ark', t('ark.receive.arkTab')], ['lightning', t('ark.receive.lightningTab')], ['onchain', t('ark.receive.onchainTab')]], tab),
    body)
}

function alBindReceive(body) {
  alOn(body, {
    tab: (group, key) => {
      alArk.receiveTab = key
      alRefresh()
    },
    '#al-new-address': (el) =>
      alBusy(el, () => {
        alArk.addressIndex += 1
        alArk.address = 'tark1q' + alHex('ark-address-' + alArk.addressIndex, 74)
        alRefresh()
      }, 600),
    '#al-create-invoice': (el) => {
      const amount = Number(body.querySelector('[data-ss-amount]').dataset.value || alArk.invoiceAmount)
      alArk.invoiceAmount = amount
      alArk.invoiceDescription = (body.querySelector('.al-desc input') || {}).value || ''
      alBusy(el, () => {
        alArk.invoice = { amountSats: amount, invoice: 'lntbs' + Math.round(amount / 100) + 'u1p' + alHex('ark-invoice-' + amount, 180) }
        alRefresh()
      })
    },
    '#al-new-invoice': () => {
      alArk.invoice = null
      alRefresh()
    }
  })
}

registerScreen('ark-receive', {
  source: AL_ARK + 'receive.tsx',
  title: () => t('ark.receive.title'),
  back: 'ark',
  render: alRenderReceive,
  bind: alBindReceive
})

registerScreen('ark-account-receive', {
  source: AL_ARK + 'account/[id]/receive.tsx',
  title: () => t('ark.receive.title'),
  back: 'ark-account',
  render: alRenderReceive,
  bind: alBindReceive
})

// account/[id]/receive-lnurl-withdraw.tsx
registerScreen('ark-receive-lnurl-withdraw', {
  source: AL_ARK + 'account/[id]/receive-lnurl-withdraw.tsx',
  title: () => t('ark.receive.lnurlWithdraw.title'),
  back: 'ark-account',
  render: () => {
    const phase = alArk.lnurlPhase
    const v = Number(alArk.lnurlAmount)
    const ok = v >= 1000 && v <= 50000
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      ss.vstack({ gap: 'xs' }, alLabel(t('ark.receive.lnurlWithdraw.service')), ss.text({}, 'faucet.mutinynet.com')),
      ss.vstack({ gap: 'xs' }, alLabel(t('ark.receive.lnurlWithdraw.description')), ss.text({}, 'Signet faucet withdrawal')),
      ss.vstack({ gap: 'xs' },
        alLabel(t('ark.receive.lnurlWithdraw.amount')),
        ss.text({ color: 'muted', size: 'xs' }, t('ark.receive.lnurlWithdraw.range', { min: alFmt(1000), max: alFmt(50000) })),
        ss.textInput({ align: 'left', value: alArk.lnurlAmount, placeholder: t('ark.receive.lnurlWithdraw.amountPlaceholder'), inputMode: 'numeric', readOnly: phase !== 'ready', className: 'al-lnurl-amount' })),
      phase === 'ready'
        ? ss.vstack({},
            ss.button({ label: t('ark.receive.lnurlWithdraw.confirm'), variant: 'secondary', id: 'al-lnurl-confirm', disabled: !ok }),
            ss.button({ label: t('ark.receive.lnurlWithdraw.cancel'), variant: 'ghost', go: 'ark-account' }))
        : phase === 'awaiting'
          ? ss.vstack({ itemsCenter: true },
              ss.orbitLoader({ size: 80 }),
              ss.text({ center: true }, t('ark.receive.lnurlWithdraw.awaiting')),
              ss.button({ label: t('ark.receive.lnurlWithdraw.cancel'), variant: 'ghost', id: 'al-lnurl-reset' }))
          : ss.vstack({ itemsCenter: true },
              ss.successCheck({ size: 120 }),
              ss.text({ center: true }, t('ark.receive.lnurlWithdraw.success')),
              ss.button({ label: t('common.close'), variant: 'secondary', id: 'al-lnurl-close' })))
  },
  bind: (body) => {
    const input = body.querySelector('.al-lnurl-amount input')
    input.addEventListener('input', () => {
      alArk.lnurlAmount = input.value.replace(/\D/g, '')
      const v = Number(alArk.lnurlAmount)
      const btn = body.querySelector('#al-lnurl-confirm')
      if (btn) btn.disabled = !(v >= 1000 && v <= 50000)
    })
    alOn(body, {
      '#al-lnurl-confirm': () => {
        alArk.lnurlPhase = 'awaiting'
        alRefresh()
        setTimeout(() => {
          if (kitCurrent !== 'ark-receive-lnurl-withdraw' || alArk.lnurlPhase !== 'awaiting') return
          alArk.lnurlPhase = 'success'
          alRefresh()
        }, 1800)
      },
      '#al-lnurl-reset': () => {
        alArk.lnurlPhase = 'ready'
        alRefresh()
      },
      '#al-lnurl-close': () => {
        alArk.lnurlPhase = 'ready'
        go('ark-account')
      }
    })
  }
})

// account/[id]/send/index.tsx
function alDetectDraft(text) {
  const v = text.trim()
  const low = v.toLowerCase()
  if (/^(lnbc|lntb|lntbs|lnbcrt)/.test(low)) return { kind: 'bolt11', invoice: v, amountSats: 21000, description: 'Coffee at the demo café' }
  if (/^lnurl/.test(low)) return { kind: 'lnurl', lnurl: v, min: 1000, max: 100000 }
  if (v.includes('@')) return { kind: 'lnaddress', address: v, min: 1000, max: 100000 }
  if (/^(bc1|tb1|2|3|m|n)/.test(low)) return { kind: 'onchain', address: v }
  return { kind: 'arkoor', address: v }
}

registerScreen('ark-send', {
  source: AL_ARK + 'account/[id]/send/index.tsx',
  title: () => t('ark.send.title'),
  back: 'ark-account',
  render: () =>
    ss.vstack({ gap: 'lg', className: 'al-pad' },
      ss.vstack({ gap: 'xs' },
        alLabel(t('ark.send.destination')),
        ss.textInput({ align: 'left', multiline: true, mono: true, value: alArk.sendDestination, placeholder: t('ark.send.destinationPlaceholder'), className: 'al-dest al-textarea' })),
      ss.hstack({ gap: 'sm' },
        ss.button({ label: t('ark.send.paste'), variant: 'subtle', style: 'flex:1', id: 'al-paste' }),
        ss.button({ label: t('ark.send.scan'), variant: 'subtle', style: 'flex:1', id: 'al-scan' })),
      ss.vstack({},
        ss.button({ label: t('common.continue'), variant: 'secondary', id: 'al-continue', disabled: !alArk.sendDestination.trim() }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'ark-account' }))),
  bind: (body) => {
    const area = body.querySelector('.al-dest textarea')
    const cont = body.querySelector('#al-continue')
    const set = (v) => {
      alArk.sendDestination = v
      area.value = v
      cont.disabled = !v.trim()
    }
    area.addEventListener('input', () => set(area.value))
    alOn(body, {
      '#al-paste': () => set('tark1qsend0demo4ld8n2x6e9m3w7c5v0p8k4j2h6g9f3d1s5a7q0z8x2c4v6b8n0m2l4k6j8h0g2f'),
      '#al-scan': () => set('lntbs210u1pdemo0satsigner0ark0invoice0x7k9m2p4q6r8s0t2v4w6y8z0a2c4e6g8j0l2n4p6'),
      '#al-continue': (el) =>
        alBusy(el, () => {
          alArk.draft = alDetectDraft(alArk.sendDestination)
          alArk.confirmAmount = ''
          alArk.comment = ''
          go('ark-send-confirm')
        }, 500)
    })
  }
})

// account/[id]/send/confirm.tsx
const AL_KIND_LABEL = { arkoor: 'ark.send.kind.arkoor', bolt11: 'ark.send.kind.bolt11', lnaddress: 'ark.send.kind.lnaddress', lnurl: 'ark.send.kind.lnurl', onchain: 'ark.send.kind.onchain' }

registerScreen('ark-send-confirm', {
  source: AL_ARK + 'account/[id]/send/confirm.tsx',
  title: () => t('ark.send.confirmTitle'),
  back: 'ark-send',
  render: () => {
    const d = alArk.draft || alDetectDraft('tark1qsend0demo4ld8n2x6e9m3w7c5v0p8k4j2h6g9f3d1s5a7q0z8x2c4v6b8n0m2l4k6j8h0g2f')
    alArk.draft = d
    const source = d.invoice || d.address || d.lnurl
    const editable = d.kind !== 'bolt11'
    const amount = editable ? Number(alArk.confirmAmount || 0) : d.amountSats
    const fee = amount > 0 ? (d.kind === 'onchain' ? 380 : d.kind === 'arkoor' ? 0 : Math.max(1, Math.round(amount * 0.004))) : 0
    const spendable = alArk.account.balance
    const exceeds = amount + fee > spendable
    const inRange = !(d.min !== undefined) || (amount >= d.min && amount <= d.max)
    const kindLabel = t(AL_KIND_LABEL[d.kind])
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      ss.vstack({ gap: 'xs' },
        alLabel(kindLabel),
        `<div class="al-box">${ss.clipboardCopy({ text: source }, ss.text({ size: 'sm', className: 'al-mono' }, ss.esc(d.kind === 'lnaddress' ? source : alTrunc(source, 16))))}</div>`),
      d.kind === 'bolt11' && d.description ? ss.vstack({ gap: 'xs' }, alLabel(t('common.description')), ss.text({}, ss.esc(d.description))) : '',
      ss.vstack({ gap: 'xs' },
        alLabel(`${t('ark.send.amount')} (${alSats()})`),
        d.min !== undefined ? ss.text({ color: 'muted', size: 'xs' }, t('ark.send.lnurlRange', { min: alFmt(d.min), max: alFmt(d.max) })) : '',
        editable
          ? ss.textInput({ align: 'left', value: alArk.confirmAmount ? alFmt(alArk.confirmAmount) : '', placeholder: '0', inputMode: 'numeric', className: 'al-amount' })
          : ss.text({ size: 'lg' }, alFmt(amount)),
        amount > 0 ? ss.text({ color: 'muted', size: 'xs' }, `${alUsd(amount)} USD`) : '',
        ss.text({ color: 'muted', size: 'xs' }, t('ark.send.spendable', { amount: alFmt(spendable), unit: alSats() })),
        exceeds ? ss.text({ size: 'xs', className: 'al-warn' }, t('ark.send.error.insufficientBalanceWithFee')) : '',
        !inRange && amount > 0 ? ss.text({ size: 'xs', className: 'al-warn' }, t('ark.send.error.amountOutOfRange', { min: alFmt(d.min), max: alFmt(d.max) })) : ''),
      alInvoiceStats(amount, fee),
      d.kind === 'lnurl' || d.kind === 'lnaddress'
        ? ss.vstack({ gap: 'xs' },
            alLabel(t('ark.send.comment')),
            ss.textInput({ align: 'left', value: alArk.comment, placeholder: t('ark.send.commentPlaceholder'), className: 'al-comment' }))
        : '',
      `<div class="al-actions">${ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'ark-account' })}${ss.button({
        label: t('ark.send.confirm'), variant: 'secondary', id: 'al-send-confirm', disabled: amount <= 0 || exceeds || !inRange
      })}</div>`)
  },
  bind: (body) => {
    const amount = body.querySelector('.al-amount input')
    if (amount)
      amount.addEventListener('change', () => {
        alArk.confirmAmount = amount.value.replace(/\D/g, '')
        alRefresh()
      })
    const comment = body.querySelector('.al-comment input')
    if (comment) comment.addEventListener('input', () => (alArk.comment = comment.value))
    alOn(body, {
      '#al-send-confirm': (el) =>
        alBusy(el, () => {
          const d = alArk.draft
          ss.toast(t(d.kind === 'arkoor' ? 'ark.send.success.arkoor' : d.kind === 'onchain' ? 'ark.send.success.onchain' : 'ark.send.success.lightning'), document.getElementById('view-kit'))
          setTimeout(() => go('ark-account'), 700)
        }, 1200)
    })
  }
})

// account/[id]/pay-invoice.tsx (opened from a scanned zap / invoice)
registerScreen('ark-pay-invoice', {
  source: AL_ARK + 'account/[id]/pay-invoice.tsx',
  title: () => t('ark.pay.title'),
  back: 'ark-account',
  render: () => {
    const invoice = 'lntbs50u1pdemo0zap0satsigner0nostr0note0q8w4e6r8t0y2u4i6o8p0a2s4d6f8g0h2j4k6l8z0x2c4v6b8n0m'
    const amount = 5000
    const fee = 20
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      ss.vstack({ gap: 'xs' },
        alLabel(t('ark.pay.zapLabel')),
        `<div class="al-box">${ss.clipboardCopy({ text: invoice }, ss.text({ size: 'sm', className: 'al-mono' }, alTrunc(invoice, 18)))}</div>`),
      ss.vstack({ gap: 'xs' },
        alLabel(`${t('ark.send.amount')} (${alSats()})`),
        ss.text({ size: 'lg' }, alFmt(amount)),
        ss.text({ color: 'muted', size: 'xs' }, `${alUsd(amount)} USD`),
        ss.text({ color: 'muted', size: 'xs' }, t('ark.send.spendable', { amount: alFmt(alArk.account.balance), unit: alSats() }))),
      alInvoiceStats(amount, fee),
      `<div class="al-actions">${ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'ark-account' })}${ss.button({ label: t('ark.pay.confirm'), variant: 'secondary', id: 'al-pay' })}</div>`)
  },
  bind: (body) =>
    alOn(body, {
      '#al-pay': (el) =>
        alBusy(el, () => {
          ss.toast(t('ark.send.success.lightning'), document.getElementById('view-kit'))
          setTimeout(() => go('ark-account'), 700)
        }, 1200)
    })
})

// account/[id]/movement/[movementId]/index.tsx
registerScreen('ark-movement', {
  source: AL_ARK + 'account/[id]/movement/[movementId]/index.tsx',
  title: () => t('ark.movement.detail.title'),
  back: 'ark-account',
  render: () => {
    const m = alMovement()
    const lab = alArk.labels['movement:' + m.id] || { label: '', tags: [] }
    const row = (label, value, style) => `<div class="al-row">${ss.text({ color: 'muted' }, label)}${ss.text({ style: style || '' }, value)}</div>`
    const list = (label, values) =>
      values.length ? ss.vstack({ gap: 'xs' }, ss.text({ color: 'muted' }, label), values.map((v) => alBox(v)).join('')) : ''
    const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${alFmt(Math.abs(n))} ${alSats()}`
    const labelDetails =
      typeof baLabelDetails === 'function'
        ? baLabelDetails(t('transaction.label'), lab.label, lab.tags, 'ark-movement-label')
        : ss.button({ label: lab.label || t('transaction.label'), variant: 'outline', go: 'ark-movement-label' })
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      alMovementSummary(m),
      labelDetails,
      m.txids.length ? ss.vstack({ gap: 'xs' }, ss.text({ color: 'muted' }, t('ark.movement.detail.txid')), m.txids.map((x) => ss.addressDisplay({ address: x, variant: 'outline', size: 'sm' })).join('')) : '',
      `<div>${[
        row(t('ark.movement.detail.kind'), t('ark.movement.kind.' + m.kind)),
        row(t('ark.movement.detail.status'), t('ark.movement.status.' + m.status), `color:${alStatusColor(m.status)}`),
        row(t('ark.movement.detail.subsystem'), m.subsystem.join(' · ')),
        row(t('ark.movement.detail.effectiveBalance'), signed(m.amount - (m.amount < 0 ? m.fee : 0))),
        row(t('ark.movement.detail.intendedBalance'), signed(m.amount)),
        m.fee > 0 ? row(t('ark.movement.detail.fee'), `${alFmt(m.fee)} ${alSats()}`) : '',
        row(t('ark.movement.detail.createdAt'), alWhen(m.at)),
        row(t('ark.movement.detail.updatedAt'), alWhen(m.at + 6e4)),
        m.status === 'successful' ? row(t('ark.movement.detail.completedAt'), alWhen(m.at + 12e4)) : ''
      ].join('')}</div>`,
      list(t('ark.movement.detail.addressesSent'), m.sent),
      list(t('ark.movement.detail.addressesReceived'), m.received),
      list(t('ark.movement.detail.inputVtxos'), m.inputs),
      list(t('ark.movement.detail.outputVtxos'), m.outputs),
      list(t('ark.movement.detail.exitedVtxos'), m.exited),
      ss.vstack({ gap: 'xs' }, ss.text({ color: 'muted' }, t('ark.movement.detail.metadata')), alBox(JSON.stringify({ round: 18342, vtxoExpiry: 912100 }, null, 2))))
  }
})

// account/[id]/movement/[movementId]/label.tsx
registerScreen('ark-movement-label', {
  source: AL_ARK + 'account/[id]/movement/[movementId]/label.tsx',
  title: () => t('transaction.edit.label.transaction'),
  back: 'ark-movement',
  render: () => ss.vstack({ gap: 'lg', className: 'al-pad' }, alMovementSummary(alMovement()), alLabelEditor('movement:' + alMovement().id)),
  bind: (body) => alBindLabelEditor(body, 'movement:' + alMovement().id, 'ark-movement')
})

// account/[id]/address/[addr]/label.tsx
registerScreen('ark-address-label', {
  source: AL_ARK + 'account/[id]/address/[addr]/label.tsx',
  title: () => t('address.label.title'),
  back: 'ark-account',
  render: () => {
    const addr = alArk.addr || alArk.address
    return ss.vstack({ gap: 'lg', className: 'al-pad' }, ss.addressDisplay({ address: addr }), alLabelEditor('address:' + addr))
  },
  bind: (body) => alBindLabelEditor(body, 'address:' + (alArk.addr || alArk.address), 'ark-account')
})

// account/[id]/settings/index.tsx
registerScreen('ark-settings', {
  source: AL_ARK + 'account/[id]/settings/index.tsx',
  title: () => alArk.account.name || t('navigation.item.ark'),
  back: 'ark-account',
  render: () =>
    `<div class="al-settings">${ss.vstack({ gap: 'none' },
      ss.settingsCard({ title: t('ark.refresh.allTitle'), description: t('ark.refresh.allDescription'), icon: ss.icon('arrowsClockwise', { size: 24 }), id: 'al-refresh-open' }),
      ss.settingsCard({ title: t('ark.board.allTitle'), description: t('ark.board.allDescription'), icon: ss.icon('boardCircle', { size: 24 }), go: 'ark-board' }),
      ss.settingsCard({ title: t('ark.offboard.allTitle'), description: t('ark.offboard.allDescription'), icon: ss.icon('offboardCircle', { size: 24 }), go: 'ark-offboard' }),
      ss.settingsCard({ title: t('ark.exit.allTitle'), description: t('ark.exit.allDescription'), icon: `<span style="color:var(--error);display:inline-flex">${ss.icon('signOut', { size: 24 })}</span>`, id: 'al-exit-open' }))}
      <div class="al-settings-actions">${ss.vstack({},
        ss.button({ label: t('ark.account.exportDb'), id: 'al-export-db' }),
        ss.button({ label: t('ark.account.deleteWalletAction'), variant: 'danger', id: 'al-delete-open' }))}</div></div>`,
  overlays: () => {
    const modal = (id, warn, title, copy, extra, action) =>
      ss.modal({ id, fullOpacity: true, label: t('common.cancel') },
        ss.vstack({ justifyBetween: true, widthFull: true, style: 'flex:1' },
          ss.vstack({ gap: 'lg', itemsCenter: true, style: 'margin:auto 0' },
            warn ? `<span style="color:${warn};display:inline-flex">${ss.icon('warning', { size: 20 })}</span>` : '',
            ss.text({ center: true, uppercase: true, size: 'md', weight: 'medium' }, title),
            ss.text({ center: true, color: 'muted' }, copy),
            extra || ''),
          action))
    return (
      modal('al-refresh-modal', '', t('ark.refresh.confirmTitle'), t('ark.refresh.confirmDescription', { count: alArk.vtxos.length }),
        ss.text({ color: 'muted' }, t('ark.refresh.feeLabel', { amount: alFmt(420), unit: alSats() })),
        ss.button({ label: t('ark.refresh.action'), variant: 'secondary', id: 'al-refresh-go' })) +
      modal('al-exit-modal', 'var(--error)', t('ark.exit.allConfirmTitle'), t('ark.exit.confirmDescription'),
        ss.vstack({ gap: 'xs', itemsCenter: true },
          ss.text({ color: 'muted' }, t('ark.exit.feeLabel', { amount: alFmt(1860), unit: alSats(), feeRate: 4 })),
          ss.text({ color: 'muted', size: 'xs', center: true }, t('ark.exit.feeHint'))),
        ss.button({ label: t('ark.exit.confirm'), variant: 'danger', id: 'al-exit-go' })) +
      modal('al-delete-modal', 'var(--gray-400)', t('ark.account.deleteWallet'), t('ark.account.deleteWalletWarning'), '',
        ss.button({ label: t('common.delete'), variant: 'danger', id: 'al-delete-go' }))
    )
  },
  bind: () => {
    const view = document.getElementById('view-kit')
    const done = (id, msg, then) => (el) =>
      alBusy(el, () => {
        ss.close(id)
        ss.toast(msg, view)
        if (then) setTimeout(then, 600)
      }, 1000)
    view.onclick = (e) => {
      if (kitCurrent !== 'ark-settings') return
      const hit = (sel) => e.target.closest(sel)
      if (hit('#al-refresh-open')) ss.open('al-refresh-modal')
      if (hit('#al-exit-open')) ss.open('al-exit-modal')
      if (hit('#al-delete-open')) ss.open('al-delete-modal')
      if (hit('#al-export-db')) ss.toast(t('ark.account.exportDb'), view)
      if (hit('#al-refresh-go')) done('al-refresh-modal', t('ark.refresh.action'))(hit('#al-refresh-go'))
      if (hit('#al-exit-go')) done('al-exit-modal', t('ark.exit.confirm'))(hit('#al-exit-go'))
      if (hit('#al-delete-go')) done('al-delete-modal', t('common.delete'), () => go('ark'))(hit('#al-delete-go'))
    }
  }
})

// account/[id]/settings/board.tsx
registerScreen('ark-board', {
  source: AL_ARK + 'account/[id]/settings/board.tsx',
  title: () => t('ark.board.title'),
  back: 'ark-settings',
  render: () => {
    const confirmed = 250000
    const linked = accounts[0]
    const tab = alArk.boardTab
    const fee = 210
    const deposit =
      tab === 'address'
        ? ss.vstack({ gap: 'sm' },
            ss.text({ color: 'muted', size: 'xs' }, t('ark.board.depositDescription')),
            `<div class="al-qr">${ss.qr({ value: alArk.onchainAddress, size: 240 })}${ss.text({ size: 'sm', className: 'al-mono', style: 'word-break:break-all;text-align:center' }, alArk.onchainAddress)}<div class="al-actions" style="width:100%">${ss.clipboardCopy(
              { text: alArk.onchainAddress },
              ss.button({ label: t('common.copy'), variant: 'outline' })
            )}${ss.button({ label: t('common.share'), variant: 'outline', data: { 'ss-copy': alArk.onchainAddress } })}</div></div>`,
            ss.button({ label: t('ark.board.fundFromLinked', { name: linked.name }), variant: 'subtle', id: 'al-fund-linked' }))
        : ss.vstack({ gap: 'sm' },
            `<div class="al-qr">${ss.qr({ value: 'bitcoin:' + alArk.onchainAddress + '?pj=https://payjo.in/ark', size: 240 })}</div>`,
            ss.hstack({ gap: 'sm', style: 'justify-content:center' }, ss.orbitLoader({ size: 24 }), ss.text({ color: 'muted', center: true }, t('ark.board.payjoinWaiting'))))
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      ss.text({ color: 'muted', size: 'xs' }, tab === 'payjoin' ? t('ark.board.payjoinDescription') : t('ark.board.description')),
      ss.hstack({ justifyBetween: true, style: 'align-items:flex-start' },
        ss.vstack({ gap: 'xs' },
          alLabel(t('ark.board.onchainBalance')),
          ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ size: '2xl' }, alFmt(confirmed)), ss.text({ color: 'muted' }, alSats())),
          ss.text({ color: 'muted', size: 'xs' }, t('ark.board.balancePendingHint', { amount: alFmt(30000), unit: alSats() }))),
        ss.vstack({ gap: 'xs', style: 'align-items:flex-end' },
          alLabel(t('ark.board.linkedWallet', { name: linked.name })),
          ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ size: '2xl' }, alFmt(linked.balance)), ss.text({ color: 'muted' }, alSats())))),
      ss.text({ color: 'muted', size: 'xs' }, t('ark.board.onchainBalanceHint')),
      alTabs('board', [['address', t('ark.board.addressTab')], ['payjoin', t('ark.board.payjoinTab')]], tab),
      deposit,
      tab === 'address'
        ? ss.vstack({ gap: 'xs' },
            alLabel(t('ark.board.amount')),
            ss.text({ color: 'muted', size: 'xs' }, t('ark.board.minAmount', { amount: alFmt(20000), unit: alSats() })),
            ss.amountInput({ min: 20000, max: confirmed, value: alArk.boardAmount }),
            ss.hstack({ justifyBetween: true }, alLabel(t('ark.board.fee')), ss.text({ size: 'xs' }, `${alFmt(fee)} ${alSats()}`)))
        : '',
      alArk.pendingBoards.length
        ? ss.vstack({ gap: 'xs' },
            alLabel(t('ark.board.pendingTitle')),
            ss.text({ color: 'muted', size: 'xs' }, t('ark.board.pendingConfirmations', { count: 2 })),
            alArk.pendingBoards.map((p) => `<div class="al-pending-row">${ss.text({}, `${alFmt(p.amountSats)} ${alSats()}`)}${ss.text({ color: 'muted', size: 'xs', className: 'al-mono' }, alTrunc(p.txid, 8))}</div>`).join(''))
        : '',
      tab === 'address'
        ? `<div class="al-actions">${ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'ark-settings' })}${ss.button({ label: t('ark.board.confirm'), variant: 'secondary', id: 'al-board-go' })}</div>`
        : '')
  },
  bind: (body) =>
    alOn(body, {
      tab: (group, key) => {
        alArk.boardTab = key
        alRefresh()
      },
      '#al-fund-linked': () => ss.toast(t('ark.board.fundFromLinked', { name: accounts[0].name }), document.getElementById('view-kit')),
      '#al-board-go': (el) => {
        const v = Number(body.querySelector('[data-ss-amount]').dataset.value || alArk.boardAmount)
        alBusy(el, () => {
          alArk.pendingBoards.unshift({ vtxoId: 'b' + Date.now(), amountSats: v, txid: alHex('board-' + v + Date.now()) })
          ss.toast(t('ark.board.confirm'), document.getElementById('view-kit'))
          setTimeout(() => go('ark-account'), 700)
        }, 1200)
      }
    })
})

// account/[id]/settings/offboard.tsx
registerScreen('ark-offboard', {
  source: AL_ARK + 'account/[id]/settings/offboard.tsx',
  title: () => t('ark.offboard.title'),
  back: 'ark-settings',
  render: () => {
    const sel = alArk.offboardSelected
    const addr = alArk.offboardAddress
    const valid = /^(tb1|bc1)[a-z0-9]{20,}$/i.test(addr.trim())
    const selected = alArk.vtxos.filter((v) => sel.has(v.fullId))
    const total = selected.reduce((s, v) => s + v.amountSats, 0)
    const fee = 380
    const feeExceeds = selected.length > 0 && fee >= total
    const all = sel.size === alArk.vtxos.length
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      ss.text({ color: 'muted', size: 'xs' }, t('ark.offboard.description')),
      ss.vstack({ gap: 'xs' },
        alLabel(t('ark.offboard.address')),
        ss.textInput({ align: 'left', multiline: true, mono: true, value: addr, className: 'al-off-addr' }),
        ss.hstack({ gap: 'sm' },
          ss.button({ label: t('ark.send.paste'), variant: 'subtle', style: 'flex:1', id: 'al-off-paste' }),
          ss.button({ label: t('ark.send.scan'), variant: 'subtle', style: 'flex:1', id: 'al-off-paste' })),
        addr && !valid ? ss.text({ size: 'xs', className: 'al-warn' }, t('ark.offboard.error.invalidAddress')) : ''),
      ss.vstack({ gap: 'xs' },
        ss.hstack({ justifyBetween: true },
          alLabel(t('ark.offboard.vtxos')),
          `<button type="button" class="al-select-toggle" id="al-off-all">${all ? t('ark.offboard.clearAll') : t('ark.offboard.selectAll')}</button>`),
        alArk.vtxos
          .map((v) => `<div class="al-vtxo">${ss.checkbox({ label: `${alFmt(v.amountSats)} ${alSats()}`, description: `${alUsd(v.amountSats)} USD`, selected: sel.has(v.fullId), data: { vtxo: v.fullId } })}<div class="al-vtxo-meta">${ss.text({ color: 'muted', size: 'xs' }, v.state)}${ss.text({ color: 'muted', size: 'xs' }, v.id)}</div></div>`)
          .join('')),
      selected.length
        ? ss.vstack({ gap: 'xs' },
            ss.text({ color: 'muted', size: 'xs' }, t('ark.offboard.selectedSummary', { count: selected.length, amount: alFmt(total), unit: alSats() })),
            valid ? ss.hstack({ justifyBetween: true }, alLabel(t('ark.offboard.fee')), ss.text({ size: 'xs', className: feeExceeds ? 'al-warn' : '' }, `${alFmt(fee)} ${alSats()}`)) : '',
            valid && feeExceeds ? ss.text({ size: 'xs', className: 'al-warn' }, t('ark.offboard.error.feeExceedsAmount')) : '')
        : '',
      `<div class="al-actions">${ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'ark-settings' })}${ss.button({
        label: t('ark.offboard.confirm'), variant: 'secondary', id: 'al-off-go', disabled: !valid || !selected.length || feeExceeds
      })}</div>`)
  },
  bind: (body) => {
    const area = body.querySelector('.al-off-addr textarea')
    area.addEventListener('change', () => {
      alArk.offboardAddress = area.value.trim()
      alRefresh()
    })
    alOn(body, {
      '#al-off-paste': () => {
        alArk.offboardAddress = 'tb1qoffboard0demo8x4k2m6n9p3r5t7v0w2y4z6a8c'
        alRefresh()
      },
      '#al-off-all': () => {
        const sel = alArk.offboardSelected
        if (sel.size === alArk.vtxos.length) sel.clear()
        else alArk.vtxos.forEach((v) => sel.add(v.fullId))
        alRefresh()
      },
      '[data-vtxo]': (el) => {
        const id = el.dataset.vtxo
        const sel = alArk.offboardSelected
        if (sel.has(id)) sel.delete(id)
        else sel.add(id)
        alRefresh()
      },
      '#al-off-go': (el) =>
        alBusy(el, () => {
          alArk.offboardSelected.clear()
          ss.toast(t('ark.offboard.confirm'), document.getElementById('view-kit'))
          setTimeout(() => go('ark-account'), 700)
        }, 1200)
    })
  }
})

// --- Lightning fixtures -----------------------------------------------------------------

const alLn = {
  node: {
    alias: 'satshop',
    pubkey: '02ab4f1c9d3e7a6b5c8d2e0f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9c91e',
    url: 'https://satshop.local:8080',
    version: '0.18.4-beta commit=v0.18.4-beta',
    blockHeight: 892417,
    blockHash: '00000000000000000001b6f3a2c4e8d1f9a7b5c3e1d9f7a5b3c1e9d7f5a3b1c9',
    commitHash: 'a1c3e5f7b9d1c3e5f7a9b1d3e5f7c9a1b3d5e7f9',
    chains: 'bitcoin (signet)',
    onchain: 200000,
    uris: ['02ab4f1c9d3e7a6b5c8d2e0f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9c91e@satshop.onion:9735']
  },
  channels: [
    { id: '881253x1022x1', alias: 'alice', remote: '03aa7c2e9f1b4d6a8c0e2f4b6d8a0c2e4f6b8d0a2c4e6f8b0d2a4c6e8f0b2d491e', capacity: 2000000, local: 1400000, remoteBal: 600000, active: true, private: false, initiator: true, point: 'f1e2d3c4b5a69788f1e2d3c4b5a69788f1e2d3c4b5a69788f1e2d3c4b5a69788:0' },
    { id: '879904x2201x0', alias: 'bob', remote: '02bb4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2c4', capacity: 3000000, local: 1800000, remoteBal: 1200000, active: true, private: true, initiator: false, point: 'a9b8c7d6e5f40312a9b8c7d6e5f40312a9b8c7d6e5f40312a9b8c7d6e5f40312:1' }
  ],
  channelIndex: 0,
  txs: [
    { id: 'inv1', type: 'receive', amount: 50000, status: 'settled', at: alNow - 2 * 36e5, description: 'Sticker pack' },
    { id: 'pay1', type: 'send', amount: -12000, fee: 3, status: 'succeeded', at: alNow - 864e5, description: 'Coffee' },
    { id: 'chain1', type: 'onchain', amount: 2000000, status: 'confirmed', at: alNow - 3 * 864e5, description: 'Channel open' }
  ],
  txIndex: 1,
  invoiceTab: 'lightning',
  invoice: null,
  payTab: 'lightning',
  payRequest: '',
  backup: { connection: true, node: true, channels: true, data: '' },
  open: { step: 'form', peer: '', amount: 500000, push: '0', private: false, fee: '', minConfs: '1' },
  peers: [
    { label: 'alice', uri: '03aa7c2e9f1b4d6a8c0e2f4b6d8a0c2e4f6b8d0a2c4e6f8b0d2a4c6e8f0b2d491e@alice.onion:9735' },
    { label: 'bob', uri: '02bb4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2c4@203.0.113.7:9735' },
    { label: 'carol', uri: '03cc9e1a3c5e7a9c1e3a5c7e9a1c3e5a7c9e1a3c5e7a9c1e3a5c7e9a1c3e5a7c9@carol.onion:9735' }
  ]
}

const alChannel = () => alLn.channels[alLn.channelIndex] || alLn.channels[0]
const alTx = () => alLn.txs[alLn.txIndex] || alLn.txs[0]

function alOpenChannel(index) {
  alLn.channelIndex = index
  go('lightning-channel')
}

function alOpenTx(index) {
  alLn.txIndex = index
  go('lightning-transaction')
}

// SSLightningChannelLiquidityBar
function alLiquidity(local, remote, capacity, nodeTotal) {
  const pct = (v) => `${Math.max(0, (v / nodeTotal) * 100)}%`
  return ss.vstack({ gap: 'xs' },
    ss.hstack({ justifyBetween: true },
      ss.text({ color: 'muted', size: 'xs', weight: 'medium' }, t('lightning.node.channelLiquidityTotals')),
      ss.hstack({ gap: 'none' },
        ss.text({ weight: 'medium' }, alFmt(capacity)),
        ss.text({ color: 'muted', weight: 'medium' }, ' / '),
        ss.text({ color: 'muted', weight: 'medium' }, alFmt(nodeTotal)))),
    `<div class="al-liq-track"><i style="width:${pct(local)};background:var(--white)"></i><i style="width:${pct(remote)};background:var(--gray-200)"></i></div>`,
    ss.hstack({ justifyBetween: true },
      ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ weight: 'medium' }, alFmt(local)), ss.text({ color: 'muted', size: 'xxs', weight: 'medium' }, 'LOCAL')),
      ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ color: 'muted', size: 'xxs', weight: 'medium' }, 'REMOTE'), ss.text({ weight: 'medium' }, alFmt(remote)))))
}

// --- Lightning screens --------------------------------------------------------------------

const AL_LN = 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/lightning/'

// invoice.tsx
registerScreen('lightning-invoice', {
  source: AL_LN + 'invoice.tsx',
  title: () => t('lightning.invoice.title'),
  back: 'lightning-node',
  render: () => {
    const tab = alLn.invoiceTab
    const inv = alLn.invoice
    const body =
      tab === 'lightning'
        ? ss.vstack({ gap: 'md' },
            ss.text({ uppercase: true }, t('lightning.invoice.amountWithUnit', { unit: t('common.sats') })),
            ss.textInput({ align: 'left', value: inv ? alFmt(inv.amount) : '', placeholder: t('lightning.invoice.amountPlaceholderSats'), inputMode: 'numeric', className: 'al-inv-amount' }),
            ss.text({ color: 'muted', className: 'al-inv-fiat', style: 'text-decoration:underline' }, `≈ ${inv ? alUsd(inv.amount) : '0'} USD`),
            ss.text({ uppercase: true }, t('lightning.invoice.description')),
            ss.textInput({ align: 'left', multiline: true, value: inv ? inv.description : '', placeholder: t('lightning.invoice.descriptionPlaceholder'), className: 'al-inv-desc al-textarea' }),
            ss.hstack({ gap: 'sm' },
              ss.button({ label: t('common.paste'), variant: 'outline', style: 'flex:1', id: 'al-inv-paste' }),
              ss.button({ label: t('lightning.invoice.scanQr'), variant: 'outline', style: 'flex:1', id: 'al-inv-paste' })),
            ss.button({ label: t('lightning.invoice.createInvoice'), variant: 'secondary', id: 'al-inv-create' }),
            ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'lightning-node' }))
        : ss.vstack({ gap: 'md' },
            alQrBlock('tb1q' + alHex('ln-onchain', 38)),
            ss.button({ label: t('lightning.invoice.generateNewAddress'), variant: 'subtle', id: 'al-inv-newaddr' }))
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      alTabs('invoice', [['lightning', t('lightning.invoice.lightningTab')], ['onchain', t('lightning.invoice.onchainTab')]], tab),
      body)
  },
  overlays: () => {
    const inv = alLn.invoice
    if (!inv) return ss.modal({ id: 'al-inv-modal', fullOpacity: true }, '')
    return ss.modal({ id: 'al-inv-modal', fullOpacity: true, label: t('common.close') },
      ss.vstack({ gap: 'lg', widthFull: true, style: 'overflow:auto' },
        ss.text({ uppercase: true, center: true }, t('lightning.invoice.paymentDetails')),
        `<div>${[
          [t('lightning.amount'), ss.vstack({ gap: 'none', style: 'align-items:flex-end' }, ss.text({ weight: 'medium' }, `${alFmt(inv.amount)} sats`), ss.text({ color: 'muted' }, `≈ ${alUsd(inv.amount)} USD`))],
          [t('lightning.invoice.description'), ss.text({}, ss.esc(inv.description || '—'))],
          [t('lightning.invoice.status'), ss.text({ color: inv.paid ? 'white' : 'muted', className: 'al-inv-status' }, inv.paid ? t('lightning.invoice.paid') : t('lightning.invoice.waiting'))]
        ].map(([k, v]) => `<div class="al-row">${ss.text({ color: 'muted' }, k)}${v}</div>`).join('')}</div>`,
        `<div class="al-qr">${ss.qr({ value: inv.request, size: 240 })}${ss.text({ color: 'muted', uppercase: true }, t('lightning.invoice.paymentRequest'))}${alBox(inv.request)}${ss.clipboardCopy(
          { text: inv.request },
          ss.button({ label: t('common.copyToClipboard'), variant: 'gradient' })
        )}</div>`))
  },
  bind: (body) => {
    alOn(body, {
      tab: (group, key) => {
        alLn.invoiceTab = key
        alRefresh()
      },
      '#al-inv-paste': () => {
        body.querySelector('.al-inv-amount input').value = '21,000'
        body.querySelector('.al-inv-desc textarea').value = 'Studio demo invoice'
      },
      '#al-inv-newaddr': (el) => alBusy(el, alRefresh, 600),
      '#al-inv-create': (el) => {
        const amount = Number(body.querySelector('.al-inv-amount input').value.replace(/\D/g, '')) || 21000
        const description = body.querySelector('.al-inv-desc textarea').value.trim()
        alBusy(el, () => {
          alLn.invoice = { amount, description, paid: false, request: 'lntbs' + Math.round(amount / 100) + 'u1p' + alHex('ln-invoice-' + amount, 200) }
          alRefresh()
          ss.open('al-inv-modal')
          setTimeout(() => {
            if (kitCurrent !== 'lightning-invoice' || !alLn.invoice) return
            alLn.invoice.paid = true
            const status = document.querySelector('#al-inv-modal .al-inv-status')
            if (status) {
              status.textContent = t('lightning.invoice.paid')
              status.classList.remove('is-muted')
            }
          }, 3500)
        }, 800)
      }
    })
  }
})

// pay.tsx
registerScreen('lightning-pay', {
  source: AL_LN + 'pay.tsx',
  title: () => t('lightning.pay.title'),
  back: 'lightning-node',
  render: () => {
    const tab = alLn.payTab
    const req = alLn.payRequest
    const decoded = /^ln/i.test(req.trim())
    const body =
      tab === 'lightning'
        ? ss.vstack({ gap: 'md' },
            ss.textInput({ align: 'left', multiline: true, mono: true, value: req, placeholder: t('lightning.pay.enterPaymentRequest'), className: 'al-pay-req al-textarea' }),
            ss.hstack({ gap: 'sm' },
              ss.button({ label: t('common.paste'), variant: 'subtle', style: 'flex:1', id: 'al-pay-paste' }),
              ss.button({ label: t('lightning.invoice.scanQr'), variant: 'subtle', style: 'flex:1', id: 'al-pay-paste' })),
            decoded
              ? ss.detailsList({ columns: 2, items: [[t('lightning.amount'), '21,000 sats'], ['USD', alUsd(21000)], [t('lightning.invoice.description'), 'Coffee at the demo café', { width: '100%' }], ['Payment hash', alTrunc(alHex('ln-pay-hash'), 10), { width: '100%', variant: 'mono' }]] })
              : '',
            ss.button({ label: t('lightning.pay.sendPayment'), variant: 'secondary', id: 'al-pay-send', disabled: !decoded }),
            ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'lightning-node' }))
        : ss.vstack({ gap: 'md' },
            ss.vstack({ gap: 'xs' }, ss.text({ color: 'muted' }, t('lightning.pay.confirmedBalance')), ss.styledSat({ amount: alLn.node.onchain, textSize: 'xl' })),
            ss.form({},
              ss.form.item({},
                ss.textInput({ align: 'left', placeholder: t('lightning.pay.addressPlaceholder'), className: 'al-pay-addr' }),
                ss.hstack({ gap: 'sm' },
                  ss.button({ label: t('common.paste'), variant: 'subtle', style: 'flex:1', id: 'al-pay-addr-paste' }),
                  ss.button({ label: t('lightning.invoice.scanQr'), variant: 'subtle', style: 'flex:1', id: 'al-pay-addr-paste' }))),
              ss.form.item({}, ss.form.label({ label: t('lightning.pay.amount') }), ss.amountInput({ min: 546, max: alLn.node.onchain, value: 50000, remainingSats: alLn.node.onchain })),
              ss.form.item({}, ss.form.label({ label: t('lightning.pay.feeRate') }), ss.textInput({ align: 'left', value: '4', inputMode: 'numeric', size: 'small' }))),
            ss.button({ label: t('lightning.pay.onchainSend'), variant: 'secondary', id: 'al-pay-onchain' }),
            ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'lightning-node' }))
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      alTabs('pay', [['lightning', t('lightning.pay.lightningTab')], ['onchain', t('lightning.pay.onchainTab')]], tab),
      body)
  },
  bind: (body) => {
    const area = body.querySelector('.al-pay-req textarea')
    if (area)
      area.addEventListener('change', () => {
        alLn.payRequest = area.value
        alRefresh()
      })
    const sent = (el) =>
      alBusy(el, () => {
        ss.toast(t('lightning.pay.sendPayment'), document.getElementById('view-kit'))
        alLn.payRequest = ''
        setTimeout(() => go('lightning-node'), 700)
      }, 1200)
    alOn(body, {
      tab: (group, key) => {
        alLn.payTab = key
        alRefresh()
      },
      '#al-pay-paste': () => {
        alLn.payRequest = 'lntbs210u1pdemo0satsigner0lightning0pay0r7t9y2u4i6o8p0a2s4d6f8g0h2j4k6l8z0x2c4v'
        alRefresh()
      },
      '#al-pay-addr-paste': () => (body.querySelector('.al-pay-addr input').value = 'tb1qonchain0demo4ld8n2x6e9m3w7c5v0p8k4j2'),
      '#al-pay-send': sent,
      '#al-pay-onchain': sent
    })
  }
})

// node/backup.tsx
registerScreen('lightning-backup', {
  source: AL_LN + 'node/backup.tsx',
  title: () => t('lightning.backup.title'),
  back: 'lightning-node-settings',
  render: () => {
    const b = alLn.backup
    const row = (k, v, mono) => ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted', style: 'flex:1' }, `${k}:`), ss.text({ weight: 'medium', type: mono ? 'mono' : undefined }, v))
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true }, t('lightning.backup.title')), ss.text({ color: 'muted' }, t('lightning.backup.description'))),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t('lightning.backup.nodeSummary')),
        row(t('lightning.backup.alias'), alLn.node.alias),
        row(t('lightning.nodeSettings.url'), alLn.node.url, true),
        row(t('lightning.nodeSettings.channels'), String(alLn.channels.length))),
      ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true }, t('lightning.backup.warning')), ss.text({ color: 'muted' }, t('lightning.backup.warningText'))),
      ss.vstack({ gap: 'md' },
        ss.text({ uppercase: true }, t('lightning.backup.backupOptions')),
        ss.checkbox({ label: t('lightning.backup.includeConnection'), selected: b.connection, data: { opt: 'connection' } }),
        ss.checkbox({ label: t('lightning.backup.includeNodeInformation'), selected: b.node, data: { opt: 'node' } }),
        ss.checkbox({ label: t('lightning.backup.includeChannels'), selected: b.channels, data: { opt: 'channels' } })),
      ss.button({ label: t('lightning.backup.generateBackup'), variant: 'gradient', id: 'al-backup-go' }),
      b.data
        ? ss.vstack({ gap: 'sm' },
            ss.text({ uppercase: true }, t('lightning.backup.backupData')),
            ss.text({ color: 'muted' }, t('lightning.backup.backupInstructions')),
            ss.textInput({ align: 'left', multiline: true, value: b.data, readOnly: true, className: 'al-backup' }),
            ss.hstack({ gap: 'sm' },
              ss.button({ label: t('common.share'), variant: 'outline', style: 'flex:1', data: { 'ss-copy': b.data } }),
              ss.button({ label: t('common.close'), variant: 'ghost', style: 'flex:1', id: 'al-backup-close' })))
        : '')
  },
  bind: (body) =>
    alOn(body, {
      '[data-opt]': (el) => (alLn.backup[el.dataset.opt] = el.classList.contains('is-on')),
      '#al-backup-go': (el) =>
        alBusy(el, () => {
          const b = alLn.backup
          const out = { version: 1, createdAt: new Date(alNow).toISOString() }
          if (b.connection) out.connection = { url: alLn.node.url, macaroon: '0201036c6e64…demo', cert: '-----BEGIN CERTIFICATE-----…' }
          if (b.node) out.node = { alias: alLn.node.alias, pubkey: alLn.node.pubkey, version: alLn.node.version }
          if (b.channels) out.channels = alLn.channels.map((c) => ({ chanId: c.id, point: c.point, capacity: c.capacity }))
          b.data = JSON.stringify(out, null, 2)
          alRefresh()
        }, 800),
      '#al-backup-close': () => {
        alLn.backup.data = ''
        alRefresh()
      }
    })
})

// node/channel/[chanId].tsx
registerScreen('lightning-channel', {
  source: AL_LN + 'node/channel/[chanId].tsx',
  title: () => alChannel().alias,
  back: 'lightning-node',
  render: () => {
    const c = alChannel()
    const nodeTotal = alLn.channels.reduce((s, x) => s + x.capacity, 0)
    const L = (k) => t('lightning.channelDetail.' + k)
    const yes = (v) => (v ? t('common.yes') : t('common.no'))
    const values = {
      peerAlias: c.alias, initiator: yes(c.initiator), active: yes(c.active), private: yes(c.private),
      remotePubkey: c.remote, channelPoint: c.point, chanId: c.id, capacity: alFmt(c.capacity),
      localBalance: alFmt(c.local), remoteBalance: alFmt(c.remoteBal), unsettledBalance: '0', commitFee: '2,810',
      commitWeight: '1,116', feePerKw: '2,500', csvDelay: '144', chanStatusFlags: 'ChanStatusDefault',
      commitmentType: 'ANCHORS', staticRemoteKey: yes(true), localChanReserveSat: alFmt(c.capacity / 100),
      remoteChanReserveSat: alFmt(c.capacity / 100), totalSatoshisSent: '312,000', totalSatoshisReceived: '488,000',
      numUpdates: '1,284', lifetime: '41d 6h', uptime: '40d 22h', closeAddress: '—', pushAmountSat: '0', thawHeight: '0',
      localConstraintsJson: '{"csv_delay":144,"max_accepted_htlcs":483}', remoteConstraintsJson: '{"csv_delay":144,"max_accepted_htlcs":483}', pendingHtlcs: '0'
    }
    const mono = new Set(['remotePubkey', 'channelPoint', 'chanId', 'closeAddress', 'localConstraintsJson', 'remoteConstraintsJson'])
    const pairs = [['peerAlias', 'initiator'], ['active', 'private'], ['capacity', 'localBalance'], ['remoteBalance', 'unsettledBalance'], ['commitFee', 'commitWeight'], ['feePerKw', 'csvDelay'], ['localChanReserveSat', 'remoteChanReserveSat'], ['totalSatoshisSent', 'totalSatoshisReceived'], ['numUpdates', 'pendingHtlcs'], ['lifetime', 'uptime'], ['pushAmountSat', 'thawHeight']]
    const paired = new Set(pairs.flat())
    const order = Object.keys(values)
    const items = []
    for (const k of order) {
      const p = pairs.find((x) => x[0] === k)
      if (p) items.push(p)
      else if (!paired.has(k)) items.push([k])
    }
    const val = (k) => ss.text({ size: 'sm', type: mono.has(k) ? 'mono' : undefined, style: 'word-break:break-all' }, ss.esc(values[k]))
    const rows = items
      .map((it) => {
        const html =
          it.length === 2
            ? `<div class="al-pair">${ss.text({ color: 'muted', size: 'xs' }, L(it[0]))}${ss.text({ color: 'muted', size: 'xs' }, L(it[1]))}${val(it[0])}${val(it[1])}</div>`
            : `<div class="al-single">${ss.text({ color: 'muted', size: 'xs' }, L(it[0]))}${val(it[0])}</div>`
        const actions =
          it[0] === 'active'
            ? `<div style="padding:16px 0">${ss.vstack({ gap: 'md' },
                ss.clipboardCopy({ text: c.point }, ss.button({ label: L('copyChannelPoint') })),
                ss.button({ label: L('openFundingTx'), go: 'explorer-transaction-detail' }),
                ss.button({ label: L('exportScbButton'), id: 'al-scb' }),
                ss.button({ label: L('closeCooperativeButton'), id: 'al-close-coop' }),
                ss.button({ label: L('forceCloseButton'), variant: 'danger', id: 'al-close-force' }))}</div>`
            : ''
        return html + actions
      })
      .join('')
    const history = [
      ['historyForward', 1800, 2, alNow - 5 * 36e5],
      ['historyPaymentOut', -12000, 3, alNow - 864e5],
      ['historyForward', 4200, 4, alNow - 2 * 864e5]
    ]
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      alLiquidity(c.local, c.remoteBal, c.capacity, nodeTotal),
      `<div>${rows}</div>`,
      ss.vstack({ gap: 'none' },
        ss.text({ color: 'muted' }, L('historyTitle')),
        history
          .map(([k, amt, fee, at]) => `<div class="al-history">${ss.vstack({ gap: 'none' }, ss.styledSat({ amount: Math.abs(amt), textSize: 'md', noColor: false, type: amt < 0 ? 'send' : 'receive', showSign: false }), ss.text({ color: 'muted', size: 'xs' }, alWhen(at)))}${ss.vstack({ gap: 'none', style: 'align-items:flex-end' }, ss.text({ size: 'xs', style: `color:${amt < 0 ? 'var(--main-red)' : 'var(--main-green)'}` }, L(k)), ss.text({ color: 'muted', size: 'xxs' }, `${L('historyFee')}: ${fee}`))}</div>`)
          .join('')))
  },
  bind: (body) => {
    const view = document.getElementById('view-kit')
    alOn(body, {
      '#al-scb': () => ss.toast(t('lightning.channelDetail.exportScbButton'), view),
      '#al-close-coop': (el) => alBusy(el, () => (ss.toast(t('lightning.channelDetail.closeCooperativeButton'), view), alRefresh()), 1000),
      '#al-close-force': (el) => alBusy(el, () => (ss.toast(t('lightning.channelDetail.forceCloseButton'), view), alRefresh()), 1000)
    })
  }
})

// node/open-channel.tsx
registerScreen('lightning-open-channel', {
  source: AL_LN + 'node/open-channel.tsx',
  title: () => (alLn.open.step === 'review' ? t('lightning.openChannel.reviewTitle') : t('lightning.openChannel.title')),
  back: 'lightning-node',
  render: () => {
    const o = alLn.open
    const confirmed = alLn.node.onchain * 10
    if (o.step === 'review') {
      const row = (label, value) => ss.vstack({ gap: 'xs', style: 'padding:10px 0;border-bottom:1px solid var(--gray-850)' }, ss.text({ color: 'muted' }, label), value)
      return ss.vstack({ justifyBetween: true, className: 'al-pad' },
        `<div>${[
          row(t('lightning.openChannel.peer'), ss.text({ type: 'mono', style: 'word-break:break-all' }, ss.esc(o.peer))),
          row(t('lightning.openChannel.localAmount'), ss.styledSat({ amount: o.amount, textSize: 'xl', noColor: false, type: 'send', showSign: false })),
          row(t('lightning.openChannel.push'), ss.styledSat({ amount: Number(o.push) || 0, textSize: 'lg' })),
          row(t('lightning.openChannel.private'), ss.text({}, o.private ? t('lightning.openChannel.privateYes') : t('lightning.openChannel.privateNo'))),
          row(t('lightning.openChannel.feeRate'), ss.text({ type: 'mono' }, o.fee.trim() || t('lightning.openChannel.feeDefault'))),
          row(t('lightning.openChannel.minConfs'), ss.text({ type: 'mono' }, o.minConfs))
        ].join('')}</div>`,
        ss.vstack({},
          ss.button({ label: t('lightning.openChannel.confirm'), variant: 'gradient', id: 'al-open-confirm' }),
          ss.button({ label: t('lightning.openChannel.backToForm'), variant: 'ghost', id: 'al-open-back' })))
    }
    return ss.vstack({ gap: 'lg', className: 'al-pad' },
      ss.form({},
        ss.form.item({},
          ss.form.label({ label: t('lightning.openChannel.peer') }),
          ss.textInput({ variant: 'outline', align: 'left', value: o.peer, placeholder: t('lightning.openChannel.peerPlaceholder'), className: 'al-open-peer' }),
          ss.button({ label: t('lightning.openChannel.scanQr'), variant: 'subtle', id: 'al-open-scan' })),
        ss.form.item({},
          ss.form.label({ label: t('lightning.openChannel.peersTitle') }),
          `<div>${alLn.peers.map((p) => `<button type="button" class="al-chip" data-peer="${ss.esc(p.uri)}">${ss.esc(p.label)}</button>`).join('')}</div>`),
        ss.form.item({}, ss.form.label({ label: t('lightning.openChannel.confirmedBalance') }), ss.styledSat({ amount: confirmed, textSize: 'xl' })),
        ss.form.item({}, ss.amountInput({ min: 20000, max: confirmed, value: o.amount, remainingSats: confirmed })),
        ss.form.item({}, ss.form.label({ label: t('lightning.openChannel.push') }), ss.textInput({ align: 'left', size: 'small', value: o.push, inputMode: 'numeric', className: 'al-open-push' })),
        ss.checkbox({ label: t('lightning.openChannel.private'), selected: o.private, id: 'al-open-private' }),
        ss.form.item({}, ss.form.label({ label: t('lightning.openChannel.feeRate') }), ss.textInput({ align: 'left', size: 'small', value: o.fee, inputMode: 'numeric', className: 'al-open-fee' })),
        ss.form.item({}, ss.form.label({ label: t('lightning.openChannel.minConfs') }), ss.textInput({ align: 'left', size: 'small', value: o.minConfs, inputMode: 'numeric', className: 'al-open-confs' }))),
      ss.button({ label: t('common.continue'), id: 'al-open-continue' }))
  },
  bind: (body) => {
    const o = alLn.open
    const read = () => {
      const q = (c) => body.querySelector(c)
      if (!q('.al-open-peer')) return
      o.peer = q('.al-open-peer input').value.trim()
      o.push = q('.al-open-push input').value.replace(/\D/g, '') || '0'
      o.fee = q('.al-open-fee input').value.replace(/[^\d.]/g, '')
      o.minConfs = q('.al-open-confs input').value.replace(/\D/g, '') || '0'
      o.private = q('#al-open-private').classList.contains('is-on')
      o.amount = Number(q('[data-ss-amount]').dataset.value || o.amount)
    }
    const view = document.getElementById('view-kit')
    alOn(body, {
      '[data-peer]': (el) => (body.querySelector('.al-open-peer input').value = el.dataset.peer),
      '#al-open-scan': () => (body.querySelector('.al-open-peer input').value = alLn.peers[2].uri),
      '#al-open-continue': () => {
        read()
        if (!/^0[23][0-9a-f]{64}@/i.test(o.peer)) return ss.toast(t('lightning.openChannel.invalidPeer'), view)
        if (Number(o.push) > o.amount) return ss.toast(t('lightning.openChannel.invalidPush'), view)
        o.step = 'review'
        alRefresh()
      },
      '#al-open-back': () => {
        o.step = 'form'
        alRefresh()
      },
      '#al-open-confirm': (el) =>
        alBusy(el, () => {
          ss.toast(t('lightning.openChannel.success'), view)
          o.step = 'form'
          setTimeout(() => go('lightning-node'), 700)
        }, 1400)
    })
    // Back from review returns to the form, like the app's custom header back.
    if (o.step === 'review') document.getElementById('kit-back').onclick = () => ((o.step = 'form'), alRefresh())
  }
})

// node/settings.tsx
registerScreen('lightning-node-settings', {
  source: AL_LN + 'node/settings.tsx',
  title: () => t('lightning.nodeSettings.title', { alias: alLn.node.alias }),
  back: 'lightning-node',
  render: () => {
    const n = alLn.node
    const L = (k) => t('lightning.nodeSettings.' + k)
    const section = (k) => ss.text({ color: 'muted', style: 'margin-top:8px' }, L(k))
    const row = (k, v) => `<div class="al-row">${ss.text({ color: 'muted' }, L(k))}${v}</div>`
    const copy = (v) => ss.clipboardCopy({ text: v }, ss.text({ size: 'xs', type: 'mono' }, alTrunc(v, 10)))
    const peers = alLn.peers
      .map((p) => ss.vstack({ gap: 'xs', style: 'padding:10px 0;border-bottom:1px solid var(--gray-850)' },
        ss.text({ weight: 'medium' }, p.label),
        ss.text({ color: 'muted', size: 'xxs' }, L('peerAddress')),
        ss.text({ size: 'xs', type: 'mono' }, p.uri.split('@')[1]),
        copy(p.uri.split('@')[0]),
        ss.button({ label: L('openChannel'), variant: 'outline', data: { 'al-peer-open': p.uri } })))
      .join('')
    return ss.vstack({ gap: 'md', className: 'al-pad' },
      section('nodeInformation'),
      `<div>${[
        row('version', ss.text({}, n.version.split(' ')[0])),
        row('channels', ss.text({}, String(alLn.channels.length))),
        row('peers', ss.text({}, String(alLn.peers.length))),
        row('chainSync', ss.text({}, L('synced'))),
        row('blockHeight', ss.text({}, alFmt(n.blockHeight))),
        row('blockHash', copy(n.blockHash)),
        row('identityPubkey', copy(n.pubkey)),
        row('commitHash', copy(n.commitHash)),
        row('chains', ss.text({}, n.chains))
      ].join('')}</div>`,
      ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted' }, L('lastSync')), ss.text({ color: 'muted', size: 'xs' }, alWhen(alNow - 6e4))),
      section('connectionStatus'),
      row('status', ss.text({}, L('connected'))),
      section('peersTitle'),
      `<div>${peers}</div>`,
      section('pendingChannelsTitle'),
      ss.text({ color: 'muted', size: 'xs' }, L('pendingEmpty')),
      section('backupNodeTitle'),
      ss.text({ color: 'muted', size: 'xs' }, L('backupNodeBlurb')),
      ss.button({ label: L('backupNode'), variant: 'outline', go: 'lightning-backup' }),
      section('channelBackupTitle'),
      ss.text({ color: 'muted', size: 'xs' }, L('channelBackupBlurb')),
      ss.button({ label: L('exportChannelBackup'), variant: 'outline', id: 'al-ns-scb' }),
      section('nodeConfiguration'),
      `<div>${[row('url', ss.text({}, n.url)), row('macaroon', ss.text({}, '0201036c6e64…demo')), row('certificate', ss.text({}, L('notSet')))].join('')}</div>`,
      ss.button({ label: L('disconnectNode'), variant: 'outline', id: 'al-ns-disconnect' }),
      ss.button({ label: L('clearConfig'), variant: 'danger', id: 'al-ns-clear' }))
  },
  overlays: () =>
    ss.modal({ id: 'al-ns-clear-modal', fullOpacity: true, label: t('common.cancel') },
      ss.vstack({ justifyBetween: true, widthFull: true, style: 'flex:1' },
        ss.vstack({ gap: 'lg', itemsCenter: true, style: 'margin:auto 0' },
          `<span style="color:var(--error);display:inline-flex">${ss.icon('warning', { size: 24 })}</span>`,
          ss.text({ center: true, size: 'lg', uppercase: true }, t('lightning.nodeSettings.clearConfig'))),
        ss.button({ label: t('lightning.nodeSettings.clearConfig'), variant: 'danger', id: 'al-ns-clear-go' }))),
  bind: (body) => {
    const view = document.getElementById('view-kit')
    alOn(body, {
      '[data-al-peer-open]': (el) => {
        alLn.open = { ...alLn.open, step: 'form', peer: el.dataset.alPeerOpen }
        go('lightning-open-channel')
      },
      '#al-ns-scb': () => ss.toast(t('lightning.nodeSettings.exportChannelBackup'), view),
      '#al-ns-disconnect': () => {
        ss.toast(t('lightning.nodeSettings.disconnected'), view)
        setTimeout(() => go('lightning'), 600)
      },
      '#al-ns-clear': () => ss.open('al-ns-clear-modal')
    })
    view.onclick = (e) => {
      if (kitCurrent !== 'lightning-node-settings' || !e.target.closest('#al-ns-clear-go')) return
      ss.close('al-ns-clear-modal')
      go('lightning')
    }
  }
})

// node/transaction/[txId].tsx
registerScreen('lightning-transaction', {
  source: AL_LN + 'node/transaction/[txId].tsx',
  title: () => t('lightning.node.txDetail.type.' + alTx().type),
  back: 'lightning-node',
  render: () => {
    const tx = alTx()
    const L = (k, vars) => t('lightning.node.txDetail.' + k, vars)
    const section = (k) => `<p class="al-section">${L('section.' + k)}</p>`
    const color = tx.amount > 0 ? 'var(--main-green)' : 'var(--white)'
    const ok = tx.status !== 'pending'
    const hero = ss.vstack({ gap: 'none', style: 'padding-top:12px' },
      ss.hstack({ justifyBetween: true, style: 'align-items:flex-start' },
        `<span class="al-badge ${ok ? 'is-ok' : 'is-pending'}">${ss.esc(tx.status)}</span>`,
        ss.vstack({ gap: 'none', style: 'align-items:flex-end' },
          ss.text({ color: 'muted', size: 'xs', style: 'opacity:0.55' }, alWhen(tx.at)),
          ss.text({ color: 'muted', size: 'xs' }, tx.at > alNow - 864e5 ? 'today' : `${Math.round((alNow - tx.at) / 864e5)}d ago`))),
      ss.hstack({ gap: 'xs', style: 'align-items:baseline;margin-top:16px' },
        ss.text({ size: '4xl', weight: 'ultralight', style: `color:${color};letter-spacing:-1px` }, `${tx.amount > 0 ? '+' : '−'}${alFmt(Math.abs(tx.amount))}`),
        ss.text({ style: 'color:var(--gray-500)' }, alSats().toLowerCase())),
      ss.hstack({ gap: 'xs' }, ss.text({ color: 'muted' }, alUsd(Math.abs(tx.amount))), ss.text({ style: 'color:var(--gray-700)' }, 'USD')),
      tx.description ? ss.text({ color: 'muted', style: 'margin-top:10px' }, ss.esc(tx.description)) : '')
    let detail = ''
    if (tx.type === 'send') {
      const hops = [['satshop', 0], ['alice', 1], ['coffee-node', 2]]
      detail =
        section('routeMap') +
        `<div class="al-hop"><span class="al-hop-node">${L('sender')}</span>${hops.map(([a, i]) => `<span class="al-hop-arrow">→</span><span class="al-hop-node">${a}<br><small style="color:var(--gray-300)">${L('hop', { index: i + 1 })}</small></span>`).join('')}</div>` +
        section('payment') +
        ss.detailsList({ columns: 1, variant: 'mono', items: [[L('paymentHash'), alHex('ln-pay-hash')], [L('preimage'), alHex('ln-preimage')]] }) +
        ss.detailsList({ columns: 2, gap: 16, items: [[L('valueSat'), alFmt(12000)], [L('valueMsat'), alFmt(12000000)], [L('feeSat'), '3'], [L('feeMsat'), '3,120'], [L('created'), alWhen(tx.at)], [L('htlcs'), '1']] }) +
        section('route') +
        hops
          .map(([a, i]) => ss.vstack({ gap: 'xs', style: 'padding:10px 0;border-bottom:1px solid var(--gray-850)' },
            ss.text({ size: 'xs', weight: 'medium' }, `${L('hop', { index: i + 1 })} · ${a}`),
            ss.detailsList({ columns: 2, items: [[L('pubKey'), alTrunc(alHex('hop' + a), 6), { variant: 'mono' }], [L('chanId'), `88${1253 + i}x1022x1`], [L('amtForwardSat'), alFmt(12000 + (2 - i))], [L('feeSat'), i < 2 ? '1' : '0']] })))
          .join('')
    } else if (tx.type === 'receive') {
      detail =
        section('invoice') +
        ss.detailsList({ columns: 1, variant: 'mono', items: [[L('rHash'), alHex('ln-rhash')], [L('paymentAddr'), alHex('ln-addr')], [L('paymentRequest'), 'lntbs500u1p' + alHex('ln-req', 90)]] }) +
        ss.detailsList({ columns: 2, gap: 16, items: [[L('valueSat'), alFmt(50000)], [L('valueMsat'), alFmt(50000000)], [L('amtPaidSat'), alFmt(50000)], [L('amtPaidMsat'), alFmt(50000000)], [L('created'), alWhen(tx.at)], [L('settled'), alWhen(tx.at + 9e4)], [L('expiry'), '86400'], [L('cltvExpiry'), '80'], [L('addIndex'), '42']] })
    } else {
      detail =
        section('transaction') +
        ss.detailsList({ columns: 1, variant: 'mono', items: [[L('txHash'), alHex('ln-chain-tx')], [L('blockHash'), alLn.node.blockHash]] }) +
        ss.detailsList({ columns: 2, gap: 16, items: [[L('confirmations'), '412'], [L('blockHeight'), alFmt(alLn.node.blockHeight - 411)], [L('totalFees'), '1,240']] }) +
        ss.vstack({ gap: 'xs' }, ss.text({ size: 'xs', color: 'muted', uppercase: true }, L('destAddresses')), ss.detailsList({ columns: 1, variant: 'mono', items: [['', 'tb1q' + alHex('ln-dest', 38)]] })) +
        ss.detailsList({ columns: 1, variant: 'mono', items: [[L('rawTx'), '02000000000101' + alHex('ln-raw', 120) + '…']] })
    }
    return ss.vstack({ gap: 'xl', className: 'al-pad' }, hero, ss.vstack({ gap: 'md' }, detail))
  }
})

// Expose openers for wiring from the hand-ported views.
window.alOpenMovement = alOpenMovement
window.alOpenAddressLabel = alOpenAddressLabel
window.alOpenChannel = alOpenChannel
window.alOpenTx = alOpenTx
