/* Hub screens re-ported with the ss.* kit, replacing the hand-made sections in index.html.
   Same ids as the legacy views (ark, ark-account, lightning, lightning-node, lightning-rest,
   lightning-rpc, ecash, ecash-account, ecash-add, ecash-send, ecash-receive, nostr,
   nostr-account, nostr-relays, nostr-add). go() checks kitScreens first, so these win.
   Fixture state is shared with screens/ark-lightning.js (alArk, alMovements, alLn),
   screens/ecash-shell.js (esState) and screens/nostr.js (noState, noMe). */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  /* Full-width hub bodies: the kit body has side padding, hubs manage their own. */
  #kit-body:has(.lh-flush) { padding: 0; }
  .lh-pad { padding: 0 var(--layout-main-container-padding-horizontal); }
  .lh-header-action { display: flex; align-items: center; justify-content: flex-end; gap: 4px; grid-column: 3; }
  .lh-header-action button { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 32px; border: 0; padding: 0; background: none; color: var(--gray-200); cursor: pointer; }

  /* SSButtonActionsGroup — components/SSButtonActionsGroup.tsx */
  .lh-actions { display: flex; width: 100%; }
  .lh-act { position: relative; box-sizing: border-box; height: var(--sizes-action-button-height); border: 1px solid var(--gray-950); border-top: 0; border-radius: 4px; overflow: hidden; background: var(--gray-925); color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-sm); text-transform: uppercase; cursor: pointer; }
  .lh-act::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: linear-gradient(90deg, var(--lh-a, var(--gray-700)), var(--lh-b, var(--gray-700))); }
  .lh-act:active { opacity: 0.65; }
  .lh-act.is-wide { width: 25.25%; }
  .lh-act.is-narrow { width: 16.5%; }
  .lh-act.is-cwide { width: 40%; }
  .lh-act.is-cnarrow { width: 20%; }
  .lh-act .ss-icon { margin: 0 auto; }

  /* Count tabs (ark / lightning / ecash account TabView bars) */
  .lh-tabs { display: flex; padding: 8px 5% 0; border-bottom: 1px solid var(--gray-800); }
  .lh-tab { position: relative; flex: 1; height: var(--sizes-action-button-height); border: 0; background: none; color: var(--white); font: inherit; cursor: pointer; }
  .lh-tab .ss-text { line-height: 1.25; }
  .lh-tab .lh-tab-label { line-height: 12px; }
  .lh-tab.is-on::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--white); }
  .lh-tab:active { opacity: 0.65; }
  .lh-net-tabs { display: flex; border-bottom: 1px solid var(--gray-800); }
  .lh-net-tab { position: relative; width: 50%; height: 48px; border: 0; background: none; color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-sm); letter-spacing: 3px; text-transform: uppercase; cursor: pointer; }
  .lh-net-tab.is-on::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: var(--white); }

  /* SSAccountCard */
  .lh-account-card { display: flex; justify-content: space-between; align-items: center; width: 100%; border: 0; padding: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lh-account-card:active { opacity: 0.5; }

  /* Rows */
  .lh-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; width: 100%; box-sizing: border-box; border: 0; padding: 4px 0 10px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lh-row:active { opacity: 0.7; }
  .lh-sep { height: 1px; background: var(--gray-800); transform: scaleY(0.5); }
  .lh-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 16px var(--layout-main-container-padding-horizontal); }
  .lh-icon-btn { display: inline-flex; align-items: center; justify-content: center; border: 0; padding: 4px; background: none; color: var(--white); cursor: pointer; }
  .lh-muted-link { border: 0; padding: 0; background: none; color: var(--gray-75); font: inherit; font-size: var(--sizes-text-font-size-xs); text-decoration: underline; text-transform: uppercase; cursor: pointer; }
  .lh-empty { padding-top: 32px; text-align: center; }
  .lh-move-icon { flex: none; display: inline-flex; }
  /* SSArkMovementCard ICON_SIZE = 18: shrink the shared movement icon for list rows */
  .lh-move-icon .al-move-icon { width: 18px; height: 18px; font-size: 11px; font-weight: 400; }
  .lh-move-icon .al-move-icon .al-bolt { right: -6px; bottom: -6px; width: 12px; height: 12px; padding: 1px; }

  /* SSArkVtxoCard */
  .lh-vtxo { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; width: 100%; padding: 10px 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lh-vtxo.is-locked { opacity: 0.5; cursor: default; }
  .lh-check { flex: none; align-self: center; width: 18px; height: 18px; box-sizing: border-box; border: 2px solid transparent; border-radius: 4px; background: var(--gray-700); position: relative; }
  .lh-check.is-on { border-color: var(--white); }
  .lh-check.is-on::after { content: ""; position: absolute; left: 50%; top: 45%; width: 4px; height: 8px; border: solid var(--white); border-width: 0 2px 2px 0; transform: translate(-50%, -50%) rotate(45deg); }
  .lh-selection { position: sticky; bottom: 0; display: flex; align-items: center; gap: 8px; padding: 12px var(--layout-main-container-padding-horizontal) 20px; border-top: 1px solid var(--gray-800); background: var(--gray-950); }
  .lh-selection button { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; border: 0; padding: 0 6px; background: none; color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-xxs); text-transform: uppercase; cursor: pointer; }
  .lh-selection button.is-danger { color: var(--error); }

  /* Lightning cards (lightning/index.tsx card, node channel cards) */
  .lh-ln-card { display: block; width: 100%; box-sizing: border-box; margin-top: 24px; border: 1px solid var(--gray-700); border-radius: 3px; background: var(--gray-875); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.35); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: transform 120ms; }
  .lh-ln-card:active { border-color: var(--gray-500); opacity: 0.92; transform: scale(0.992); }
  .lh-ln-card-content { display: flex; flex-direction: column; gap: 14px; padding: 18px; }
  .lh-pill { padding: 5px 10px; border-radius: 3px; background: var(--gray-700); }
  .lh-pill.is-off { background: var(--gray-800); }
  .lh-bar { display: flex; height: 12px; box-sizing: border-box; border: 1px solid var(--gray-800); border-radius: 3px; overflow: hidden; background: var(--gray-900); }
  .lh-bar i { min-width: 4px; }
  .lh-stats { display: flex; border: 1px solid var(--gray-600); border-radius: 3px; background: var(--gray-800); }
  .lh-stat { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 64px; padding: 10px 6px; }
  .lh-stat + .lh-stat { border-left: 0.5px solid var(--gray-600); }
  .lh-channel { display: block; width: 100%; box-sizing: border-box; border: 1px solid var(--gray-700); border-radius: 3px; background: var(--gray-875); color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lh-channel.is-inactive { opacity: 0.6; }
  .lh-channel:active { opacity: 0.9; }
  .lh-tx { display: block; width: 100%; box-sizing: border-box; padding: 12px 0; border: 0; border-bottom: 1px solid var(--gray-850); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lh-tx:active { opacity: 0.7; }
  .lh-badge { flex: none; margin-left: auto; padding: 2px 5px; border: 1px solid var(--gray-600); border-radius: 3px; background: var(--gray-850); }
  .lh-hero-cols { display: flex; align-items: flex-start; gap: 16px; }
  .lh-hero-side { flex: 0.2; display: flex; flex-direction: column; align-items: center; padding-top: 14px; }
  .lh-hero-main { flex: 0.6; display: flex; flex-direction: column; align-items: center; }
  .lh-textarea { box-sizing: border-box; width: 100%; height: 100px; padding: 12px; border: 1px solid #333; border-radius: 3px; background: #1a1a1a; color: #fff; font: inherit; resize: none; outline: none; }
  .lh-textarea::placeholder { color: #666; }

  /* eCash account card — ecash/index.tsx EcashAccountCard */
  .lh-ecash-card { position: relative; display: block; width: 100%; box-sizing: border-box; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: var(--sizes-button-border-radius); overflow: hidden; background: linear-gradient(180deg, var(--gray-905), var(--gray-925)); color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lh-ecash-card::before { content: ""; position: absolute; inset: 0; background: linear-gradient(160deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0) 52%, rgba(255, 255, 255, 0.012)); pointer-events: none; }
  .lh-ecash-card:active { opacity: 0.88; }
  .lh-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--gray-900); border: 1px solid var(--gray-600); }
  .lh-dot.is-on { background: var(--main-green); border-color: var(--main-green); }
  .lh-proof { display: block; width: 100%; box-sizing: border-box; padding: 12px 0; border: 0; border-bottom: 1px solid var(--gray-850); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lh-proof .ss-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lh-word-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .lh-word { display: flex; align-items: baseline; gap: 6px; padding: 10px; border-radius: 3px; background: var(--gray-850); }

  /* SSNostrAccountCard */
  .lh-nostr-card { position: relative; display: block; width: 100%; box-sizing: border-box; padding: 14px 14px 12px; border: 0; border-top: 1px solid var(--gray-800); border-radius: var(--sizes-button-border-radius); overflow: hidden; background: var(--gray-925); color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lh-nostr-card.is-active { border: 1px solid rgba(255, 255, 255, 0.14); background: linear-gradient(185deg, var(--gray-875), var(--gray-925)); box-shadow: 0 0 14px rgba(255, 255, 255, 0.05); }
  .lh-nostr-badges { position: absolute; top: 10px; right: 14px; display: flex; align-items: center; gap: 8px; }
  .lh-active-tag { padding: 3px 6px; border: 0.5px solid rgba(255, 255, 255, 0.07); border-radius: 4px; background: rgba(255, 255, 255, 0.03); }
  .lh-nostr-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
  .lh-relay-addon { flex: none; padding: 14px 7px; border-radius: 2px; background: var(--bar-gray); }
  .lh-relay-row { display: flex; align-items: center; gap: 8px; text-align: left; }
  .lh-relay-row .ss-checkbox { width: auto; flex: none; }
  .lh-relay-row .ss-vstack { align-items: flex-start; }
  .lh-relay-row[hidden] { display: none; }
  </style>`
)

// --- shared ---------------------------------------------------------------------------------

const LH_SRC = 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/'
const lhFmt = (n) => Number(n).toLocaleString('en-US')
const lhUsd = (sats) => ((sats / SATS_PER_BTC) * USD_PER_BTC).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const lhView = () => document.getElementById('view-kit')
const lhToast = (msg) => ss.toast(msg, lhView())

function lhAgo(ms) {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

// Header-right icons. openKitScreen() only knows the settings gear, so hubs add their own
// action next to it and hide the gear; the wrapper below removes them on the next screen.
function lhHeaderAction(...buttons) {
  const header = document.querySelector('#view-kit .stack-header')
  const gear = header.querySelector('[data-settings]')
  if (gear) gear.hidden = true
  header.insertAdjacentHTML('beforeend', `<div class="lh-header-action">${buttons.join('')}</div>`)
}
const lhHeaderBtn = (label, iconHtml, attrs) => `<button type="button" aria-label="${ss.esc(label)}" ${attrs}>${iconHtml}</button>`
const lhOpenKitScreenOriginal = openKitScreen
// eslint-disable-next-line no-global-assign
openKitScreen = function (id) {
  document.querySelectorAll('#view-kit .lh-header-action').forEach((n) => n.remove())
  return lhOpenKitScreenOriginal(id)
}

// SSButtonActionsGroup. Full: send, paste, camera, nfc, receive. Compact: send, camera, receive.
function lhActions(compact) {
  const btn = (act, cls, a, b, body) => `<button type="button" class="lh-act ${cls}" style="--lh-a:var(--gray-${a});--lh-b:var(--gray-${b})" data-lh-act="${act}">${body}</button>`
  if (compact)
    return `<div class="lh-actions">${
      btn('send', 'is-cwide', 880, 700, 'Send') + btn('camera', 'is-cnarrow', 700, 700, ss.icon('camera', { width: 18, height: 13 })) + btn('receive', 'is-cwide', 700, 880, 'Receive')
    }</div>`
  return `<div class="lh-actions">${
    btn('send', 'is-wide', 880, 700, 'Send') +
    btn('paste', 'is-narrow', 850, 700, ss.icon('pasteClipboard', { width: 18, height: 16 })) +
    btn('camera', 'is-narrow', 700, 700, ss.icon('camera', { width: 18, height: 13 })) +
    btn('nfc', 'is-narrow', 700, 850, ss.text({ as: 'span', size: 'xs' }, 'NFC')) +
    btn('receive', 'is-wide', 700, 880, 'Receive')
  }</div>`
}

function lhBindActions(body, handlers) {
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lh-act]')
    if (!b) return
    const fn = handlers[b.dataset.lhAct]
    if (typeof fn === 'function') fn()
    else if (typeof fn === 'string') go(fn)
    else lhToast(b.dataset.lhAct === 'nfc' ? 'NFC reading is not available in the demo' : t('common.paste'))
  })
}

// TabView count bars: [{ count, label }]
function lhTabs(items, active, attr) {
  return `<div class="lh-tabs">${items
    .map(
      (it, i) =>
        `<button type="button" class="lh-tab${i === active ? ' is-on' : ''}" data-${attr}="${i}">${ss.text({ center: true, size: 'lg' }, String(it.count))}${ss.text(
          { center: true, color: 'muted', className: 'lh-tab-label' },
          ss.esc(it.label)
        )}</button>`
    )
    .join('')}</div>`
}

// SSAccountCard
function lhAccountCard(p) {
  return `<button type="button" class="lh-account-card" ${p.attrs || ''}>${ss.vstack({ gap: 'xxs' },
    ss.text({ size: 'lg', color: 'muted' }, ss.esc(p.name)),
    ss.vstack({ gap: 'none' },
      ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.amountDisplay({ amount: p.balance, textSize: '3xl', weight: 'light', unitSize: 'xl' })),
      ss.hstack({ gap: 'xs', style: 'align-items:baseline;margin-top:-4px' }, ss.text({ color: 'muted' }, lhUsd(p.balance)), ss.text({ size: 'xs', style: 'color:var(--gray-500)' }, 'USD'))),
    p.stats
      ? ss.hstack({}, p.stats.map((s) => ss.vstack({ gap: 'none' }, ss.text({ size: 'md' }, lhFmt(s.value)), ss.text({ size: 'xs', color: 'muted' }, ss.esc(s.label)))))
      : ''
  )}${ss.icon('chevronRight', { width: 6, height: 11.6 })}</button>`
}

// Liquidity bar (local white, remote gray, unused black) — lightning landing + node hero.
function lhLiquidity(total, local, remote, sizeOfTotal) {
  const pct = (v) => (total > 0 ? (v / total) * 100 : 0)
  return ss.vstack({ gap: 'xs' },
    ss.hstack({ gap: 'md', justifyBetween: true, style: 'align-items:baseline' },
      ss.text({ color: 'muted', size: 'xs', weight: 'medium' }, t('lightning.landing.totalCapacity')),
      ss.text({ size: sizeOfTotal || 'sm', weight: 'medium' }, lhFmt(total))),
    `<div class="lh-bar"><i style="width:${pct(local)}%;background:var(--white)"></i><i style="width:${pct(remote)}%;background:var(--gray-200)"></i></div>`,
    ss.hstack({ gap: 'md', justifyBetween: true, style: 'align-items:baseline' },
      ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ weight: 'medium' }, lhFmt(local)), ss.text({ color: 'muted', size: 'xxs', weight: 'medium' }, t('lightning.node.channelLiquidityLocal'))),
      ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ color: 'muted', size: 'xxs', weight: 'medium' }, t('lightning.node.channelLiquidityRemote')), ss.text({ weight: 'medium' }, lhFmt(remote)))))
}

// --- Ark --------------------------------------------------------------------------------------

const lhArkUi = { network: 1, tab: 0, vtxosView: 'list', selected: new Set(), sortDesc: true }
const lhArkAddresses = () => [
  { index: 0, address: alArk.address, used: true, receivedSats: 80000, receiveCount: 1 },
  { index: 1, address: 'tark1qz8m4v0lq7x3d5r2n9c6w1e8t4y7u0i3o6p9a2s5d8f1g4h7j0k3l6z9x2c5v8b1n4m7q0w3e6r9t2y5', used: false, receivedSats: 0, receiveCount: 0 }
]
const lhArkTransactions = () => alMovements.filter((m) => m.kind !== 'refresh')
const lhArkRefreshes = () => alMovements.filter((m) => m.kind === 'refresh')
const lhArkLabel = (key) => (alArk.labels[key] && alArk.labels[key].label) || ''

// ark/index.tsx
registerScreen('ark', {
  source: LH_SRC + 'ark/index.tsx',
  title: () => t('navigation.item.ark').toUpperCase(),
  back: 'signer',
  render: () => {
    const nets = ['bitcoin', 'signet']
    const net = nets[lhArkUi.network]
    const accounts = alArk.account.network === net ? [alArk.account] : []
    const stats = [
      { label: t('accounts.totalTransactions'), value: lhArkTransactions().length },
      { label: t('ark.tab.addresses'), value: lhArkAddresses().filter((a) => a.used).length },
      { label: t('ark.tab.vtxos'), value: alArk.vtxos.length },
      { label: t('ark.tab.refreshes'), value: lhArkRefreshes().length }
    ]
    const tabs = `<div class="lh-net-tabs">${nets
      .map((n, i) => `<button type="button" class="lh-net-tab${i === lhArkUi.network ? ' is-on' : ''}" data-net="${i}">${t('ark.network.' + n)}</button>`)
      .join('')}</div>`
    const list = accounts.length
      ? ss.vstack({ gap: 'md', style: 'padding:16px 0 20px' },
          accounts.map((a) => lhAccountCard({ name: a.name, balance: a.balance, stats, attrs: 'data-go="ark-account"' })).join(ss.separator({ style: 'margin:16px 0' })),
          ss.button({ label: t('ark.account.create'), variant: 'outline', go: 'ark-add' }))
      : ss.vstack({ itemsCenter: true, gap: 'lg', style: 'padding:60px 20px' },
          ss.vstack({ itemsCenter: true, gap: 'sm' }, ss.text({ uppercase: true }, t('ark.account.noAccounts')), ss.text({ color: 'muted', center: true }, t('ark.account.noAccountsDescription'))),
          ss.button({ label: t('ark.account.create'), variant: 'outline', go: 'ark-add' }))
    return tabs + list
  },
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const n = e.target.closest('[data-net]')
      if (n) {
        lhArkUi.network = +n.dataset.net
        openKitScreen('ark')
      }
    })
  }
})

// SSArkMovementCard / SSArkRefreshCard
function lhMovementCard(m) {
  const label = lhArkLabel('movement:' + m.id)
  const counterparty = m.kind === 'send' ? m.sent[0] : m.received[0]
  const right = ss.vstack({ gap: 'xxs', style: 'align-items:flex-end' },
    ss.text({ size: 'xs', color: 'muted' }, lhAgo(m.at)),
    m.status !== 'successful' ? ss.text({ size: 'xxs', style: `color:${alStatusColor(m.status)}` }, t('ark.movement.status.' + m.status)) : '',
    m.fee > 0 ? ss.text({ size: 'xs', style: 'color:var(--gray-400);text-align:right' }, t('ark.movement.feeLabel', { amount: lhFmt(m.fee), unit: t('bitcoin.sats') })) : '')
  if (m.kind === 'refresh')
    return `<button type="button" class="lh-row" data-movement="${m.id}">${ss.vstack({ gap: 'xxs', style: 'flex-shrink:1' },
      ss.text({ size: 'lg', weight: 'light' }, `${m.inputs.length} → ${m.outputs.length} VTXOs`),
      label ? ss.text({ size: 'xs' }, ss.esc(label)) : '')}${right}</button>`
  const type = m.kind === 'receive' || m.kind === 'board' ? 'receive' : 'send'
  return `<button type="button" class="lh-row" data-movement="${m.id}">${ss.vstack({ gap: 'xxs', style: 'flex-shrink:1' },
    ss.hstack({ gap: 'sm' },
      `<span class="lh-move-icon">${alMoveIcon(m)}</span>`,
      ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.amountDisplay({ amount: Math.abs(m.amount), textSize: 'xl', type, noColor: false, showSign: false, weight: 'light' }))),
    ss.text({ size: 'xs', style: 'color:var(--gray-400)' }, `${lhUsd(Math.abs(m.amount))} USD`),
    counterparty ? ss.text({ size: 'xxs', style: 'color:var(--gray-400)' }, t(type === 'send' ? 'ark.movement.toLabel' : 'ark.movement.fromLabel', { value: alTrunc(counterparty, 8) })) : '',
    m.txids[0] ? ss.text({ size: 'xxs', style: 'color:var(--gray-400)' }, alTrunc(m.txids[0], 8)) : '',
    label ? ss.text({ size: 'xs' }, ss.esc(label)) : '')}${right}</button>`
}

// ark/account/[id]/index.tsx
registerScreen('ark-account', {
  source: LH_SRC + 'ark/account/[id]/index.tsx',
  title: () => alArk.account.name.toUpperCase(),
  back: 'ark',
  render: () => {
    const a = alArk.account
    const txs = lhArkTransactions().sort((x, y) => (lhArkUi.sortDesc ? y.at - x.at : x.at - y.at))
    const refreshes = lhArkRefreshes()
    const addrs = lhArkAddresses()
    const tabs = [
      { count: txs.length, label: t('accounts.totalTransactions') },
      { count: addrs.filter((x) => x.used).length, label: t('ark.tab.addresses') },
      { count: alArk.vtxos.length, label: t('ark.tab.vtxos') },
      { count: refreshes.length, label: t('ark.tab.refreshes') }
    ]
    const refreshBtn = `<button type="button" class="lh-icon-btn" data-lh-sync aria-label="Refresh">${ss.icon('refresh', { width: 19, height: 16 })}</button>`
    const sortBtn = `<button type="button" class="lh-icon-btn" data-lh-sort aria-label="Sort">${ss.text({ as: 'span', size: 'sm' }, lhArkUi.sortDesc ? '↓' : '↑')}</button>`
    const sep = '<div class="lh-sep"></div>'
    let scene = ''
    if (lhArkUi.tab === 0) {
      scene =
        `<div class="lh-toolbar">${ss.hstack({}, refreshBtn)}${sortBtn}</div>` +
        `<div class="lh-pad">${txs.length ? txs.map(lhMovementCard).join(sep) : `<div class="lh-empty">${ss.text({ color: 'muted' }, t('ark.movement.empty'))}</div>`}</div>`
    } else if (lhArkUi.tab === 1) {
      scene =
        `<div class="lh-toolbar">${refreshBtn}</div><div class="lh-pad">` +
        addrs
          .map((x) =>
            ss.vstack({ gap: 'sm', style: (x.used ? '' : 'opacity:0.6;') + 'padding-bottom:16px' },
              ss.hstack({ justifyBetween: true },
                ss.text({ uppercase: true, weight: 'bold' }, t('ark.address.index', { index: x.index })),
                ss.hstack({ gap: 'sm' },
                  ss.text({ size: 'xs', color: 'muted', uppercase: true }, x.used ? t('ark.address.used') : t('ark.address.unused')),
                  `<button type="button" class="lh-icon-btn" data-ark-addr="${x.address}" aria-label="Edit label">${ss.icon('editPencil', { size: 14 })}</button>`)),
              lhArkLabel('address:' + x.address) ? ss.text({}, ss.esc(lhArkLabel('address:' + x.address))) : '',
              ss.addressDisplay({ address: x.address, size: 'sm' }),
              ss.detailsList({ columns: 2, items: [[t('ark.address.received'), lhFmt(x.receivedSats)], [t('ark.address.receiveCount'), lhFmt(x.receiveCount)]] })))
          .join(sep) +
        '</div>'
    } else if (lhArkUi.tab === 2) {
      const spendable = alArk.vtxos.filter((v) => v.state === 'Spendable')
      const locked = alArk.vtxos.filter((v) => v.state !== 'Spendable')
      const all = spendable.length > 0 && spendable.every((v) => lhArkUi.selected.has(v.fullId))
      const card = (v) => {
        const ok = v.state === 'Spendable'
        const on = lhArkUi.selected.has(v.fullId)
        return `<button type="button" class="lh-vtxo${ok ? '' : ' is-locked'}"${ok ? ` data-vtxo="${v.fullId}"` : ''}>${ss.hstack({ gap: 'sm', style: 'flex-shrink:1;align-items:flex-start' },
          ok ? `<span class="lh-check${on ? ' is-on' : ''}"></span>` : '',
          ss.vstack({ gap: 'xxs' },
            ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.amountDisplay({ amount: v.amountSats, textSize: 'lg', weight: 'light', unitSize: 'xs' })),
            ss.text({ size: 'xxs', style: 'color:var(--gray-400)' }, v.id)))}${ss.vstack({ gap: 'xxs', style: 'align-items:flex-end' },
          ss.text({ size: 'xs', color: 'muted', uppercase: true }, ok ? t('ark.vtxo.spendable') : t('ark.vtxo.locked')),
          ss.text({ size: 'xxs', style: 'color:var(--gray-400);text-align:right' }, t('ark.vtxo.expiry', { height: ok ? 912100 : 910240 })))}</button>`
      }
      scene =
        `<div class="lh-toolbar">${refreshBtn}<button type="button" class="lh-icon-btn" data-lh-vview aria-label="View">${ss.icon(lhArkUi.vtxosView === 'list' ? 'bubbles' : 'list', { size: 15 })}</button></div><div class="lh-pad">` +
        (lhArkUi.vtxosView === 'bubbles'
          ? `<div class="lh-empty">${ss.hstack({ gap: 'md', style: 'justify-content:center;flex-wrap:wrap' },
              alArk.vtxos.map((v) => {
                const d = Math.round(40 + Math.sqrt(v.amountSats) / 3)
                const on = lhArkUi.selected.has(v.fullId)
                return `<button type="button" ${v.state === 'Spendable' ? `data-vtxo="${v.fullId}"` : ''} style="width:${d}px;height:${d}px;border-radius:50%;border:0;background:${on ? 'var(--white)' : 'var(--gray-600)'};color:${on ? 'var(--black)' : 'var(--white)'};font:inherit;font-size:10px;cursor:pointer">${lhFmt(v.amountSats)}</button>`
              }))}</div>`
          : ss.hstack({ justifyBetween: true, style: 'padding:16px 0 4px' },
              ss.text({ color: 'muted', size: 'xs', uppercase: true }, `${t('ark.vtxo.spendable')} (${spendable.length})`),
              `<button type="button" class="lh-muted-link" data-lh-allvtxo>${all ? t('common.deselectAll') : t('common.selectAll')}</button>`) +
            spendable.map(card).join('') +
            (locked.length ? ss.text({ color: 'muted', size: 'xs', uppercase: true, style: 'padding:16px 0 4px' }, `${t('ark.vtxo.locked')} (${locked.length})`) + locked.map(card).join('') : '')) +
        '</div>' +
        (lhArkUi.selected.size
          ? `<div class="lh-selection">${ss.text({ size: 'xs', color: 'muted', style: 'flex:1' }, t('ark.vtxo.selectedCount', { count: lhArkUi.selected.size }))}<button type="button" data-lh-refresh>${ss.icon(
              'arrowsClockwise',
              { size: 18 }
            )}${t('ark.refresh.action')}</button><button type="button" data-go="ark-offboard">${ss.icon('offboardCircle', { size: 18 })}${t('ark.offboard.title')}</button><button type="button" class="is-danger" data-lh-exit>${ss.icon('signOut', { size: 18 })}${t(
              'ark.exit.action'
            )}</button><button type="button" data-lh-clear aria-label="Clear">${ss.icon('x', { size: 10 })}</button></div>`
          : '')
    } else {
      scene =
        `<div class="lh-toolbar">${refreshBtn}${ss.text({ color: 'muted', size: 'xs' }, t('ark.refresh.nextExpiry', { height: 910240 }))}${sortBtn}</div>` +
        `<div class="lh-pad">${refreshes.length ? refreshes.map(lhMovementCard).join(sep) : `<div class="lh-empty">${ss.text({ color: 'muted' }, t('ark.refresh.empty'))}</div>`}</div>`
    }
    return `<div class="lh-flush">${ss.vstack({ itemsCenter: true, gap: 'none', className: 'lh-pad' },
      ss.vstack({ gap: 'xs', itemsCenter: true, style: 'padding:24px 0 12px' },
        ss.text({ color: 'muted', size: 'xs', uppercase: true }, t('ark.balance.title')),
        ss.hstack({ gap: 'xs', style: 'align-items:baseline;max-width:100%' }, ss.amountDisplay({ amount: a.balance, textSize: ss.moneySize(a.balance), weight: 'ultralight', unitSize: 'xl', letterSpacing: -1, fitMax: 250 })),
        ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ color: 'muted' }, lhUsd(a.balance)), ss.text({ size: 'xs', style: 'color:var(--gray-500)' }, 'USD')),
        a.pending > 0 ? ss.hstack({ gap: 'xs' }, ss.icon('time', { size: 13 }), ss.text({ color: 'muted', size: 'xs' }, t('ark.balance.pending', { amount: lhFmt(a.pending) }))) : ''),
      `<div style="width:100%;padding:12px 0;margin-bottom:8px">${lhActions(true)}</div>`)}${lhTabs(tabs, lhArkUi.tab, 'ark-tab')}${scene}</div>`
  },
  overlays: () =>
    ss.modal({ id: 'lh-ark-refresh', fullOpacity: true, label: t('common.cancel') },
      ss.vstack({ gap: 'lg', itemsCenter: true, widthFull: true },
        ss.text({ center: true, uppercase: true, size: 'md', weight: 'medium' }, t('ark.refresh.confirmTitle')),
        ss.text({ center: true, color: 'muted' }, t('ark.refresh.confirmDescription', { count: lhArkUi.selected.size })),
        ss.button({ label: t('ark.refresh.action'), variant: 'secondary', id: 'lh-ark-refresh-go' }))) +
    ss.modal({ id: 'lh-ark-exit', fullOpacity: true, label: t('common.cancel') },
      ss.vstack({ gap: 'lg', itemsCenter: true, widthFull: true },
        ss.text({ center: true, uppercase: true, size: 'md', weight: 'medium' }, t('ark.exit.action')),
        ss.button({ label: t('ark.exit.action'), variant: 'danger', id: 'lh-ark-exit-go' }))),
  bind: (body) => {
    lhHeaderAction(lhHeaderBtn('Ark settings', ss.icon('triangle', { size: 16 }), 'data-go="ark-settings"'))
    lhBindActions(body, { send: 'ark-send', camera: 'ark-pay-invoice', receive: 'ark-account-receive' })
    const again = () => openKitScreen('ark-account')
    body.addEventListener('click', (e) => {
      const hit = (s) => e.target.closest(s)
      if (hit('[data-ark-tab]')) {
        lhArkUi.tab = +hit('[data-ark-tab]').dataset.arkTab
        return again()
      }
      if (hit('[data-movement]')) return alOpenMovement(+hit('[data-movement]').dataset.movement)
      if (hit('[data-ark-addr]')) return alOpenAddressLabel(hit('[data-ark-addr]').dataset.arkAddr)
      if (hit('[data-vtxo]')) {
        const id = hit('[data-vtxo]').dataset.vtxo
        if (lhArkUi.selected.has(id)) lhArkUi.selected.delete(id)
        else lhArkUi.selected.add(id)
        return again()
      }
      if (hit('[data-lh-allvtxo]')) {
        const ids = alArk.vtxos.filter((v) => v.state === 'Spendable').map((v) => v.fullId)
        const all = ids.every((id) => lhArkUi.selected.has(id))
        lhArkUi.selected = new Set(all ? [] : ids)
        return again()
      }
      if (hit('[data-lh-clear]')) {
        lhArkUi.selected.clear()
        return again()
      }
      if (hit('[data-lh-vview]')) {
        lhArkUi.vtxosView = lhArkUi.vtxosView === 'list' ? 'bubbles' : 'list'
        return again()
      }
      if (hit('[data-lh-sort]')) {
        lhArkUi.sortDesc = !lhArkUi.sortDesc
        return again()
      }
      if (hit('[data-lh-sync]')) lhToast(t('common.loading'))
      if (hit('[data-lh-refresh]')) ss.open('lh-ark-refresh')
      if (hit('[data-lh-exit]')) ss.open('lh-ark-exit')
    })
    document.getElementById('kit-overlays').onclick = (e) => {
      if (e.target.closest('#lh-ark-refresh-go') || e.target.closest('#lh-ark-exit-go')) {
        lhArkUi.selected.clear()
        lhToast(t('common.loading'))
        again()
      }
    }
  }
})

// --- Lightning --------------------------------------------------------------------------------

const lhLnUi = { tab: 0, connected: true, connecting: false, input: '' }
const lhLnTotals = () => {
  const cap = alLn.channels.reduce((s, c) => s + c.capacity, 0)
  const local = alLn.channels.reduce((s, c) => s + c.local, 0)
  const remote = alLn.channels.reduce((s, c) => s + c.remoteBal, 0)
  return { cap, local, remote }
}

// lightning/index.tsx
registerScreen('lightning', {
  source: LH_SRC + 'lightning/index.tsx',
  title: () => t('lightning.landing.title').toUpperCase(),
  back: 'signer',
  render: () => {
    const n = alLn.node
    const tot = lhLnTotals()
    const card = lhLnUi.connected
      ? `<button type="button" class="lh-ln-card" data-go="lightning-node"><div class="lh-ln-card-content">${ss.hstack({ gap: 'md', justifyBetween: true, style: 'align-items:flex-start' },
          ss.vstack({ gap: 'xs', style: 'flex:1;min-width:0;padding-right:8px' },
            ss.text({ size: 'xl', weight: 'light' }, ss.esc(n.alias)),
            ss.text({ color: 'muted', size: 'xs', type: 'mono', weight: 'light', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, n.pubkey)),
          ss.hstack({ gap: 'sm', style: 'flex:none;margin-top:2px' },
            `<span class="lh-pill">${ss.text({ as: 'span', size: 'xs', weight: 'medium' }, t('lightning.landing.connectionConnected'))}</span>`,
            ss.icon('chevronRight', { width: 6, height: 11.6 })))}${lhLiquidity(tot.cap, tot.local, tot.remote)}<div class="lh-stats">${[
          [t('lightning.landing.channels'), String(alLn.channels.filter((c) => c.active).length)],
          [t('lightning.landing.peers'), '3'],
          [t('lightning.landing.chain'), t('lightning.landing.chainSynced')]
        ]
          .map(([label, value], i) => `<div class="lh-stat">${ss.text({ center: true, color: 'muted', size: 'xxs', weight: 'medium' }, label)}${ss.text({ center: true, size: i === 2 ? 'sm' : 'lg', weight: i === 2 ? 'medium' : 'light', style: i === 2 ? 'margin-top:4px' : 'margin-top:6px' }, value)}</div>`)
          .join('')}</div></div></button>`
      : ''
    return ss.vstack({ style: 'align-items:center;padding-top:32px' },
      card,
      ss.vstack({ widthFull: true, style: 'gap:16px;margin-top:24px' },
        ss.text({ center: true, color: 'muted' }, t('lightning.landing.connectExistingNode')),
        ss.button({ label: t('lightning.landing.lndRest'), variant: 'elevated', go: 'lightning-rest' }),
        ss.button({ label: t('lightning.landing.lndRpc'), variant: 'elevated', go: 'lightning-rpc' }),
        ss.text({ center: true, color: 'muted' }, t('lightning.landing.createNewNode')),
        ss.button({ label: t('lightning.landing.ldk'), variant: 'elevated', disabled: true })))
  }
})

// lightning/LNDRest/index.tsx — REST, or RPC pairing via ?protocol=rpc
function lhLndScreen(rpc) {
  return {
    source: LH_SRC + 'lightning/LNDRest/index.tsx',
    title: () => t('lightning.lndRest.title').toUpperCase(),
    back: 'lightning',
    render: () =>
      lhLnUi.connecting
        ? ss.vstack({ gap: 'md', itemsCenter: true, widthFull: true, style: 'min-height:60vh;justify-content:center' },
            ss.orbitLoader({ size: 120 }),
            ss.text({ center: true, uppercase: true }, t('lightning.lndRest.connectingButton')),
            ss.text({ center: true, color: 'muted', size: 'xs' }, t('lightning.lndRest.connectingHint')))
        : ss.vstack({ gap: 'none', style: 'align-items:center;padding:32px 0 0' },
            ss.text({ color: 'muted', center: true, style: 'margin-bottom:32px' }, rpc ? t('lightning.lndRest.subtitleRpc') : t('lightning.lndRest.subtitle')),
            ss.text({ color: 'muted', size: 'xs', center: true, style: 'margin-bottom:12px' }, rpc ? t('lightning.lndRest.helpTextRpc') : t('lightning.lndRest.helpText')),
            ss.text({ color: 'muted', size: 'xs', type: 'mono', center: true, style: 'margin-bottom:24px;word-break:break-all' }, rpc ? t('lightning.lndRest.helpExampleRpc') : t('lightning.lndRest.helpExample')),
            ss.vstack({ widthFull: true, style: 'gap:12px;margin-bottom:24px' },
              `<textarea class="lh-textarea" id="lh-lnd-input" placeholder="${ss.esc(t('lightning.lndRest.inputPlaceholder'))}">${ss.esc(lhLnUi.input)}</textarea>`,
              ss.hstack({ style: 'gap:12px' },
                ss.button({ label: t('lightning.lndRest.pasteButton'), variant: 'subtle', style: 'flex:1', id: 'lh-lnd-paste' }),
                ss.button({ label: t('lightning.lndRest.scanQrButton'), variant: 'subtle', style: 'flex:1', id: 'lh-lnd-paste2' }))),
            `<div style="width:100%">${ss.button({ label: t('lightning.lndRest.connectButton'), variant: 'secondary', id: 'lh-lnd-connect', disabled: lhLnUi.input.trim().length < 10 })}</div>`),
    bind: (body) => {
      const input = body.querySelector('#lh-lnd-input')
      const connect = body.querySelector('#lh-lnd-connect')
      if (!input) return
      input.addEventListener('input', () => {
        lhLnUi.input = input.value
        connect.disabled = input.value.trim().length < 10
      })
      const fill = () => {
        lhLnUi.input = rpc
          ? 'lndconnect://satshop.local:10009?cert=MIICJzCCAc2gAwIBAgIRAKdemo&macaroon=AgEDbG5kAvgBAwoQdemo'
          : 'https://satshop.local:8080?macaroon=0201036c6e6402f801030a10demo0macaroon0hex'
        input.value = lhLnUi.input
        connect.disabled = false
      }
      body.querySelector('#lh-lnd-paste').onclick = fill
      body.querySelector('#lh-lnd-paste2').onclick = fill
      connect.onclick = () => {
        lhLnUi.connecting = true
        openKitScreen(kitCurrent)
        setTimeout(() => {
          lhLnUi.connecting = false
          lhLnUi.connected = true
          go('lightning-node')
        }, 1200)
      }
    }
  }
}
registerScreen('lightning-rest', lhLndScreen(false))
registerScreen('lightning-rpc', lhLndScreen(true))

// SSStatus badge for lightning tx rows (only non-normal states show one).
function lhLnTxRow(tx, i) {
  const type = tx.amount > 0 ? 'receive' : 'send'
  const when = new Date(tx.at)
  return `<button type="button" class="lh-tx" data-lntx="${i}">${ss.hstack({ gap: 'xs', justifyBetween: true, style: 'align-items:flex-start' },
    ss.hstack({ gap: 'xs', style: 'align-items:baseline;flex-wrap:wrap;flex:1;min-width:0' },
      ss.styledSat({ amount: Math.abs(tx.amount), textSize: 'md', weight: 'light', type, noColor: false, showSign: false }),
      ss.text({ color: 'muted', size: 'xs', as: 'span' }, t('bitcoin.sats').toLowerCase()),
      ss.text({ color: 'muted', size: 'xs', as: 'span' }, `≈ ${lhUsd(Math.abs(tx.amount))} USD`)),
    ss.hstack({ gap: 'xs' },
      ss.text({ color: 'muted', size: 'xs' }, when.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })),
      ss.text({ color: 'muted', size: 'xs' }, lhAgo(tx.at))))}${ss.hstack({ gap: 'sm', style: 'margin-top:6px' },
    ss.text({ size: 'xs', color: tx.description ? 'white' : 'muted' }, ss.esc(tx.description || t('lightning.node.txNoDescription'))),
    tx.fee ? ss.text({ color: 'muted', size: 'xs', style: 'margin-left:auto' }, `${t('lightning.node.txFeeLabel')} ${t('lightning.node.txFeeAmount', { fee: String(tx.fee) })}`) : '')}</button>`
}

// lightning/node/index.tsx
registerScreen('lightning-node', {
  source: LH_SRC + 'lightning/node/index.tsx',
  title: () => alLn.node.alias.toUpperCase(),
  back: 'lightning',
  render: () => {
    const tot = lhLnTotals()
    const lnBal = tot.local
    const onchain = alLn.node.onchain
    const total = lnBal + onchain
    const onchainTxs = alLn.txs.map((tx, i) => ({ tx, i })).filter(({ tx }) => tx.type === 'onchain')
    const tabs = [
      { count: alLn.txs.length, label: t('lightning.node.transactionsTab') },
      { count: `${alLn.channels.filter((c) => c.active).length}/${alLn.channels.length}`, label: t('lightning.node.channelsTab') },
      { count: onchainTxs.length, label: t('lightning.node.onchainTab') }
    ]
    const side = (label, sats) =>
      `<div class="lh-hero-side">${ss.text({ color: 'muted', center: true, size: 'xs' }, label)}${ss.styledSat({ amount: sats, textSize: 'md', weight: 'light' })}${ss.text({ color: 'muted', size: 'xs', style: 'opacity:0.7' }, `${lhUsd(sats)} USD`)}</div>`
    const hero = `<div class="lh-hero-cols">${side(t('lightning.node.totalColumn'), total)}<div class="lh-hero-main">${ss.text({ color: 'muted', center: true, size: 'xs' }, t('lightning.node.spendableLightning'))}${ss.styledSat({
      amount: lnBal,
      textSize: ss.moneySize(lnBal, '5xl', 'xl'),
      weight: 'light',
      fitMax: 150
    })}${ss.text({ color: 'muted', size: 'xs' }, `${lhUsd(lnBal)} USD`)}</div>${side(t('lightning.node.onchainColumn'), onchain)}</div>`
    let scene = ''
    if (lhLnUi.tab === 0)
      scene =
        `<div class="lh-toolbar" style="padding-left:0;padding-right:0"><button type="button" class="lh-icon-btn" data-lh-sync aria-label="Refresh">${ss.icon('refresh', { width: 19, height: 16 })}</button></div>` +
        alLn.txs.map(lhLnTxRow).join('')
    else if (lhLnUi.tab === 1)
      scene = ss.vstack({ gap: 'md', style: 'padding-top:16px' },
        alLn.channels
          .map(
            (c, i) =>
              `<button type="button" class="lh-channel${c.active ? '' : ' is-inactive'}" data-lnchan="${i}"><div class="lh-ln-card-content">${ss.hstack({ gap: 'md', justifyBetween: true, style: 'align-items:flex-start' },
                ss.text({ size: 'lg', weight: 'light' }, ss.esc(c.alias)),
                ss.hstack({ gap: 'sm' },
                  `<span class="lh-pill${c.active ? '' : ' is-off'}">${ss.text({ as: 'span', size: 'xs', weight: 'medium', color: c.active ? 'white' : 'muted' }, c.active ? t('lightning.node.active') : t('lightning.node.inactive'))}</span>`,
                  ss.icon('chevronRight', { width: 6, height: 11.6 })))}${alLiquidity(c.local, c.remoteBal, c.capacity, tot.cap)}</div></button>`
          )
          .join(''),
        ss.button({ label: t('lightning.openChannel.action'), go: 'lightning-open-channel' }))
    else scene = onchainTxs.length ? onchainTxs.map(({ tx, i }) => lhLnTxRow(tx, i)).join('') : `<div class="lh-empty">${ss.text({ color: 'muted' }, t('lightning.node.noOnchainTransactions'))}</div>`
    return `<div class="lh-flush"><div class="lh-pad">${ss.vstack({ gap: 'md', widthFull: true, style: 'padding-top:12px' },
      ss.vstack({ gap: 'none', widthFull: true, style: 'padding-bottom:8px' }, hero, `<div style="margin-top:16px">${lhLiquidity(tot.cap, tot.local, tot.remote)}</div>`),
      lhActions(false))}</div>${lhTabs(tabs, lhLnUi.tab, 'ln-tab')}<div class="lh-pad">${scene}</div></div>`
  },
  bind: (body) => {
    lhHeaderAction(lhHeaderBtn(t('lightning.nodeSettings.title', { alias: alLn.node.alias }), ss.icon('lightning', { width: 12, height: 17 }), 'data-go="lightning-node-settings"'))
    lhBindActions(body, { send: 'lightning-pay', paste: 'lightning-pay', camera: 'lightning-pay', receive: 'lightning-invoice' })
    body.addEventListener('click', (e) => {
      const hit = (s) => e.target.closest(s)
      if (hit('[data-ln-tab]')) {
        lhLnUi.tab = +hit('[data-ln-tab]').dataset.lnTab
        openKitScreen('lightning-node')
      }
      if (hit('[data-lntx]')) alOpenTx(+hit('[data-lntx]').dataset.lntx)
      if (hit('[data-lnchan]')) alOpenChannel(+hit('[data-lnchan]').dataset.lnchan)
      if (hit('[data-lh-sync]')) lhToast(t('lightning.node.refreshing'))
    })
  }
})

// --- eCash ------------------------------------------------------------------------------------

const lhEcashUi = { tab: 0, proofsView: 'list', step: 'name', name: 'Spending', mnemonic: '' }

// ecash/index.tsx
registerScreen('ecash', {
  source: LH_SRC + 'ecash/index.tsx',
  title: () => t('navigation.item.ecash').toUpperCase(),
  back: 'signer',
  render: () => {
    const mints = esState.mints
    const mintLabel = mints.length === 1 ? `1 ${t('ecash.mint.singular')} · ${mints[0].name}` : `${mints.length} ${mints.length === 1 ? t('ecash.mint.singular') : t('ecash.mint.plural')}`
    const bal = esBalance()
    return ss.vstack({ gap: 'md', style: 'padding-bottom:20px' },
      `<button type="button" class="lh-ecash-card" data-go="ecash-account">${ss.hstack({ justifyBetween: true },
        ss.hstack({ gap: 'sm' },
          ss.text({ weight: 'medium', size: 'md' }, ss.esc(esState.accountName)),
          esState.hasSeed ? '' : `<span class="lh-active-tag">${ss.text({ as: 'span', size: 'xxs', style: 'color:var(--warning)' }, t('ecash.account.noSeed'))}</span>`),
        ss.text({ color: 'muted', size: 'xs' }, ss.esc(mintLabel)))}${ss.hstack({ gap: 'sm', style: 'align-items:baseline;padding:4px 0' },
        ss.hstack({ gap: 'none', style: 'align-items:baseline;gap:3px' },
          ss.styledSat({ amount: bal, textSize: 'lg', weight: 'ultralight' }),
          ss.text({ size: 'xs', style: 'color:var(--gray-500)' }, 'sats')),
        ss.text({ size: 'xs', style: 'color:var(--gray-500)' }, `${lhUsd(bal)} USD`))}</button>`,
      ss.button({ label: t('ecash.account.addAccount'), variant: 'outline', go: 'ecash-add' }))
  }
})

function lhEcashTxCard(tx) {
  const icon = { send: 'outgoing', receive: 'incoming', mint: 'incomingLightning', melt: 'outgoingLightning' }[tx.type]
  const type = tx.type === 'mint' ? 'receive' : tx.type === 'melt' ? 'send' : tx.type
  const statusColor = { completed: 'var(--main-green)', pending: 'var(--warning)', failed: 'var(--error)' }[tx.status] || 'var(--gray-300)'
  const tokenColor = { unspent: 'var(--error)', spent: 'var(--soft-bar-red)', pending: 'var(--warning)' }[tx.tokenStatus] || 'var(--white)'
  return `<button type="button" class="lh-tx" data-ecash-tx="${tx.id}">${ss.hstack({ justifyBetween: true },
    ss.text({ size: 'xs', color: 'muted' }, lhAgo(tx.timestamp)),
    ss.hstack({ gap: 'xs' },
      tx.status ? ss.text({ uppercase: true, size: 'xs', style: `color:${statusColor}` }, tx.status) : '',
      tx.type === 'send' && tx.tokenStatus ? ss.text({ uppercase: true, size: 'xs', style: `color:${tokenColor}` }, tx.tokenStatus) : ''))}${ss.hstack({ gap: 'sm', style: 'margin-top:5px' },
    ss.icon(icon, { size: 12 }),
    ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.amountDisplay({ amount: tx.amount, textSize: 'xl', type, noColor: false, showSign: false, weight: 'light', unitSize: 'xs' })))}${ss.text({
    size: 'xs',
    style: 'color:var(--gray-400)'
  }, `${lhUsd(tx.amount)} USD`)}${tx.memo ? ss.text({ size: 'xs', color: 'muted', style: 'margin-top:4px' }, ss.esc(tx.memo)) : ''}</button>`
}

// ecash/account/[id]/index.tsx
registerScreen('ecash-account', {
  source: LH_SRC + 'ecash/account/[id]/index.tsx',
  title: () => esState.accountName.toUpperCase(),
  back: 'ecash',
  render: () => {
    const total = esBalance()
    const proofs = esState.proofs
    const txs = esState.transactions
    let scene
    if (lhEcashUi.tab === 0) scene = txs.length ? txs.map(lhEcashTxCard).join('') : `<div class="lh-empty">${ss.text({ color: 'muted' }, t('ecash.noTransactions'))}</div>`
    else
      scene =
        ss.hstack({ justifyBetween: true, style: 'padding:12px 0' },
          ss.hstack({ gap: 'xs' },
            ss.text({ color: 'muted', size: 'xs' }, t('ecash.accountDetail.totalProofs', { count: proofs.length })),
            ss.text({ color: 'muted', size: 'xs' }, t('ecash.accountDetail.uniqueKeysets', { count: new Set(proofs.map((p) => p.id)).size }))),
          `<button type="button" class="lh-icon-btn" data-lh-pview aria-label="View">${ss.icon(lhEcashUi.proofsView === 'list' ? 'bubbles' : 'list', { size: 15 })}</button>`) +
        (lhEcashUi.proofsView === 'bubbles'
          ? `<div class="lh-empty">${ss.hstack({ gap: 'md', style: 'justify-content:center;flex-wrap:wrap' },
              proofs.map((p, i) => {
                const d = Math.round(30 + Math.sqrt(p.amount) / 2.2)
                return `<button type="button" data-ecash-proof="${i}" style="width:${d}px;height:${d}px;border-radius:50%;border:0;background:var(--gray-600);color:var(--white);font:inherit;font-size:10px;cursor:pointer">${lhFmt(p.amount)}</button>`
              }))}</div>`
          : proofs
              .map(
                (p, i) =>
                  `<button type="button" class="lh-proof" data-ecash-proof="${i}">${ss.vstack({ gap: 'xs' },
                    ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted', size: 'xs' }, '#' + (i + 1)), ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.amountDisplay({ amount: p.amount, textSize: 'lg', weight: 'medium', unitSize: 'xs' }))),
                    ss.vstack({ gap: 'none' },
                      ss.text({ color: 'muted', size: 'xs', uppercase: true }, t('ecash.proofs.keysetId')),
                      ss.hstack({ gap: 'xs' }, ss.text({ type: 'mono', size: 'xs' }, p.id), ss.text({ size: 'xs', style: `color:${p.active ? 'var(--success)' : 'var(--gray-500)'}` }, p.active ? t('ecash.proofs.active') : t('ecash.proofs.inactive')))),
                    ss.vstack({ gap: 'none' }, ss.text({ color: 'muted', size: 'xs', uppercase: true }, t('ecash.proofs.secret')), ss.text({ type: 'mono', size: 'xs' }, p.secret)))}</button>`
              )
              .join(''))
    return `<div class="lh-flush"><div class="lh-pad">${ss.vstack({ itemsCenter: true, gap: 'none' },
      ss.vstack({ gap: 'xs', itemsCenter: true, style: 'padding:24px 0 16px' },
        ss.text({ color: 'muted', size: 'xs', uppercase: true }, t('ecash.mint.balance')),
        ss.hstack({ gap: 'xs', style: 'align-items:baseline;max-width:100%' }, ss.amountDisplay({ amount: total, textSize: ss.moneySize(total), weight: 'ultralight', unitSize: 'xl', letterSpacing: -1, fitMax: 250 })),
        ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ size: 'xl', style: 'color:var(--gray-500)' }, lhUsd(total)), ss.text({ size: 'xl', style: 'color:var(--gray-500)' }, 'USD')),
        ss.hstack({ gap: 'sm', style: 'flex-wrap:wrap;justify-content:center' },
          esState.mints.map((m) => ss.hstack({ gap: 'xs' }, `<i class="lh-dot${m.isConnected ? ' is-on' : ''}"></i>`, ss.text({ color: 'muted', size: 'xs' }, ss.esc(m.name || m.url)))))),
      lhActions(false))}</div><div style="margin-top:8px">${lhTabs(
      [
        { count: txs.length, label: t('ecash.accountDetail.transactionsTab') },
        { count: proofs.length, label: t('ecash.accountDetail.proofsTab') }
      ],
      lhEcashUi.tab,
      'ecash-tab'
    )}</div><div class="lh-pad" style="padding-bottom:60px">${scene}</div></div>`
  },
  bind: (body) => {
    lhHeaderAction(lhHeaderBtn(t('ecash.settings.title'), ss.icon('eCash', { size: 16 }), 'data-go="ecash-account-settings"'))
    lhBindActions(body, { send: 'ecash-send-page', paste: 'ecash-receive-page', camera: 'ecash-receive-page', receive: 'ecash-receive-page' })
    body.addEventListener('click', (e) => {
      const hit = (s) => e.target.closest(s)
      if (hit('[data-ecash-tab]')) {
        lhEcashUi.tab = +hit('[data-ecash-tab]').dataset.ecashTab
        openKitScreen('ecash-account')
      }
      if (hit('[data-lh-pview]')) {
        lhEcashUi.proofsView = lhEcashUi.proofsView === 'list' ? 'bubbles' : 'list'
        openKitScreen('ecash-account')
      }
      if (hit('[data-ecash-tx]')) esOpenTx(hit('[data-ecash-tx]').dataset.ecashTx)
      if (hit('[data-ecash-proof]')) esOpenProof(+hit('[data-ecash-proof]').dataset.ecashProof)
    })
  }
})

// ecash/account/add/index.tsx — name + seed setup, import, confirm words.
registerScreen('ecash-add', {
  source: LH_SRC + 'ecash/account/add/index.tsx',
  title: () => t('ecash.account.addAccount').toUpperCase(),
  back: 'ecash',
  render: () => {
    const step = lhEcashUi.step
    if (step === 'import')
      return ss.vstack({ gap: 'md', style: 'padding-bottom:24px' },
        ss.text({ uppercase: true }, t('ecash.account.importSeed')),
        ss.text({ color: 'muted', size: 'sm' }, t('ecash.account.importSeedDescription')),
        ss.textInput({ multiline: true, align: 'left', value: lhEcashUi.mnemonic, placeholder: t('ecash.account.mnemonicPlaceholder'), className: 'lh-mnemonic' }),
        ss.hstack({ gap: 'sm' },
          ss.button({ label: t('common.paste'), variant: 'subtle', style: 'flex:1', id: 'lh-ecash-paste' }),
          ss.button({ label: t('ecash.account.scanSeedQR'), variant: 'subtle', style: 'flex:1', id: 'lh-ecash-scan' })),
        ss.button({ label: t('common.confirm'), variant: 'elevated', id: 'lh-ecash-import', disabled: lhEcashUi.mnemonic.trim().split(/\s+/).length !== 12 }),
        ss.button({ label: t('common.back'), variant: 'subtle', id: 'lh-ecash-back' }))
    if (step === 'confirm')
      return ss.vstack({ gap: 'md', style: 'padding-bottom:24px' },
        ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true }, t('ecash.account.yourSeedWords')), ss.text({ color: 'muted', size: 'sm' }, t('ecash.account.seedWarning'))),
        `<div class="lh-word-grid">${ES_DEMO_SEED.map((w, i) => `<div class="lh-word">${ss.text({ as: 'span', color: 'muted', size: 'xs' }, String(i + 1))}${ss.text({ as: 'span', weight: 'medium' }, w)}</div>`).join('')}</div>`,
        ss.vstack({ gap: 'sm' },
          ss.button({ label: t('ecash.account.createAccount'), variant: 'elevated', id: 'lh-ecash-create' }),
          ss.button({ label: t('common.back'), variant: 'subtle', id: 'lh-ecash-back' })))
    return ss.vstack({ gap: 'lg', style: 'padding-bottom:24px' },
      ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true }, t('ecash.account.name')), ss.textInput({ value: lhEcashUi.name, placeholder: t('ecash.account.namePlaceholder'), className: 'lh-ecash-name' })),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t('ecash.account.seedSetup')),
        ss.text({ color: 'muted', size: 'sm' }, t('ecash.account.seedDescription')),
        ss.button({ label: t('ecash.account.generateSeed'), variant: 'elevated', id: 'lh-ecash-generate' }),
        ss.button({ label: t('ecash.account.importSeed'), variant: 'outline', id: 'lh-ecash-to-import' })))
  },
  bind: (body) => {
    const again = () => openKitScreen('ecash-add')
    const name = body.querySelector('.lh-ecash-name input')
    if (name) name.addEventListener('input', () => (lhEcashUi.name = name.value))
    const mn = body.querySelector('.lh-mnemonic textarea')
    if (mn)
      mn.addEventListener('input', () => {
        lhEcashUi.mnemonic = mn.value
        body.querySelector('#lh-ecash-import').disabled = mn.value.trim().split(/\s+/).length !== 12
      })
    body.addEventListener('click', (e) => {
      const hit = (s) => e.target.closest(s)
      if (hit('#lh-ecash-generate')) {
        lhEcashUi.step = 'confirm'
        again()
      }
      if (hit('#lh-ecash-to-import')) {
        lhEcashUi.step = 'import'
        again()
      }
      if (hit('#lh-ecash-back')) {
        lhEcashUi.step = 'name'
        again()
      }
      if (hit('#lh-ecash-paste') || hit('#lh-ecash-scan')) {
        lhEcashUi.mnemonic = ES_DEMO_SEED.join(' ')
        again()
      }
      if (hit('#lh-ecash-import')) {
        lhEcashUi.step = 'confirm'
        again()
      }
      if (hit('#lh-ecash-create')) {
        const btn = hit('#lh-ecash-create')
        btn.disabled = true
        btn.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          esState.accountName = lhEcashUi.name || esState.accountName
          lhEcashUi.step = 'name'
          go('ecash-account')
        }, 700)
      }
    })
  }
})

// The app's account send/receive routes re-export the full send/receive pages.
for (const [id, target] of [['ecash-send', 'ecash-send-page'], ['ecash-receive', 'ecash-receive-page']]) {
  registerScreen(id, {
    source: LH_SRC + `ecash/account/[id]/${id.split('-')[1]}.tsx`,
    title: () => '',
    back: 'ecash-account',
    render: () => '',
    // Defer until openKitScreen has finished, so the route ends on the target page.
    bind: () => queueMicrotask(() => go(target))
  })
}

// --- Nostr ------------------------------------------------------------------------------------

const lhNostr = {
  active: null,
  connected: true,
  identities: null,
  identityRelays: null
}
function lhIdentities() {
  if (!lhNostr.identities) {
    lhNostr.identities = [
      noMe,
      noPerson('Studio test', { nip05: '', lud16: '' })
    ]
    lhNostr.active = noMe.npub
  }
  return lhNostr.identities
}

// SSNostrAccountCard
function lhNostrCard(id) {
  const active = id.npub === lhNostr.active
  const name = id === noMe ? noState.profile.displayName || id.name : id.name
  const nip05 = id === noMe ? noState.profile.nip05 : id.nip05
  const lud16 = id === noMe ? noState.profile.lud16 : id.lud16
  const avatar = `<span style="display:inline-flex;align-items:center;justify-content:center;flex:none;width:36px;height:36px;border-radius:18px;border:1px solid rgba(255,255,255,${active ? 0.09 : 0.18});background:var(--gray-800)">${ss.text({
    as: 'span',
    size: 'md',
    weight: 'bold'
  }, ss.esc((name || id.npub)[0].toUpperCase()))}</span>`
  const status = lhNostr.connected ? t('nostrIdentity.account.relayConnected') : t('nostrIdentity.account.relayDisconnected')
  return `<button type="button" class="lh-nostr-card${active ? ' is-active' : ''}" data-identity="${id.npub}">${
    active
      ? `<span class="lh-nostr-badges">${ss.text({ as: 'span', size: 'xxs', weight: 'medium', style: `color:${lhNostr.connected ? 'var(--main-green)' : 'var(--gray-400)'}` }, status)}<span class="lh-active-tag">${ss.text(
          { as: 'span', size: 'xxs', color: 'muted', uppercase: true, weight: 'medium' },
          t('nostrIdentity.account.activeTag')
        )}</span></span>`
      : ''
  }${ss.hstack({ justifyBetween: true, style: 'align-items:stretch' },
    ss.hstack({ gap: 'md', style: 'align-items:flex-start;flex:1' },
      avatar,
      ss.vstack({ gap: 'xxs', style: 'flex:1;min-width:0' },
        ss.text({ size: 'md', weight: 'medium' }, ss.esc(name || 'Unnamed')),
        ss.hstack({ gap: 'xs' }, `<i class="lh-nostr-dot" style="background:${noColorOf(id.npub)}"></i>`, ss.text({ size: 'xs', type: 'mono', color: 'muted' }, noShort(id.npub, 'xs'))),
        ss.text({ size: 'xs', color: lud16 ? 'white' : 'muted', style: lud16 ? '' : 'opacity:0.55' }, ss.esc(lud16 || t('nostrIdentity.account.lud16NotSet'))),
        ss.hstack({ gap: 'xs' },
          ss.text({ size: 'xs', color: 'muted', style: nip05 ? '' : 'opacity:0.55' }, ss.esc(nip05 || t('nostrIdentity.account.nip05NotSet'))),
          nip05 ? ss.icon('checkCircleThin', { size: 10 }) : ''))),
    `<span style="align-self:center">${ss.icon('chevronRight', { width: 6, height: 11.6 })}</span>`)}</button>`
}

// nostr/index.tsx
registerScreen('nostr', {
  source: LH_SRC + 'nostr/index.tsx',
  title: () => t('nostrIdentity.title').toUpperCase(),
  back: 'signer',
  render: () =>
    ss.vstack({ gap: 'md', style: 'min-height:100%' },
      ss.vstack({ gap: 'sm', style: 'padding-bottom:16px' }, lhIdentities().map(lhNostrCard)),
      ss.vstack({ gap: 'sm', style: 'margin-top:auto;padding-bottom:4px' },
        ss.button({ label: t('nostrIdentity.landing.relays'), variant: 'ghost', go: 'nostr-global-relays' }),
        ss.button({ label: lhNostr.connected ? t('nostrIdentity.landing.disconnectAll') : t('nostrIdentity.landing.connectAll'), variant: 'ghost', id: 'lh-nostr-connect' }),
        ss.button({ label: t('nostrIdentity.addIdentity'), variant: 'elevated', go: 'nostr-add' }))),
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const id = e.target.closest('[data-identity]')
      if (id) {
        lhNostr.active = id.dataset.identity
        go('nostr-account')
      }
      if (e.target.closest('#lh-nostr-connect')) {
        lhNostr.connected = !lhNostr.connected
        openKitScreen('nostr')
      }
    })
  }
})

// nostr/add.tsx
registerScreen('nostr-add', {
  source: LH_SRC + 'nostr/add.tsx',
  title: () => t('nostrIdentity.addIdentity').toUpperCase(),
  back: 'nostr',
  render: () =>
    ss.vstack({ gap: 'lg', style: 'padding-top:8px' },
      ss.vstack({ gap: 'sm' }, ss.text({ size: 'lg', weight: 'medium' }, t('nostrIdentity.add.title')), ss.text({ color: 'muted' }, t('nostrIdentity.add.description'))),
      ss.vstack({ gap: 'sm' },
        ss.button({ label: t('nostrIdentity.createNew'), variant: 'elevated', go: 'nostr-create' }),
        ss.button({ label: t('nostrIdentity.importExisting'), variant: 'secondary', go: 'nostr-import' })))
})

// nostr/account/[npub]/index.tsx — hero card, actions, feed tabs.
registerScreen('nostr-account', {
  source: LH_SRC + 'nostr/account/[npub]/index.tsx',
  title: () => '',
  back: 'nostr',
  render: () => {
    const me = { ...noMe, name: noState.profile.displayName || noMe.name, nip05: noState.profile.nip05 }
    return `<div class="lh-flush">${noHero(me)}<div class="lh-pad">${ss.vstack({ gap: 'sm' },
      lhActions(false),
      // Studio-only shortcuts kept from the old hand-made hub (the app reaches these from settings/chat).
      ss.hstack({ gap: 'md', style: 'justify-content:center' },
        `<button type="button" class="lh-muted-link" data-go="nostr-contacts">${nt('contacts.title')}</button>`,
        `<button type="button" class="lh-muted-link" data-go="nostr-relays">${t('nostrIdentity.settings.identityRelays')}</button>`),
      noFeed(noMe.npub))}</div></div>`
  },
  bind: (body) => {
    lhHeaderAction(
      lhHeaderBtn(t('nostrIdentity.chat.title'), ss.icon('chatBubble', { size: 16 }), 'data-go="nostr-chat"'),
      lhHeaderBtn(t('nostrIdentity.settings.title'), ss.icon('nostr', { size: 16 }), 'data-go="nostr-settings"')
    )
    lhBindActions(body, { send: 'nostr-send', receive: 'nostr-compose' })
    body.addEventListener('click', (e) => noFeedClicks(e, 'nostr-account'))
  }
})

// nostr/account/[npub]/relays.tsx — per-identity relays.
registerScreen('nostr-relays', {
  source: LH_SRC + 'nostr/account/[npub]/relays.tsx',
  title: () => t('nostrIdentity.settings.identityRelays').toUpperCase(),
  back: 'nostr-account',
  render: () => {
    if (!lhNostr.identityRelays) lhNostr.identityRelays = [...noState.relays]
    const sel = lhNostr.identityRelays
    const row = (r) =>
      `<div class="lh-relay-row" data-relay-row="${r.url}">${ss.checkbox({ selected: sel.includes(r.url), data: { 'lh-relay': r.url } })}${ss.vstack({ gap: 'none' }, ss.text({}, ss.esc(r.name)), ss.text({ size: 'xs', color: 'muted' }, r.url))}</div>`
    const custom = sel.filter((u) => !NO_RELAYS.some((r) => r.url === u))
    return ss.vstack({ gap: 'lg', style: 'padding-bottom:40px' },
      ss.vstack({ gap: 'sm' },
        ss.text({ size: 'xs', color: 'muted' }, t('nostrIdentity.settings.identityRelaysHint')),
        ss.textInput({ placeholder: t('nostrIdentity.relays.search'), align: 'left', className: 'lh-relay-search' }),
        NO_RELAYS.map(row).join('')),
      ss.vstack({ gap: 'sm' },
        ss.text({ color: 'muted', uppercase: true }, t('nostrIdentity.relays.custom')),
        custom.map((u) => row({ name: u.replace('wss://', ''), url: u })).join(''),
        ss.hstack({ gap: 'xs' }, `<span class="lh-relay-addon">${ss.text({ as: 'span', color: 'muted', size: 'lg' }, 'wss://')}</span>`, `<div style="flex-grow:1">${ss.textInput({ placeholder: t('nostrIdentity.relays.inputPlaceholder'), align: 'left', className: 'lh-relay-new' })}</div>`),
        ss.button({ label: t('nostrIdentity.relays.addCustom'), variant: 'outline', id: 'lh-relay-add', disabled: true })),
      ss.button({ label: t('nostrIdentity.settings.save'), variant: 'secondary', id: 'lh-relay-save' }))
  },
  bind: (body) => {
    const search = body.querySelector('.lh-relay-search input')
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase()
      body.querySelectorAll('[data-relay-row]').forEach((r) => (r.hidden = q && !r.textContent.toLowerCase().includes(q)))
    })
    const input = body.querySelector('.lh-relay-new input')
    const add = body.querySelector('#lh-relay-add')
    input.addEventListener('input', () => (add.disabled = !/^[a-z0-9-]+\.[a-z0-9.-]+/i.test(input.value.trim())))
    body.addEventListener('click', (e) => {
      const box = e.target.closest('[data-lh-relay]')
      if (box)
        // ss.checkbox toggles itself; mirror into state after it runs.
        setTimeout(() => {
          const url = box.dataset.lhRelay
          lhNostr.identityRelays = box.classList.contains('is-on') ? [...new Set([...lhNostr.identityRelays, url])] : lhNostr.identityRelays.filter((u) => u !== url)
        })
      if (e.target.closest('#lh-relay-add') && !add.disabled) {
        const url = 'wss://' + input.value.trim().replace(/^wss?:\/\//, '')
        if (!lhNostr.identityRelays.includes(url)) lhNostr.identityRelays.push(url)
        if (!noState.customRelays.includes(url)) noState.customRelays.push(url)
        openKitScreen('nostr-relays')
      }
      if (e.target.closest('#lh-relay-save')) {
        lhToast(t('nostrIdentity.relays.saved'))
        go('nostr-account')
      }
    })
  }
})
