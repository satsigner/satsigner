/* Kit re-ports of three hand-made Studio screens. They keep their legacy ids, and go() checks
   kitScreens first, so these replace the old sections without touching screen.js:
     'difficulty' ← explorer/difficulty.tsx
     'currency'   ← converter/currency.tsx
     'builder'    ← ioPreview.tsx with loadHistory (SSMultipleSankeyDiagram)
   go('payjoin') is left as-is: it still opens the send builder with payjoin on. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  /* shared */
  .lt-section-title { letter-spacing: 1px; }
  .lt-green { color: var(--main-green); }
  .lt-muted5 { color: var(--gray-500); opacity: 0.9; }
  .lt-banner { padding: 16px; border: 1px solid var(--gray-800); border-radius: 6px; background: var(--gray-925); }

  /* difficulty.tsx */
  #kit-body:has(.lt-difficulty) { padding-top: 10px; padding-bottom: 20px; }
  .lt-difficulty { display: flex; flex-direction: column; gap: var(--layout-v-stack-gap-md); min-height: 100%; }
  .lt-diff-right { text-align: right; }
  .lt-spiral-prompt { align-items: center; margin: 24px 0; }
  .lt-spiral { flex: 1; margin-top: 24px; display: flex; align-items: center; justify-content: center; }
  .lt-spiral svg { width: 100%; max-height: 340px; }
  .lt-spiral rect { cursor: pointer; }
  .lt-spiral rect:hover { fill: var(--main-green); }
  .lt-nav-row { align-items: center; }
  .lt-nav-btn { display: flex; align-items: center; justify-content: center; flex: none; box-sizing: border-box;
    width: var(--sizes-text-input-height-default); height: var(--sizes-text-input-height-default);
    border: 1px solid var(--gray-700); border-radius: 8px; background: none; color: var(--white); cursor: pointer; }
  .lt-nav-btn[disabled] { border-color: var(--gray-800); color: var(--gray-600); opacity: 0.55; cursor: default; }
  .lt-nav-input { flex: 1; }
  .lt-center-row { justify-content: center; }
  .lt-block-grid .ss-hstack { align-items: flex-start; gap: 0; }
  .lt-block-grid .ss-vstack { flex: 1; }
  .lt-chainwork { color: var(--gray-100); font-family: ui-monospace, monospace; word-break: break-all; }

  /* currency.tsx */
  #kit-body:has(.lt-converter) { padding: 0; }
  .lt-converter { display: flex; flex-direction: column; min-height: 100%; }
  .lt-cur-large { display: flex; flex-direction: column; align-items: center; padding: 8px 0 4px; border-top: 1px solid var(--gray-875); transition: opacity 150ms; }
  .lt-cur-section { border-top: 1px solid var(--gray-875); }
  .lt-cur-row { display: flex; border-bottom: 1px solid var(--gray-875); transition: opacity 200ms; }
  .lt-cur-block { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 2px 4px; }
  .lt-cur-block + .lt-cur-block { border-left: 1px solid var(--gray-875); }
  .lt-cur-input { box-sizing: border-box; width: 100%; border: 0; background: transparent; color: var(--white); font: inherit; text-align: center; outline: none; }
  .lt-cur-input.is-large { height: 44px; padding-top: 10px; font-size: var(--sizes-text-input-font-size-large); letter-spacing: 1px; }
  .lt-cur-input.is-small { height: 32px; padding-top: 8px; font-size: var(--sizes-text-input-font-size-small); letter-spacing: 0.5px; }
  .lt-cur-label { width: 100%; padding-bottom: 6px; text-align: center; }
  .lt-cur-label.is-large { padding: 2px 0 14px; }
  .lt-written { width: 100%; height: 0; overflow: hidden; text-align: center; transition: height 180ms; }
  .lt-converter.is-written .lt-written { height: 20px; }
  .lt-converter.is-loading .lt-cur-large, .lt-converter.is-loading .lt-cur-row { opacity: 0.35; }
  .lt-date { flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--layout-v-stack-gap-sm); padding: 20px 20px var(--layout-main-container-padding-bottom); }
  .lt-wheels { position: relative; display: flex; width: 80%; height: 160px; }
  .lt-wheels::before { content: ""; position: absolute; left: 0; right: 0; top: 57px; height: 46px; border-top: 1px solid var(--gray-800); border-bottom: 1px solid var(--gray-800); pointer-events: none; }
  .lt-wheels::after { content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(180deg, var(--gray-950) 0%, transparent 35%, transparent 65%, var(--gray-950) 100%); }
  .lt-wheel { flex: 1; height: 160px; overflow-y: auto; scroll-snap-type: y mandatory; scrollbar-width: none; }
  .lt-wheel::-webkit-scrollbar { display: none; }
  .lt-wheel-pad { height: 57px; }
  .lt-wheel-item { height: 46px; display: flex; align-items: center; justify-content: center; scroll-snap-align: center; color: var(--white); font-size: var(--sizes-text-font-size-2xl); }
  .lt-toggle-row { width: 100%; }
  .lt-toggle { flex: 1; }
  .lt-toggle.is-on { background: var(--gray-700); }

  /* builder (SSMultipleSankeyDiagram) */
  #kit-body:has(.lt-history) { padding: 0; overflow: hidden; }
  .lt-history { position: relative; height: 100%; display: flex; flex-direction: column; }
  .lt-history-scroll { flex: 1; overflow: auto; }
  .lt-history-scroll svg { display: block; }
  .lt-history-top { padding: var(--layout-v-stack-gap-sm) var(--layout-main-container-padding-horizontal) 12px; }
  .lt-history-bottom { padding: 12px var(--layout-main-container-padding-horizontal) 20px; }
  .lt-node-amt { fill: var(--white); font-size: 11px; font-weight: 600; }
  .lt-node-sub { fill: var(--gray-300); font-size: 8px; }
  .lt-node-lbl { font-size: 9px; font-weight: 700; }
  .lt-block-lbl { fill: var(--gray-200); font-size: 8px; }
  </style>`
)

const ltRand = (seed) => {
  let h = 2166136261
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    return h / 4294967296
  }
}

// SSExplorerSection
function ltSection(title, sourceLabel, source, ...children) {
  return ss.vstack({ gap: 'sm' },
    ss.hstack({ justifyBetween: true },
      ss.text({ uppercase: true, size: 'md', className: 'lt-section-title' }, title),
      sourceLabel ? ss.text({ size: 'xxs', className: source === 'backend' ? 'lt-green' : 'lt-muted5' }, sourceLabel) : ''),
    ...children)
}

// SSExplorerCapabilityBanner
function ltBanner(p) {
  return `<div class="lt-banner">${ss.vstack({ gap: 'sm' },
    ss.text({ color: 'muted' }, p.why),
    ss.text({ size: 'xs', color: 'muted' }, p.fix),
    ss.button({ variant: 'outline', label: t('explorer.capability.loadMempool'), id: p.id, loading: p.loading }),
    ss.text({ size: 'xxs', center: true, color: 'muted' }, t('explorer.capability.externalNote')))}</div>`
}

// --- difficulty.tsx ---------------------------------------------------------------------

const LT_INTERVAL = 2016
const LT_TIP = typeof EC_TIP !== 'undefined' ? EC_TIP : 972231
const LT_MAX_EPOCH = Math.floor(LT_TIP / LT_INTERVAL)
const ltDiff = { input: String(LT_MAX_EPOCH), fetched: null, loading: false, adjustment: false, adjusting: false, block: null }

const ltTime = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Block intervals for an epoch: exponential around 600s, seeded so an epoch always looks the same.
function ltEpochBlocks(epoch) {
  const start = epoch * LT_INTERVAL
  const count = epoch === LT_MAX_EPOCH ? LT_TIP - start + 1 : LT_INTERVAL
  const rand = ltRand('epoch' + epoch)
  const tsOf = (h) => (typeof ecTimestamp === 'function' ? ecTimestamp(h) : 1231006505 + h * 600)
  const t0 = tsOf(start)
  let time = t0
  return Array.from({ length: count }, (_, i) => {
    const gap = i === 0 ? 0 : Math.max(1, Math.round(-Math.log(1 - rand()) * 600))
    time += gap
    return { height: start + i, cycleHeight: i, gap, timestamp: time }
  })
}

// SSSpiralBlocks: one square per block along a spiral whose arc grows with block time.
function ltSpiral(blocks) {
  const growth = 0.97
  const step = 0.0016
  let phi = 1 / growth
  let arc = growth * (Math.asinh(phi) + phi * Math.sqrt(phi * phi + 1))
  const points = blocks.map((b, i) => {
    if (i) arc += b.gap * step
    phi = Math.sqrt(Math.max(arc * growth, 0))
    const r = growth * phi
    return { x: r * Math.cos(phi), y: r * Math.sin(phi), rot: phi, b }
  })
  const maxR = Math.max(...points.map((p) => Math.hypot(p.x, p.y)), 1)
  const scale = 150 / maxR
  const cx = 180
  const cy = 170
  // one-week ring like the app's time marks
  const weekR = Math.sqrt(growth * (604800 * step)) * growth * scale
  const ring = weekR < 160
    ? `<circle cx="${cx}" cy="${cy}" r="${weekR.toFixed(1)}" fill="none" stroke="rgba(255,255,255,0.28)" stroke-dasharray="2 3"/><text x="${cx}" y="${(cy - weekR - 4).toFixed(1)}" fill="#8A8A8A" font-size="8" text-anchor="middle">1 WEEK</text>`
    : ''
  const size = blocks.length > 1000 ? 2.6 : 4.4
  const rects = points
    .map((p) => `<rect data-lt-block="${p.b.height}" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" fill="#F2F2F2" transform="translate(${(cx + p.x * scale).toFixed(1)} ${(cy + p.y * scale).toFixed(1)}) rotate(${((p.rot * 180) / Math.PI).toFixed(1)})"/>`)
    .join('')
  return `<svg viewBox="0 0 360 340" role="img" aria-label="Difficulty epoch spiral">${ring}${rects}</svg>`
}

