/* Bitcoin core screens rebuilt on the SS kit. They replace the hand-made sections in
   index.html / screen.js by registering the same ids (go() checks kitScreens first):

     accounts                 ← signer/bitcoin/accountList.tsx
     account, coins, chart    ← signer/bitcoin/account/[id]/index.tsx
     tx, payjoin-tx           ← signer/bitcoin/account/[id]/transaction/[txid]/index.tsx
     account-settings         ← signer/bitcoin/account/[id]/settings/index.tsx
     script                   ← components/SSScriptVersionModal.tsx (SSSelectModal)
     psbt-qr                  ← signAndSend/previewTransaction.tsx PSBT QR modal
     seed-drop                ← components/SSMultisigKeyControl.tsx drop seed confirm

   Fixtures are the screen.js globals (accounts, openAccountData, activity, openTxData,
   coins, usedAddresses, activeNetwork). openAccount() and openTransaction() are redirected
   here so every existing caller lands on the kit screens. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  #kit-body:has(.lb-flush) { padding: 0; }
  .lb-flush { display: flex; flex-direction: column; min-height: 100%; }
  .lb-pad { padding: 0 var(--layout-main-container-padding-horizontal); }
  .lb-info { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 var(--layout-main-container-padding-horizontal); }
  .lb-info button { border: 0; padding: 0; background: none; font: inherit; cursor: pointer; }
  .lb-row { display: inline-flex; align-items: baseline; gap: 4px; }
  .lb-dot { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 3px; background: var(--main-green); align-self: center; }
  .lb-tabs { display: flex; justify-content: space-evenly; border-bottom: 1px solid var(--gray-800); }
  .lb-tab { position: relative; width: 30%; height: 48px; border: 0; background: none; color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-sm); letter-spacing: 3px; text-transform: uppercase; cursor: pointer; }
  .lb-tab.is-on::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--white); }
  .lb-card { position: relative; display: block; width: 100%; border: 0; padding: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lb-card:active { opacity: 0.6; }
  .lb-card .lb-chevron { position: absolute; right: 0; top: 50%; transform: translateY(-50%); }
  .lb-sync { position: absolute; right: 6px; top: 0; opacity: 0.6; font-size: var(--sizes-text-font-size-xs); text-transform: uppercase; }
  .lb-fp { display: inline-flex; align-items: center; gap: 4px; color: var(--gray-300); font-size: var(--sizes-text-font-size-xs); }
  .lb-fp i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }
  .lb-stats { display: flex; gap: 16px; margin-top: 4px; }
  .lb-stats span { display: flex; flex-direction: column; }
  .lb-stats small { color: var(--gray-300); font-size: var(--sizes-text-font-size-xs); white-space: pre-line; line-height: 1.2; }
  .lb-actions { display: flex; width: 100%; }
  .lb-tx .ss-details .is-mono { word-break: break-all; }
  .lb-act { position: relative; height: var(--sizes-action-button-height); box-sizing: border-box; border: 1px solid var(--gray-950); border-top: 0; border-radius: 4px; background: var(--gray-925); color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-sm); text-transform: uppercase; overflow: hidden; cursor: pointer; }
  .lb-act::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, var(--from, var(--gray-700)), var(--to, var(--gray-700))); }
  .lb-act:active { opacity: 0.65; }
  .lb-act .ss-icon { color: var(--white); }
  .lb-act.is-wide { width: 25.25%; } .lb-act.is-narrow { width: 16.5%; }
  .lb-stat-tabs { display: flex; padding: 8px var(--layout-main-container-padding-horizontal); }
  .lb-stat { position: relative; width: 25%; height: 62px; border: 0; padding: 0; background: none; color: var(--white); font: inherit; cursor: pointer; }
  .lb-stat strong { display: block; font-size: var(--sizes-text-font-size-lg); font-weight: 400; }
  .lb-stat small { display: block; color: var(--gray-300); font-size: var(--sizes-text-font-size-sm); line-height: 12px; white-space: pre-line; }
  .lb-stat.is-on::after { content: ""; position: absolute; left: 0; right: 0; bottom: -4px; height: 2px; background: var(--white); }
  .lb-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; }
  .lb-toolbar-side { display: flex; align-items: center; gap: 12px; }
  .lb-toolbar-center { flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 18px; padding: 0 8px; color: var(--gray-300); font-size: var(--sizes-text-font-size-xs); }
  .lb-icon { display: inline-flex; border: 0; padding: 0; background: none; color: var(--white); cursor: pointer; position: relative; }
  .lb-icon[disabled] { opacity: 0.3; cursor: default; }
  .lb-icon.is-spin .ss-icon { animation: ss-spin 0.8s linear infinite; }
  .lb-sortbar { display: flex; justify-content: flex-end; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--gray-900); }
  .lb-list { padding: 12px 0 24px; }
  .lb-empty { padding-top: 50px; text-align: center; color: var(--gray-300); }
  .lb-utxo { display: flex; align-items: stretch; border-bottom: 1px solid var(--gray-900); }
  .lb-utxo-body { flex: 1; min-width: 0; border: 0; padding: 12px 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lb-utxo.is-excluded .lb-utxo-body { opacity: 0.45; }
  .lb-utxo-x { display: flex; align-items: center; border: 0; padding: 0 0 0 12px; background: none; color: var(--gray-500); cursor: pointer; }
  .lb-utxo-x.is-on { color: var(--main-red); }
  .lb-utxo-bar { height: 2px; background: var(--gray-850); }
  .lb-utxo-bar i { display: block; height: 2px; background: var(--white); opacity: 0.3; }
  .lb-acct .history-chart { height: 360px; margin-top: 8px; }
  .lb-acct .addr-row, .lb-acct .addr-card { cursor: pointer; }
  .lb-tx .tx-sankey { height: auto; margin: 4px 0 16px; }
  .lb-tag { display: inline-block; padding: 1px 8px; border-radius: 10px; background: var(--gray-850); color: var(--gray-75); font-size: var(--sizes-text-font-size-xs); }
  .lb-label-row { display: flex; align-items: center; justify-content: space-between; width: 100%; border: 0; padding: 12px 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .lb-label-row:active { opacity: 0.6; }
  .lb-io { border-top: 1px solid var(--gray-850); padding: 12px 0; }
  .lb-io button { border: 0; padding: 0; background: none; color: var(--white); font: inherit; text-decoration: underline; cursor: pointer; }
  .lb-io code { font-family: ui-monospace, monospace; font-size: 11px; overflow-wrap: anywhere; color: var(--white); }
  .lb-info-table { display: flex; flex-direction: column; gap: 4px; }
  .lb-info-table .ss-hstack { justify-content: space-between; }
  .lb-pair .ss-button { flex: 1; }
  .lb-segment { display: flex; gap: 3px; width: 100%; box-sizing: border-box; padding: 3px; margin-bottom: 10px; border-radius: var(--sizes-button-border-radius); background: var(--gray-850); }
  .lb-segment button { flex: 1; height: calc(var(--sizes-button-height) - 6px); border: 0; border-radius: var(--sizes-button-border-radius); background: transparent; color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-sm); text-transform: uppercase; cursor: pointer; }
  .lb-segment button.is-on { background: var(--white); color: var(--black); }
  .lb-qr-box { padding: 5px; border-radius: 2px; background: var(--white); }
  .lb-mono-box { width: 100%; box-sizing: border-box; height: 80px; padding: 5px 20px; border-radius: 2px; background: var(--gray-900); color: var(--white); font-family: ui-monospace, monospace; font-size: var(--sizes-text-font-size-sm); text-align: center; display: flex; align-items: center; justify-content: center; word-break: break-all; }
  .lb-step .ss-button { width: 50px; height: 50px; }
  .lb-white-card { width: 100%; max-width: 300px; box-sizing: border-box; margin: 0 auto; padding: 20px 16px; border-radius: 8px; background: var(--white); box-shadow: 0 2px 3.84px rgba(0, 0, 0, 0.25); }
  .lb-white-card .lb-cancel { background: var(--gray-100); color: var(--black); }
  .lb-script-art { width: 100%; height: 80px; margin-top: 8px; color: var(--gray-500); }
  .lb-select { min-height: 100%; }
</style>`
)

// --- shared bits -----------------------------------------------------------------------

const lbAcct = { tab: 0, chart: false, utxoView: 'list', expand: false, change: false, addrView: 'table', sort: { field: 'date', dir: 'desc' }, syncing: false }
const lbSettings = {}
let lbScript = 'P2WPKH'
const lbUsd = (sats) => ((sats / SATS_PER_BTC) * USD_PER_BTC).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const lbTxs = () => activity[openAccountData.fingerprint] || []
// en.json strings use %{x}; a few app strings fall back to their key — guard those.
const lbT = (key, fallback, vars) => {
  const v = t(key, vars)
  return v === key ? fallback : v
}

function lbStats(account) {
  const n = (i) => Number(String(account.stats[i][0]).replace(/,/g, '')) || 0
  return [
    { label: t('accounts.totalTransactions'), value: n(0) },
    { label: t('accounts.derivedAddresses'), value: n(1) },
    { label: t('accounts.spendableOutputs'), value: n(2) },
    { label: t('accounts.satsInMempool'), value: n(3) }
  ]
}

// Connection + SSBlockFeePriceRow, shared by accountList.tsx and account/[id]/index.tsx.
function lbInfoRows() {
  const net = networkNames[activeNetwork] || 'Signet'
  return `<div class="lb-info">
    <button type="button" data-go="settings-network-server"><span class="lb-row"><i class="lb-dot"></i>${ss.text({ as: 'span', size: 'xxs', uppercase: true, style: 'color:var(--gray-200)' }, `${net} - Default`)}${ss.text({ as: 'span', size: 'xxs', uppercase: true, style: 'color:var(--gray-500)' }, 'mempool.space')}</span></button>
    <button type="button" data-go="explorer-chaintip"><span class="lb-row">${ss.text({ as: 'span', size: 'xxs', style: 'color:var(--gray-500)' }, 'Block ')}${ss.text({ as: 'span', size: 'xxs' }, BLOCK_HEIGHT.toLocaleString('en-US'))}<i style="width:8px"></i>${ss.text({ as: 'span', size: 'xxs', style: 'color:var(--gray-500)' }, '~')}${ss.text({ as: 'span', size: 'xxs', style: 'color:var(--gray-200)' }, String(NEXT_BLOCK_FEE))}${ss.text({ as: 'span', size: 'xxs', style: 'color:var(--gray-500)' }, ' sat/vB')}<i style="width:12px"></i>${ss.text({ as: 'span', size: 'xxs', style: 'color:var(--gray-200)' }, USD_PER_BTC.toLocaleString('en-US'))}${ss.text({ as: 'span', size: 'xxs', style: 'color:var(--gray-500)' }, ' USD')}</span></button>
  </div>`
}

const lbFingerprint = (fp) => `<span class="lb-fp"><i style="background:#${fp.slice(0, 6)}"></i>${fp}</span>`

function lbIconButton(name, attrs, size, extraClass) {
  return `<button type="button" class="lb-icon${extraClass ? ' ' + extraClass : ''}" ${attrs || ''}>${ss.icon(name, { size: size || 16 })}</button>`
}

function lbSortBar() {
  return `<div class="lb-sortbar">${['date', 'amount', 'label']
    .map(
      (field) =>
        `<button type="button" class="sort-toggle${lbAcct.sort.field === field ? ' is-on' : ''}" data-lb-sort="${field}"><span>${
          lbAcct.sort.field === field && lbAcct.sort.dir === 'asc' ? '↑' : '↓'
        }</span>${ss.text({ as: 'span', color: lbAcct.sort.field === field ? 'white' : 'muted' }, t('utxo.sort.' + field))}</button>`
    )
    .join('')}</div>`
}

// --- accountList.tsx -------------------------------------------------------------------

// SSAccountCard
function lbAccountCard(account, index) {
  const stats = lbStats(account)
  const synced = index === 0 ? [t('account.sync.status.synced'), 'var(--main-green)'] : [`${t('account.sync.status.synced')} ${t('account.sync.status.old.hour', { value: 2 })}`, 'var(--gray-75)']
  return `<button type="button" class="lb-card" data-lb-account="${account.fingerprint}">
    <span class="lb-sync" style="color:${synced[1]}">${synced[0]}</span>
    ${ss.vstack({ gap: 'xxs' },
      lbFingerprint(account.fingerprint),
      ss.hstack({ gap: 'sm' }, ss.text({ size: 'lg', color: 'muted' }, account.name), account.watchOnly ? ss.icon('eyeOn', { size: 16 }) : ''),
      ss.vstack({ gap: 'none' },
        ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.amountDisplay({ amount: account.balance, textSize: '3xl', weight: 'light', unitSize: 'xl' })),
        ss.hstack({ gap: 'xs', style: 'align-items:baseline;margin-top:-4px' }, ss.text({ color: 'muted' }, lbUsd(account.balance)), ss.text({ size: 'xs', style: 'color:var(--gray-500)' }, 'USD'))),
      `<span class="lb-stats">${stats.map((s) => `<span>${ss.text({ as: 'span', size: 'md' }, s.value.toLocaleString('en-US'))}<small>${s.label}</small></span>`).join('')}</span>`)}
    <span class="lb-chevron">${ss.icon('chevronRight', { width: 6, height: 11.6 })}</span>
  </button>`
}

const LB_SAMPLES = {
  bitcoin: ['account.load.sample.bitcoin.address.salvador', 'account.load.sample.bitcoin.address.segwit', 'account.load.sample.bitcoin.address.tether'],
  testnet: ['account.load.sample.testnet.address'],
  signet: ['account.load.sample.signet.segwit', 'account.load.sample.signet.multisig', 'account.load.sample.signet.legacy', 'account.load.sample.signet.xpub', 'account.load.sample.signet.address']
}

registerScreen('accounts', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/accountList.tsx',
  title: () => t('bitcoin.network.bitcoin').toUpperCase(),
  back: 'signer',
  render: () => {
    const visible = accounts.filter((a) => a.network === activeNetwork)
    const total = visible.reduce((s, a) => s + a.balance, 0)
    const mempool = visible.reduce((s, a) => s + mempoolSats(a), 0)
    return `<div class="lb-flush" style="padding:0 var(--layout-main-container-padding-horizontal)">
      ${ss.vstack({ gap: 'none', itemsCenter: true, style: 'margin-bottom:24px' },
        lbInfoRows(),
        `<span class="lb-row">${ss.text({ as: 'span', size: 'xxs', style: 'color:var(--gray-500)' }, t('accounts.totalBalance'))}${ss.text({ as: 'span', size: 'xxs', style: 'color:var(--gray-200)' }, total.toLocaleString('en-US'))}<i style="width:12px"></i>${ss.text({ as: 'span', size: 'xxs', style: 'color:var(--gray-500)' }, t('accounts.satsInMempool').replace('\n', ' '))}${ss.text({ as: 'span', size: 'xxs', style: 'color:var(--gray-200)' }, mempool.toLocaleString('en-US'))}</span>`)}
      ${ss.button({ label: t('account.add'), variant: 'elevated', go: 'new-account', style: 'margin-bottom:24px' })}
      <div class="lb-tabs">${['bitcoin', 'testnet', 'signet'].map((n) => `<button type="button" class="lb-tab${n === activeNetwork ? ' is-on' : ''}" data-lb-network="${n}">${n}</button>`).join('')}</div>
      <div style="padding-top:16px">
        ${
          visible.length
            ? visible.map((a, i) => lbAccountCard(a, i)).join(ss.separator({ style: 'margin:16px 0' }))
            : ss.vstack({ itemsCenter: true, style: 'padding:32px 0' }, ss.text({ uppercase: true }, t('accounts.empty')))
        }
        ${ss.vstack({ itemsCenter: true, style: 'margin-top:48px;padding:32px 0' },
          ss.text({ color: 'muted', uppercase: true }, t('accounts.samples')),
          LB_SAMPLES[activeNetwork].map((k) => ss.button({ label: t(k), variant: 'subtle', data: { 'lb-sample': k } })))}
      </div>
    </div>`
  },
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const net = e.target.closest('[data-lb-network]')
      if (net) {
        activeNetwork = net.dataset.lbNetwork
        return openKitScreen('accounts')
      }
      const card = e.target.closest('[data-lb-account]')
      if (card) return openAccount(accounts.find((a) => a.fingerprint === card.dataset.lbAccount))
      const sample = e.target.closest('[data-lb-sample]')
      if (sample) {
        sample.disabled = true
        sample.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          ss.toast('Sample accounts are fixtures in Studio', document.getElementById('view-kit'))
          openKitScreen('accounts')
        }, 700)
      }
    })
  }
})

// --- account/[id]/index.tsx ------------------------------------------------------------

function lbSortedTxs(list) {
  const key = { date: (tx) => tx.block || Infinity, amount: (tx) => tx.amount, label: (tx) => (tx.label || '').toLowerCase() }[lbAcct.sort.field]
  return [...list].sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * (lbAcct.sort.dir === 'asc' ? 1 : -1))
}

function lbTxList(list) {
  const all = lbTxs()
  const max = Math.max(...all.map((tx) => tx.balance), 1)
  if (!list.length) return `<p class="lb-empty">${t('transaction.noTransactions') === 'transaction.noTransactions' ? 'No transactions' : t('transaction.noTransactions')}</p>`
  return lbSortedTxs(list)
    .map((tx) => {
      const index = all.indexOf(tx)
      return txCard(tx, index <= 0 ? 0 : all[index - 1].balance, max)
    })
    .join('')
}

function lbUtxoCard(coin, total) {
  return `<div class="lb-utxo-wrap">
    <div class="lb-utxo-bar"><i style="width:${Math.max(1, (coin.value / total) * 100)}%"></i></div>
    <div class="lb-utxo${coin.excluded ? ' is-excluded' : ''}">
      <button type="button" class="lb-utxo-body" data-lb-utxo="${coin.id}">${ss.vstack({ gap: 'none' },
        ss.hstack({ justifyBetween: true, style: 'align-items:flex-start' },
          ss.vstack({ gap: 'none' },
            ss.hstack({ gap: 'xxs', style: 'align-items:baseline' }, ss.styledSat({ amount: coin.value, textSize: 'xl' }), ss.text({ as: 'span', color: 'muted' }, t('bitcoin.sats').toLowerCase())),
            ss.hstack({}, ss.text({}, lbUsd(coin.value)), ss.text({ style: 'color:var(--gray-400)' }, 'USD'))),
          ss.vstack({ gap: 'none', style: 'align-items:flex-end' },
            ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({}, coin.address), ss.text({ color: 'muted' }, `(${coin.addressIndex ?? 0})`)),
            ss.text({ color: 'muted' }, coin.timestamp ? new Date(coin.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''))),
        ss.text({ size: 'md', color: coin.label ? 'white' : 'muted' }, coin.label || t('utxo.noLabel')))}</button>
      <button type="button" class="lb-utxo-x${coin.excluded ? ' is-on' : ''}" data-lb-exclude="${coin.id}" aria-label="Exclude">${ss.icon('exclude', { size: 16 })}</button>
    </div>
  </div>`
}

function lbAccountMarkup() {
  const account = openAccountData
  const txs = lbTxs()
  const stats = lbStats(account)
  const syncTitle = lbAcct.syncing ? t('account.sync.status.syncing') : `${t('account.sync.status.synced')} ${t('account.sync.status.old.day', { value: 3 })}`
  const left = `<span class="lb-toolbar-side">${lbIconButton('refresh', 'data-lb-refresh', 16, lbAcct.syncing ? 'is-spin' : '')}${lbIconButton(lbAcct.expand ? 'collapse' : 'expand', 'data-lb-expand', 15)}${
    lbAcct.tab === 0 && lbAcct.chart ? lbIconButton('chartSettings', 'data-go="settings-features-charts"', 18) : ''
  }</span>`
  const toolbar = (center, right) =>
    `<div class="lb-toolbar">${left}<span class="lb-toolbar-center">${lbAcct.syncing ? ss.orbitLoader({ size: 14 }) : ''}${center}</span><span class="lb-toolbar-side">${right}</span></div>`
  let content = ''
  if (lbAcct.tab === 0) {
    content =
      toolbar(syncTitle, `${lbIconButton('search', 'disabled', 18)}${lbIconButton(lbAcct.chart ? 'menu' : 'historyChart', 'data-lb-chart', 18)}`) +
      (lbAcct.chart ? historyChart(txs) : lbSortBar() + `<div class="lb-list">${lbTxList(txs)}</div>`)
  } else if (lbAcct.tab === 1) {
    const rows = addressRows(account)
    const markup = lbAcct.addrView === 'table' ? addressTable(account) : addressCards(account)
    // Tag each row/card with its address so taps open address/[addr].
    let i = 0
    const tagged = markup.replace(/<(button type="button" class="addr-row"|article class="addr-card")/g, (m, tag) => `<${tag} data-lb-address="${rows[i++] ? rows[i - 1].address : ''}"`)
    content =
      toolbar(`m/84'/1'/0'/${lbAcct.change ? 1 : 0}`, lbIconButton(lbAcct.addrView === 'table' ? 'menu' : 'list', 'data-lb-addr-view', 18)) +
      ss.hstack({ gap: 'none', style: 'margin-bottom:12px' },
        ss.radio({ label: 'Receive', variant: 'outline', group: 'lb-chain', selected: !lbAcct.change, data: { 'lb-chain': 'receive' }, style: 'flex:1' }),
        ss.radio({ label: 'Change', variant: 'outline', group: 'lb-chain', selected: lbAcct.change, data: { 'lb-chain': 'change' }, style: 'flex:1' })) +
      tagged
  } else if (lbAcct.tab === 2) {
    const excluded = coins.filter((c) => c.excluded).length
    const total = coins.reduce((s, c) => s + c.value, 0)
    const right =
      lbIconButton('filter', '', 16) +
      lbIconButton(lbAcct.utxoView === 'bubbles' ? 'list' : 'bubbles', 'data-lb-utxo-view', 15) +
      `<button type="button" class="lb-icon" data-go="exclude-utxos" aria-label="${t('utxo.exclude.title')}">${ss.icon('exclude', { size: 16 })}${excluded ? `<span class="exclude-badge">${excluded}</span>` : ''}</button>`
    const sorted = [...coins].sort((a, b) => {
      const key = { date: (c) => c.timestamp || 0, amount: (c) => c.value, label: (c) => (c.label || '').toLowerCase() }[lbAcct.sort.field]
      return (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * (lbAcct.sort.dir === 'asc' ? 1 : -1)
    })
    content =
      toolbar(syncTitle, right) +
      (lbAcct.utxoView === 'bubbles'
        ? `<div class="lb-bubbles">${bubblePack(!lbAcct.bubblesEntered, false)}</div>`
        : lbSortBar() + `<div class="lb-list">${sorted.map((c) => lbUtxoCard(c, total)).join('')}</div>`)
    lbAcct.bubblesEntered = lbAcct.utxoView === 'bubbles'
  } else {
    content = toolbar(syncTitle, lbIconButton('search', 'disabled', 18)) + `<div class="lb-list">${lbTxList(txs.filter((tx) => tx.conf <= 0))}</div>`
  }
  const actions = `<div class="lb-actions">
    <button type="button" class="lb-act is-wide" style="--from:var(--gray-880);--to:var(--gray-700)" data-lb-send>Send</button>
    <button type="button" class="lb-act is-narrow" style="--from:var(--gray-850)" data-lb-paste aria-label="Paste">${ss.icon('pasteClipboard', { width: 18, height: 16 })}</button>
    <button type="button" class="lb-act is-narrow" data-lb-camera aria-label="Camera">${ss.icon('camera', { width: 18, height: 13 })}</button>
    <button type="button" class="lb-act is-narrow" style="--to:var(--gray-850)" data-lb-nfc aria-label="NFC">${ss.icon('scanNFC', { width: 18, height: 21 })}</button>
    <button type="button" class="lb-act is-wide" style="--from:var(--gray-700);--to:var(--gray-880)" data-go="account-receive">Receive</button>
  </div>`
  const balanceSize = String(account.balance).length > 9 ? '5xl' : '6xl'
  return `<div class="lb-flush lb-acct">
    ${lbInfoRows()}
    ${
      lbAcct.expand
        ? ''
        : `<div class="lb-pad" style="padding-top:20px">${ss.vstack({ itemsCenter: true, gap: 'none' },
            ss.vstack({ itemsCenter: true, gap: 'none', style: 'padding-bottom:12px' },
              ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.amountDisplay({ amount: account.balance, textSize: balanceSize, weight: 'ultralight', unitSize: 'xl' })),
              ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ color: 'muted' }, lbUsd(account.balance)), ss.text({ size: 'xs', style: 'color:var(--gray-500)' }, 'USD'))),
            actions)}</div>
          <div class="lb-stat-tabs">${stats
            .map((s, i) => `<button type="button" class="lb-stat${lbAcct.tab === i ? ' is-on' : ''}" data-lb-tab="${i}"><strong>${s.value.toLocaleString('en-US')}</strong><small>${s.label}</small></button>`)
            .join('')}</div>`
    }
    <div class="lb-pad" style="flex:1">${content}</div>
  </div>`
}

function lbBindAccount(body) {
  const repaint = () => {
    body.innerHTML = lbAccountMarkup()
  }
  body.addEventListener('click', (e) => {
    const hit = (sel) => e.target.closest(sel)
    if (hit('[data-lb-send]')) return go('coin-list')
    if (hit('[data-lb-paste]')) return openPaste()
    if (hit('[data-lb-camera]')) return openCamera()
    if (hit('[data-lb-nfc]')) return openNfc()
    const tab = hit('[data-lb-tab]')
    if (tab) {
      lbAcct.tab = +tab.dataset.lbTab
      lbAcct.chart = false
      return repaint()
    }
    if (hit('[data-lb-chart]')) {
      lbAcct.chart = !lbAcct.chart
      return repaint()
    }
    if (hit('[data-lb-expand]')) {
      lbAcct.expand = !lbAcct.expand
      return repaint()
    }
    if (hit('[data-lb-refresh]')) {
      lbAcct.syncing = true
      repaint()
      return setTimeout(() => {
        lbAcct.syncing = false
        if (kitCurrent && ['account', 'coins', 'chart'].includes(kitCurrent)) repaint()
      }, 1200)
    }
    const sort = hit('[data-lb-sort]')
    if (sort) {
      const field = sort.dataset.lbSort
      lbAcct.sort = { field, dir: lbAcct.sort.field === field && lbAcct.sort.dir === 'desc' ? 'asc' : 'desc' }
      return repaint()
    }
    if (hit('[data-lb-addr-view]')) {
      lbAcct.addrView = lbAcct.addrView === 'table' ? 'list' : 'table'
      return repaint()
    }
    const chain = hit('[data-lb-chain]')
    if (chain) {
      lbAcct.change = chain.dataset.lbChain === 'change'
      addressChange = lbAcct.change // addressRows() reads the screen.js flag
      return repaint()
    }
    if (hit('[data-lb-utxo-view]')) {
      lbAcct.utxoView = lbAcct.utxoView === 'bubbles' ? 'list' : 'bubbles'
      return repaint()
    }
    const ex = hit('[data-lb-exclude]')
    if (ex) {
      const coin = coins.find((c) => c.id === ex.dataset.lbExclude)
      coin.excluded = !coin.excluded
      if (coin.excluded) coin.selected = false
      return repaint()
    }
    const utxo = hit('[data-lb-utxo]') || hit('.lb-bubbles [data-coin]')
    if (utxo) return baOpenUtxo(utxo.dataset.lbUtxo || utxo.dataset.coin)
    const addr = hit('[data-lb-address]')
    if (addr && addr.dataset.lbAddress) return baOpenAddress(addr.dataset.lbAddress)
    const card = hit('.tx-card[data-txid]')
    if (card) {
      const tx = lbTxs().find((item) => item.txid === card.dataset.txid)
      if (tx) openTransaction(tx)
    }
  })
}

// Header right (SSIconKeys → account settings), removed whenever another kit screen opens.
function lbHeaderKeys() {
  const header = document.querySelector('#view-kit .stack-header')
  const gear = header.querySelector('[data-settings]')
  if (gear) gear.hidden = true
  const keys = document.createElement('button')
  keys.type = 'button'
  keys.className = 'settings lb-header-extra'
  keys.setAttribute('aria-label', 'Account settings')
  keys.innerHTML = ss.icon('keys', { size: 20 })
  keys.addEventListener('click', () => go('account-settings'))
  header.appendChild(keys)
}

const lbOpenKitScreen = openKitScreen
openKitScreen = function (id) {
  document.querySelectorAll('.lb-header-extra').forEach((node) => node.remove())
  return lbOpenKitScreen(id)
}

function lbTitleWithEye(account) {
  return account.name.toUpperCase()
}

for (const id of ['account', 'coins', 'chart']) {
  registerScreen(id, {
    source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/index.tsx',
    title: () => lbTitleWithEye(openAccountData),
    back: 'accounts',
    render: (state) => {
      if (!openAccountData) openAccountData = accounts[0]
      if (state.id === 'coins') {
        lbAcct.tab = 2
        lbAcct.chart = false
      } else if (state.id === 'chart') {
        lbAcct.tab = 0
        lbAcct.chart = true
      }
      return lbAccountMarkup()
    },
    bind: (body) => {
      lbBindAccount(body)
      lbHeaderKeys()
      if (openAccountData.watchOnly) {
        const title = document.getElementById('kit-title')
        title.innerHTML = `${ss.esc(openAccountData.name.toUpperCase())} <span style="display:inline-flex;vertical-align:-2px">${ss.icon('eyeOn', { size: 16 })}</span>`
      }
    }
  })
}

// Every existing caller (account cards, created/finish screens…) lands on the kit account.
openAccount = function (account) {
  openAccountData = account || accounts[0]
  Object.assign(lbAcct, { tab: 0, chart: false, expand: false, utxoView: 'list' })
  go('account')
}

// --- transaction/[txid]/index.tsx -----------------------------------------------------

openTransaction = function (tx) {
  openTxData = tx
  go('tx')
}

function lbTxMarkup(tx) {
  const feeRate = (tx.fee / tx.size).toFixed(2)
  const feeVrate = (tx.fee / tx.vsize).toFixed(2)
  const pct = tx.priceChange
  const inputs = tx.flowInputs || Array.from({ length: tx.inputs }, (_, i) => ({ value: i ? 0 : tx.amount + tx.fee, ours: tx.type === 'send', from: tx.txid.slice(i * 6, i * 6 + 12) }))
  const outputs = (tx.flowOutputs || []).filter((o) => !o.fee)
  const outs = outputs.length
    ? outputs
    : Array.from({ length: tx.outputs }, (_, i) => ({ value: i ? 0 : tx.amount, ours: tx.type === 'receive' ? i === 0 : i > 0, to: `tb1q${tx.txid.slice(0, 8)}demo${i}` }))
  const book = usedAddresses[openAccountData.fingerprint] || usedAddresses.ab12cd34
  const known = new Set([...book.receive, ...book.change].map((r) => r.address))
  const coinFor = (o) => coins.find((c) => c.label && c.label === o.label) || coins.find((c) => c.value === o.value)
  // Wallet-owned outputs show the matching receive address from the account's address book.
  const ownAddress = (o) => (known.has(o.to) ? o.to : (book.receive.find((r) => r.label && r.label === o.label) || book.receive[0]).address)
  const tagChips = (tx.tags || []).map((tag) => `<span class="lb-tag">${ss.esc(tag)}</span>`).join('')
  return `<div class="lb-tx" style="padding:20px">${ss.vstack({},
    ss.vstack({ gap: 'sm', itemsCenter: true },
      tx.ago ? ss.text({ color: 'muted' }, tx.ago) : '',
      ss.vstack({ gap: 'xxs', itemsCenter: true },
        ss.hstack({ gap: 'sm', style: 'align-items:center' },
          ss.icon(tx.type === 'receive' ? 'incoming' : 'outgoing', { size: 12 }),
          ss.hstack({ gap: 'xs', style: 'align-items:baseline' },
            ss.styledSat({ amount: tx.amount, textSize: '4xl', weight: 'ultralight', noColor: false, showSign: false, type: tx.type }),
            ss.text({ as: 'span', color: 'muted', size: 'xl' }, t('bitcoin.sats')))),
        tx.payjoin && tx.contributed ? ss.text({ color: 'muted' }, t('transaction.details.contributed', { amount: tx.contributed.toLocaleString('en-US') })) : '',
        ss.hstack({ gap: 'xs' },
          ss.text({ color: 'muted' }, tx.fiat),
          ss.text({ style: 'color:var(--gray-500)' }, 'USD'),
          tx.historical ? ss.text({ color: 'muted' }, `(${tx.historical})`) : '',
          pct ? ss.text({ style: `color:var(${pct[0] === '+' ? '--soft-bar-green' : '--soft-bar-red'})` }, pct) : '')),
      ss.hstack({ gap: 'sm', style: 'align-items:baseline' },
        `<span class="tx-conf ${confClass(tx.conf)} ss-text w-light">${confText(tx.conf, 0)}</span>`,
        ss.text({ as: 'span' }, `<span class="ss-text is-muted">${t('common.from').toLowerCase()} </span>${tx.inputs} ${(tx.inputs === 1 ? t('transaction.input.singular') : t('transaction.input.plural')).toLowerCase()}`),
        ss.text({ as: 'span' }, `<span class="ss-text is-muted">${t('common.to').toLowerCase()} </span>${tx.outputs} ${(tx.outputs === 1 ? t('transaction.output.singular') : t('transaction.output.plural')).toLowerCase()}`))),
    ss.separator(),
    `<button type="button" class="lb-label-row" data-lb-tx-label>${ss.vstack({ gap: 'xxs' },
      ss.text({ uppercase: true, color: 'muted', size: 'xs' }, t('transaction.label')),
      tx.label || tagChips
        ? ss.hstack({ gap: 'sm' }, tx.label ? ss.text({ size: 'lg', weight: 'light' }, ss.esc(tx.label)) : ss.text({ weight: 'light', style: 'color:var(--gray-500)' }, t('transaction.noLabel')), tagChips)
        : ss.hstack({ gap: 'sm' }, ss.text({ weight: 'light', style: 'color:var(--gray-500)' }, t('transaction.noLabel')), ss.text({ weight: 'light', style: 'color:var(--gray-600)' }, '·'), ss.text({ weight: 'light', style: 'color:var(--gray-500)' }, t('transaction.noTags'))))}${ss.icon('chevronRight', { width: 6, height: 11.6 })}</button>`,
    ss.vstack({ style: 'padding-top:50px' },
      ss.separator(),
      ss.text({ uppercase: true, color: 'muted' }, t('transaction.details.chart')),
      tx.payjoin ? ss.text({ color: 'muted' }, t('transaction.details.possiblePayjoin')) : '',
      txDetailSankey(tx)),
    ss.separator(),
    ss.detailsList({
      columns: 3,
      headerSize: 'sm',
      textSize: 'md',
      uppercase: false,
      items: [
        [t('transaction.block'), tx.block ? tx.block.toLocaleString('en-US') : '', { width: '100%' }],
        [t('transaction.hash'), tx.txid, { copyToClipboard: true, variant: 'mono', width: '100%' }],
        [t('transaction.size'), tx.size, { unit: t('bitcoin.bytes') }],
        [t('transaction.weight'), tx.weight],
        [t('transaction.vsize'), tx.vsize],
        [t('transaction.fee'), tx.fee, { unit: t('bitcoin.sats') }],
        [t('transaction.feeBytes'), feeRate],
        [t('transaction.feeVBytes'), feeVrate],
        [t('transaction.version'), tx.version],
        [t('transaction.input.count'), tx.inputs],
        ['Total outputs', tx.outputs]
      ]
    }),
    ss.separator(),
    ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true, color: 'muted' }, t('transaction.decoded.title')), decodedMarkup()),
    `<div>${inputs
      .map(
        (input, i) => `<div class="lb-io">${ss.vstack({ gap: 'xs' },
          ss.text({ uppercase: true, color: 'muted' }, `${t('transaction.input.singular')} ${i}`),
          ss.text({ size: 'xs', color: 'muted' }, 'Previous transaction output hash'),
          `<code>${ss.esc(tx.txid.slice(i) + tx.txid.slice(0, i))}</code>`,
          ss.hstack({ justifyBetween: true }, ss.text({ size: 'xs', color: 'muted' }, 'Output index in transaction'), ss.text({}, String(i))),
          ss.hstack({ justifyBetween: true }, ss.text({ size: 'xs', color: 'muted' }, 'Sequence'), ss.text({}, '4294967293')),
          input.value ? ss.hstack({ justifyBetween: true }, ss.text({ size: 'xs', color: 'muted' }, 'Value'), ss.text({}, `${input.value.toLocaleString('en-US')} sats`)) : '')}</div>`
      )
      .join('')}${outs
      .map((o, i) => {
        const coin = o.ours ? coinFor(o) : null
        if (o.ours) o = { ...o, to: ownAddress(o) }
        return `<div class="lb-io">${ss.vstack({ gap: 'xs' },
          ss.text({ uppercase: true, color: 'muted' }, `${t('transaction.output.singular')} ${i}`),
          ss.text({ size: 'xs', color: 'muted' }, t('transaction.address')),
          known.has(o.to) ? `<button type="button" data-lb-open-address="${o.to}"><code>${o.to}</code></button>` : `<code>${ss.esc(o.to || '')}</code>`,
          o.value ? ss.hstack({ justifyBetween: true }, ss.text({ size: 'xs', color: 'muted' }, 'Value'), ss.text({}, `${o.value.toLocaleString('en-US')} sats`)) : '',
          coin ? `<button type="button" data-lb-open-utxo="${coin.id}">View UTXO</button>` : '')}</div>`
      })
      .join('')}</div>`)}</div>`
}

for (const id of ['tx', 'payjoin-tx']) {
  registerScreen(id, {
    source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/transaction/[txid]/index.tsx',
    title: () => t('transaction.details.title'),
    back: 'account',
    render: (state) => {
      if (!openAccountData) openAccountData = accounts[0]
      const list = lbTxs()
      if (state.id === 'payjoin-tx') {
        openAccountData = accounts[0]
        openTxData = lbTxs().find((tx) => tx.payjoin) || lbTxs()[0]
      } else if (!openTxData || !list.includes(openTxData)) {
        openTxData = list[0] || activity.ab12cd34[0]
      }
      return lbTxMarkup(openTxData)
    },
    bind: (body) => {
      document.getElementById('kit-title').textContent = t('transaction.details.title')
      body.addEventListener('click', (e) => {
        if (e.target.closest('[data-lb-tx-label]')) return baOpenTxLabel(openTxData)
        const a = e.target.closest('[data-lb-open-address]')
        if (a) return baOpenAddress(a.dataset.lbOpenAddress)
        const u = e.target.closest('[data-lb-open-utxo]')
        if (u) return baOpenUtxo(u.dataset.lbOpenUtxo)
      })
    }
  })
}

// --- account/[id]/settings/index.tsx --------------------------------------------------

registerScreen('account-settings', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/index.tsx',
  title: () => openAccountData.name.toUpperCase(),
  back: 'account',
  render: () => {
    const account = openAccountData
    const s = (lbSettings[account.fingerprint] = lbSettings[account.fingerprint] || { name: account.name })
    const birthday = typeof bsState === 'function' && bsState().birthday ? bsState().birthday : t('account.birthdayDate.unset')
    const row = (label, value) => ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted' }, label), value)
    const ratio = (a, b) => ss.hstack({ gap: 'xs' }, ss.text({}, String(a)), ss.text({ color: 'muted' }, 'of'), ss.text({}, String(b)))
    const n = (i) => Number(account.stats[i][0]) || 0
    return ss.vstack({ gap: 'lg', style: 'padding-bottom:24px' },
      ss.text({ center: true, uppercase: true, color: 'muted' }, t('account.settings.title')),
      ss.form({}, ss.form.item({}, ss.form.label({ label: t('account.name') }), ss.textInput({ value: s.name, className: 'lb-name', status: 'valid' }))),
      `<div class="lb-info-table">${[
        row(t('account.fingerprint'), lbFingerprint(account.fingerprint)),
        row(t('account.createdOn'), ss.text({}, 'Mar 12, 2024')),
        `<button type="button" class="lb-card" data-go="account-birthday">${row(t('account.birthdayDate.label'), ss.hstack({ gap: 'xs' }, ss.text({}, birthday), ss.icon('chevronRight', { width: 7, height: 12 })))}</button>`,
        row(t('account.network.title'), ss.text({}, account.network)),
        row(t('account.policy.title'), ss.text({}, account.watchOnly ? 'Watch Only' : 'Single Signature')),
        account.watchOnly ? '' : row(t('account.script'), ss.text({}, 'Native Segwit (P2WPKH)')),
        row(t('account.derivationPath'), ss.text({}, "m/84'/1'/0'")),
        row(t('account.labeledTransactions'), ratio(lbTxs().filter((tx) => tx.label).length, n(0))),
        row(t('account.labeledUtxos'), ratio(coins.filter((c) => c.label).length, n(2))),
        row(t('account.labeledAddresses'), ratio(addressRows(account).filter((r) => r.label).length, n(1)))
      ].join('')}</div>`,
      ss.button({ label: t('account.nostrSync.sync'), variant: 'outline', go: 'account-nostr' }),
      ss.hstack({ className: 'lb-pair' },
        ss.button({ label: t('account.export.labels'), go: 'account-export-labels' }),
        ss.button({ label: t('account.import.labels'), go: 'account-import-labels' })),
      ss.vstack({},
        account.watchOnly ? '' : ss.button({ label: t('account.viewMnemonic'), go: 'account-export-seed-words' }),
        ss.hstack({ className: 'lb-pair' },
          ss.button({ label: t('account.export.descriptors'), go: 'account-export-descriptors' }),
          ss.button({ label: t('account.export.pubkeys'), go: 'account-export-pubkeys' }))),
      ss.vstack({ style: 'margin-top:32px' },
        ss.button({ label: t('account.rescan.title'), variant: 'outline', id: 'lb-rescan' }),
        ss.button({ label: t('account.delete.title'), variant: 'danger', id: 'lb-delete' }),
        ss.button({ label: t('common.save'), variant: 'secondary', id: 'lb-save' })))
  },
  overlays: () =>
    ss.modal({ id: 'lb-rescan-modal', showLabel: false },
      ss.vstack({ itemsCenter: true, style: 'margin:auto 0' },
        ss.text({ center: true, uppercase: true }, t('account.rescan.confirm')),
        ss.text({ center: true, color: 'muted' }, t('account.rescan.description')),
        ss.hstack({ style: 'width:100%' },
          ss.button({ label: t('common.yes'), variant: 'secondary', id: 'lb-rescan-yes', style: 'flex:1' }),
          ss.button({ label: t('common.no'), data: { 'ss-close': '' }, style: 'flex:1' })))) +
    ss.modal({ id: 'lb-delete-modal', showLabel: false },
      ss.vstack({ itemsCenter: true, style: 'margin:auto 0' },
        ss.text({ uppercase: true }, t('common.areYouSure')),
        ss.hstack({ style: 'width:100%' },
          ss.button({ label: t('common.yes'), variant: 'danger', id: 'lb-delete-yes', style: 'flex:1' }),
          ss.button({ label: t('common.no'), data: { 'ss-close': '' }, style: 'flex:1' })))),
  bind: (body) => {
    const section = document.getElementById('view-kit')
    body.querySelector('.lb-name input').addEventListener('input', (e) => (lbSettings[openAccountData.fingerprint].name = e.target.value))
    body.querySelector('#lb-rescan').onclick = () => ss.open('lb-rescan-modal')
    body.querySelector('#lb-delete').onclick = () => ss.open('lb-delete-modal')
    body.querySelector('#lb-save').onclick = () => {
      const name = lbSettings[openAccountData.fingerprint].name.trim()
      if (name) openAccountData.name = name
      go('account')
    }
    document.getElementById('lb-rescan-yes').onclick = () => {
      ss.close('lb-rescan-modal')
      lbAcct.syncing = true
      go('account')
      setTimeout(() => {
        lbAcct.syncing = false
        if (['account', 'coins', 'chart'].includes(kitCurrent)) openKitScreen(kitCurrent)
      }, 1500)
    }
    document.getElementById('lb-delete-yes').onclick = () => {
      ss.close('lb-delete-modal')
      ss.toast('Demo: accounts are fixtures and are not deleted', section)
      setTimeout(() => go('accounts'), 600)
    }
  }
})

// --- SSScriptVersionModal (SSSelectModal) -----------------------------------------------

const LB_SCRIPTS = ['P2PKH', 'P2SH-P2WPKH', 'P2WPKH', 'P2TR']
const LB_SCRIPT_NAMES = { P2PKH: 'Legacy (P2PKH)', 'P2SH-P2WPKH': 'Nested Segwit (P2SH-P2WPKH)', P2WPKH: 'Native Segwit (P2WPKH)', P2TR: 'Taproot (P2TR)' }

function lbScriptDescription(script) {
  const k = script.toLowerCase()
  return `${ss.esc(lbT(`script.${k}.description.1`, ''))} <u>${ss.esc(lbT(`script.${k}.link.name`, ''))}</u> ${ss.esc(lbT(`script.${k}.description.2`, ''))}`
}

registerScreen('script', {
  source: 'apps/mobile/components/SSScriptVersionModal.tsx',
  title: '',
  back: null,
  gear: false,
  render: () => {
    const k = lbScript.toLowerCase()
    return `<div class="lb-select">${ss.vstack({ justifyBetween: true, style: 'min-height:100%;padding-bottom:20px' },
      ss.vstack({ gap: 'lg' },
        ss.text({ center: true, color: 'muted', uppercase: true, style: 'min-height:40px' }, t('account.script')),
        ss.vstack({ style: 'padding-bottom:16px' }, LB_SCRIPTS.map((s) => ss.radio({ label: LB_SCRIPT_NAMES[s], selected: s === lbScript, group: 'lb-script', data: { 'lb-script': s } }))),
        ss.vstack({ gap: 'sm', style: 'padding-top:16px' },
          ss.text({ uppercase: true }, `${lbScript} - ${lbT(`script.${k}.name`, LB_SCRIPT_NAMES[lbScript].replace(/ \(.*\)/, ''))}`),
          ss.text({ color: 'muted', size: 'md', id: 'lb-script-desc' }, lbScriptDescription(lbScript)),
          `<svg class="lb-script-art" viewBox="0 0 300 80" fill="none" stroke="currentColor"><rect x="10" y="20" width="90" height="40" rx="3"/><rect x="200" y="20" width="90" height="40" rx="3"/><path d="M100 40h100" stroke-dasharray="4 4"/><text x="55" y="45" fill="currentColor" stroke="none" font-size="11" text-anchor="middle">${lbScript}</text><text x="245" y="45" fill="currentColor" stroke="none" font-size="11" text-anchor="middle">scriptPubKey</text></svg>`)),
      ss.vstack({ gap: 'sm' },
        ss.button({ label: t('common.select'), variant: 'secondary', id: 'lb-script-select' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', id: 'lb-script-cancel' })))}</div>`
  },
  bind: (body) => {
    let pick = lbScript
    body.addEventListener('click', (e) => {
      const r = e.target.closest('[data-lb-script]')
      if (r) {
        pick = r.dataset.lbScript
        body.querySelector('#lb-script-desc').innerHTML = lbScriptDescription(pick)
        body.querySelector('.ss-vstack[style*="padding-top:16px"] .ss-text.is-uppercase').textContent = `${pick} - ${lbT(`script.${pick.toLowerCase()}.name`, LB_SCRIPT_NAMES[pick].replace(/ \(.*\)/, ''))}`
      }
      if (e.target.closest('#lb-script-select')) {
        lbScript = pick
        go('new-singlesig')
      }
      if (e.target.closest('#lb-script-cancel')) go('new-singlesig')
    })
  }
})

// --- previewTransaction.tsx PSBT QR modal ----------------------------------------------

const lbQr = { mode: 'UR', density: 8, speed: 6, part: 0, timer: 0 }
const LB_PSBT = 'cHNidP8BAHECAAAAAa91c8f21b04e20aa11c0d4e20aa91c8f21b04e20aa11c0d4e20aa91c8f4e200000000000fdffffff02905f010000000000160014b20d91aa77c0e11f44aa91b20d91aa77c0e1917e0001000000000016'

function lbQrParts() {
  const n = Math.max(1, 13 - lbQr.density)
  if (lbQr.mode === 'RAW') return [LB_PSBT]
  if (lbQr.mode === 'BBQR') return Array.from({ length: n }, (_, i) => `B$ZP${String(n).padStart(2, '0')}${String(i).padStart(2, '0')}${LB_PSBT.slice(i * 9, i * 9 + 40)}`)
  return Array.from({ length: n }, (_, i) => `ur:crypto-psbt/${i + 1}-${n}/lpad${LB_PSBT.slice(i * 7, i * 7 + 48).toLowerCase()}`)
}

function lbQrDescription(parts) {
  if (lbQr.mode === 'RAW') return lbQr.density === 12 ? 'Static QR - Complete PSBT in single code' : lbT('transaction.preview.rawPSBT', 'Raw PSBT')
  return parts.length > 1
    ? lbT('transaction.preview.scanAllChunks', `Scan all ${parts.length} chunks (${lbQr.part + 1}/${parts.length})`, { current: lbQr.part + 1, total: parts.length })
    : lbT('transaction.preview.singleChunk', 'Single chunk')
}

registerScreen('psbt-qr', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/signAndSend/previewTransaction.tsx',
  title: '',
  back: 'preview',
  gear: false,
  render: () => {
    const parts = lbQrParts()
    lbQr.part = Math.min(lbQr.part, parts.length - 1)
    const value = parts[lbQr.part]
    return ss.vstack({ gap: 'xs', itemsCenter: true, style: 'padding:8px 0 20px' },
      ss.text({ uppercase: true, style: 'margin-bottom:5px' }, t('transaction.preview.PSBT')),
      `<div class="lb-qr-box" id="lb-qr">${ss.qr({ value, size: 250 })}</div>`,
      `<div class="lb-segment">${['RAW', 'UR', 'BBQR'].map((m) => `<button type="button" class="${lbQr.mode === m ? 'is-on' : ''}" data-lb-mode="${m}">${m}</button>`).join('')}</div>`,
      ss.text({ center: true, id: 'lb-qr-desc' }, lbQrDescription(parts)),
      `<div class="lb-mono-box" id="lb-qr-value">${ss.esc(value.length > 100 ? value.slice(0, 100) + '...' : value)}</div>`,
      ss.hstack({ justifyEvenly: true, style: 'width:100%;margin:12px 0 20px' },
        ss.vstack({ gap: 'xs', className: 'lb-step' }, ss.text({ center: true }, `QR density: ${lbQr.density}/12`), ss.hstack({ gap: 'sm', style: 'justify-content:center' }, ss.button({ label: '-', variant: 'outline', data: { 'lb-density': -1 } }), ss.button({ label: '+', variant: 'outline', data: { 'lb-density': 1 } }))),
        ss.vstack({ gap: 'xs', className: 'lb-step' }, ss.text({ center: true }, `${t('common.speed')}: ${lbQr.speed}/12`), ss.hstack({ gap: 'sm', style: 'justify-content:center' }, ss.button({ label: '-', variant: 'outline', data: { 'lb-speed': -1 } }), ss.button({ label: '+', variant: 'outline', data: { 'lb-speed': 1 } })))),
      parts.length === 1 ? ss.button({ label: t('common.share'), variant: 'outline', data: { 'ss-copy': value } }) : '',
      ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'preview' }))
  },
  bind: (body) => {
    clearInterval(lbQr.timer)
    const tick = () => {
      if (kitCurrent !== 'psbt-qr' || document.getElementById('view-kit').hidden) return clearInterval(lbQr.timer)
      const parts = lbQrParts()
      if (parts.length < 2) return
      lbQr.part = (lbQr.part + 1) % parts.length
      body.querySelector('#lb-qr').innerHTML = ss.qr({ value: parts[lbQr.part], size: 250 })
      body.querySelector('#lb-qr-desc').textContent = lbQrDescription(parts)
      const v = parts[lbQr.part]
      body.querySelector('#lb-qr-value').textContent = v.length > 100 ? v.slice(0, 100) + '...' : v
    }
    const restart = () => {
      clearInterval(lbQr.timer)
      lbQr.timer = setInterval(tick, 1300 - lbQr.speed * 100)
    }
    restart()
    body.addEventListener('click', (e) => {
      const m = e.target.closest('[data-lb-mode]')
      const d = e.target.closest('[data-lb-density]')
      const s = e.target.closest('[data-lb-speed]')
      if (m) {
        lbQr.mode = m.dataset.lbMode
        lbQr.part = 0
      } else if (d) lbQr.density = Math.max(1, Math.min(12, lbQr.density + Number(d.dataset.lbDensity)))
      else if (s) lbQr.speed = Math.max(1, Math.min(12, lbQr.speed + Number(s.dataset.lbSpeed)))
      else return
      openKitScreen('psbt-qr')
    })
  }
})

// --- SSMultisigKeyControl drop seed ----------------------------------------------------

const lbDropped = {}

registerScreen('seed-drop', {
  source: 'apps/mobile/components/SSMultisigKeyControl.tsx',
  title: () => openAccountData.name.toUpperCase(),
  back: 'account-settings',
  render: () => {
    const account = openAccountData || accounts[0]
    const dropped = lbDropped[account.fingerprint]
    return ss.vstack({ gap: 'lg', style: 'padding-top:12px' },
      ss.vstack({ gap: 'xs' },
        ss.text({ uppercase: true, color: 'muted' }, 'Key 1'),
        ss.text({ size: 'xl' }, dropped ? t('account.seed.droppedSeed', { name: account.name }) : account.name),
        lbFingerprint(account.fingerprint),
        ss.text({ type: 'mono', size: 'xs', color: 'muted', style: 'word-break:break-all' }, `vpub5Y${account.fingerprint}Lq3Gz7AE8FbXo2cJ9hYk4TtWmRv8sQpNuKx3Dn6Ze1Hj`)),
      ss.text({ color: 'muted' }, t('account.seed.dropSeedConfirm.message')),
      dropped
        ? ss.button({ label: t('account.seed.droppedSeed', { name: account.name }), variant: 'subtle', disabled: true })
        : ss.button({ label: t('account.seed.dropAndKeep.vpub'), variant: 'danger', id: 'lb-drop' }))
  },
  overlays: () =>
    ss.modal({ id: 'lb-drop-modal', showLabel: false },
      `<div style="margin:auto 0;width:100%"><div class="lb-white-card">${ss.vstack({ gap: 'lg', itemsCenter: true },
        ss.text({ size: 'lg', weight: 'bold', center: true, style: 'color:var(--black);margin-bottom:4px' }, t('account.seed.dropSeedConfirm.title')),
        ss.text({ color: 'muted', center: true, size: 'md', style: 'line-height:20px;max-width:260px' }, t('account.seed.dropSeedConfirm.message')),
        ss.hstack({ gap: 'sm', style: 'width:100%' },
          ss.button({ label: t('common.cancel'), variant: 'ghost', className: 'lb-cancel', data: { 'ss-close': '' }, style: 'flex:1' }),
          ss.button({ label: t('account.seed.dropSeedConfirm.confirm'), variant: 'danger', id: 'lb-drop-yes', style: 'flex:1' })))}</div></div>`),
  bind: (body) => {
    const drop = body.querySelector('#lb-drop')
    if (drop) drop.onclick = () => ss.open('lb-drop-modal')
    document.getElementById('lb-drop-yes').onclick = () => {
      lbDropped[openAccountData.fingerprint] = true
      openKitScreen('seed-drop')
    }
  }
})
