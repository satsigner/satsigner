/* Explorer › block, chain, chain tip, halving, mempool
   app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/{block/*, chain, chaintip, halving, mempool}
   Ids: explorer-block, explorer-block-detail, explorer-block-hex, explorer-block-transactions,
   explorer-chain, explorer-chaintip, explorer-halving, explorer-mempool.
   All data is fixture data derived from a tip height that matches the hand-ported Difficulty screen. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  .ec-pad { padding-top: 20px; padding-bottom: 32px; }
  .ec-nav { display: flex; align-items: center; gap: var(--layout-h-stack-gap-sm); }
  .ec-nav-btn { display: flex; align-items: center; justify-content: center; flex: none; width: var(--sizes-text-input-height-default); height: var(--sizes-text-input-height-default); border: 1px solid var(--gray-700); border-radius: 8px; background: none; color: var(--white); cursor: pointer; }
  .ec-nav-btn[disabled] { border-color: var(--gray-800); color: var(--gray-600); opacity: 0.55; cursor: default; }
  .ec-nav-btn:not([disabled]):active { opacity: 0.65; }
  .ec-nav-mid { flex: 1; min-width: 0; }
  .ec-example { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 14px 0; border: 0; border-bottom: 1px solid var(--gray-800); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .ec-example:active { opacity: 0.7; }
  .ec-example .ss-icon { color: var(--gray-600); }
  .ec-green { color: var(--main-green); opacity: 0.8; }
  .ec-muted5 { color: var(--gray-500); }
  .ec-txcount { display: flex; flex-direction: column; align-items: center; margin-top: var(--layout-v-stack-gap-xs); border: 0; padding: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
  .ec-txcount[disabled] { cursor: default; }
  .ec-bar { display: flex; flex-direction: column; align-items: center; }
  .ec-bar > div { display: flex; flex-direction: column; justify-content: center; width: 100px; }
  .ec-bar .ss-text { white-space: pre-line; }
  .ec-capacity { align-items: center; width: 100%; margin: var(--layout-v-stack-gap-xs) 0 var(--layout-v-stack-gap-md); }
  .ec-banner { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid var(--gray-800); border-radius: 8px; }
  .ec-section-title { color: var(--gray-200); letter-spacing: 1px; }
  .ec-track { display: flex; width: 100%; height: 16px; overflow: hidden; border-radius: 4px; }
  .ec-track i { display: block; height: 100%; min-width: 2px; }
  .ec-bars { display: flex; align-items: flex-end; gap: 1px; }
  .ec-bars i { display: block; flex: 1; min-width: 2px; max-width: 6px; border-radius: 1px; }
  .ec-hex-chip { padding: 6px 10px; border: 0; border-radius: 2px; background: none; color: var(--gray-300); font: inherit; font-size: var(--sizes-text-font-size-xxs); cursor: pointer; }
  .ec-hex-chip.is-on { background: var(--gray-600); color: var(--white); font-weight: var(--sizes-text-font-weight-medium); }
  .ec-hex-scroll { width: 100%; padding-bottom: 24px; }
  .ec-hex-raw { margin: 0; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: var(--sizes-text-font-size-xxs); line-height: 18px; word-break: break-all; color: var(--white); }
  .ec-hex-dump { margin: 0; overflow-x: auto; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 7px; line-height: 12px; white-space: pre; color: var(--white); }
  .ec-zoom { display: flex; justify-content: flex-end; margin-bottom: 4px; }
  .ec-zoom button { padding: 4px 12px; border: 0; background: none; color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-xl); cursor: pointer; }
  .ec-zoom button[disabled] { opacity: 0.5; cursor: default; }
  .ec-bytes { display: flex; flex-wrap: wrap; }
  .ec-bytes b { margin-bottom: -1px; padding: 2.6px; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-weight: 400; cursor: pointer; }
  .ec-bytes b.is-on { background: var(--white); color: var(--black) !important; }
  .ec-selected { min-height: 72px; margin-top: 12px; }
  .ec-txrow { padding: 8px 0; border-top: 1px solid var(--bar-gray); }
  .ec-txrow .ss-text.is-mono { word-break: break-all; }
  .ec-link { border: 0; padding: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .ec-row { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; }
  .ec-row.is-link { width: 100%; border: 0; background: none; font: inherit; cursor: pointer; }
  .ec-label { color: var(--gray-400); }
  .ec-value { color: var(--gray-100); }
  .ec-sec { color: var(--gray-400); letter-spacing: 1.5px; }
  .ec-hash { margin: 0; color: var(--gray-100); font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: var(--sizes-text-font-size-xs); word-break: break-all; }
  .ec-underline { margin-top: 4px; text-decoration: underline; }
  .ec-chart-box { box-sizing: border-box; height: 324px; padding: 12px; border: 1px solid var(--gray-700); border-radius: 4px; }
  .ec-chart-box svg, .ec-price svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .ec-price { height: 220px; margin: 0 calc(-1 * var(--layout-main-container-padding-horizontal)); }
  .ec-up { color: var(--main-green); }
  .ec-down { color: var(--main-red); }
  .ec-halving-svg { display: block; width: 100%; height: 280px; margin-bottom: -24px; }
  .ec-hrow { display: flex; align-items: center; height: 28px; width: 100%; border: 0; padding: 0; background: none; font: inherit; text-align: left; }
  .ec-hrow:not([disabled]) { cursor: pointer; }
  .ec-hrow:not([disabled]):active { opacity: 0.7; }
  .ec-hhead { display: flex; align-items: flex-start; padding-bottom: 4px; }
  .ec-hhead .ss-text { color: var(--gray-600); letter-spacing: 1px; white-space: pre-line; }
  .ec-c-epoch { flex: 0.5; }
  .ec-c-height, .ec-c-subsidy { flex: 1.5; }
  .ec-c-date { flex: 2; text-align: right; }
  .ec-c-circle { display: flex; align-items: center; justify-content: center; flex: none; width: 108px; overflow: visible; }
  .ec-c-circle i { display: block; flex: none; border-radius: 50%; }
  .ec-h-current { color: var(--white) !important; }
  .ec-h-past { color: var(--gray-400) !important; }
  .ec-h-future { color: var(--gray-500) !important; }
  .ec-backlog { display: flex; align-items: center; justify-content: space-between; padding: var(--layout-v-stack-gap-xxs) 0; }
  .ec-backlog .ec-eta { width: 36px; }
  .ec-backlog .ec-fee { flex: 1; color: var(--gray-100); }
  .ec-backlog .ec-txs { min-width: 72px; text-align: right; }
  .ec-center { display: flex; align-items: center; justify-content: center; padding: 60px 0; }
  .ec-center.is-sm { padding: 24px 0; }
  .ec-details { width: 100%; }
  .ec-details .ss-text { word-break: break-all; }
  </style>`
)

// --- fixtures --------------------------------------------------------------------------

const EC_TIP = 972231 // matches the hand-ported Difficulty screen (epoch 482)
const EC_HALVING = 210000
const EC_SUBSIDY0 = 5000000000
const EC_GENESIS_TIME = 1231006505
const EC_NOW = Math.floor(Date.UTC(2026, 9, 20, 13, 42) / 1000)
const EC_SOURCE = 'Mempool (esplora)'
const EC_MAX_WEIGHT = 4000000

const EC_EXAMPLES = [
  { height: 0, label: 'Genesis', description: 'Genesis block — Times headline embedded in the coinbase (Jan 3, 2009)' },
  { height: 1, label: 'Block 1', description: 'Block 1 — first block after genesis (mined 6 days later)' },
  { height: 170, label: 'First Tx', description: 'First peer-to-peer payment — Satoshi → Hal Finney, 10 BTC (Jan 12, 2009)' },
  { height: 57043, label: 'Pizza Day', description: 'Pizza Day — 10,000 BTC paid for two pizzas (May 22, 2010)' },
  { height: 74638, label: 'Overflow Bug', description: 'Value overflow incident — 184 billion BTC bug (Aug 15, 2010)' },
  { height: 100000, label: '100K', description: '100,000th block — early network maturity milestone' },
  { height: 210000, label: '1st Halving', description: 'First halving — block subsidy 50 → 25 BTC (Nov 28, 2012)' },
  { height: 420000, label: '2nd Halving', description: 'Second halving — block subsidy 25 → 12.5 BTC (Jul 9, 2016)' },
  { height: 478558, label: 'BCH Fork', description: 'Bitcoin Cash hard fork — last shared BTC/BCH block (Aug 1, 2017)' },
  { height: 481824, label: 'SegWit', description: 'SegWit activation — BIP141 soft fork (Aug 24, 2017)' },
  { height: 500000, label: '500K', description: '500,000th block — mid-history milestone' },
  { height: 630000, label: '3rd Halving', description: 'Third halving — block subsidy 12.5 → 6.25 BTC (May 11, 2020)' },
  { height: 709632, label: 'Taproot', description: 'Taproot activation — BIP341 soft fork (Nov 14, 2021)' },
  { height: 767430, label: 'Ordinals', description: 'First Ordinals inscription — inscription #0 by Casey Rodarmor (Dec 14, 2022)' },
  { height: 840000, label: '4th Halving', description: 'Fourth halving — block subsidy 6.25 → 3.125 BTC (Apr 20, 2024)' }
]

const EC_GENESIS = {
  id: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
  merkle: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
  coinbase:
    '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000'
}

// Navigation state shared by these screens.
const ecState = {
  input: '',
  height: EC_TIP,
  detailBack: 'explorer-block',
  hexMode: 'raw',
  hexSize: 0,
  hexField: 0,
  txVisible: 20,
  vizLoaded: {},
  vizLoading: false,
  chaintipExternal: false,
  chainExternal: false,
  mempoolExternal: false,
  externalLoading: false
}

// Deterministic hex from a seed (FNV + xorshift).
function ecHex(seed, length) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0
  let out = ''
  for (let i = 0; out.length < length; i += 1) {
    h = Math.imul(h ^ (i + 1), 16777619) >>> 0
    h = (h ^ (h >>> 13)) >>> 0
    out += h.toString(16).padStart(8, '0')
  }
  return out.slice(0, length)
}

function ecRand(seed) {
  return parseInt(ecHex(seed, 8), 16) / 0xffffffff
}

function ecTimestamp(height) {
  if (height === 0) return EC_GENESIS_TIME
  return Math.round(EC_GENESIS_TIME + 6 * 86400 + ((EC_NOW - EC_GENESIS_TIME - 6 * 86400) * height) / EC_TIP)
}

function ecSubsidySats(height) {
  return Math.floor(EC_SUBSIDY0 / 2 ** Math.floor(height / EC_HALVING))
}

function ecBlock(height) {
  if (height === 0) {
    return {
      height: 0, id: EC_GENESIS.id, previousblockhash: '0'.repeat(64), merkle_root: EC_GENESIS.merkle,
      timestamp: EC_GENESIS_TIME, mediantime: EC_GENESIS_TIME, version: 1, nonce: 2083236893, bits: '1d00ffff',
      difficulty: 1, tx_count: 1, size: 285, weight: 1140
    }
  }
  const r = ecRand('block' + height)
  const era = height / EC_TIP
  const modern = height > 400000
  const txCount = height < 100000 ? 1 + Math.floor(r * 4) : Math.round(400 + era * 3600 + r * 900)
  const weight = height < 100000 ? 900 + Math.floor(r * 1600) : Math.min(EC_MAX_WEIGHT - 400, Math.round(EC_MAX_WEIGHT * (0.55 + era * 0.4 + r * 0.05)))
  const size = height < 100000 ? Math.round(weight / 4) : Math.round(weight * (0.37 + r * 0.05))
  const zeros = height < 200000 ? 8 : height < 600000 ? 16 : 19
  const ts = ecTimestamp(height)
  return {
    height,
    id: '0'.repeat(zeros) + ecHex('hash' + height, 64 - zeros),
    previousblockhash: '0'.repeat(zeros) + ecHex('hash' + (height - 1), 64 - zeros),
    merkle_root: ecHex('merkle' + height, 64),
    timestamp: ts,
    mediantime: ts - 1800 - Math.floor(r * 1200),
    version: modern ? 536870912 + Math.floor(r * 8) * 4 : height < 227000 ? 1 : 2,
    nonce: Math.floor(ecRand('nonce' + height) * 4294967295),
    bits: modern ? '17' + ecHex('bits' + height, 6) : '1b' + ecHex('bits' + height, 6),
    difficulty: Math.round(140577680051920 * (era ** 4.2) * (0.98 + r * 0.04)) || 1,
    tx_count: txCount,
    size,
    weight
  }
}

function ecViz(block) {
  const n = Math.min(block.tx_count, 120)
  const sample = []
  for (let i = 0; i < n; i += 1) {
    const r = ecRand('tx' + block.height + ':' + i)
    sample.push({ txid: ecHex('txid' + block.height + ':' + i, 64), feeRate: i === 0 ? 0 : Math.round((1 + r ** 3 * 80) * 10) / 10, weight: Math.round(400 + r ** 2 * 6000) })
  }
  const sorted = sample.map((s) => s.feeRate).filter((f) => f > 0).sort((a, b) => a - b)
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] || 0
  const totalFees = Math.round(block.tx_count * 2100 * (0.6 + ecRand('fees' + block.height)))
  return {
    sampleTxs: sample,
    txCount: block.tx_count,
    extras: {
      feeRange: [q(0), q(0.1), q(0.25), q(0.5), q(0.75), q(0.9), q(0.99), q(1)],
      medianFee: q(0.5),
      pool: { name: ['Foundry USA', 'AntPool', 'ViaBTC', 'F2Pool', 'SpiderPool', 'MARA Pool'][Math.floor(ecRand('pool' + block.height) * 6)] },
      totalFees,
      reward: ecSubsidySats(block.height) + totalFees,
      avgFeeRate: sorted.reduce((s, f) => s + f, 0) / (sorted.length || 1),
      avgFee: Math.round(totalFees / block.tx_count),
      avgTxSize: Math.round(block.size / block.tx_count),
      virtualSize: Math.ceil(block.weight / 4),
      totalInputs: Math.round(block.tx_count * 2.4),
      totalOutputs: Math.round(block.tx_count * 2.9),
      segwitTotalTxs: Math.round(block.tx_count * 0.93),
      matchRate: 97 + Math.round(ecRand('match' + block.height) * 3)
    }
  }
}

// --- formatting helpers (utils/format.ts) ---------------------------------------------

const ecNum = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const ecDate = (ms) => new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms))
const ecTime = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const ecBlockDate = (ts) => (ts ? `${ecDate(ts * 1000)} ${ecTime(ts * 1000)}` : '')

function ecBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  const decimals = [0, 1, 2, 2]
  const i = bytes < 1000 ? 0 : Math.min(3, Math.floor(Math.log(bytes) / Math.log(1000)))
  return `${Number((bytes / 1000 ** i).toFixed(decimals[i]))} ${units[i]}`
}

// --- shared building blocks ------------------------------------------------------------

// SSExplorerCapabilityBanner
function ecBanner(p) {
  return `<div class="ec-banner">${ss.vstack({ gap: 'sm' },
    ss.text({ color: 'muted' }, p.why),
    ss.text({ size: 'xs', color: 'muted' }, p.fix),
    ss.button({ variant: 'outline', label: p.loadLabel || t('explorer.capability.loadMempool'), id: p.id, loading: p.loading, disabled: p.disabled }),
    ss.text({ size: 'xxs', center: true, color: 'muted' }, p.note || t('explorer.capability.externalNote')))}</div>`
}

// SSExplorerSection
function ecSection(title, sourceLabel, source, ...children) {
  return ss.vstack({ gap: 'sm' },
    ss.hstack({ justifyBetween: true },
      ss.text({ uppercase: true, size: 'md', className: 'ec-section-title' }, title),
      sourceLabel ? ss.text({ size: 'xxs', className: source === 'backend' ? 'ec-green' : 'ec-muted5' }, sourceLabel) : ''),
    ...children)
}

// SectionHeader + Row used by chain, chaintip, halving and mempool screens
function ecHeader(title, source, sourceLabel) {
  return ss.hstack({ justifyBetween: true },
    ss.text({ uppercase: true, size: 'md', className: 'ec-sec' }, title),
    source && sourceLabel ? ss.text({ size: 'xxs', className: source === 'backend' ? 'ec-green' : 'ec-muted5' }, sourceLabel) : '')
}

function ecRow(label, value, go) {
  const inner = ss.text({ as: 'span', className: 'ec-label' }, label) + ss.text({ as: 'span', className: 'ec-value' }, value)
  return go ? `<button type="button" class="ec-row is-link" data-ec-block="${go}">${inner}</button>` : `<div class="ec-row">${inner}</div>`
}

function ecNavButton(dir, disabled, id) {
  return `<button type="button" class="ec-nav-btn" id="${id}"${disabled ? ' disabled' : ''} aria-label="${dir}">${ss.icon(dir === 'prev' ? 'chevronLeft' : 'chevronRight', { size: 18 })}</button>`
}

function ecOpenBlock(height, back) {
  ecState.height = height
  ecState.detailBack = back
  ecState.hexField = 0
  ecState.txVisible = 20
  go('explorer-block-detail')
}

// Clicking any [data-ec-block] opens that block; back returns to the current screen.
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-ec-block]')
  if (!link || !kitCurrent || !String(kitCurrent).startsWith('explorer-')) return
  ecOpenBlock(Number(link.dataset.ecBlock), kitCurrent)
})

// --- block/index.tsx -------------------------------------------------------------------

registerScreen('explorer-block', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/block/index.tsx',
  title: () => t('explorer.block.title'),
  back: 'explorer',
  render: () => {
    const value = ecState.input
    const n = Number(value)
    const valid = value !== '' && Number.isInteger(n) && n >= 0 && n <= EC_TIP
    return ss.vstack({ gap: 'md', style: 'padding-top:16px;padding-bottom:24px' },
      `<div class="ec-nav">${ecNavButton('prev', !valid || n <= 0, 'ec-prev')}<div class="ec-nav-mid">${numberInput({
        variant: 'outline', min: 0, max: EC_TIP, value, placeholder: t('explorer.block.placeholder'), name: 'height'
      })}</div>${ecNavButton('next', !valid || n >= EC_TIP, 'ec-next')}</div>`,
      ss.button({ label: t('explorer.block.load'), variant: 'outline', id: 'ec-load', disabled: !valid }),
      ss.button({ label: t('explorer.block.latest'), variant: 'ghost', id: 'ec-latest' }),
      ss.vstack({ gap: 'none' },
        EC_EXAMPLES.map((ex) =>
          `<button type="button" class="ec-example" data-ec-block="${ex.height}">${ss.vstack({ gap: 'xxs', style: 'flex:1;padding-right:12px' },
            ss.text({ weight: 'medium' }, ex.label),
            ss.text({ size: 'xxs', color: 'muted' }, ex.description),
            ss.text({ type: 'mono', size: 'xxs', color: 'muted' }, `Block ${ex.height.toLocaleString('en-US')}`))}${ss.icon('chevronRight', { size: 12 })}</button>`)))
  },
  bind: (body) => {
    const input = body.querySelector('input[name=height]')
    const sync = () => {
      ecState.input = input.value.trim()
      const n = Number(ecState.input)
      const valid = ecState.input !== '' && Number.isInteger(n) && n >= 0 && n <= EC_TIP
      body.querySelector('#ec-load').disabled = !valid
      body.querySelector('#ec-prev').disabled = !valid || n <= 0
      body.querySelector('#ec-next').disabled = !valid || n >= EC_TIP
    }
    input.addEventListener('input', sync)
    const step = (d) => {
      input.value = String(Math.min(EC_TIP, Math.max(0, Number(input.value) + d)))
      sync()
    }
    body.querySelector('#ec-prev').onclick = () => step(-1)
    body.querySelector('#ec-next').onclick = () => step(1)
    body.querySelector('#ec-load').onclick = () => ecOpenBlock(Number(ecState.input), 'explorer-block')
    const latest = body.querySelector('#ec-latest')
    latest.onclick = () => {
      latest.disabled = true
      latest.innerHTML = '<span class="ss-spinner"></span>'
      setTimeout(() => ecOpenBlock(EC_TIP, 'explorer-block'), 500)
    }
  }
})

// --- block/[block]/index.tsx (+ SSExploreBlock and the analytics components) -----------

function ecExploreBlock(block) {
  const vsize = Math.ceil(block.weight / 4)
  const pct = (100 * block.weight) / EC_MAX_WEIGHT
  const empty = pct <= 0 ? 100 : Math.min(99.9, 100 - pct)
  const fill = pct <= 0 ? 0 : Math.max(1, pct)
  const hash = (h) => (h.startsWith('0000') ? h : h.split('').reverse().join(''))
  const capacityRow = (label, hint, value) =>
    ss.vstack({ gap: 'none', style: 'width:100%' },
      ss.hstack({ justifyBetween: true, style: 'width:100%' }, ss.text({ size: 'xs', weight: 'medium' }, label), ss.text({ size: 'xs', type: 'mono' }, value)),
      ss.text({ size: 'xxs', color: 'muted' }, hint))
  return ss.vstack({ gap: 'none', itemsCenter: true },
    ss.vstack({ gap: 'xxs', itemsCenter: true },
      ss.text({ weight: 'bold' }, String(block.height || '?')),
      ss.text({ size: 'xxs', className: 'ec-green' }, EC_SOURCE),
      `<button type="button" class="ec-txcount" id="ec-open-txs">${ss.text({ size: '3xl', weight: 'bold', type: 'mono', center: true }, ecNum(block.tx_count))}${ss.text({
        size: 'xs', color: 'muted', center: true, uppercase: true
      }, t('explorer.block.txCount'))}${ss.text({ size: 'xxs', color: 'muted', center: true }, t('explorer.block.viewTransactions'))}</button>`),
    ss.vstack({ gap: 'sm', className: 'ec-capacity' },
      `<div class="ec-bar"><div style="background:var(--white);height:${100 - fill}px">${
        pct <= 30 ? ss.text({ size: 'xs', color: 'black', center: true }, t('explorer.block.percentageEmpty', { percentage: ecNum(empty, 1) })) : ''
      }</div><div style="background:var(--gray-300);height:${fill}px">${
        pct > 30 ? ss.text({ size: 'xs', center: true }, t('explorer.block.percentageFull', { percentage: ecNum(pct, 1) })) : ''
      }</div></div>`,
      ss.vstack({ gap: 'xs', style: 'width:100%' },
        capacityRow(t('explorer.block.capacity.vbytesLabel'), t('explorer.block.capacity.vbytesHint'), t('explorer.block.capacity.vbytes', { max: ecNum(1000000), used: ecNum(vsize) })),
        capacityRow(t('explorer.block.capacity.sizeLabel'), t('explorer.block.capacity.sizeHint'), t('explorer.block.capacity.size', { max: ecNum(4000000), used: ecNum(block.size) })),
        ss.text({ size: 'xxs', color: 'muted', center: true }, t('explorer.block.capacity.note')))),
    `<div class="ec-details">${ss.detailsList({
      columns: 2,
      items: [
        [t('explorer.block.id'), hash(block.id), { copyToClipboard: true, width: '100%' }],
        [t('explorer.block.date'), ecBlockDate(block.timestamp)],
        [t('explorer.block.dateMedian'), ecBlockDate(block.mediantime)],
        [t('explorer.block.version'), block.version],
        [t('explorer.block.nonce'), block.nonce],
        [t('explorer.block.difficulty'), block.difficulty],
        [t('explorer.block.weight'), `${ecNum(block.weight)} / ${ecNum(EC_MAX_WEIGHT)} WU`],
        [t('explorer.block.merkleRoot'), block.merkle_root, { width: '100%' }],
        [t('explorer.block.prevHash'), hash(block.previousblockhash), { width: '100%' }]
      ]
    })}</div>`)
}

// SSExplorerBlockFeeRange / FeeRateBars / TxSizeBars / BlockVizStats
function ecVizSection(viz) {
  const e = viz.extras
  const range = e.feeRange
  const min = range[0]
  const max = range[range.length - 1]
  const colors = ['var(--gray-700)', 'var(--gray-600)', 'var(--gray-500)', 'var(--main-green)', 'var(--gray-400)', 'var(--gray-300)', 'var(--white)']
  const segs = range.slice(0, -1).map((start, i) => {
    const span = Math.max((range[i + 1] ?? start) - start, 0.01)
    return `<i style="flex:${span / Math.max(max - min, 0.01)};background:${colors[i] || 'var(--gray-500)'}"></i>`
  })
  const maxRate = Math.max(...viz.sampleTxs.map((tx) => tx.feeRate), 1)
  const rateColor = (f) => (f >= 50 ? 'var(--white)' : f >= 10 ? 'var(--gray-300)' : f >= 3 ? 'var(--main-green)' : 'var(--gray-600)')
  const maxW = Math.max(...viz.sampleTxs.map((tx) => tx.weight), 1)
  const stat = (label, value) => ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted' }, label), ss.text({}, value))
  return ecSection(t('explorer.block.viz.title'), 'mempool.space', 'mempool',
    ss.vstack({ gap: 'xs' },
      ss.text({ size: 'xs', color: 'muted' }, t('explorer.block.viz.feeRange')),
      `<div class="ec-track">${segs.join('')}</div>`,
      ss.hstack({ justifyBetween: true },
        ss.text({ size: 'xxs', color: 'muted' }, `${ecNum(min, 1)} sat/vB`),
        ss.text({ size: 'xxs' }, t('explorer.block.viz.medianFee', { rate: ecNum(e.medianFee, 1) })),
        ss.text({ size: 'xxs', color: 'muted' }, `${ecNum(max, 1)} sat/vB`))),
    ss.vstack({ gap: 'xs' },
      ss.text({ size: 'xs', color: 'muted' }, t('explorer.block.viz.feeRateSample', { count: viz.sampleTxs.length, total: viz.txCount })),
      `<div class="ec-bars" style="height:56px">${viz.sampleTxs.map((tx) => `<i style="background:${rateColor(tx.feeRate)};height:${Math.max(4, (tx.feeRate / maxRate) * 56)}px"></i>`).join('')}</div>`),
    ecSizeBars(viz.sampleTxs.map((tx) => tx.weight), viz.txCount, maxW),
    ss.vstack({ gap: 'xs' },
      stat(t('explorer.block.viz.pool'), e.pool.name),
      stat(t('explorer.block.viz.totalFees'), `${ecNum(e.totalFees)} sats`),
      stat(t('explorer.block.viz.reward'), `${ecNum(e.reward)} sats`),
      stat(t('explorer.block.viz.avgFeeRate'), `${ecNum(e.avgFeeRate, 1)} sat/vB`),
      stat(t('explorer.block.viz.avgFee'), `${ecNum(e.avgFee)} sats`),
      stat(t('explorer.block.viz.avgTxSize'), `${ecNum(e.avgTxSize)} B`),
      stat(t('explorer.block.viz.virtualSize'), `${ecNum(e.virtualSize)} vB`),
      stat(t('explorer.block.viz.inputsOutputs'), `${ecNum(e.totalInputs)} / ${ecNum(e.totalOutputs)}`),
      stat(t('explorer.block.viz.segwitShare'), `${ecNum((100 * e.segwitTotalTxs) / viz.txCount, 1)}%`),
      stat(t('explorer.block.viz.matchRate'), `${ecNum(e.matchRate)}%`)))
}

// SSExplorerTxSizeBars
function ecSizeBars(sizes, total, maxSize) {
  const max = maxSize || Math.max(...sizes, 1)
  return ss.vstack({ gap: 'xs' },
    ss.text({ size: 'xs', color: 'muted' }, t('explorer.block.txSizeSample', { count: sizes.length, total })),
    `<div class="ec-bars" style="height:48px">${sizes.map((s) => `<i style="background:var(--gray-400);height:${Math.max(4, (s / max) * 48)}px"></i>`).join('')}</div>`)
}

registerScreen('explorer-block-detail', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/block/[block]/index.tsx',
  title: () => t('explorer.block.detailsTitle'),
  back: () => ecState.detailBack || 'explorer-block',
  render: () => {
    const block = ecBlock(ecState.height)
    const loaded = ecState.vizLoaded[block.height]
    return ss.vstack({ gap: 'md', style: 'padding-bottom:20px' },
      ecExploreBlock(block),
      !loaded
        ? ecBanner({ why: t('explorer.block.viz.why'), fix: t('explorer.block.viz.fix'), loadLabel: t('explorer.block.viz.load'), id: 'ec-viz-load', loading: ecState.vizLoading })
        : ecVizSection(ecViz(block)),
      ss.vstack({ gap: 'sm' },
        `<div class="ec-nav">${ecNavButton('prev', block.height <= 0, 'ec-prev')}<div class="ec-nav-mid">${ss.text({ center: true, size: 'lg' }, String(block.height))}</div>${ecNavButton('next', block.height >= EC_TIP, 'ec-next')}</div>`,
        ss.vstack({ gap: 'xxs' },
          ss.hstack({ gap: 'sm' },
            ss.button({ variant: 'ghost', label: t('explorer.block.viewHex'), id: 'ec-view-hex', style: 'flex:1' }),
            ss.button({ variant: 'ghost', label: t('explorer.block.downloadRawHex'), id: 'ec-download-hex', style: 'flex:1' })),
          ss.text({ size: 'xxs', center: true, color: 'muted' }, t('explorer.block.downloadRawHexSource', { source: EC_SOURCE })))))
  },
  bind: (body) => {
    const block = ecBlock(ecState.height)
    // Example label above the title (headerTitle in the app).
    const example = EC_EXAMPLES.find((ex) => ex.height === block.height)
    const title = document.getElementById('kit-title')
    if (example) title.innerHTML = `<span style="display:block;font-size:var(--sizes-text-font-size-xs);color:var(--gray-300);text-transform:none;letter-spacing:0">${example.label}</span>${t('explorer.block.detailsTitle')}`
    const move = (d) => {
      ecState.height = Math.min(EC_TIP, Math.max(0, ecState.height + d))
      openKitScreen('explorer-block-detail')
    }
    body.querySelector('#ec-prev').onclick = () => move(-1)
    body.querySelector('#ec-next').onclick = () => move(1)
    body.querySelector('#ec-open-txs').onclick = () => {
      ecState.txVisible = 20
      go('explorer-block-transactions')
    }
    body.querySelector('#ec-view-hex').onclick = () => go('explorer-block-hex')
    const dl = body.querySelector('#ec-download-hex')
    dl.onclick = () => {
      dl.disabled = true
      dl.innerHTML = '<span class="ss-spinner"></span>'
      setTimeout(() => {
        dl.disabled = false
        dl.innerHTML = `<span class="ss-button-label">${t('explorer.block.downloadRawHex')}</span>`
        ss.toast(`${block.id.slice(0, 16)}….hex`, document.getElementById('view-kit'))
      }, 600)
    }
    const viz = body.querySelector('#ec-viz-load')
    if (viz)
      viz.onclick = () => {
        ecState.vizLoading = true
        openKitScreen('explorer-block-detail')
        setTimeout(() => {
          ecState.vizLoading = false
          ecState.vizLoaded[block.height] = true
          if (kitCurrent === 'explorer-block-detail') openKitScreen('explorer-block-detail')
        }, 700)
      }
  }
})

// --- block/[block]/hex.tsx (+ SSBlockDecoded) -------------------------------------------

const EC_BLOCK_COLORS = { blockVersion: '#ffffff', prevHash: '#4A90D9', merkleRoot: '#9B59B6', timestamp: '#F39C12', bits: '#1ABC9C', nonce: '#E67E22', txCount: '#aaaaaa' }
const EC_TX_COLORS = {
  version: '#fff', txInVarInt: '#888', txInHash: '#E01919', txInIndex: '#860B0B', txInScriptVarInt: '#DD9595', txInScript: '#860B0B',
  txInSequence: '#860B0B', txOutVarInt: '#aaa', txOutValue: '#07BC03', txOutScriptVarInt: '#93CC92', txOutScript: '#C13939',
  txOutScriptNonStandard: '#608A64', locktime: '#eee'
}
const EC_HEX_SIZES = ['xxs', 'xs', 'sm', 'md']

const ecLE = (n, bytes) => {
  let out = ''
  for (let i = 0; i < bytes; i += 1) out += ((Math.floor(n / 256 ** i)) & 255).toString(16).padStart(2, '0')
  return out
}
const ecRev = (hex) => hex.match(/../g).reverse().join('')
const ecVarInt = (n) => (n < 0xfd ? ecLE(n, 1) : n <= 0xffff ? 'fd' + ecLE(n, 2) : 'fe' + ecLE(n, 4))

// Header + tx count + the coinbase. The coinbase body is the genesis coinbase for every block
// (prototype only); the decoded view says how many of the block's txs it decoded.
function ecBlockHex(block) {
  const fields = [
    { field: 'blockVersion', hex: ecLE(block.version, 4), value: block.version },
    { field: 'prevHash', hex: ecRev(block.previousblockhash), value: block.previousblockhash },
    { field: 'merkleRoot', hex: ecRev(block.height === 0 ? EC_GENESIS.merkle : block.merkle_root), value: block.merkle_root },
    { field: 'timestamp', hex: ecLE(block.timestamp, 4), value: block.timestamp },
    { field: 'bits', hex: ecRev(block.bits), value: block.bits },
    { field: 'nonce', hex: ecLE(block.nonce, 4), value: block.nonce },
    { field: 'txCount', hex: ecVarInt(block.tx_count), value: block.tx_count }
  ]
  const cb = EC_GENESIS.coinbase
  let i = 0
  const take = (n) => {
    const s = cb.slice(i, i + n * 2)
    i += n * 2
    return s
  }
  const tx = (field, hex, value, placeholders) => fields.push({ field, hex, value, placeholders: { tx: 0, ...placeholders } })
  const version = take(4)
  tx('version', version, parseInt(ecRev(version), 16))
  tx('txInVarInt', take(1), 1)
  const prev = take(32)
  tx('txInHash', prev, ecRev(prev), { input: 0 })
  const idx = take(4)
  tx('txInIndex', idx, parseInt(ecRev(idx), 16), { input: 0 })
  const sLen = take(1)
  tx('txInScriptVarInt', sLen, parseInt(sLen, 16), { input: 0 })
  const script = take(parseInt(sLen, 16))
  tx('txInScript', script, script, { input: 0 })
  const seq = take(4)
  tx('txInSequence', seq, parseInt(ecRev(seq), 16), { input: 0 })
  tx('txOutVarInt', take(1), 1)
  const value = take(8)
  tx('txOutValue', value, parseInt(ecRev(value), 16), { output: 0 })
  const oLen = take(1)
  tx('txOutScriptVarInt', oLen, parseInt(oLen, 16), { output: 0 })
  const oScript = take(parseInt(oLen, 16))
  tx('txOutScriptNonStandard', oScript, oScript, { output: 0 })
  const lock = take(4)
  tx('locktime', lock, parseInt(ecRev(lock), 16))
  return { fields, hex: fields.map((f) => f.hex).join(''), decoded: 1, total: block.tx_count }
}

// utils/hexDump.ts formatHexDump
function ecHexDump(hex, perLine = 16) {
  const total = Math.floor(hex.length / 2)
  const lines = []
  for (let off = 0; off < total; off += perLine) {
    let h = ''
    let a = ''
    for (let j = 0; j < perLine; j += 1) {
      if (off + j < total) {
        const b = hex.slice((off + j) * 2, (off + j) * 2 + 2)
        const v = parseInt(b, 16)
        h += b + ' '
        a += v >= 32 && v <= 126 ? String.fromCharCode(v) : '.'
      } else {
        h += '   '
        a += ' '
      }
      if (j === 7 && perLine > 8) h += ' '
    }
    lines.push(`${off.toString(16).padStart(8, '0')}  ${h} |${a}|`)
  }
  return lines.join('\n')
}

function ecDecodedLabel(f) {
  const isBlock = f.field in EC_BLOCK_COLORS
  const ph = f.placeholders || {}
  const base = isBlock ? 'explorer.block.decoded.' : 'transaction.decoded.'
  const key = isBlock ? f.field : f.field
  return {
    label: t(base + 'label.' + key, ph),
    description: t(base + 'description.' + key, ph),
    tx: typeof ph.tx === 'number' ? t('explorer.block.decoded.txPrefix', { tx: ph.tx }) : ''
  }
}

registerScreen('explorer-block-hex', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/block/[block]/hex.tsx',
  title: () => t('explorer.block.viewHex'),
  back: 'explorer-block-detail',
  render: () => {
    const block = ecBlock(ecState.height)
    const data = ecBlockHex(block)
    const mode = ecState.hexMode
    const chip = (m) => `<button type="button" class="ec-hex-chip${mode === m ? ' is-on' : ''}" data-ec-mode="${m}">${t('explorer.block.viewHexMode.' + m)}</button>`
    let content
    if (mode === 'decoded') {
      const size = EC_HEX_SIZES[ecState.hexSize]
      const sel = data.fields[ecState.hexField]
      const info = sel ? ecDecodedLabel(sel) : null
      content = ss.vstack({ gap: 'sm' },
        data.total > data.decoded
          ? ss.text({ size: 'xxs', color: 'muted', center: true }, t('explorer.block.viewHexDecodedTruncated', { decoded: ecNum(data.decoded), total: ecNum(data.total) }))
          : '',
        ss.vstack({ gap: 'none' },
          `<div class="ec-zoom"><button type="button" id="ec-zoom-out"${ecState.hexSize === 0 ? ' disabled' : ''}>-</button><button type="button" id="ec-zoom-in"${
            ecState.hexSize === EC_HEX_SIZES.length - 1 ? ' disabled' : ''
          }>+</button></div>`,
          `<div class="ec-bytes" style="font-size:var(--sizes-text-font-size-${size})">${data.fields
            .map((f, i) => f.hex.match(/../g).map((b) => `<b data-ec-field="${i}" class="${ecState.hexField === i ? 'is-on' : ''}" style="color:${EC_BLOCK_COLORS[f.field] || EC_TX_COLORS[f.field] || '#fff'}">${b}</b>`).join(''))
            .join('')}</div>`,
          `<div class="ec-selected">${
            info
              ? ss.vstack({ gap: 'none' },
                  info.tx ? ss.text({ color: 'muted', size: 'xxs' }, info.tx) : '',
                  ss.text({ weight: 'bold' }, info.label),
                  ss.text({ type: 'mono', style: 'word-break:break-all' }, String(sel.value)),
                  ss.text({ color: 'muted', size: 'xxs' }, info.description))
              : ''
          }</div>`))
    } else if (mode === 'dump') {
      content = `<pre class="ec-hex-dump">${ecHexDump(data.hex)}</pre>`
    } else {
      content = `<p class="ec-hex-raw">${data.hex}</p>`
    }
    return ss.vstack({ gap: 'sm', style: 'padding-bottom:0' },
      ss.hstack({ gap: 'xs', style: 'flex-wrap:wrap;justify-content:center;width:100%' }, chip('raw'), chip('dump'), chip('decoded')),
      `<div class="ec-hex-scroll">${content}</div>`)
  },
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const m = e.target.closest('[data-ec-mode]')
      if (m) {
        ecState.hexMode = m.dataset.ecMode
        return openKitScreen('explorer-block-hex')
      }
      const f = e.target.closest('[data-ec-field]')
      if (f) {
        const i = Number(f.dataset.ecField)
        ecState.hexField = ecState.hexField === i ? -1 : i
        return openKitScreen('explorer-block-hex')
      }
      if (e.target.closest('#ec-zoom-in')) {
        ecState.hexSize = Math.min(EC_HEX_SIZES.length - 1, ecState.hexSize + 1)
        return openKitScreen('explorer-block-hex')
      }
      if (e.target.closest('#ec-zoom-out')) {
        ecState.hexSize = Math.max(0, ecState.hexSize - 1)
        return openKitScreen('explorer-block-hex')
      }
    })
  }
})

// --- block/[block]/transactions.tsx -------------------------------------------------------

registerScreen('explorer-block-transactions', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/block/[block]/transactions.tsx',
  title: () => t('explorer.block.title'),
  back: 'explorer-block-detail',
  render: () => {
    const block = ecBlock(ecState.height)
    const total = block.tx_count
    const visible = Math.min(ecState.txVisible, total)
    const sizes = []
    for (let i = 0; i < Math.min(total, 120); i += 1) sizes.push(Math.round(400 + ecRand('w' + block.height + ':' + i) ** 2 * 6000))
    const rows = []
    for (let i = 0; i < visible; i += 1) {
      const txid = block.height === 0 && i === 0 ? '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b' : ecHex('txid' + block.height + ':' + i, 64)
      rows.push(`<div class="ec-txrow">${ss.vstack({ gap: 'none' },
        ss.text({ weight: 'bold' }, i === 0 ? `#${i} [${t('transaction.coinbase')}]` : `#${i}`),
        ss.clipboardCopy({ text: txid }, ss.text({ type: 'mono' }, txid)),
        `<button type="button" class="ec-link" data-ec-tx="${txid}">${ss.text({ size: 'xs', color: 'muted' }, t('common.showMore'))}</button>`)}</div>`)
    }
    return ss.vstack({ gap: 'sm' },
      ss.vstack({ itemsCenter: true, gap: 'xxs' },
        ss.text({ center: true, size: 'md' }, t('explorer.block.transactions.title', { block: block.height })),
        ss.text({ size: 'xxs', className: 'ec-muted5' }, EC_SOURCE)),
      ecSizeBars(sizes, total),
      `<div>${rows.join('')}</div>`,
      visible < total ? `<button type="button" class="ec-link" id="ec-more" style="align-self:center;padding:12px 0">${ss.text({ size: 'xs', color: 'muted' }, t('common.loadMore'))}</button>` : '')
  },
  bind: (body) => {
    const more = body.querySelector('#ec-more')
    if (more)
      more.onclick = () => {
        ecState.txVisible += 20
        const top = body.scrollTop
        openKitScreen('explorer-block-transactions')
        document.getElementById('kit-body').scrollTop = top
      }
    body.addEventListener('click', (e) => {
      const tx = e.target.closest('[data-ec-tx]')
      if (!tx) return
      // explorer/transaction/[txid] is ported elsewhere; open it when registered.
      if (kitScreens['explorer-transaction-detail']) {
        window.ecTxid = tx.dataset.ecTx
        go('explorer-transaction-detail')
      } else if (kitScreens['explorer-transaction']) go('explorer-transaction')
      else ss.toast(tx.dataset.ecTx.slice(0, 16) + '…', document.getElementById('view-kit'))
    })
  }
})

// --- chain/index.tsx ---------------------------------------------------------------------

registerScreen('explorer-chain', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/chain/index.tsx',
  title: () => t('explorer.chain.title'),
  back: 'explorer',
  render: () => {
    const tn = (k, v) => t('explorer.chain.' + k, v)
    const block = ecBlock(EC_TIP)
    const epoch = Math.floor(EC_TIP / 2016)
    const inEpoch = EC_TIP % 2016
    const until = 2016 - inEpoch
    const estAdj = (EC_NOW + until * 600) * 1000
    const hashRate = (block.difficulty * 2 ** 32) / 600 / 1e18
    return ss.vstack({ gap: 'xl', className: 'ec-pad' },
      ss.vstack({ gap: 'sm' },
        ecHeader(tn('latestBlock'), 'backend', EC_SOURCE),
        ss.vstack({ gap: 'xs' },
          ecRow(tn('height'), EC_TIP.toLocaleString('en-US'), EC_TIP),
          ecRow(tn('timestamp'), ecDate(block.timestamp * 1000)),
          ecRow(tn('difficulty'), block.difficulty.toLocaleString('en-US', { maximumFractionDigits: 0 })),
          ss.vstack({ gap: 'none' }, ss.text({ size: 'xs', className: 'ec-label' }, tn('hash')), `<p class="ec-hash">${block.id}</p>`),
          `<button type="button" class="ec-link" data-ec-block="${EC_TIP}">${ss.text({ size: 'xs', className: 'ec-underline' }, tn('viewBlock'))}</button>`)),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, size: 'md', className: 'ec-sec' }, tn('consensus')),
        ss.vstack({ gap: 'xs' },
          ecRow(tn('difficultyEpoch'), epoch.toLocaleString('en-US')),
          ecRow(tn('blocksInEpoch'), inEpoch.toLocaleString('en-US')),
          ecRow(tn('blocksUntilAdjustment'), until.toLocaleString('en-US')),
          ecRow(tn('estNextAdjustment'), ecDate(estAdj)),
          ecRow(tn('estHashRate'), `${hashRate.toFixed(2)} EH/s`))),
      !ecState.chainExternal
        ? ecBanner({ why: tn('externalWhy'), fix: tn('externalNote'), loadLabel: tn('loadExternal'), id: 'ec-external', loading: ecState.externalLoading })
        : ss.vstack({ gap: 'sm' },
            ecHeader(tn('preciseAdjustment'), 'mempool', 'mempool.space'),
            ss.vstack({ gap: 'xs' },
              ecRow(tn('difficultyChange'), '+1.84%'),
              ecRow(tn('avgBlockTime'), '9.6 min'),
              ecRow(tn('remainingBlocks'), until.toLocaleString('en-US')),
              ecRow(tn('progressPercent'), `${((inEpoch / 2016) * 100).toFixed(1)}%`),
              ecRow(tn('estRetargetDate'), ecDate(estAdj - 6 * 3600 * 1000)))))
  },
  bind: (body) => ecBindExternal(body, 'chainExternal', 'explorer-chain')
})

function ecBindExternal(body, key, id) {
  const btn = body.querySelector('#ec-external')
  if (!btn) return
  btn.onclick = () => {
    ecState.externalLoading = true
    openKitScreen(id)
    setTimeout(() => {
      ecState.externalLoading = false
      ecState[key] = true
      if (kitCurrent === id) openKitScreen(id)
    }, 700)
  }
}

// --- chaintip.tsx (+ SSFeeRateChart and the price chart) ---------------------------------

const EC_FEES = { high: 12, medium: 8, low: 4, none: 2 }

// SSFeeRateChart: stacked mempool vbytes per fee band over two hours (alternating #939393/#FFFFFF).
function ecFeeRateChart() {
  const bands = ['0-1', '1-2', '2-3', '3-4', '4-5', '5-6', '6-8', '8-10', '10-12', '12-15', '15-20', '20-30', '30-40', '40-50']
  const points = 25
  const W = 230
  const H = 300
  const bottom = H - 18
  const data = []
  for (let p = 0; p < points; p += 1) {
    const row = bands.map((_, b) => {
      const base = b < 2 ? 7 : b < 6 ? 4.2 : b < 9 ? 2.4 : 1.1
      return base * (0.75 + 0.5 * ecRand('fee' + b + ':' + p)) * (1 - (p % 8) * 0.03) * 1e6
    })
    data.push(row)
  }
  const totals = data.map((r) => r.reduce((s, v) => s + v, 0))
  const maxY = Math.max(...totals) * 1.15
  const x = (p) => 40 + (p / (points - 1)) * (W - 40)
  const y = (v) => bottom - (v / maxY) * (bottom - 8)
  const cum = data.map((r) => r.reduce((acc, v, i) => (acc.push((acc[i - 1] || 0) + v), acc), []))
  const areas = bands
    .map((_, b) => {
      const top = cum.map((c, p) => `${x(p).toFixed(1)},${y(c[b]).toFixed(1)}`)
      const low = cum.map((c, p) => `${x(p).toFixed(1)},${y(b ? c[b - 1] : 0).toFixed(1)}`).reverse()
      return `<polygon points="${top.concat(low).join(' ')}" fill="${b % 2 ? '#FFFFFF' : '#939393'}"/>`
    })
    .join('')
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = (maxY * f) / 1e6
    return `<text x="34" y="${y(maxY * f) + 3}" text-anchor="end" fill="#ffffff" font-size="9">${v.toFixed(0)} MvB</text>`
  })
  const times = [0, 1, 2, 3].map((i) => {
    const m = new Date((EC_NOW - (3 - i) * 2400) * 1000)
    return `<text x="${x((i / 3) * (points - 1))}" y="${H - 2}" text-anchor="middle" fill="#787878" font-size="9">${m.getHours()}:${String(m.getMinutes()).padStart(2, '0')}</text>`
  })
  const last = cum[points - 1]
  const keys = bands
    .map((band, b) => ({ band, mid: y((b ? last[b - 1] : 0) + (last[b] - (b ? last[b - 1] : 0)) / 2), share: (last[b] - (b ? last[b - 1] : 0)) / last[bands.length - 1] }))
    .filter((k) => k.share >= 0.02)
  for (let i = keys.length - 2; i >= 0; i -= 1) if (keys[i].mid < keys[i + 1].mid + 13) keys[i].mid = keys[i + 1].mid + 13
  const labels = keys.map((k) => `<text x="${W + 8}" y="${Math.min(bottom, k.mid) + 3}" fill="#B0B0B0" font-size="9">${k.band}</text>`)
  return `<div class="ec-chart-box"><svg viewBox="0 0 ${W + 56} ${H}" preserveAspectRatio="none">${areas}${ticks.join('')}${times.join('')}${labels.join('')}</svg></div>`
}

// Price section: 30-day line, white 1.5px, y labels right, x labels bottom.
function ecPriceChart() {
  const days = 30
  const W = 390
  const H = 220
  const prices = []
  let p = 96200
  for (let i = 0; i <= days; i += 1) {
    p += (ecRand('price' + i) - 0.45) * 2600
    prices.push(i === days ? 100000 : p)
  }
  const min = Math.min(...prices) * 0.995
  const max = Math.max(...prices) * 1.005
  const x = (i) => 8 + (i / days) * (W - 70)
  const y = (v) => 12 + (1 - (v - min) / (max - min)) * (H - 40)
  const line = prices.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const yl = [0, 0.5, 1].map((f) => {
    const v = min + (max - min) * f
    return `<text x="${W - 8}" y="${y(v) + 3}" text-anchor="end" fill="#777777" font-size="10">${(v / 1000).toFixed(1)}k</text>`
  })
  const xl = [0, 10, 20, 30].map((d) => {
    const dt = new Date((EC_NOW - (days - d) * 86400) * 1000)
    return `<text x="${x(d)}" y="${H - 6}" text-anchor="middle" fill="#515151" font-size="10">${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>`
  })
  return `<div class="ec-price"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${line}" fill="none" stroke="#ffffff" stroke-width="1.5"/>${yl.join('')}${xl.join('')}</svg></div>`
}

function ecFeeRows(fees, rate, keys = ['feesHigh', 'feesMedium', 'feesLow', 'feesNone'], base = 'explorer.chaintip.') {
  const vals = [fees.high, fees.medium, fees.low, fees.none]
  return ss.vstack({ gap: 'xs' }, keys.map((k, i) => ecRow(t(base + k), `${vals[i]} sat/vB`)))
}

registerScreen('explorer-chaintip', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/chaintip.tsx',
  title: () => t('explorer.chaintip.title'),
  back: 'explorer',
  render: () => {
    const tn = (k, v) => t('explorer.chaintip.' + k, v)
    const block = ecBlock(EC_TIP)
    return ss.vstack({ gap: 'xl', widthFull: true, className: 'ec-pad' },
      ss.vstack({ gap: 'sm' },
        ecHeader(tn('latestBlock'), 'backend', EC_SOURCE),
        ss.vstack({ gap: 'xs' },
          ecRow(tn('height'), EC_TIP.toLocaleString('en-US'), EC_TIP),
          ecRow(tn('timestamp'), ecDate(block.timestamp * 1000)),
          ecRow(tn('transactions'), block.tx_count.toLocaleString('en-US')),
          ecRow(tn('size'), ecBytes(block.size)),
          ecRow(tn('weight'), ecBytes(block.weight)),
          ss.vstack({ gap: 'none' }, ss.text({ size: 'xs', className: 'ec-label' }, tn('hash')), `<p class="ec-hash">${block.id}</p>`),
          `<button type="button" class="ec-link" data-ec-block="${EC_TIP}">${ss.text({ size: 'xs', className: 'ec-underline' }, tn('viewBlock'))}</button>`)),
      ss.vstack({ gap: 'sm' },
        ecHeader(tn('mempool'), 'backend', EC_SOURCE),
        ss.vstack({ gap: 'xs' },
          ecRow(tn('mempoolTxs'), (48217).toLocaleString('en-US')),
          ecRow(tn('mempoolSize'), ecBytes(74812345)),
          ecRow(tn('mempoolFees'), `${(61234567).toLocaleString('en-US')} sats`))),
      ss.vstack({ gap: 'sm' }, ecHeader(tn('fees'), 'backend', EC_SOURCE), ecFeeRows(EC_FEES)),
      !ecState.chaintipExternal
        ? ecBanner({ why: tn('externalWhy'), fix: tn('externalNote'), loadLabel: tn('loadExternal'), id: 'ec-external', loading: ecState.externalLoading })
        : ss.vstack({ gap: 'xl', widthFull: true },
            ss.vstack({ gap: 'sm', style: 'margin-top:8px' }, ecFeeRateChart()),
            ss.vstack({ gap: 'sm', widthFull: true },
              ecHeader(tn('price'), 'mempool', 'mempool.space'),
              ss.vstack({ gap: 'none', widthFull: true },
                ss.hstack({ gap: 'sm', style: 'align-items:baseline' },
                  ss.text({ size: '3xl', type: 'mono', weight: 'light' }, (USD_PER_BTC || 100000).toLocaleString('en-US')),
                  ss.text({ size: 'md', color: 'muted' }, 'USD')),
                ss.hstack({ gap: 'xs', style: 'margin-top:-2px' },
                  ss.text({ size: 'xs', type: 'mono', className: 'ec-up' }, '+3.95%'),
                  ss.text({ size: 'xs', color: 'muted' }, tn('priceChangePeriod', { days: 30 })))),
              ecPriceChart())))
  },
  bind: (body) => ecBindExternal(body, 'chaintipExternal', 'explorer-chaintip')
})

// --- halving/index.tsx (+ SSHalvingProgress) ------------------------------------------------

const EC_HALVING_DATES = { 0: '2009-01-03', 1: '2012-11-28', 2: '2016-07-09', 3: '2020-05-11', 4: '2024-04-19' }

function ecHalvings() {
  const out = []
  for (let epoch = 0; ; epoch += 1) {
    const subsidySats = Math.floor(EC_SUBSIDY0 / 2 ** epoch)
    out.push({ epoch, subsidySats })
    if (subsidySats === 0) break
  }
  return out
}

function ecMinedSats(height) {
  let total = 0
  let h = 0
  while (h <= height) {
    const end = Math.min(height, (Math.floor(h / EC_HALVING) + 1) * EC_HALVING - 1)
    total += (end - h + 1) * ecSubsidySats(h)
    h = end + 1
  }
  return total
}

function ecHalvingProgress(height) {
  const epoch = Math.floor(height / EC_HALVING)
  const inEpoch = height - epoch * EC_HALVING
  const progress = inEpoch / EC_HALVING
  const subsidy = ecSubsidySats(height) / 1e8
  const W = 340
  const cx = W / 2
  const cy = 140
  const R = 110
  const start = -Math.PI / 2
  const end = start + progress * 2 * Math.PI
  const pt = (a) => `${(cx + R * Math.cos(a)).toFixed(2)} ${(cy + R * Math.sin(a)).toFixed(2)}`
  const arc = progress > 0.0016 ? `<path d="M ${pt(start)} A ${R} ${R} 0 ${end - start > Math.PI ? 1 : 0} 1 ${pt(end)}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none"/>` : ''
  const dots = ecHalvings()
    .slice(0, epoch + 1)
    .map((h) => {
      const a = start + (epoch + 1 > 1 ? h.epoch / (epoch + 1) : 0) * 2 * Math.PI
      return `<circle cx="${cx + R * Math.cos(a)}" cy="${cy + R * Math.sin(a)}" r="3" fill="#ffffff"/>`
    })
    .join('')
  const next = (epoch + 1) * EC_HALVING
  const font = subsidy >= 1 ? 20 : subsidy >= 0.1 ? 17 : 13
  return `<svg class="ec-halving-svg" viewBox="0 0 ${W} 280">
    <circle cx="${cx}" cy="${cy}" r="${R}" stroke="#2D2D2D" stroke-width="2" fill="none"/>${arc}${dots}
    <text x="${cx}" y="${cy - 38}" text-anchor="middle" fill="#ffffff" font-size="11">${t('explorer.halving.epochLabel', { epoch })}</text>
    <text x="${cx}" y="${cy - 14}" text-anchor="middle" fill="#ffffff" font-size="${font}">${subsidy.toFixed(Math.max(0, epoch - 1))} ${t('bitcoin.btc')}</text>
    <text x="${cx}" y="${cy + 2}" text-anchor="middle" fill="#686868" font-size="11">${(progress * 100).toFixed(1)}%</text>
    <text x="${cx}" y="${cy + 20}" text-anchor="middle" font-size="11"><tspan fill="#ffffff">${height.toLocaleString('en-US')}</tspan><tspan fill="#515151"> / ${next.toLocaleString('en-US')}</tspan></text>
    <text x="${cx}" y="${cy + 36}" text-anchor="middle" fill="#434343" font-size="11">${t('explorer.halving.blocksToGo', { count: (EC_HALVING - inEpoch).toLocaleString('en-US') })}</text>
  </svg>`
}

registerScreen('explorer-halving', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/halving/index.tsx',
  title: () => t('explorer.halving.title'),
  back: 'explorer',
  render: () => {
    const tn = (k, v) => t('explorer.halving.' + k, v)
    const height = EC_TIP
    const epoch = Math.floor(height / EC_HALVING)
    const inEpoch = height % EC_HALVING
    const remaining = EC_HALVING - inEpoch
    const next = (epoch + 1) * EC_HALVING
    const minedBtc = ecMinedSats(height) / 1e8
    const halvings = ecHalvings()
    const rows = halvings.map((h) => {
      const hh = h.epoch * EC_HALVING
      const isPast = hh < height
      const isCurrent = h.epoch === epoch
      const date = EC_HALVING_DATES[h.epoch] ? ecDate(EC_HALVING_DATES[h.epoch] + 'T12:00:00Z') : `~${ecDate((EC_NOW + (hh - height) * 600) * 1000)}`
      const cls = isCurrent ? 'ec-h-current' : isPast ? 'ec-h-past' : 'ec-h-future'
      const r = Math.max(0.5, 50 * (h.subsidySats / EC_SUBSIDY0))
      const op = isCurrent ? 0.9 : isPast ? 0.5 : 0.2
      const sub = h.subsidySats === 0 ? '0.00000000' : (h.subsidySats / 1e8).toFixed(8).replace(/\.?0+$/, '')
      return `<button type="button" class="ec-hrow"${isPast ? ` data-ec-block="${hh}"` : ' disabled'}>
        ${ss.text({ size: 'xs', as: 'span', className: 'ec-c-epoch ' + cls }, String(h.epoch))}
        ${ss.text({ size: 'xs', as: 'span', className: 'ec-c-height ' + cls }, hh.toLocaleString('en-US'))}
        ${ss.text({ size: 'xs', as: 'span', className: 'ec-c-subsidy ' + cls }, sub)}
        <span class="ec-c-circle"><i style="width:${r * 2}px;height:${r * 2}px;background:rgba(255,255,255,${op})"></i></span>
        ${ss.text({ size: 'xs', as: 'span', className: 'ec-c-date ' + cls }, date)}</button>`
    })
    return ss.vstack({ gap: 'xl', className: 'ec-pad' },
      ecHalvingProgress(height),
      ss.vstack({ gap: 'sm' },
        ecHeader(tn('currentEpoch'), 'backend', EC_SOURCE),
        ss.vstack({ gap: 'xs' },
          ecRow(tn('height'), height.toLocaleString('en-US')),
          ecRow(tn('epoch'), epoch.toLocaleString('en-US')),
          ecRow(tn('subsidy'), `${ecSubsidySats(height) / 1e8} BTC`),
          ecRow(tn('blocksMinedThisEpoch'), inEpoch.toLocaleString('en-US')),
          ecRow(tn('blocksUntilHalving'), remaining.toLocaleString('en-US')),
          ecRow(tn('nextHalvingHeight'), next.toLocaleString('en-US')),
          ecRow(tn('estHalvingDate'), ecDate((EC_NOW + remaining * 600) * 1000)))),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, size: 'md', className: 'ec-sec' }, tn('supply')),
        ss.vstack({ gap: 'xs' },
          ecRow(tn('totalMined'), `${minedBtc.toLocaleString('en-US', { maximumFractionDigits: 2 })} BTC`),
          ecRow(tn('percentIssued'), `${((minedBtc / 21e6) * 100).toFixed(4)}%`),
          ecRow(tn('maxSupply'), '21,000,000 BTC'))),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, size: 'md', className: 'ec-sec' }, tn('halvingSchedule')),
        `<div class="ec-hhead">${ss.text({ size: 'xxs', as: 'span', className: 'ec-c-epoch' }, '#')}${ss.text({ size: 'xxs', as: 'span', className: 'ec-c-height' }, tn('height').replace(' ', '\n'))}${ss.text({
          size: 'xxs', as: 'span', className: 'ec-c-subsidy'
        }, tn('subsidy').replace(' ', '\n'))}<span class="ec-c-circle"></span>${ss.text({ size: 'xxs', as: 'span', className: 'ec-c-date' }, tn('date'))}</div>`,
        ss.vstack({ gap: 'xs' }, rows)))
  }
})

// --- mempool/index.tsx (+ SSMempoolBlocks) -------------------------------------------------

function ecMempoolBlocks(blocks, approximate) {
  return ss.vstack({ gap: 'sm' },
    ss.text({}, t('explorer.mempool.pendingBlocksSummary', { blocks: blocks.length, minutes: blocks.length * 10 })),
    ss.text({ size: 'xxs', color: 'muted' }, approximate ? t('explorer.mempool.pendingBlocksHintApproximate') : t('explorer.mempool.pendingBlocksHint')),
    ss.vstack({ gap: 'xxs' },
      blocks.map((b, i) => `<div class="ec-backlog">${ss.text({ color: 'muted', as: 'span', className: 'ec-eta' }, t('explorer.mempool.pendingBlock.eta', { n: i + 1 }))}${ss.text({
        type: 'mono', as: 'span', className: 'ec-fee'
      }, t('explorer.mempool.pendingBlock.minFee', { rate: ecNum(b.minFee, 1) }))}${b.nTx > 0 ? ss.text({ color: 'muted', type: 'mono', as: 'span', className: 'ec-txs' }, t('explorer.mempool.pendingBlock.nTxShort', { n: ecNum(b.nTx) })) : ''}</div>`)))
}

const EC_BACKEND_BLOCKS = [9.6, 6.1, 4.2, 3.1, 2.4, 2.0, 1.5, 1.1].map((minFee, i) => ({ minFee, nTx: 0 }))
const EC_PRECISE_BLOCKS = [10.2, 6.4, 4.4, 3.3, 2.5, 2.0, 1.6, 1.2].map((minFee, i) => ({ minFee, nTx: [3412, 3876, 4102, 3990, 4210, 4388, 4501, 6210][i] }))

registerScreen('explorer-mempool', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/mempool/index.tsx',
  title: () => t('explorer.mempool.title'),
  back: 'explorer',
  render: () => {
    const tn = (k, v) => t('explorer.mempool.' + k, v)
    const feeRows = (f) => ss.vstack({ gap: 'xs' }, ecRow(tn('feeHigh'), `${f.high} sat/vB`), ecRow(tn('feeMedium'), `${f.medium} sat/vB`), ecRow(tn('feeLow'), `${f.low} sat/vB`))
    return ss.vstack({ gap: 'xl', className: 'ec-pad' },
      ss.vstack({ gap: 'sm' },
        ecHeader(tn('mempoolStats'), 'backend', EC_SOURCE),
        ss.vstack({ gap: 'xs' },
          ecRow(tn('pendingTxs'), (48217).toLocaleString('en-US')),
          ecRow(tn('mempoolSize'), ecBytes(74812345)),
          ecRow(tn('totalFees'), `${(61234567).toLocaleString('en-US')} sats`),
          ecRow(tn('minFeeRate'), '1 sat/vB'),
          ecRow(tn('maxFeeRate'), '512 sat/vB'),
          ecRow(tn('feeBands'), '36'))),
      ss.vstack({ gap: 'sm' }, ecHeader(tn('feeRecommendations'), 'backend', EC_SOURCE), feeRows(EC_FEES)),
      !ecState.mempoolExternal
        ? ss.vstack({ gap: 'sm' }, ecHeader(tn('pendingBlocks'), 'backend', EC_SOURCE), ecMempoolBlocks(EC_BACKEND_BLOCKS, true))
        : '',
      !ecState.mempoolExternal
        ? ecBanner({ why: tn('externalWhy'), fix: tn('externalNote'), loadLabel: tn('loadExternal'), id: 'ec-external', loading: ecState.externalLoading })
        : ss.vstack({ gap: 'xl' },
            ss.vstack({ gap: 'sm' }, ecHeader(tn('feeRecommendations'), 'mempool', 'mempool.space'), feeRows({ high: 13, medium: 9, low: 5 })),
            ss.vstack({ gap: 'sm' }, ecHeader(tn('pendingBlocks'), 'mempool', 'mempool.space'), ecMempoolBlocks(EC_PRECISE_BLOCKS, false))))
  },
  bind: (body) => ecBindExternal(body, 'mempoolExternal', 'explorer-mempool')
})