// BlockDetails (difficulty.tsx)
function ltBlockDetails(b) {
  const tn = (k) => t('explorer.difficulty.blockDetails.' + k)
  const full = typeof ecBlock === 'function' ? ecBlock(b.height) : { tx_count: 2000, size: 1500000, weight: 3990000, nonce: 1 }
  const cell = (label, value) => ss.vstack({ gap: 'none' }, ss.text({ color: 'muted' }, label), ss.text({ weight: 'bold' }, value))
  const date = new Date(b.timestamp * 1000)
  return `<div class="lt-block-grid">${ss.vstack({},
    ss.text({ center: true, uppercase: true, weight: 'bold' }, tn('title')),
    ss.hstack({}, cell(tn('height'), b.height.toLocaleString('en-US')), cell(tn('cycleHeight'), b.cycleHeight), cell(tn('date'), ltTime(date))),
    ss.hstack({}, cell(tn('txs'), full.tx_count.toLocaleString('en-US')), cell(tn('size'), full.size.toLocaleString('en-US')), cell(tn('weight'), full.weight.toLocaleString('en-US'))),
    ss.hstack({}, cell(tn('vsize'), Math.ceil(full.weight / 4).toLocaleString('en-US')), cell(tn('nonce'), full.nonce), cell(tn('time'), date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))),
    ss.vstack({ gap: 'none' }, ss.text({ color: 'muted' }, tn('chainWork')), ss.text({ className: 'lt-chainwork' }, '0000000000000000000000000000000000000000' + (b.height * 2654435761 >>> 0).toString(16).padStart(24, '0'))))}</div>`
}

registerScreen('difficulty', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/difficulty.tsx',
  title: () => t('explorer.difficulty.title'),
  back: 'explorer',
  render: () => {
    const tn = (k, v) => t('explorer.difficulty.' + k, v)
    const tipBlock = typeof ecBlock === 'function' ? ecBlock(LT_TIP) : { difficulty: 140577680051920 }
    const epochStart = LT_MAX_EPOCH * LT_INTERVAL
    const remainingBlocks = epochStart + LT_INTERVAL - LT_TIP
    const input = Number(ltDiff.input)
    const atMin = !(input > 0)
    const atMax = !(input < LT_MAX_EPOCH)
    const fetched = ltDiff.fetched
    const blocks = fetched !== null ? ltEpochBlocks(fetched) : null
    const header = ltSection(tn('tipDifficulty'), 'Blockstream · electrum', 'backend',
      ss.text({ weight: 'bold' }, tipBlock.difficulty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
      ss.text({ color: 'muted', size: 'xs' }, tn('tipHeight', { height: LT_TIP.toLocaleString('en-US') })))
    const adjustment = ltDiff.adjustment
      ? ss.vstack({ gap: 'xs' },
          ss.hstack({ gap: 'none', justifyBetween: true, style: 'align-items:flex-start' },
            ss.vstack({ gap: 'none' }, ss.text({ weight: 'bold' }, '~9.6 ' + t('time.minutes', { value: '' }).trim()), ss.text({ color: 'muted', size: 'xs' }, tn('avgBlock'))),
            ss.vstack({ gap: 'none' },
              ss.text({ weight: 'bold', className: 'lt-diff-right' }, t('time.days', { value: ((remainingBlocks * 9.6) / 1440).toFixed(1) })),
              ss.text({ color: 'muted', size: 'xs', className: 'lt-diff-right' }, tn('nextAdjustment')))),
          ss.text({ size: 'xxs', className: 'lt-muted5 lt-diff-right', style: 'margin-top:4px' }, 'mempool.space'))
      : ltBanner({ why: t('explorer.capability.difficultyAdjustment.why'), fix: t('explorer.capability.difficultyAdjustment.fix'), id: 'lt-adjust', loading: ltDiff.adjusting })
    const spiral = blocks
      ? `<div class="lt-spiral">${ltSpiral(blocks)}</div>`
      : ss.vstack({ gap: 'sm', className: 'lt-spiral-prompt' },
          ss.text({ color: 'muted', center: true }, tn('spiralPrompt')),
          ss.button({ variant: 'outline', label: tn('loadSpiral'), id: 'lt-load-spiral', loading: ltDiff.loading }),
          ss.text({ size: 'xxs', center: true, color: 'muted' }, tn('spiralSource')))
    const first = blocks && blocks[0]
    const last = blocks && blocks[blocks.length - 1]
    const footer = ss.vstack({ gap: 'none' },
      ss.vstack({ gap: 'none', style: 'justify-content:center' },
        ss.hstack({ gap: 'xs', className: 'lt-center-row' }, ss.text({ color: 'muted' }, tn('epoch')), ss.text({ weight: 'bold' }, String(fetched ?? ltDiff.input))),
        blocks
          ? ss.text({ center: true, weight: 'bold' }, `${ltTime(first.timestamp * 1000)} - ${ltTime(last.timestamp * 1000)}`) +
            ss.hstack({ gap: 'xs', className: 'lt-center-row' },
              ss.text({ color: 'muted' }, tn('blockFrom')), ss.text({ weight: 'bold' }, first.height.toLocaleString('en-US')),
              ss.text({ color: 'muted' }, tn('blockTo')), ss.text({ weight: 'bold' }, last.height.toLocaleString('en-US'))) +
            ss.text({ size: 'xxs', center: true, className: 'lt-muted5' }, 'pvxg.net')
          : ''),
      ss.vstack({ gap: 'sm' },
        ss.hstack({ gap: 'sm', className: 'lt-nav-row' },
          `<button type="button" class="lt-nav-btn" id="lt-prev"${atMin ? ' disabled' : ''} aria-label="Previous epoch">${ss.icon('chevronLeft', { size: 18 })}</button>`,
          `<div class="lt-nav-input">${ss.textInput({ variant: 'outline', value: ltDiff.input, inputMode: 'numeric', name: 'epoch' })}</div>`,
          `<button type="button" class="lt-nav-btn" id="lt-next"${atMax ? ' disabled' : ''} aria-label="Next epoch">${ss.icon('chevronRight', { size: 18 })}</button>`),
        ss.button({ label: tn('fetch'), variant: 'outline', id: 'lt-fetch', loading: ltDiff.loading && fetched !== null, disabled: String(fetched) === ltDiff.input })))
    return `<div class="lt-difficulty">${header}${adjustment}${spiral}${footer}</div>`
  },
  overlays: () =>
    ss.modal({ id: 'lt-block-modal', showLabel: false },
      `<div id="lt-block-body" style="width:100%"></div>`,
      ss.button({ label: t('common.close'), variant: 'secondary', data: { 'ss-close': '' } })),
  bind: (body) => {
    const rerender = () => openKitScreen('difficulty')
    const fetch = (epoch) => {
      ltDiff.input = String(epoch)
      ltDiff.loading = true
      rerender()
      setTimeout(() => {
        ltDiff.loading = false
        ltDiff.fetched = epoch
        if (routeId === 'difficulty') rerender()
      }, 600)
    }
    body.addEventListener('click', (e) => {
      if (e.target.closest('#lt-adjust')) {
        ltDiff.adjusting = true
        rerender()
        setTimeout(() => {
          ltDiff.adjusting = false
          ltDiff.adjustment = true
          if (routeId === 'difficulty') rerender()
        }, 600)
      }
      if (e.target.closest('#lt-load-spiral') || e.target.closest('#lt-fetch')) {
        const n = Math.min(LT_MAX_EPOCH, Math.max(0, Math.floor(Number(ltDiff.input)) || 0))
        fetch(n)
      }
      if (e.target.closest('#lt-prev') || e.target.closest('#lt-next')) {
        const dir = e.target.closest('#lt-prev') ? -1 : 1
        ltDiff.input = String(Math.min(LT_MAX_EPOCH, Math.max(0, (Number(ltDiff.input) || 0) + dir)))
        rerender()
      }
      const rect = e.target.closest('[data-lt-block]')
      if (rect) {
        const block = ltEpochBlocks(ltDiff.fetched).find((b) => b.height === Number(rect.dataset.ltBlock))
        document.getElementById('lt-block-body').innerHTML = ltBlockDetails(block)
        ss.open('lt-block-modal')
      }
    })
    const input = body.querySelector('input[name=epoch]')
    input.addEventListener('input', () => {
      ltDiff.input = input.value.replace(/\D/g, '')
      body.querySelector('#lt-fetch').disabled = String(ltDiff.fetched) === ltDiff.input
    })
  }
})

// --- converter/currency.tsx ------------------------------------------------------------

// Fixture rates per BTC today; history scales them by a rough yearly BTC/USD curve.
const LT_RATES = { USD: USD_PER_BTC, EUR: USD_PER_BTC * 0.92, GBP: USD_PER_BTC * 0.79, CAD: USD_PER_BTC * 1.37, CHF: USD_PER_BTC * 0.88, JPY: USD_PER_BTC * 152 }
const LT_HISTORY = { 2011: 5, 2012: 13, 2013: 800, 2014: 320, 2015: 430, 2016: 950, 2017: 13000, 2018: 3700, 2019: 7200, 2020: 29000, 2021: 46000, 2022: 16500, 2023: 42000, 2024: 94000, 2025: 100000, 2026: 100000 }
const LT_FIAT = [
  ['USD', '🇺🇸', 'usd'], ['EUR', '🇪🇺', 'eur'], ['GBP', '🇬🇧', 'gbp'], ['CAD', '🇨🇦', 'cad'], ['CHF', '🇨🇭', 'chf'], ['JPY', '🇯🇵', 'jpy']
]
const ltConv = { btc: 1, anchor: 'bitcoin', written: false, european: false, date: new Date(), loading: false }

function ltPriceFactor(date) {
  const y = date.getFullYear() + date.getMonth() / 12
  const lo = Math.max(2011, Math.min(2026, Math.floor(y)))
  const hi = Math.min(2026, lo + 1)
  const f = y - lo
  return (LT_HISTORY[lo] + (LT_HISTORY[hi] - LT_HISTORY[lo]) * Math.max(0, Math.min(1, f))) / LT_HISTORY[2026]
}

// utils/format formatLargeNumber: compact long words, "~" when rounded, long scale in european mode.
function ltWritten(num, european) {
  if (!isFinite(num) || num === 0 || Math.abs(num) < 1e3) return ''
  if (european && Math.abs(num) >= 1e15) return '~' + Math.round(num / 1e15) + ' billiard'
  if (!european && Math.abs(num) >= 1e15) return '~' + Math.round(num / 1e15) + ' quadrillion'
  const loc = european ? 'fr' : 'en-US'
  const opts = { notation: 'compact', compactDisplay: 'long' }
  const exact = new Intl.NumberFormat(loc, { ...opts, maximumFractionDigits: 20 }).format(num)
  const rounded = new Intl.NumberFormat(loc, { ...opts, maximumFractionDigits: 0 }).format(num)
  let out = (exact !== rounded ? '~' : '') + rounded
  if (european) out = out.replace(/billion/, 'milliard')
  return out
}

const ltCommas = (n, decimals) => {
  const [i, d] = String(n).split('.')
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return d !== undefined && decimals ? int + '.' + d.slice(0, decimals) : int
}

function ltValues() {
  const factor = ltPriceFactor(ltConv.date)
  const v = { bitcoin: ltConv.btc, sats: Math.round(ltConv.btc * SATS_PER_BTC) }
  LT_FIAT.forEach(([k]) => (v[k] = Math.round(ltConv.btc * LT_RATES[k] * factor * 100) / 100))
  return v
}

function ltCurInput(key, value, size, decimals) {
  const shown = key === 'bitcoin' ? ltCommas(Number(value).toFixed(8).replace(/\.?0+$/, ''), 8) : ltCommas(value, decimals)
  return `<input class="lt-cur-input is-${size}" inputmode="decimal" data-lt-cur="${key}" value="${shown}">`
}

registerScreen('currency', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/converter/currency.tsx',
  title: () => t('converter.title'),
  back: 'converter',
  render: () => {
    const v = ltValues()
    const written = (n) => ss.text({ size: 'xs', color: 'muted', className: 'lt-written' }, ltWritten(n, ltConv.european))
    const large = (key, label) =>
      `<div class="lt-cur-large">${ltCurInput(key, v[key], 'large', 8)}${written(v[key])}${ss.text({ size: 'xs', color: 'muted', uppercase: true, className: 'lt-cur-label is-large' }, label)}</div>`
    const small = ([k, flag, s]) =>
      `<div class="lt-cur-block">${ltCurInput(k, v[k], 'small', 2)}${written(v[k])}${ss.text({ size: 'xs', color: 'muted', className: 'lt-cur-label' }, flag + ' ' + t('converter.currency.' + s))}</div>`
    const rows = [LT_FIAT.slice(0, 2), LT_FIAT.slice(2, 4), LT_FIAT.slice(4, 6)].map((pair) => `<div class="lt-cur-row">${pair.map(small).join('')}</div>`).join('')
    const d = ltConv.date
    const wheel = (kind, items, selected) =>
      `<div class="lt-wheel" data-lt-wheel="${kind}"><div class="lt-wheel-pad"></div>${items
        .map((it) => `<div class="lt-wheel-item${it.v === selected ? ' is-on' : ''}" data-v="${it.v}">${it.l}</div>`)
        .join('')}<div class="lt-wheel-pad"></div></div>`
    const months = Array.from({ length: 12 }, (_, i) => ({ v: i, l: new Date(2020, i, 1).toLocaleString('en-US', { month: 'short' }) }))
    const days = Array.from({ length: 31 }, (_, i) => ({ v: i + 1, l: String(i + 1) }))
    const years = Array.from({ length: new Date().getFullYear() - 2011 + 1 }, (_, i) => ({ v: 2011 + i, l: String(2011 + i) }))
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    return `<div class="lt-converter${ltConv.written ? ' is-written' : ''}${ltConv.loading ? ' is-loading' : ''}">
      ${large('sats', '⚪️ ' + t('converter.currency.sats'))}
      ${large('bitcoin', '🌍 ' + t('converter.currency.bitcoin'))}
      <div class="lt-cur-section">${rows}</div>
      <div class="lt-date">
        <div class="lt-wheels">${wheel('month', months, d.getMonth())}${wheel('day', days, d.getDate())}${wheel('year', years, d.getFullYear())}</div>
        ${ss.vstack({ gap: 'sm', className: 'lt-toggle-row' },
          ss.button({ label: t('date.today'), variant: 'outline', id: 'lt-today', disabled: isToday }),
          ss.hstack({ gap: 'sm' },
            ss.button({ label: t('converter.writtenNumbers'), variant: 'outline', id: 'lt-written', className: 'lt-toggle' + (ltConv.written ? ' is-on' : '') }),
            ss.button({ label: t('converter.europeanScale'), variant: 'outline', id: 'lt-european', disabled: !ltConv.written, className: 'lt-toggle' + (ltConv.european ? ' is-on' : '') })))}
      </div>
    </div>`
  },
  bind: (body) => {
    const root = body.querySelector('.lt-converter')
    const paintValues = (except) => {
      const v = ltValues()
      body.querySelectorAll('[data-lt-cur]').forEach((input) => {
        const key = input.dataset.ltCur
        if (input === except) return
        input.value = key === 'bitcoin' ? ltCommas(Number(v.bitcoin).toFixed(8).replace(/\.?0+$/, ''), 8) : ltCommas(v[key], key === 'sats' ? 0 : 2)
      })
      body.querySelectorAll('[data-lt-cur]').forEach((input) => {
        input.parentElement.querySelector('.lt-written').textContent = ltWritten(v[input.dataset.ltCur], ltConv.european)
      })
    }
    body.addEventListener('input', (e) => {
      const input = e.target.closest('[data-lt-cur]')
      if (!input) return
      const raw = input.value.replace(/,/g, '')
      if (!/^\d*\.?\d*$/.test(raw)) return
      const n = parseFloat(raw) || 0
      const key = input.dataset.ltCur
      const factor = ltPriceFactor(ltConv.date)
      ltConv.anchor = key
      ltConv.btc = key === 'bitcoin' ? n : key === 'sats' ? n / SATS_PER_BTC : n / (LT_RATES[key] * factor)
      paintValues(input)
    })
    body.addEventListener('focusout', (e) => {
      if (e.target.closest('[data-lt-cur]')) paintValues()
    })
    const setDate = (date) => {
      ltConv.date = date
      ltConv.loading = true
      root.classList.add('is-loading')
      setTimeout(() => {
        ltConv.loading = false
        if (routeId === 'currency') openKitScreen('currency')
      }, 350)
    }
    // Wheels: scroll each column to its selected row, then read the centred row when it settles.
    body.querySelectorAll('[data-lt-wheel]').forEach((wheel) => {
      // bind() runs before show(), so position the wheel once the section is visible.
      // That scroll lands on the current value, so the handler below changes nothing.
      requestAnimationFrame(() => {
        const on = wheel.querySelector('.is-on')
        if (on) wheel.scrollTop = on.offsetTop - 57
      })
      let timer = 0
      wheel.addEventListener('scroll', () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          const index = Math.round(wheel.scrollTop / 46)
          const item = wheel.querySelectorAll('.lt-wheel-item')[index]
          if (!item) return
          const d = new Date(ltConv.date)
          const value = Number(item.dataset.v)
          const kind = wheel.dataset.ltWheel
          if (kind === 'month') d.setMonth(value)
          if (kind === 'day') d.setDate(value)
          if (kind === 'year') d.setFullYear(value)
          if (d > new Date()) return
          if (d.toDateString() !== ltConv.date.toDateString()) setDate(d)
        }, 140)
      })
    })
    body.querySelector('#lt-today').onclick = () => setDate(new Date())
    body.querySelector('#lt-written').onclick = () => {
      ltConv.written = !ltConv.written
      if (!ltConv.written) ltConv.european = false
      openKitScreen('currency')
    }
    body.querySelector('#lt-european').onclick = () => {
      ltConv.european = !ltConv.european
      openKitScreen('currency')
    }
  }
})

// --- builder: ioPreview loadHistory (SSMultipleSankeyDiagram) ----------------------------

let ltBuilderBack = 'send'

// Remember where history was opened from (title() runs before render(); re-renders keep it).
function ltBuilderOrigin() {
  if (routeId && routeId !== 'builder') ltBuilderBack = routeId === 'explorer-transaction-detail' ? routeId : 'send'
  return ltBuilderBack
}

// Model: { inputs: [{ value, label, ours, parent: { txid, inputs: [{ value, label }] } }], outputs: [{ value, label, kind }], fee, feeRate }
function ltHistoryModel() {
  if (ltBuilderBack === 'explorer-transaction-detail' && typeof exTxData === 'function' && exState.txid) {
    const tx = exTxData(exState.txid)
    const rand = ltRand('hist' + tx.txid)
    return {
      txid: tx.txid,
      inputs: tx.inputs.map((i) => ({
        value: i.value || 5000000000,
        label: i.isCoinbase ? 'Coinbase' : ss.shortId(i.address || i.prevTxid, 6),
        ours: false,
        parent: {
          txid: i.prevTxid,
          inputs: i.isCoinbase ? [] : [{ value: Math.round((i.value || 0) * (1.2 + rand())), label: 'Previous' }, { value: Math.round((i.value || 0) * 0.4 * rand()) + 1000, label: 'Previous' }]
        }
      })),
      outputs: tx.outputs.map((o) => ({ value: o.value, label: o.special || ss.shortId(o.address, 6), kind: 'external' })),
      fee: tx.fee,
      feeRate: tx.vsize ? tx.fee / tx.vsize : 0
    }
  }
  const tot = typeof draftTotals === 'function' ? draftTotals() : null
  if (!tot || !tot.inputs.length) {
    return ltBuilderBack === 'send' ? null : null
  }
  return {
    txid: 'draft',
    inputs: tot.inputs.map((c) => {
      const rand = ltRand('parent' + c.id)
      const a = Math.round(c.value * (1.1 + rand() * 0.8))
      return {
        value: c.value,
        label: c.label,
        ours: true,
        parent: { txid: demoTxid('parent' + c.id), inputs: [{ value: a, label: 'Previous' }, { value: Math.round(c.value * 0.3 + rand() * 50000), label: 'Previous' }] }
      }
    }),
    outputs: draft.outputs
      .map((o) => ({ value: o.amount, label: o.label || t('common.noLabel'), kind: 'external' }))
      .concat(tot.change > 0 ? [{ value: tot.change, label: 'Change', kind: 'change' }] : []),
    fee: tot.fee,
    feeRate: draft.feeRate
  }
}

// Five levels: parent inputs → parent tx → our inputs → this tx → outputs (+ fee).
function ltHistorySvg(m) {
  const NODE_W = 98
  const BLOCK_W = 46
  const GAP_X = 70
  const ROW = 58
  const levels = 5
  const xs = Array.from({ length: levels }, (_, i) => 12 + i * (NODE_W + GAP_X))
  const width = xs[levels - 1] + NODE_W + 12
  const parentInputs = m.inputs.flatMap((inp, i) => inp.parent.inputs.map((p) => ({ ...p, owner: i })))
  const rights = m.outputs.concat([{ value: m.fee, label: t('transaction.build.preview.minerFee') !== 'transaction.build.preview.minerFee' ? t('transaction.build.preview.minerFee') : 'Miner fee', kind: 'fee' }])
  const rows = Math.max(parentInputs.length, m.inputs.length, rights.length, 3)
  const height = rows * ROW + 40
  const band = (v, total, px) => Math.max(2, (v / (total || 1)) * px)
  const slotY = (i, count) => (height - count * ROW) / 2 + i * ROW + ROW / 2
  const col = (k) => ({ ours: 'url(#ltOwn)', external: 'url(#ltPay)', change: 'url(#ltOwn)', fee: 'url(#ltFee)', prev: 'url(#ltPrev)' })[k]
  const ribbon = (x1, y1, h1, x2, y2, h2, fill) => `<path fill="${fill}" opacity="0.9" d="${txRibbon(x1, y1, h1, x2, y2, h2)}"/>`
  const label = (x, y, amt, sub, name, color, anchor = 'start') =>
    `<text x="${x}" y="${y - 6}" class="lt-node-amt" text-anchor="${anchor}">${amt.toLocaleString('en-US')} sats</text>` +
    (sub ? `<text x="${x}" y="${y + 4}" class="lt-node-sub" text-anchor="${anchor}">${sub}</text>` : '') +
    `<text x="${x}" y="${y + 15}" class="lt-node-lbl" fill="${color}" text-anchor="${anchor}">${name}</text>`
  let svg = ''
  // parent tx blocks (level 1), one per input, sized by its inputs
  const parentBlocks = m.inputs.map((inp, i) => {
    const total = inp.parent.inputs.reduce((s, p) => s + p.value, 0) || inp.value
    const h = Math.max(14, Math.min(70, 10 + Math.log10(total + 10) * 6))
    const y = slotY(i, m.inputs.length) - h / 2
    return { x: xs[1] + (NODE_W - BLOCK_W) / 2, y, h, total }
  })
  // level 0 → parent blocks
  parentInputs.forEach((p, k) => {
    const y = slotY(k, parentInputs.length)
    const blk = parentBlocks[p.owner]
    const share = band(p.value, blk.total, blk.h)
    const offset = parentInputs.filter((q, j) => q.owner === p.owner && j < k).reduce((s, q) => s + band(q.value, blk.total, blk.h), 0)
    svg += ribbon(xs[0] + NODE_W - 10, y - share / 2, share, blk.x, blk.y + offset, share, col('prev'))
    svg += label(xs[0], y, p.value, '', p.label, '#8A8A8A')
  })
  // parent blocks → our inputs (level 2)
  const inTotal = m.inputs.reduce((s, i) => s + i.value, 0)
  const txH = Math.max(40, Math.min(150, 20 + Math.log10(inTotal + 10) * 14))
  const txY = height / 2 - txH / 2
  const txX = xs[3] + (NODE_W - BLOCK_W) / 2
  let txOffset = 0
  m.inputs.forEach((inp, i) => {
    const blk = parentBlocks[i]
    const y = slotY(i, m.inputs.length)
    const h = band(inp.value, blk.total, blk.h)
    svg += `<rect x="${blk.x}" y="${blk.y}" width="${BLOCK_W}" height="${blk.h}" fill="#2D2D2D" stroke="#515151"/>`
    svg += `<text x="${blk.x + BLOCK_W / 2}" y="${blk.y - 4}" class="lt-block-lbl" text-anchor="middle">${ss.shortId(inp.parent.txid, 4)}</text>`
    svg += ribbon(blk.x + BLOCK_W, blk.y, h, xs[2], y - h / 2, h, col(inp.ours ? 'ours' : 'prev'))
    const share = band(inp.value, inTotal, txH)
    svg += ribbon(xs[2] + NODE_W - 10, y - h / 2, Math.min(h, share), txX, txY + txOffset, share, col(inp.ours ? 'ours' : 'prev'))
    txOffset += share
    svg += label(xs[2], y - 6, inp.value, '', inp.label, inp.ours ? '#A7FFAF' : '#FF7171')
  })
  // this tx → outputs + fee
  svg += `<rect x="${txX}" y="${txY}" width="${BLOCK_W}" height="${txH}" fill="url(#ltBlock)" stroke="#777"/>`
  svg += `<text x="${txX + BLOCK_W / 2}" y="${txY - 6}" class="lt-block-lbl" text-anchor="middle">${m.txid === 'draft' ? t('transaction.build.preview.contents') : ss.shortId(m.txid, 4)}</text>`
  const outTotal = rights.reduce((s, o) => s + o.value, 0)
  let outOffset = 0
  rights.forEach((o, i) => {
    const y = slotY(i, rights.length)
    const share = band(o.value, outTotal, txH)
    svg += ribbon(txX + BLOCK_W, txY + outOffset, share, xs[4], y - share / 2, share, col(o.kind))
    outOffset += share
    const sub = o.kind === 'fee' ? `${(m.feeRate || 0).toFixed(2)} sat/vB` : ''
    svg += label(xs[4] + 4, y, o.value, sub, o.label, o.kind === 'fee' ? '#FF7171' : o.kind === 'change' ? '#A7FFAF' : '#FF7171')
  })
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="ltOwn" x1="0" x2="1"><stop offset="0" stop-color="#0E5D0C" stop-opacity="0.9"/><stop offset="1" stop-color="#F2F2F2" stop-opacity="0.9"/></linearGradient>
      <linearGradient id="ltPay" x1="0" x2="1"><stop offset="0" stop-color="#F2F2F2"/><stop offset="1" stop-color="#7B0B0B" stop-opacity="0.85"/></linearGradient>
      <linearGradient id="ltFee" x1="0" x2="1"><stop offset="0" stop-color="#F2F2F2"/><stop offset="1" stop-color="#F2F2F2" stop-opacity="0.1"/></linearGradient>
      <linearGradient id="ltPrev" x1="0" x2="1"><stop offset="0" stop-color="#434343" stop-opacity="0.5"/><stop offset="1" stop-color="#A0A0A0" stop-opacity="0.8"/></linearGradient>
      <linearGradient id="ltBlock" x1="0" x2="1"><stop offset="0" stop-color="#363636"/><stop offset="1" stop-color="#CDCDCD"/></linearGradient>
    </defs>${svg}</svg>`
}

registerScreen('builder', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/signAndSend/ioPreview.tsx (loadHistory)',
  title: () => (ltBuilderOrigin() === 'explorer-transaction-detail' ? t('transaction.details.title') : openAccountData ? openAccountData.name : 'Spending'),
  back: () => ltBuilderBack,
  render: () => {
    ltBuilderOrigin()
    let m = ltHistoryModel()
    if (!m) {
      // Empty draft: show the account's first coin as a fixture input so the diagram has history.
      if (typeof coins !== 'undefined' && !coins.some((c) => c.selected)) coins[0].selected = true
      m = ltHistoryModel()
    }
    const inValue = m.inputs.reduce((s, i) => s + i.value, 0)
    return `<div class="lt-history">
      <div class="lt-history-top">${ss.vstack({ gap: 'xxs', itemsCenter: true },
        ss.text({ size: 'xxs', style: 'color:var(--gray-400)' }, t('transaction.loadHistory').toUpperCase()),
        ss.hstack({ gap: 'xs', style: 'align-items:baseline' },
          ss.text({ size: '3xl', weight: 'ultralight' }, inValue.toLocaleString('en-US')),
          ss.text({ color: 'muted' }, t('bitcoin.sats'))))}</div>
      <div class="lt-history-scroll" id="lt-history-scroll">${ltHistorySvg(m)}</div>
      <div class="lt-history-bottom">${ss.button({ variant: 'outline', label: t('common.back'), id: 'lt-history-back' })}</div>
    </div>`
  },
  bind: (body) => {
    // Like the app, open scrolled to the last three levels (inputs → tx → outputs).
    const scroll = body.querySelector('#lt-history-scroll')
    requestAnimationFrame(() => {
      scroll.scrollLeft = scroll.scrollWidth - scroll.clientWidth
      scroll.scrollTop = (scroll.scrollHeight - scroll.clientHeight) / 2
    })
    body.querySelector('#lt-history-back').onclick = () => go(ltBuilderBack)
  }
})
