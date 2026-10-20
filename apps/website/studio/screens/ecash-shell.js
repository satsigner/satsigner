/* eCash sub-screens and app shell routes.
   eCash — app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ecash/*
   Shell — app/setPin.tsx, setDuressPin.tsx, unlock.tsx, warning.tsx, (authenticated)/_session.tsx,
           .../upcoming/index.tsx, .../converter/energy.tsx
   Registered with registerScreen() from screens.js. Fixture data only. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  /* Shell screens have no stack header in the app */
  #view-kit:has(.es-shell) .stack-header { display: none; }
  #kit-body:has(.es-shell) { padding: 0; }
  .es-shell { display: flex; flex-direction: column; min-height: 100%; box-sizing: border-box; padding: 32px var(--layout-main-container-padding-horizontal) var(--layout-main-container-padding-bottom); background: var(--gray-950); }
  .es-shell.is-black { background: var(--black); }
  .es-shell > .ss-vstack { flex: 1; }

  /* SSPinInput — 54px cells, gray-850 / active gray-700 / active+filled gray-500, white dot */
  .es-pin { width: 100%; }
  .es-pin-row { display: flex; justify-content: center; gap: var(--layout-h-stack-gap-xs); }
  .es-pin-cell { position: relative; width: 54px; height: 54px; box-sizing: border-box; border-radius: 4px; padding: 1px;
    background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.14)); }
  .es-pin-cell i { display: block; height: 100%; border-radius: 3px; background: var(--gray-850); }
  .es-pin-cell.is-active i { background: var(--gray-700); animation: es-glow 1s ease-in-out infinite; }
  .es-pin-cell.is-active.is-filled i { background: var(--gray-500); }
  .es-pin-cell.is-filled::after { content: ""; position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; border-radius: 6px; background: var(--white); transform: translate(-50%, -50%); }
  @keyframes es-glow { 50% { box-shadow: inset 0 0 0 30px rgba(255,255,255,0.07); } }
  .es-pin-feedback { display: flex; flex-direction: column; align-items: center; min-height: 64px; padding-top: 30px; box-sizing: border-box; }
  .es-pin-below { display: flex; flex-direction: column; align-items: center; padding-top: 24px; }
  .es-shake { animation: es-shake 360ms ease; }
  @keyframes es-shake { 20%, 60% { transform: translateX(-10px); } 40%, 80% { transform: translateX(10px); } }

  /* SSKeyboard — 3 columns, keys 1.32:1 with a lit rim */
  .es-keys { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; }
  .es-key { padding: var(--layout-h-stack-gap-xs); }
  .es-key button { display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 1.32; box-sizing: border-box;
    border: 0; border-radius: 6px; padding: 1px; background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.3)); color: var(--white); font: inherit; cursor: pointer; }
  .es-key button span { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; border-radius: 5px; background: linear-gradient(180deg, var(--gray-875), var(--gray-890)); font-size: var(--sizes-text-font-size-2xl); font-weight: 300; }
  .es-key button:active span { background: var(--gray-700); }
  .es-key button.is-control span { font-size: var(--sizes-text-font-size-sm); letter-spacing: 1px; color: var(--gray-200); }
  .es-pin-length { width: 32px; height: 32px; box-sizing: border-box; border: 1px solid var(--gray-700); border-radius: 4px; background: none; color: var(--gray-300); font: inherit; font-size: var(--sizes-text-font-size-sm); cursor: pointer; }
  .es-pin-length.is-on { border-color: var(--gray-200); color: var(--white); font-weight: 700; }

  /* SSEcashLightningTabs / token-version toggles */
  .es-tabs { display: flex; gap: var(--layout-h-stack-gap-md); }
  .es-tabs.is-sm { gap: var(--layout-h-stack-gap-sm); }
  .es-tab { flex: 1; min-width: 0; height: var(--sizes-button-height); box-sizing: border-box; border: 1px solid var(--gray-900); border-radius: var(--sizes-button-border-radius);
    background: var(--gray-900); color: var(--gray-50); font: inherit; font-size: var(--sizes-text-font-size-sm); font-weight: 500; text-transform: uppercase; cursor: pointer; }
  .es-tab.is-on { background: transparent; border-color: var(--gray-75); color: var(--white); }
  .es-tab.is-alt { background: var(--gray-800); border-color: var(--gray-800); }
  .es-tab.is-alt.is-on { background: transparent; border-color: var(--gray-75); }

  /* SSEcashMintSelector pills */
  .es-pills { display: flex; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
  .es-pill { flex: none; display: flex; flex-direction: column; align-items: center; max-width: 160px; margin-right: 8px; padding: 8px 12px; box-sizing: border-box;
    border: 1px solid var(--gray-900); border-radius: var(--sizes-button-border-radius); background: var(--gray-900); color: var(--gray-50); font: inherit; font-size: var(--sizes-text-font-size-xs); cursor: pointer; }
  .es-pill.is-on { background: transparent; border-color: var(--gray-75); color: var(--white); }
  .es-pill span { max-width: 136px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .es-pill small { color: var(--gray-500); font-size: var(--sizes-text-font-size-xs); }
  .es-pill.is-on small { color: var(--gray-200); }

  .es-mono textarea, textarea.es-mono { font-family: ui-monospace, "SF Mono", Menlo, monospace !important; font-size: 12px !important; }
  .es-token textarea { height: auto; min-height: 100px; font-size: 12px; font-family: ui-monospace, "SF Mono", Menlo, monospace; padding: 10px; word-break: break-all; }
  .es-card { padding: 16px; border: 1px solid var(--gray-700); border-radius: 8px; background: var(--gray-900); }
  .es-warning { padding: 10px; border: 1px solid var(--warning); border-radius: 5px; color: var(--warning); font-size: var(--sizes-text-font-size-sm); }
  .es-panel { padding: 12px; border-radius: 4px; background: var(--gray-900); }
  .es-dot { display: inline-block; width: 12px; height: 12px; border-radius: 6px; background: var(--black); border: 1px solid var(--gray-700); box-sizing: border-box; }
  .es-dot.is-on { background: var(--main-green); border-color: var(--success); box-shadow: 0 0 6px rgba(167,255,175,0.5); }
  .es-words { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; }
  .es-word { flex: 1 1 30%; display: flex; align-items: center; gap: 6px; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--gray-800); border-radius: 3px; background: var(--gray-900); }
  .es-word small { min-width: 20px; text-align: right; color: var(--gray-300); font-size: var(--sizes-text-font-size-xs); }
  .es-word b { font-weight: 500; font-size: var(--sizes-text-font-size-sm); }
  .es-row { display: flex; justify-content: space-between; gap: 12px; }
  .es-row > :last-child { flex: 1; min-width: 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .es-tx-icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex: none; border: 1px solid var(--gray-700); border-radius: 16px; color: var(--white); font-size: 16px; }
  .es-underline { text-decoration: underline; cursor: pointer; }

  /* upcoming/index.tsx carousel — 60% cards, snap, dots */
  .es-carousel { display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0 20%; scrollbar-width: none; }
  .es-carousel::-webkit-scrollbar { display: none; }
  .es-slide { flex: none; width: 60%; scroll-snap-align: center; display: flex; flex-direction: column; justify-content: space-between; gap: 24px; transition: opacity 200ms, transform 200ms; }
  .es-slide-art { aspect-ratio: 0.62; border-radius: 12px; border: 1px solid var(--gray-800); overflow: hidden; position: relative; }
  .es-slide-art span { position: absolute; left: 12px; bottom: 10px; color: var(--gray-300); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
  .es-dots { display: flex; justify-content: center; gap: 8px; padding: 24px 0; }
  .es-dots i { width: 6px; height: 6px; border-radius: 3px; background: var(--gray-700); transition: width 200ms, background 200ms; }
  .es-dots i.is-on { width: 18px; background: var(--white); }

  /* converter/energy.tsx */
  .es-big { font-weight: 100; margin-bottom: -10px; }
  .es-scrollbox { box-sizing: border-box; padding: 16px; border-radius: 8px; background: var(--gray-900); overflow: auto; word-break: break-all; }
  .es-bar { height: 8px; margin: 10px 0; border-radius: 4px; background: var(--gray-900); overflow: hidden; }
  .es-bar i { display: block; height: 100%; border-radius: 4px; background: var(--white); }
  .es-range { width: 100%; height: 60px; margin: 0; padding: 0 12px; box-sizing: border-box; border-radius: 4px; background: var(--gray-850); -webkit-appearance: none; appearance: none; --c: var(--white); --fill: 0%; }
  .es-range::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(90deg, var(--c) var(--fill), var(--gray-500) var(--fill)); }
  .es-range::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; margin-top: -9px; border-radius: 11px; background: var(--c); }
  .es-range::-moz-range-track { height: 4px; border-radius: 2px; background: linear-gradient(90deg, var(--c) var(--fill), var(--gray-500) var(--fill)); }
  .es-range::-moz-range-thumb { width: 22px; height: 22px; border: 0; border-radius: 11px; background: var(--c); }
  .es-range:disabled { opacity: 0.5; }
  .es-input-ok input { border: 1px solid var(--success) !important; }
  .es-input-bad input { border: 1px solid var(--error) !important; }
  </style>`
)

// t() with both %{x} and {{x}} placeholders (en.json mixes them).
function esT(key, vars = {}) {
  return t(key, vars).replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ''))
}
const esFmt = (n) => Number(n).toLocaleString('en-US')
const esUsd = (sats) => ((sats / 1e8) * (typeof USD_PER_BTC === 'number' ? USD_PER_BTC : 100000)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function esHex(seed, len) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  let out = ''
  while (out.length < len) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    out += h.toString(16).padStart(8, '0')
  }
  return out.slice(0, len)
}
function esToken(seed, v = 'v4') {
  const body = btoa(esHex(seed + v, 180)).replace(/=+$/, '')
  return (v === 'v4' ? 'cashuB' : 'cashuA') + body
}
function esScreen(inner, black) {
  return `<div class="es-shell${black ? ' is-black' : ''}">${inner}</div>`
}

// ---------------------------------------------------------------------------------------
// Fixtures (mirror store/ecash.ts shapes: mints, proofs, transactions)

const esState = {
  accountName: 'Spending',
  hasSeed: true,
  mints: [
    { url: 'https://mint.minibits.cash/Bitcoin', name: 'Bitcoin Minibits mint', isConnected: true },
    { url: 'https://mint.coinos.io', name: 'Coinos', isConnected: true }
  ],
  proofs: [
    { amount: 32768, mintUrl: 'https://mint.minibits.cash/Bitcoin', id: '009a1f293253e41e', active: true },
    { amount: 8192, mintUrl: 'https://mint.minibits.cash/Bitcoin', id: '009a1f293253e41e', active: true },
    { amount: 4096, mintUrl: 'https://mint.minibits.cash/Bitcoin', id: '009a1f293253e41e', active: true },
    { amount: 2048, mintUrl: 'https://mint.coinos.io', id: '00ad268c4d1f5826', active: true },
    { amount: 1024, mintUrl: 'https://mint.coinos.io', id: '00ad268c4d1f5826', active: false },
    { amount: 512, mintUrl: 'https://mint.coinos.io', id: '00ad268c4d1f5826', active: true }
  ],
  transactions: [
    { id: 'tx-send-1', type: 'send', amount: 1000, mintUrl: 'https://mint.minibits.cash/Bitcoin', memo: 'Coffee', timestamp: Date.now() - 36e5 * 3, status: 'completed', tokenStatus: 'unspent', token: true },
    { id: 'tx-mint-1', type: 'mint', amount: 50000, mintUrl: 'https://mint.minibits.cash/Bitcoin', timestamp: Date.now() - 864e5 * 2, status: 'pending', quoteId: 'q_7f3c1a9e', expiry: Math.floor(Date.now() / 1000) + 3600, invoice: true },
    { id: 'tx-receive-1', type: 'receive', amount: 2048, mintUrl: 'https://mint.coinos.io', memo: 'Tip', timestamp: Date.now() - 864e5 * 5, status: 'completed', token: true },
    { id: 'tx-melt-1', type: 'melt', amount: 2100, mintUrl: 'https://mint.coinos.io', timestamp: Date.now() - 864e5 * 9, status: 'completed', invoice: true }
  ],
  proofIndex: 0,
  txId: 'tx-send-1'
}
esState.proofs.forEach((p, i) => {
  p.secret = esHex('secret' + i, 64)
  p.C = '02' + esHex('C' + i, 64)
  p.counter = 12 + i * 3
})
const esBalance = (url) => esState.proofs.filter((p) => !url || p.mintUrl === url).reduce((s, p) => s + p.amount, 0)
const ES_DEMO_SEED = 'abandon ability able about above absent absorb abstract absurd abuse access accident'.split(' ')

function esOpenProof(i) {
  esState.proofIndex = i
  go('ecash-proof')
}
function esOpenTx(id) {
  esState.txId = id
  go('ecash-transaction')
}

// ---------------------------------------------------------------------------------------
// Shared bits

// SSEcashLightningTabs / token-version toggle row
function esTabs(name, items, active, alt) {
  return `<div class="es-tabs${alt ? ' is-sm' : ''}" role="tablist">${items
    .map(([k, label]) => `<button type="button" class="es-tab${alt ? ' is-alt' : ''}${k === active ? ' is-on' : ''}" data-es-tab="${name}" data-value="${k}">${label}</button>`)
    .join('')}</div>`
}

// SSEcashMintSelector
function esMintSelector(selected) {
  const pill = (url, label, bal) =>
    `<button type="button" class="es-pill${selected === url ? ' is-on' : ''}" data-es-mint="${url}"><span>${ss.esc(label)}</span><small>${bal} ${t('bitcoin.sats')}</small></button>`
  return ss.vstack({ gap: 'xs' },
    ss.text({ color: 'muted', size: 'xs', uppercase: true }, t('ecash.mint.selectMint')),
    `<div class="es-pills">${pill('', t('ecash.mint.autoSelect'), esBalance())}${esState.mints.map((m) => pill(m.url, m.name || m.url, esBalance(m.url))).join('')}</div>`)
}

// SSPinInput + SSKeyboard. `withClear` puts CLEAR bottom-left (unlock), else DEL bottom-left (set pin).
function esPinPad(pin, opts = {}) {
  const active = pin.findIndex((d) => d === '')
  const cells = pin
    .map((d, i) => `<span class="es-pin-cell${d !== '' ? ' is-filled' : ''}${i === (active === -1 ? pin.length - 1 : active) ? ' is-active' : ''}"><i></i></span>`)
    .join('')
  const key = (k) =>
    k === ''
      ? '<div class="es-key"></div>'
      : `<div class="es-key"><button type="button" class="${k === 'DEL' || k === 'CLEAR' ? 'is-control' : ''}" data-es-key="${k}" aria-label="${k}"><span>${
          k === 'DEL' ? '⌫' : k === 'CLEAR' ? 'C' : k
        }</span></button></div>`
  const pad = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].concat(opts.withClear ? ['CLEAR', '0', 'DEL'] : ['DEL', '0', ''])
  return `<div class="es-pin">${ss.vstack({ gap: 'none', itemsCenter: true, style: 'width:100%' },
    `<div class="es-pin-row${opts.shake ? ' es-shake' : ''}">${cells}</div>`,
    opts.feedback !== undefined ? `<div class="es-pin-feedback">${opts.feedback}</div>` : '',
    opts.below ? `<div class="es-pin-below">${opts.below}</div>` : '')}
    <div class="es-keys" style="margin-top:16px">${pad.map(key).join('')}</div></div>`
}

// Apply one key press to a pin array, returns the new array.
function esPress(pin, k) {
  const next = [...pin]
  if (k === 'CLEAR') return next.map(() => '')
  if (k === 'DEL') {
    const i = next.map((d) => d !== '').lastIndexOf(true)
    if (i >= 0) next[i] = ''
    return next
  }
  const i = next.indexOf('')
  if (i >= 0) next[i] = k
  return next
}
const esFilled = (pin) => pin.every((d) => d !== '')
const esEmpty = (n) => Array.from({ length: n }, () => '')

// ---------------------------------------------------------------------------------------
// setPin.tsx — verify (when changing) → set (with length picker) → re-enter

const esSetPin = { stage: 'set', length: 4, pin: esEmpty(4), confirm: esEmpty(4), current: esEmpty(4), wrong: false, fromSettings: false, saved: null }

registerScreen('set-pin', {
  source: 'app/setPin.tsx',
  back: null,
  render: () => {
    const s = esSetPin
    const title = s.stage === 'verify' ? t('auth.verifyPinTitle') : s.stage === 'set' ? t('auth.setPinTitle') : t('auth.reenterPinTitle')
    const match = esFilled(s.confirm) && s.confirm.join('') === s.pin.join('')
    let feedback = ''
    if (s.stage === 'verify' && s.wrong && !esFilled(s.current)) feedback = ss.text({ uppercase: true, size: 'lg', center: true, style: 'color:var(--error)' }, t('auth.wrongPin'))
    if (s.stage === 're-enter' && esFilled(s.confirm))
      feedback = match
        ? ss.vstack({ itemsCenter: true, gap: 'xs' }, ss.icon('checkCircleThin', { size: 32 }), ss.text({ uppercase: true, size: 'lg', color: 'muted', center: true }, t('auth.pinsMatch')))
        : ss.text({ uppercase: true, size: 'lg', center: true, style: 'color:var(--error)' }, t('auth.pinsDontMatch'))
    const lengths = [4, 5, 6, 7, 8].map((n) => `<button type="button" class="es-pin-length${n === s.length ? ' is-on' : ''}" data-es-length="${n}">${n}</button>`).join('')
    const pin = s.stage === 'verify' ? s.current : s.stage === 'set' ? s.pin : s.confirm
    const pad = esPinPad(pin, {
      feedback: s.stage === 'set' ? undefined : feedback,
      shake: s.stage === 'verify' && s.wrong,
      below: s.stage === 'set' ? ss.vstack({ gap: 'sm', itemsCenter: true }, ss.text({ uppercase: true, color: 'muted', center: true }, t('auth.pinLength')), ss.hstack({ gap: 'sm' }, lengths)) : ''
    })
    const filled = esFilled(pin)
    const btn = (label, variant, id) => ss.button({ label, variant, id })
    const actions = [
      s.stage === 'verify' && filled ? btn(t('auth.confirmPin'), 'secondary', 'es-verify') : '',
      s.stage === 'set' && filled ? btn(t('auth.confirmPin'), 'secondary', 'es-confirm') : '',
      s.stage === 're-enter' && filled && match ? btn(t('auth.setPin'), 'secondary', 'es-save') : '',
      s.stage === 'verify' && !filled ? btn(t('common.cancel'), 'ghost', 'es-cancel') : '',
      s.stage === 'verify' && filled ? btn(t('common.clear'), 'ghost', 'es-clear') : '',
      s.stage === 'set' && !filled ? btn(s.fromSettings ? t('auth.noPin') : t('auth.setPinLater'), 'ghost', 'es-later') : '',
      s.stage === 'set' && filled ? btn(t('common.clear'), 'ghost', 'es-clear') : '',
      s.stage === 're-enter' && !filled ? btn(t('common.goBack'), 'ghost', 'es-goback') : '',
      s.stage === 're-enter' && filled ? btn(t('common.clear'), 'ghost', 'es-clear') : ''
    ].join('')
    return esScreen(ss.vstack({ style: 'flex:1;height:100%' },
      ss.vstack({ gap: 'md', style: 'flex:1;width:100%' }, ss.text({ uppercase: true, size: 'lg', color: 'muted', center: true, weight: 'light' }, title), pad),
      ss.vstack({ widthFull: true, style: 'justify-content:flex-end;min-height:132px' }, actions)))
  },
  bind: (body) => {
    const s = esSetPin
    const rerender = () => openKitScreen('set-pin')
    const done = () => {
      ss.toast(t('auth.setPin'), document.getElementById('view-kit'))
      setTimeout(() => go(s.fromSettings ? 'settings-security' : 'signer'), 600)
    }
    body.addEventListener('click', (e) => {
      const k = e.target.closest('[data-es-key]')
      if (k) {
        const key = s.stage === 'verify' ? 'current' : s.stage === 'set' ? 'pin' : 'confirm'
        s[key] = esPress(s[key], k.dataset.esKey)
        s.wrong = false
        return rerender()
      }
      const len = e.target.closest('[data-es-length]')
      if (len) {
        s.length = +len.dataset.esLength
        s.pin = esEmpty(s.length)
        s.confirm = esEmpty(s.length)
        return rerender()
      }
      const id = e.target.closest('button')?.id
      if (id === 'es-verify') {
        // Fixture: the saved PIN, or 1234 if none was set in this session.
        if (s.current.join('') === (s.saved || '1234')) Object.assign(s, { stage: 'set', current: esEmpty(s.length) })
        else Object.assign(s, { wrong: true, current: esEmpty(s.current.length) })
      }
      if (id === 'es-confirm') s.stage = 're-enter'
      if (id === 'es-save') {
        s.saved = s.pin.join('')
        Object.assign(s, { stage: 'set', pin: esEmpty(s.length), confirm: esEmpty(s.length) })
        return done()
      }
      if (id === 'es-cancel') return go('settings-security')
      if (id === 'es-later') return go(s.fromSettings ? 'settings-security' : 'signer')
      if (id === 'es-goback') Object.assign(s, { stage: 'set', confirm: esEmpty(s.length) })
      if (id === 'es-clear') {
        if (s.stage === 'verify') s.current = esEmpty(s.current.length)
        else if (s.stage === 'set') s.pin = esEmpty(s.length)
        else s.confirm = esEmpty(s.length)
      }
      if (id) rerender()
    })
  }
})

// Open set-pin in "change PIN" mode (from Security), which starts with verify.
function esChangePin() {
  Object.assign(esSetPin, { stage: 'verify', fromSettings: true, current: esEmpty(esSetPin.length), pin: esEmpty(esSetPin.length), confirm: esEmpty(esSetPin.length), wrong: false })
  go('set-pin')
}

// ---------------------------------------------------------------------------------------
// setDuressPin.tsx — set → re-enter (fixed 4 digits)

const esDuress = { stage: 'set', pin: esEmpty(4), confirm: esEmpty(4) }

registerScreen('set-duress-pin', {
  source: 'app/setDuressPin.tsx',
  back: null,
  render: () => {
    const s = esDuress
    const match = esFilled(s.confirm) && s.confirm.join('') === s.pin.join('')
    const pin = s.stage === 'set' ? s.pin : s.confirm
    const filled = esFilled(pin)
    const feedback =
      s.stage === 're-enter' && esFilled(s.confirm)
        ? match
          ? ss.vstack({ itemsCenter: true, gap: 'xs' }, ss.icon('checkCircleThin', { size: 32 }), ss.text({ uppercase: true, size: 'lg', color: 'muted', center: true }, t('auth.pinsMatch')))
          : ss.text({ uppercase: true, size: 'lg', center: true, style: 'color:var(--error)' }, t('auth.pinsDontMatch'))
        : ''
    const btn = (label, variant, id) => ss.button({ label, variant, id })
    const actions = [
      s.stage === 'set' && filled ? btn(t('auth.confirmDuressPin'), 'secondary', 'es-confirm') : '',
      s.stage === 're-enter' && filled && match ? btn(t('auth.setDuressPin'), 'secondary', 'es-save') : '',
      s.stage === 'set' && !filled ? btn(t('auth.setDuressPinLater'), 'ghost', 'es-later') : '',
      s.stage === 'set' && filled ? btn(t('common.clear'), 'ghost', 'es-clear') : '',
      s.stage === 're-enter' && !filled ? btn(t('common.goBack'), 'ghost', 'es-goback') : '',
      s.stage === 're-enter' && filled ? btn(t('common.clear'), 'ghost', 'es-clear') : ''
    ].join('')
    return esScreen(ss.vstack({ itemsCenter: true, justifyBetween: true, style: 'flex:1' },
      ss.vstack({ gap: 'md', style: 'flex:1;width:100%' },
        ss.text({ uppercase: true, size: 'lg', color: 'muted', center: true }, s.stage === 'set' ? t('auth.setDuressPinTitle') : t('auth.reenterDuressPinTitle')),
        esPinPad(pin, { feedback: s.stage === 're-enter' ? feedback : undefined })),
      ss.vstack({ widthFull: true, style: 'justify-content:flex-end;min-height:132px' }, actions)))
  },
  bind: (body) => {
    const s = esDuress
    const rerender = () => openKitScreen('set-duress-pin')
    body.addEventListener('click', (e) => {
      const k = e.target.closest('[data-es-key]')
      if (k) {
        const key = s.stage === 'set' ? 'pin' : 'confirm'
        s[key] = esPress(s[key], k.dataset.esKey)
        return rerender()
      }
      const id = e.target.closest('button')?.id
      if (id === 'es-confirm') s.stage = 're-enter'
      if (id === 'es-save') {
        Object.assign(s, { stage: 'set', pin: esEmpty(4), confirm: esEmpty(4) })
        ss.toast(t('auth.setDuressPin'), document.getElementById('view-kit'))
        return setTimeout(() => go('settings-security'), 600)
      }
      if (id === 'es-later') return go('settings-security')
      if (id === 'es-goback') Object.assign(s, { stage: 'set', confirm: esEmpty(4) })
      if (id === 'es-clear') s[s.stage === 'set' ? 'pin' : 'confirm'] = esEmpty(4)
      if (id) rerender()
    })
  }
})

// ---------------------------------------------------------------------------------------
// unlock.tsx — SSPinAuth with tries-left feedback. Fixture PIN: the one set in set-pin, else 1234.

const esUnlock = { pin: esEmpty(4), maxTries: 10, triesLeft: 10, verifying: false, shake: false }

registerScreen('unlock', {
  source: 'app/unlock.tsx',
  back: null,
  render: () => {
    const s = esUnlock
    let text = ''
    if (s.triesLeft < s.maxTries) {
      text = `${s.triesLeft} ${s.triesLeft > 1 ? t('auth.triesLeft') : t('auth.tryLeft')}`
      if (s.triesLeft <= 2) text += '\n' + t('auth.warningKeysErase')
    }
    const color = s.triesLeft > 2 ? 'var(--gray-200)' : s.triesLeft === 1 ? 'var(--error)' : 'var(--warning)'
    const feedback = text
      .split('\n')
      .map((line, i) => ss.text({ uppercase: true, center: true, weight: s.triesLeft <= 2 && i === 0 ? 'bold' : 'regular', style: `color:${color};line-height:16px` }, line))
      .join('')
    return esScreen(
      `<div style="padding-top:28%">${ss.vstack({ itemsCenter: true, gap: 'lg', style: 'width:100%' },
        ss.text({ uppercase: true, size: 'lg', center: true, style: 'color:var(--gray-300)' }, s.verifying ? t('auth.unlocking') : t('auth.enterPinTitle')),
        s.verifying ? ss.orbitLoader({ size: 80 }) : esPinPad(s.pin, { withClear: true, feedback, shake: s.shake }))}</div>`
    )
  },
  bind: (body) => {
    const s = esUnlock
    body.addEventListener('click', (e) => {
      const k = e.target.closest('[data-es-key]')
      if (!k) return
      s.pin = esPress(s.pin, k.dataset.esKey)
      s.shake = false
      if (esFilled(s.pin)) {
        const ok = s.pin.join('') === (esSetPin.saved || '1234')
        if (ok) {
          s.verifying = true
          openKitScreen('unlock')
          return setTimeout(() => {
            Object.assign(s, { pin: esEmpty(4), triesLeft: s.maxTries, verifying: false })
            go('signer')
          }, 700)
        }
        s.triesLeft = Math.max(1, s.triesLeft - 1)
        s.pin = esEmpty(4)
        s.shake = true
      }
      openKitScreen('unlock')
    })
  }
})

// ---------------------------------------------------------------------------------------
// warning.tsx — first-launch risk warning

registerScreen('warning', {
  source: 'app/warning.tsx',
  back: null,
  render: () =>
    esScreen(
      `<div style="padding-top:12%;display:flex;flex-direction:column;flex:1">${ss.vstack({ gap: 'md', justifyBetween: true },
        ss.vstack({ itemsCenter: true, style: 'margin-bottom:24px' },
          '<img src="/imgs/satSigner_symbol.png" alt="" style="width:64px;height:64px">',
          ss.vstack({ gap: 'xs', itemsCenter: true },
            ss.text({ size: 'xs', uppercase: true, style: 'font-weight:500;letter-spacing:1px' }, t('warning.subtitle')),
            ss.text({ size: '5xl', uppercase: true, style: 'font-weight:300;letter-spacing:2px;line-height:35px' }, t('common.warning'))),
          ss.icon('warningSharp', { size: 120 }),
          ss.text({ size: '3xl', center: true, style: 'font-weight:500;letter-spacing:1px' }, t('warning.title')),
          ss.text({ color: 'muted', style: 'letter-spacing:0.5px' }, t('warning.content'))),
        ss.vstack({},
          ss.button({ variant: 'secondary', label: t('common.acknowledge'), go: 'signer' }),
          ss.button({ variant: 'ghost', label: t('common.dismiss'), go: 'intro' })))}</div>`,
      true
    )
})

// ---------------------------------------------------------------------------------------
// (authenticated)/_session.tsx — the authenticated shell: a left slide drawer (SSNavMenu,
// 300px) around the tab stack, plus the Ark receive overlay. Studio's equivalent is the
// signer menu with the existing drawer open, so this route opens exactly that.

registerScreen('session', {
  source: 'app/(authenticated)/_session.tsx',
  back: 'signer',
  title: 'Session',
  render: () => ss.vstack({ itemsCenter: true, style: 'padding-top:40%' }, ss.orbitLoader({ size: 80 })),
  bind: () => {
    setTimeout(() => {
      if (typeof menuTab === 'function') menuTab('signer')
      if (typeof setDrawer === 'function') setDrawer(true)
      routeId = 'session'
    }, 0)
  }
})

// ---------------------------------------------------------------------------------------
// upcoming/index.tsx — carousel of "coming soon" cards for a menu item (constants/slides.ts).
// Images are app assets (assets/images/*.jpg) not shipped in Studio; cards use gradients.

const ES_SLIDES = {
  lightning: { page: 'navigation.item.lightning', items: [1, 2, 3, 4, 5, 6].map((n) => [`upcoming.lightning.title_${n}`, `upcoming.lightning.description_${n}`, `ln_${n}`]) },
  liquid: { page: 'navigation.item.liquid', items: [['upcoming.liquid.title', 'upcoming.liquid.description', 'liquid_0']] },
  ecash: { page: 'navigation.item.ecash', items: [1, 2].map((n) => [`upcoming.ecash.title_${n}`, `upcoming.ecash.description_${n}`, `ecash_${n}`]) },
  nostr: { page: 'navigation.item.nostr', items: [1, 2, 3].map((n) => [`upcoming.nostr.title_${n}`, `upcoming.nostr.description_${n}`, `nostr_${n}`]) },
  chaintip: { page: 'navigation.item.chaintip', items: [['upcoming.chaintip.title', 'upcoming.chaintip.description', 'chaintip']] },
  mempool: { page: 'navigation.item.mempool', items: [['upcoming.mempool.title', 'upcoming.mempool.description', 'mempool']] },
  difficulty: { page: 'navigation.item.difficulty', items: [['upcoming.difficulty.title', 'upcoming.difficulty.description', 'difficulty']] },
  halving: { page: 'navigation.item.halving', items: [1, 2].map((n) => [`upcoming.halving.title_${n}`, `upcoming.halving.description_${n}`, `halving_${n}`]) }
}
let esUpcomingPage = 'liquid'
function esOpenUpcoming(page) {
  esUpcomingPage = ES_SLIDES[page] ? page : 'liquid'
  go('upcoming')
}

registerScreen('upcoming', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/upcoming/index.tsx',
  title: () => t('upcoming.name'),
  back: 'signer',
  render: () => {
    const slides = ES_SLIDES[esUpcomingPage].items
    const art = (name, i) => {
      const hue = [210, 160, 30, 280, 0, 120][i % 6]
      return `<div class="es-slide-art" style="background:radial-gradient(120% 80% at 30% 20%, hsl(${hue} 30% 22%), var(--gray-900) 60%, var(--black))"><span>${name}.jpg</span></div>`
    }
    return ss.vstack({ style: 'padding-top:24px;margin:0 calc(-1 * var(--pad-main-x, 24px))' },
      `<div class="es-carousel" id="es-carousel">${slides
        .map(([title, desc, img], i) =>
          `<div class="es-slide">${ss.vstack({ itemsCenter: true }, ss.text({ size: 'lg', center: true }, t(title)), ss.text({ size: 'lg', color: 'muted', center: true }, t(desc)))}${art(img, i)}</div>`)
        .join('')}</div>`,
      `<div class="es-dots">${slides.map((_, i) => `<i class="${i === 0 ? 'is-on' : ''}"></i>`).join('')}</div>`)
  },
  bind: (body) => {
    const track = body.querySelector('#es-carousel')
    const dots = [...body.querySelectorAll('.es-dots i')]
    const slides = [...track.children]
    const paint = () => {
      const mid = track.scrollLeft + track.clientWidth / 2
      let best = 0
      slides.forEach((s, i) => {
        const c = s.offsetLeft + s.offsetWidth / 2
        const d = Math.abs(c - mid)
        s.style.opacity = String(Math.max(0.4, 1 - d / track.clientWidth))
        s.style.transform = `scale(${Math.max(0.9, 1 - d / track.clientWidth / 4)})`
        if (d < Math.abs(slides[best].offsetLeft + slides[best].offsetWidth / 2 - mid)) best = i
      })
      dots.forEach((dot, i) => dot.classList.toggle('is-on', i === best))
    }
    track.addEventListener('scroll', paint)
    requestAnimationFrame(paint)
  }
})

// ---------------------------------------------------------------------------------------
// converter/energy.tsx — "mine with your phone" demo: sliders, start/stop, live counters, RPC form

const esEnergy = {
  intensity: 100,
  interval: 1000,
  mining: false,
  stopping: false,
  connected: false,
  connecting: false,
  rpcUrl: 'http://127.0.0.1:8332',
  rpcUser: 'satsigner',
  rpcPassword: '',
  address: 'bc1qminer0demo00000000000000000000000000x9',
  opReturn: '',
  hashes: 0,
  hps: 0,
  sats: 0,
  blocksFound: 0,
  lastHash: '',
  timer: 0,
  height: 972231
}
const esEnergyValid = () => /^(bc1|tb1|[13mn2])[a-zA-Z0-9]{20,}$/.test(esEnergy.address)
const esIntensityColor = (v) => (v > 500 ? 'var(--error)' : v > 300 ? 'var(--warning)' : v > 200 ? 'var(--success)' : 'var(--white)')

registerScreen('converter-energy', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/converter/energy.tsx',
  title: () => esT('converter.energy.title'),
  back: 'converter',
  render: () => {
    const s = esEnergy
    const tn = (k, v) => esT('converter.energy.' + k, v)
    const info = s.connected
    const epoch = 2016
    const prog = (s.height % epoch) / epoch
    const header = s.mining || info ? '00000020' + esHex('hdr' + s.height + s.hashes, 144) : ''
    const range = (id, min, max, step, value, color) =>
      `<input type="range" class="es-range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" ${s.mining ? 'disabled' : ''} style="--c:${color};--fill:${((value - min) / (max - min)) * 100}%">`
    const stat = (value, label, align) => ss.vstack({ gap: 'xxs', style: `align-items:${align || 'flex-start'}` }, ss.text({ size: 'xl' }, value), ss.text({ size: 'xs', color: 'muted' }, label))
    const field = (key, label, ph, extra = {}) =>
      ss.form.item({}, ss.form.label({ label: tn('params.' + label) }), ss.textInput({ variant: 'outline', align: 'center', value: s[key], placeholder: ph, name: key, ...extra }))
    return ss.vstack({ style: 'padding-bottom:100px' },
      ss.vstack({ gap: 'lg', itemsCenter: true, style: 'padding:20px 0' },
        ss.vstack({ gap: 'sm', itemsCenter: true },
          ss.text({ color: 'muted' }, tn('blocksFound', { blocks: s.blocksFound })),
          ss.text({ size: 'lg', color: 'muted', id: 'es-mining-state' }, tn(s.mining ? 'mining' : 'notMining'))),
        ss.hstack({ gap: 'xl' },
          ss.vstack({ gap: 'xxs', itemsCenter: true, style: 'width:30%' }, ss.text({ size: '3xl', className: 'es-big', id: 'es-hps' }, esFmt(s.hps)), ss.text({ color: 'muted', center: true }, tn('hashesPerSecond'))),
          ss.vstack({ gap: 'xxs', itemsCenter: true, style: 'width:30%' }, ss.text({ size: '3xl', className: 'es-big' }, '~' + Math.round(s.intensity / 10)), ss.text({ color: 'muted', center: true }, tn('energyRate')))),
        ss.vstack({ gap: 'xxs', itemsCenter: true }, ss.text({ size: '3xl', className: 'es-big', id: 'es-sats' }, esFmt(s.sats)), ss.text({ color: 'muted' }, tn('satsEarned'))),
        ss.vstack({ gap: 'md', style: 'padding:20px 0;width:100%' },
          ss.vstack({ gap: 'sm', widthFull: true },
            ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted' }, tn('miningIntensity')), ss.text({ color: 'muted', id: 'es-int-label' }, tn('miningIntensityRate', { intensity: s.intensity }))),
            range('es-intensity', 0, 2000, s.intensity > 200 ? 100 : 10, s.intensity, esIntensityColor(s.intensity))),
          ss.vstack({ gap: 'sm', widthFull: true },
            ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted' }, tn('miningInterval')), ss.text({ color: 'muted', id: 'es-int2-label' }, s.interval + 'ms')),
            range('es-interval', 1, 10000, 1, s.interval, 'var(--white)')),
          ss.button({
            label: tn(s.mining ? (s.stopping ? 'stoppingMining' : 'stopMining') : 'startMining').toUpperCase(),
            variant: s.mining ? 'danger' : 'secondary',
            disabled: !s.connected || !esEnergyValid() || s.stopping,
            loading: s.stopping,
            id: 'es-mine'
          }),
          ss.button({ label: tn('joinPool').toUpperCase(), variant: 'outline', disabled: true })),
        ss.vstack({ gap: 'md', widthFull: true },
          ss.vstack({ gap: 'sm' }, ss.text({ color: 'muted' }, tn('blockHeaderCandidate')), `<div class="es-scrollbox" style="height:95px">${ss.text({ type: 'mono', id: 'es-header' }, header || '-')}</div>`),
          ss.vstack({ gap: 'sm' }, ss.text({ color: 'muted' }, tn('latestHash')), `<div class="es-scrollbox" style="height:70px">${ss.text({ type: 'mono', id: 'es-last' }, s.lastHash || '-')}</div>`),
          ss.vstack({ gap: 'sm' }, ss.text({ color: 'muted' }, tn('bestHash')), `<div class="es-scrollbox" style="height:70px">${ss.text({ type: 'mono' }, info ? '00000000000000000000' + esHex('best' + s.height, 44) : '-')}</div>`),
          ss.vstack({ gap: 'xs' },
            ss.text({ color: 'muted' }, tn('adjustmentProgress')),
            `<div class="es-bar"><i style="width:${info ? prog * 100 : 0}%"></i></div>`,
            ss.hstack({ justifyBetween: true },
              ss.text({ size: 'xs', color: 'muted' }, info ? `Block ${s.height % epoch} of ${epoch}` : '-'),
              ss.text({ size: 'xs', color: 'muted' }, info ? `${epoch - (s.height % epoch)} until next adjustment` : '-')))),
        ss.vstack({ gap: 'lg', widthFull: true },
          ss.hstack({ justifyBetween: true }, stat(info ? s.height + 1 : '0', tn('blockCandidate')), stat(info ? '3.1250 BTC' : '0.0000 BTC', tn('reward'), 'center'), stat(info ? '3,412' : '0', tn('template.transactions'), 'flex-end')),
          ss.hstack({ justifyBetween: true }, stat(info ? '3,412' : '0', tn('template.transactions')), stat(info ? '3.81 MB' : '0.00 MB', tn('blockSize'), 'center'), stat(info ? '4' : '0', tn('blockMinedMinutesAgo'), 'flex-end')),
          ss.hstack({ justifyBetween: true }, stat('n/a', tn('template.template')), stat(info ? tn('networkHashRate', { rate: '812.4' }) : 'n/a', tn('hashRate'), 'flex-end')))),
      ss.vstack({ gap: 'md', style: 'padding-top:20px' },
        ss.form({},
          ss.text({ color: 'muted', uppercase: true, center: true, style: 'margin-bottom:16px' }, tn('params.title')),
          field('rpcUrl', 'rpcUrl', 'http://127.0.0.1:8332'),
          field('rpcUser', 'rpcUser', tn('params.rpcUserPlaceholder')),
          field('rpcPassword', 'rpcPassword', tn('params.rpcPasswordPlaceholder')),
          field('address', 'address', tn('params.addressPlaceholder'), { className: s.address ? (esEnergyValid() ? 'es-input-ok' : 'es-input-bad') : '' }),
          s.address && !esEnergyValid() ? ss.text({ color: 'muted', center: true }, tn('params.addressInvalid')) : '',
          field('opReturn', 'opReturn', tn('params.opReturnPlaceholder')),
          ss.button({ label: tn('params.test'), variant: 'outline', disabled: s.connecting, loading: s.connecting, id: 'es-test' })),
        info
          ? ss.vstack({ gap: 'xs', style: 'padding-top:40px' },
              ss.text({ color: 'muted', uppercase: true, center: true, style: 'margin-bottom:16px' }, tn('node.title')),
              ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted' }, tn('node.chain')), ss.text({}, 'main')),
              ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted' }, tn('node.blocks')), ss.text({}, String(s.height))),
              ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted' }, tn('node.headers')), ss.text({}, String(s.height))),
              ss.vstack({ gap: 'xxs' }, ss.text({ color: 'muted' }, tn('bestHash')), ss.text({ size: 'xs', type: 'mono', style: 'word-break:break-all' }, '00000000000000000000' + esHex('best' + s.height, 44))),
              ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted' }, tn('node.difficulty')), ss.text({}, '143365736421810')),
              ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted' }, tn('node.progress')), ss.text({}, '100.00%')),
              ss.button({ label: tn('node.refresh').toUpperCase(), variant: 'outline', id: 'es-refresh' }))
          : ''))
  },
  bind: (body) => {
    const s = esEnergy
    const rerender = () => {
      const y = document.getElementById('kit-body').scrollTop
      openKitScreen('converter-energy')
      document.getElementById('kit-body').scrollTop = y
    }
    body.addEventListener('input', (e) => {
      if (e.target.id === 'es-intensity') {
        s.intensity = +e.target.value
        e.target.style.setProperty('--c', esIntensityColor(s.intensity))
        e.target.style.setProperty('--fill', (s.intensity / 2000) * 100 + '%')
        body.querySelector('#es-int-label').textContent = esT('converter.energy.miningIntensityRate', { intensity: s.intensity })
      }
      if (e.target.id === 'es-interval') {
        s.interval = +e.target.value
        e.target.style.setProperty('--fill', ((s.interval - 1) / 9999) * 100 + '%')
        body.querySelector('#es-int2-label').textContent = s.interval + 'ms'
      }
      const field = e.target.closest('input[name]')
      if (field && field.name in s) s[field.name] = field.value
    })
    body.addEventListener('change', (e) => {
      if (e.target.name === 'address') rerender()
    })
    body.addEventListener('click', (e) => {
      const id = e.target.closest('button')?.id
      if (id === 'es-test' || id === 'es-refresh') {
        s.connecting = true
        rerender()
        setTimeout(() => {
          Object.assign(s, { connecting: false, connected: true })
          if (kitCurrent === 'converter-energy') rerender()
        }, 800)
      }
      if (id === 'es-mine') {
        if (s.mining) {
          s.stopping = true
          rerender()
          setTimeout(() => {
            clearInterval(s.timer)
            Object.assign(s, { mining: false, stopping: false, hps: 0 })
            if (kitCurrent === 'converter-energy') rerender()
          }, 600)
          return
        }
        s.mining = true
        const tick = () => {
          if (kitCurrent !== 'converter-energy') return clearInterval(s.timer)
          const n = Math.max(1, Math.round(s.intensity * (1000 / Math.max(s.interval, 50)) * 0.1))
          s.hashes += n
          s.hps = n
          s.lastHash = esHex('h' + s.hashes, 64)
          const set = (sel, v) => {
            const el = document.querySelector(sel)
            if (el) el.textContent = v
          }
          set('#es-hps', esFmt(s.hps))
          set('#es-last', s.lastHash)
          set('#es-header', '00000020' + esHex('hdr' + s.height + s.hashes, 144))
        }
        rerender()
        s.timer = setInterval(tick, Math.max(200, Math.min(s.interval, 2000)))
      }
    })
  }
})

// ---------------------------------------------------------------------------------------
// eCash — signer/ecash/account/[id]/settings/index.tsx

registerScreen('ecash-account-settings', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ecash/account/[id]/settings/index.tsx',
  title: () => t('ecash.settings.title'),
  back: 'ecash-account',
  render: () =>
    ss.vstack({ gap: 'lg', style: 'padding-bottom:40px' },
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t('ecash.account.name')),
        ss.textInput({ value: esState.accountName, placeholder: t('ecash.account.namePlaceholder'), name: 'name', id: 'es-name' }),
        ss.button({ label: t('ecash.account.rename'), variant: 'outline', id: 'es-rename', disabled: true })),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t('ecash.settings.mintManagement')),
        ss.button({ label: t('ecash.mint.title'), variant: 'outline', go: 'ecash-settings-mint' })),
      esState.hasSeed
        ? ss.vstack({ gap: 'sm' },
            ss.text({ uppercase: true }, t('ecash.account.seedManagement')),
            ss.button({ label: t('ecash.account.viewSeedWords'), variant: 'outline', go: 'ecash-settings-seed' }),
            ss.button({ label: t('ecash.account.restoreFromSeed'), variant: 'outline', go: 'ecash-settings-recovery' }))
        : '',
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t('ecash.settings.dataManagement')),
        ss.hstack({ gap: 'sm' },
          ss.button({ label: t('ecash.backup.title'), variant: 'outline', style: 'flex:1', go: 'ecash-settings-backup' }),
          ss.button({ label: t('ecash.recovery.title'), variant: 'outline', style: 'flex:1', go: 'ecash-settings-recovery' })),
        ss.button({ label: t('ecash.recovery.clearAllData'), variant: 'danger', id: 'es-clear-data' })),
      ss.vstack({ gap: 'sm' }, ss.button({ label: t('ecash.account.deleteAccount'), variant: 'danger', id: 'es-delete' }))),
  overlays: () =>
    ['clear', 'delete']
      .map((k) =>
        ss.modal({ id: 'es-modal-' + k, fullOpacity: true, showLabel: false },
          ss.vstack({ justifyBetween: true, widthFull: true, style: 'flex:1' },
            ss.vstack({ gap: 'lg', itemsCenter: true, style: 'margin:auto 0' },
              ss.text({ uppercase: true, weight: 'bold' }, k === 'clear' ? t('ecash.recovery.clearAllData') : t('ecash.account.deleteAccount')),
              ss.text({ color: 'muted', center: true }, k === 'clear' ? t('ecash.recovery.clearAllDataWarning') : t('ecash.account.deleteAccountWarning'))),
            ss.vstack({ gap: 'md' },
              ss.button({ variant: 'danger', label: k === 'clear' ? t('ecash.recovery.clearAllData') : t('ecash.account.deleteAccount'), id: 'es-do-' + k }),
              ss.button({ variant: 'ghost', label: t('common.cancel'), data: { 'ss-close': '' } })))))
      .join(''),
  bind: (body) => {
    const input = body.querySelector('#es-name input')
    const rename = body.querySelector('#es-rename')
    input.addEventListener('input', () => {
      rename.disabled = !input.value.trim() || input.value.trim() === esState.accountName
    })
    rename.onclick = () => {
      esState.accountName = input.value.trim()
      ss.toast(t('ecash.account.rename'), document.getElementById('view-kit'))
      rename.disabled = true
    }
    body.querySelector('#es-clear-data').onclick = () => ss.open('es-modal-clear')
    body.querySelector('#es-delete').onclick = () => ss.open('es-modal-delete')
    const overlays = document.getElementById('kit-overlays')
    overlays.querySelector('#es-do-clear').onclick = () => {
      ss.close('es-modal-clear')
      ss.toast(t('ecash.success.dataCleared'), document.getElementById('view-kit'))
    }
    overlays.querySelector('#es-do-delete').onclick = () => {
      ss.close('es-modal-delete')
      go('ecash')
    }
  }
})

// settings/mint.tsx
const ES_DEFAULT_MINTS = [
  { name: 'Bitcoin Minibits mint', url: 'https://mint.minibits.cash/Bitcoin' },
  { name: 'Mint Cuba Bitcoin', url: 'https://mint.cubabitcoin.org' },
  { name: 'Voltz Mint', url: 'https://mint.lnvoltz.com' },
  { name: '21Mint', url: 'https://21mint.me' },
  { name: 'Coinos', url: 'https://mint.coinos.io' }
]

registerScreen('ecash-settings-mint', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ecash/account/[id]/settings/mint.tsx',
  title: () => t('ecash.mint.title'),
  back: 'ecash-account-settings',
  render: () =>
    ss.vstack({ gap: 'lg', style: 'padding-bottom:40px' },
      esState.mints.length
        ? ss.vstack({ gap: 'md' },
            ss.text({ uppercase: true }, t('ecash.mint.connectedMints')),
            esState.mints
              .map((m) =>
                `<div class="es-card">${ss.vstack({ gap: 'sm' },
                  ss.text({ weight: 'medium' }, ss.esc(m.name || m.url)),
                  ss.text({ color: 'muted' }, ss.esc(m.url)),
                  ss.hstack({ gap: 'md' },
                    ss.vstack({ gap: 'xs' }, ss.text({ color: 'muted', size: 'xs', uppercase: true }, t('ecash.mint.balance')), ss.text({ weight: 'medium' }, `${esFmt(esBalance(m.url))} ${t('bitcoin.sats')}`)),
                    ss.vstack({ gap: 'xs' },
                      ss.text({ color: 'muted', size: 'xs', uppercase: true }, t('ecash.mint.status')),
                      ss.hstack({ gap: 'xs' }, `<span class="es-dot${m.isConnected ? ' is-on' : ''}"></span>`,
                        ss.text({ style: `color:${m.isConnected ? 'var(--success)' : 'var(--gray-500)'}` }, m.isConnected ? t('common.connected') : t('common.notConnected'))))),
                  esState.hasSeed ? ss.button({ label: t('ecash.mint.recover'), variant: 'outline', style: 'margin-top:8px', data: { recover: m.url } }) : '',
                  ss.button({ label: t('common.remove'), variant: 'danger', style: 'margin-top:4px', data: { remove: m.url } }))}</div>`)
              .join(''))
        : ss.vstack({ gap: 'md', itemsCenter: true, style: 'padding:40px 0' }, ss.text({ color: 'muted', center: true }, t('ecash.mint.noMintSelectedDescription'))),
      ss.vstack({ gap: 'md' },
        ss.vstack({ gap: 'xs' }, ss.text({ uppercase: true }, t('ecash.mint.addMint')), ss.textInput({ placeholder: 'https://mint.example.com', id: 'es-mint-url' })),
        ss.button({ label: t('ecash.mint.connect'), variant: 'gradient', id: 'es-connect' })),
      ss.vstack({ gap: 'md' },
        ss.text({ uppercase: true }, t('ecash.mint.defaultMints')),
        ss.vstack({ gap: 'xs' }, ES_DEFAULT_MINTS.map((m) => ss.button({ label: m.name, variant: 'subtle', style: 'margin-bottom:2px;opacity:0.7', uppercase: false, data: { pick: m.url } }))))),
  bind: (body) => {
    const url = body.querySelector('#es-mint-url input')
    body.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-pick]')
      if (pick) url.value = pick.dataset.pick
      const rm = e.target.closest('[data-remove]')
      if (rm) {
        esState.mints = esState.mints.filter((m) => m.url !== rm.dataset.remove)
        return openKitScreen('ecash-settings-mint')
      }
      const rec = e.target.closest('[data-recover]')
      if (rec) {
        rec.disabled = true
        rec.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          ss.toast(esT('ecash.recovery.proofsFound', { count: 3 }), document.getElementById('view-kit'))
          openKitScreen('ecash-settings-mint')
        }, 900)
      }
      if (e.target.closest('#es-connect')) {
        const u = url.value.trim()
        if (!/^https?:\/\/\S+$/.test(u)) return ss.toast('https://…', document.getElementById('view-kit'))
        const btn = e.target.closest('#es-connect')
        btn.disabled = true
        btn.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          if (!esState.mints.some((m) => m.url === u)) esState.mints.push({ url: u, name: (ES_DEFAULT_MINTS.find((m) => m.url === u) || {}).name || '', isConnected: true })
          openKitScreen('ecash-settings-mint')
        }, 800)
      }
    })
  }
})

// settings/backup.tsx
const esBackup = { proofs: true, mints: true, history: false, data: '' }

registerScreen('ecash-settings-backup', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ecash/account/[id]/settings/backup.tsx',
  title: () => t('ecash.backup.title'),
  back: 'ecash-account-settings',
  gear: false,
  render: () => {
    const row = (label, value) => ss.hstack({}, ss.text({ color: 'muted', style: 'flex:1' }, label + ':'), ss.text({ weight: 'medium' }, value))
    return ss.vstack({ gap: 'lg', style: 'padding-bottom:40px' },
      ss.vstack({ gap: 'md' }, ss.text({ uppercase: true }, t('ecash.backup.title')), ss.text({ color: 'muted' }, t('ecash.backup.description'))),
      ss.vstack({ gap: 'md' },
        ss.text({ uppercase: true }, t('ecash.backup.walletInfo')),
        ss.vstack({ gap: 'sm' },
          row(t('ecash.backup.totalBalance'), `${esFmt(esBalance())} ${t('bitcoin.sats')}`),
          row(t('ecash.backup.connectedMints'), String(esState.mints.length)),
          row(t('ecash.backup.totalProofs'), String(esState.proofs.length)))),
      ss.vstack({ gap: 'md' }, ss.text({ uppercase: true }, t('ecash.backup.warning')), ss.text({ color: 'muted' }, t('ecash.backup.warningText'))),
      ss.vstack({ gap: 'md' },
        ss.text({ uppercase: true }, t('ecash.backup.backupOptions')),
        ss.vstack({ gap: 'sm' },
          ss.checkbox({ label: t('ecash.backup.includeTokenProofs'), selected: esBackup.proofs, data: { opt: 'proofs' } }),
          ss.checkbox({ label: t('ecash.backup.includeMintInformation'), selected: esBackup.mints, data: { opt: 'mints' } }),
          ss.checkbox({ label: t('ecash.backup.includeTransactionHistory'), selected: esBackup.history, data: { opt: 'history' } }))),
      ss.button({ label: t('ecash.backup.generateBackup'), variant: 'gradient', id: 'es-gen' }),
      esBackup.data
        ? ss.vstack({ gap: 'md', style: 'margin-top:8px' },
            ss.text({ uppercase: true }, t('ecash.backup.backupData')),
            ss.text({ color: 'muted' }, t('ecash.backup.backupInstructions')),
            ss.textInput({ value: esBackup.data, multiline: true, mono: true, readOnly: true, className: 'es-token' }),
            ss.hstack({ gap: 'sm' },
              ss.clipboardCopy({ text: esBackup.data }, ss.button({ label: t('common.copy'), variant: 'outline' })),
              ss.button({ label: t('common.close'), variant: 'ghost', style: 'flex:1', id: 'es-close' })))
        : '')
  },
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-opt]')
      if (opt) esBackup[opt.dataset.opt] = opt.classList.contains('is-on')
      if (e.target.closest('#es-gen')) {
        const btn = e.target.closest('#es-gen')
        btn.disabled = true
        btn.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          const data = { version: '1.1', exportedAt: new Date().toISOString(), account: esState.accountName }
          if (esBackup.mints) data.mints = esState.mints.map((m) => ({ url: m.url, name: m.name }))
          if (esBackup.proofs) data.proofs = esState.proofs.map((p) => ({ id: p.id, amount: p.amount, secret: p.secret, C: p.C }))
          if (esBackup.history) data.transactions = esState.transactions.map((x) => ({ id: x.id, type: x.type, amount: x.amount }))
          esBackup.data = JSON.stringify(data, null, 2)
          openKitScreen('ecash-settings-backup')
        }, 700)
      }
      if (e.target.closest('#es-close')) {
        esBackup.data = ''
        openKitScreen('ecash-settings-backup')
      }
    })
  }
})

// settings/recovery.tsx
const esRecovery = { result: null, backup: '' }

registerScreen('ecash-settings-recovery', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ecash/account/[id]/settings/recovery.tsx',
  title: () => t('ecash.recovery.title'),
  back: 'ecash-account-settings',
  render: () => {
    const r = esRecovery.result
    return ss.vstack({ gap: 'lg', style: 'padding:20px 0 60px' },
      !esState.hasSeed
        ? ss.text({ color: 'muted' }, t('ecash.recovery.noSeedAvailable'))
        : [
            ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true }, t('ecash.recovery.seedRecovery')), ss.text({ color: 'muted' }, t('ecash.recovery.seedRecoveryDescription'))),
            esState.mints.length
              ? ss.vstack({ gap: 'xs' }, ss.text({ color: 'muted' }, `${t('ecash.backup.connectedMints')}: ${esState.mints.length}`), esState.mints.map((m) => ss.text({}, ss.esc(m.name || m.url))))
              : '',
            ss.vstack({ gap: 'xs' }, ss.text({ uppercase: true }, t('ecash.mint.url')), ss.textInput({ placeholder: 'https://mint.example.com', id: 'es-rec-url' })),
            ss.button({ label: t('ecash.recovery.restoreAllMints'), variant: 'gradient', id: 'es-restore', disabled: !esState.mints.length }),
            r
              ? ss.vstack({ gap: 'sm', className: 'es-panel' },
                  ss.text({ uppercase: true }, t('ecash.recovery.result')),
                  ss.text({}, esT('ecash.recovery.mintsScanned', { count: r.mints })),
                  ss.text({}, esT('ecash.recovery.proofsFound', { count: r.proofs })),
                  ss.text({}, esT('ecash.recovery.totalAmount', { amount: esFmt(r.amount) })))
              : ''
          ].join(''),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t('ecash.recovery.backupTab')),
        ss.text({ color: 'muted' }, t('ecash.recovery.backupInstructions')),
        ss.textInput({ placeholder: t('ecash.recovery.backupPlaceholder'), multiline: true, mono: true, value: esRecovery.backup, className: 'es-token', id: 'es-backup' }),
        ss.button({ label: t('ecash.recovery.validateAndRestore'), variant: 'outline', id: 'es-validate', disabled: !esRecovery.backup.trim() })))
  },
  bind: (body) => {
    const area = body.querySelector('#es-backup textarea')
    const validate = body.querySelector('#es-validate')
    const urlIn = body.querySelector('#es-rec-url input')
    const restore = body.querySelector('#es-restore')
    area.addEventListener('input', () => {
      esRecovery.backup = area.value
      validate.disabled = !area.value.trim()
    })
    if (urlIn) urlIn.addEventListener('input', () => (restore.disabled = !esState.mints.length && !urlIn.value.trim()))
    body.addEventListener('click', (e) => {
      if (e.target.closest('#es-restore')) {
        restore.disabled = true
        restore.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          esRecovery.result = { mints: esState.mints.length + (urlIn && urlIn.value.trim() ? 1 : 0), proofs: esState.proofs.length, amount: esBalance() }
          openKitScreen('ecash-settings-recovery')
        }, 1100)
      }
      if (e.target.closest('#es-validate')) {
        let ok = false
        try {
          ok = !!JSON.parse(esRecovery.backup).version
        } catch {}
        ss.toast(ok ? t('ecash.recovery.validateAndRestore') + ' ✓' : 'Invalid backup', document.getElementById('view-kit'))
      }
    })
  }
})

// settings/seed.tsx — reveal behind a PIN modal (SSPinAuth, 3 tries)
const esSeed = { revealed: false, pin: esEmpty(4) }

registerScreen('ecash-settings-seed', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ecash/account/[id]/settings/seed.tsx',
  title: () => t('ecash.account.seedWords'),
  back: 'ecash-account-settings',
  render: () =>
    ss.vstack({ gap: 'lg', style: 'padding:20px 0 60px' },
      ss.vstack({ gap: 'sm' }, ss.text({ color: 'muted' }, t('ecash.account.seedDisplayWarning'))),
      !esSeed.revealed
        ? ss.button({ label: t('ecash.account.revealSeed'), variant: 'gradient', id: 'es-reveal' })
        : ss.vstack({ gap: 'md' },
            `<div class="es-words">${ES_DEMO_SEED.map((w, i) => `<div class="es-word"><small>${i + 1}</small><b>${w}</b></div>`).join('')}</div>`,
            ss.button({ label: t('ecash.account.hideSeed'), variant: 'outline', id: 'es-hide' }))),
  overlays: () => ss.modal({ id: 'es-seed-pin', fullOpacity: true }, `<div id="es-seed-pad" style="width:100%">${esSeedPad()}</div>`),
  bind: (body) => {
    body.addEventListener('click', (e) => {
      if (e.target.closest('#es-reveal')) {
        esSeed.pin = esEmpty(4)
        document.getElementById('es-seed-pad').innerHTML = esSeedPad()
        ss.open('es-seed-pin')
      }
      if (e.target.closest('#es-hide')) {
        esSeed.revealed = false
        openKitScreen('ecash-settings-seed')
      }
    })
    document.getElementById('kit-overlays').onclick = (e) => {
      if (kitCurrent !== 'ecash-settings-seed') return
      const k = e.target.closest('[data-es-key]')
      if (!k) return
      esSeed.pin = esPress(esSeed.pin, k.dataset.esKey)
      if (esFilled(esSeed.pin)) {
        esSeed.revealed = true
        ss.close('es-seed-pin')
        return openKitScreen('ecash-settings-seed')
      }
      document.getElementById('es-seed-pad').innerHTML = esSeedPad()
    }
  }
})
function esSeedPad() {
  return ss.vstack({ itemsCenter: true, gap: 'lg', style: 'width:100%' }, ss.text({ uppercase: true, size: 'lg', center: true, style: 'color:var(--gray-300)' }, t('account.enter.pin')), esPinPad(esSeed.pin, { withClear: true }))
}

// account/[id]/proof/[proofIndex]/index.tsx
const esProof = { version: 'v4', token: '' }

registerScreen('ecash-proof', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ecash/account/[id]/proof/[proofIndex]/index.tsx',
  title: () => t('ecash.proofDetail.title'),
  back: 'ecash-account',
  render: () => {
    const p = esState.proofs[esState.proofIndex] || esState.proofs[0]
    const field = (label, value, extra) => ss.vstack({ gap: 'none' }, ss.text({ color: 'muted', size: 'xs', uppercase: true }, label), extra || ss.text({ type: 'mono', size: 'xs', style: 'word-break:break-all' }, value))
    const versions = esTabs('es-version', [['v4', t('ecash.send.tokenV4')], ['v3', t('ecash.send.tokenV3')]], esProof.version, true)
    return ss.vstack({ gap: 'lg', style: 'padding-bottom:40px' },
      ss.vstack({ gap: 'xs', itemsCenter: true, style: 'padding:12px 0' },
        ss.text({ color: 'muted', size: 'xs', uppercase: true }, t('ecash.proofDetail.amount')),
        ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.amountDisplay({ amount: p.amount, textSize: '4xl', weight: 'ultralight', unitSize: 'xl' })),
        ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ color: 'muted' }, esUsd(p.amount)), ss.text({ size: 'xs', style: 'color:var(--gray-500)' }, 'USD'))),
      ss.vstack({ gap: 'sm' },
        field(t('ecash.proofs.keysetId'), '', ss.hstack({ gap: 'xs' }, ss.text({ type: 'mono', size: 'xs' }, p.id), ss.text({ size: 'xs', style: `color:${p.active ? 'var(--success)' : 'var(--gray-500)'}` }, p.active ? t('ecash.proofs.active') : t('ecash.proofs.inactive')))),
        field(t('ecash.proofs.secret'), '', ss.clipboardCopy({ text: p.secret }, ss.text({ type: 'mono', size: 'xs', style: 'word-break:break-all' }, p.secret))),
        field(t('ecash.proofs.blindingFactor'), '', ss.clipboardCopy({ text: p.C }, ss.text({ type: 'mono', size: 'xs', style: 'word-break:break-all' }, p.C))),
        field(t('ecash.proofs.mintUrl'), p.mintUrl),
        field(t('ecash.proofs.derivationCounter'), String(p.counter))),
      !esProof.token
        ? ss.vstack({ gap: 'sm' },
            versions,
            ss.button({ label: t('ecash.proofDetail.createToken'), variant: 'gradient', id: 'es-create' }),
            ss.text({ color: 'muted', size: 'xs' }, t('ecash.proofDetail.exportStaysInWallet')))
        : ss.vstack({ gap: 'md' },
            versions,
            ss.vstack({ gap: 'xs', itemsCenter: true }, ss.qr({ value: esProof.token, size: 260 }), '<p style="height:16px;margin:0"></p>'),
            ss.textInput({ value: esProof.token, multiline: true, mono: true, readOnly: true, className: 'es-token' }),
            ss.hstack({ gap: 'sm' },
              ss.clipboardCopy({ text: esProof.token }, ss.button({ label: t('common.copy'), variant: 'subtle' })),
              ss.button({ label: t('common.emitNFC'), variant: 'subtle', style: 'flex:1', id: 'es-nfc' })),
            ss.button({ label: t('common.share'), variant: 'outline', data: { 'ss-copy': esProof.token } })))
  },
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-es-tab="es-version"]')
      if (tab) {
        esProof.version = tab.dataset.value
        if (esProof.token) esProof.token = esToken('proof' + esState.proofIndex, esProof.version)
        return openKitScreen('ecash-proof')
      }
      if (e.target.closest('#es-create')) {
        esProof.token = esToken('proof' + esState.proofIndex, esProof.version)
        openKitScreen('ecash-proof')
      }
      if (e.target.closest('#es-nfc')) ss.toast(t('common.emitNFC'), document.getElementById('view-kit'))
    })
  }
})

// ---------------------------------------------------------------------------------------
// signer/ecash/send.tsx (the account send route re-exports this screen)

const esSend = { tab: 'ecash', mint: '', amount: 1000, memo: '', token: '', version: 'v4', invoice: '', melting: false, status: '' }

registerScreen('ecash-send-page', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ecash/send.tsx',
  title: () => t('ecash.send.title'),
  back: 'ecash-account',
  render: () => {
    const s = esSend
    const spendable = esBalance(s.mint || undefined)
    const ecash = ss.vstack({ gap: 'md' },
      esMintSelector(s.mint),
      ss.vstack({ gap: 'xs' },
        ss.text({ size: 'xs', uppercase: true }, t('ecash.send.amount')),
        ss.amountInput({ min: 0, max: spendable, value: Math.min(s.amount, spendable), remainingSats: spendable })),
      ss.vstack({ gap: 'xs' },
        ss.text({ size: 'xs', uppercase: true }, t('ecash.send.memo')),
        ss.textInput({ placeholder: t('ecash.send.memoPlaceholder'), multiline: true, value: s.memo, id: 'es-memo', align: 'left' })),
      ss.button({ label: t('ecash.send.generateToken'), variant: 'gradient', id: 'es-generate' }),
      s.token
        ? ss.vstack({ gap: 'sm' },
            esTabs('es-send-version', [['v4', t('ecash.send.tokenV4')], ['v3', t('ecash.send.tokenV3')]], s.version, true),
            ss.vstack({ gap: 'xs', itemsCenter: true }, ss.qr({ value: s.token, size: 260 }), '<p style="height:16px;margin:0"></p>'),
            ss.text({ color: 'muted', size: 'xs', uppercase: true }, t('ecash.send.generatedToken')),
            ss.textInput({ value: s.token, multiline: true, mono: true, readOnly: true, className: 'es-token' }),
            ss.hstack({ gap: 'sm' },
              ss.clipboardCopy({ text: s.token }, ss.button({ label: t('common.copy'), variant: 'subtle' })),
              ss.button({ label: t('common.emitNFC'), variant: 'subtle', style: 'flex:1', id: 'es-nfc' })),
            ss.button({ label: t('common.share'), variant: 'outline', data: { 'ss-copy': s.token } }))
        : '')
    const decoded = /^ln(bc|tb)/i.test(s.invoice)
    const lightning = ss.vstack({ gap: 'md' },
      esMintSelector(s.mint),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t('ecash.send.lightningInvoice')),
        ss.textInput({ placeholder: 'lnbc...', multiline: true, mono: true, value: s.invoice, id: 'es-invoice', className: 'es-token', align: 'left' }),
        ss.hstack({ gap: 'sm' },
          ss.button({ label: t('common.paste'), variant: 'subtle', style: 'flex:1', id: 'es-paste-invoice' }),
          ss.button({ label: t('common.scan'), variant: 'subtle', style: 'flex:1', id: 'es-paste-invoice' })),
        decoded
          ? `<div class="es-panel">${ss.detailsList({ columns: 2, items: [['Amount', '2,100', { unit: 'sats' }], ['Fiat', esUsd(2100), { unit: 'USD' }], ['Description', 'Coffee beans'], ['Expires', 'in 59 min']] })}</div>`
          : ''),
      ss.button({ label: t('ecash.send.meltTokens'), variant: 'gradient', id: 'es-melt', loading: s.melting }),
      s.status ? ss.text({ color: 'muted' }, s.status) : '')
    return ss.vstack({ gap: 'lg', style: 'padding-bottom:60px' },
      esTabs('es-send-tab', [['ecash', t('ecash.send.ecashTab')], ['lightning', t('ecash.send.lightningTab')]], s.tab),
      s.tab === 'ecash' ? ecash : lightning)
  },
  bind: (body) => {
    const s = esSend
    const rerender = () => openKitScreen('ecash-send-page')
    document.getElementById('kit-title').innerHTML = `${ss.esc(t('ecash.send.title'))}<small style="display:block;font-size:10px;color:var(--gray-300);text-transform:none;letter-spacing:0">${ss.esc(esState.accountName)}</small>`
    body.addEventListener('ss-change', (e) => (s.amount = e.detail.sats))
    body.addEventListener('input', (e) => {
      if (e.target.closest('#es-memo')) s.memo = e.target.value
      if (e.target.closest('#es-invoice')) s.invoice = e.target.value
    })
    body.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-es-tab]')
      if (tab) {
        if (tab.dataset.esTab === 'es-send-tab') s.tab = tab.dataset.value
        else {
          s.version = tab.dataset.value
          s.token = esToken('send' + s.amount + s.memo, s.version)
        }
        return rerender()
      }
      const mint = e.target.closest('[data-es-mint]')
      if (mint) {
        s.mint = mint.dataset.esMint
        return rerender()
      }
      if (e.target.closest('#es-generate')) {
        const btn = e.target.closest('#es-generate')
        btn.disabled = true
        btn.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          s.token = esToken('send' + s.amount + s.memo, s.version)
          rerender()
        }, 600)
      }
      if (e.target.closest('#es-paste-invoice')) {
        s.invoice = 'lnbc21u1pjdemo0pp5' + esHex('inv', 120) + 'xqrrss'
        rerender()
      }
      if (e.target.closest('#es-melt')) {
        if (!s.invoice) return ss.toast(t('ecash.send.lightningInvoice'), document.getElementById('view-kit'))
        s.melting = true
        rerender()
        setTimeout(() => {
          Object.assign(s, { melting: false, status: t('ecash.quote.paid') })
          if (kitCurrent === 'ecash-send-page') rerender()
        }, 1200)
      }
      if (e.target.closest('#es-nfc')) ss.toast(t('common.emitNFC'), document.getElementById('view-kit'))
    })
  }
})

// signer/ecash/receive.tsx (the account receive route re-exports this screen)

const esReceive = { tab: 'ecash', token: '', redeemed: false, mint: '', amount: '', fiatMode: false, memo: '', quote: '', status: 'pending' }

registerScreen('ecash-receive-page', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ecash/receive.tsx',
  title: () => t('ecash.receive.title'),
  back: 'ecash-account',
  render: () => {
    const s = esReceive
    const hasToken = /^cashu[AB]/.test(s.token)
    const unknownMint = hasToken && s.token.includes('unknown')
    const ecash = ss.vstack({ gap: 'sm' },
      ss.vstack({ gap: 'xs' },
        ss.text({ color: 'muted', size: 'xs', uppercase: true }, t('ecash.receive.token')),
        ss.textInput({ placeholder: 'cashuAeyJ...', multiline: true, mono: true, value: s.token, className: 'es-token', id: 'es-token', align: 'left' })),
      ss.hstack({ gap: 'sm' },
        ss.button({ label: t('common.paste'), variant: 'subtle', style: 'flex:1', id: 'es-paste-token' }),
        ss.button({ label: t('common.scan'), variant: 'subtle', style: 'flex:1', id: 'es-paste-token' })),
      hasToken
        ? `<div class="es-panel">${ss.detailsList({ columns: 2, items: [['Amount', '2,048', { unit: 'sats' }], ['Fiat', esUsd(2048), { unit: 'USD' }], ['Mint', 'mint.coinos.io'], ['Proofs', '3'], ['Memo', 'Tip']] })}</div>`
        : '',
      unknownMint ? `<div class="es-warning">${ss.esc(esT('ecash.warning.mintNotConnected', { mint: 'https://unknown.mint' }))}</div>` : '',
      s.redeemed ? ss.text({ style: 'color:var(--success)' }, t('ecash.quote.completed')) : '',
      ss.button({ label: t('ecash.receive.redeemToken'), variant: 'secondary', id: 'es-redeem', disabled: !hasToken || s.redeemed }))
    const amt = +s.amount || 0
    const lightning = ss.vstack({ gap: 'md' },
      esMintSelector(s.mint),
      ss.vstack({ gap: 'xs' },
        ss.text({ color: 'muted', size: 'xs', uppercase: true }, `${t('ecash.receive.amount')} (${s.fiatMode ? 'USD' : t('bitcoin.sats')})`),
        ss.textInput({ placeholder: '0', value: s.fiatMode ? (amt ? esUsd(amt) : '') : amt ? esFmt(amt) : '', inputMode: 'numeric', id: 'es-amount', name: 'amount' }),
        ss.text({ color: 'muted', size: 'xs', className: 'es-underline', id: 'es-switch' }, s.fiatMode ? `${esFmt(amt)} ${t('bitcoin.sats')}` : `≈ ${amt ? esUsd(amt) : 0} USD`)),
      ss.vstack({ gap: 'xs' },
        ss.text({ color: 'muted', size: 'xs', uppercase: true }, t('ecash.receive.memo')),
        ss.textInput({ placeholder: t('ecash.receive.memoPlaceholder'), value: s.memo, id: 'es-rmemo', align: 'left' })),
      !s.quote
        ? ss.vstack({ gap: 'sm' },
            ss.hstack({ gap: 'sm' },
              ss.button({ label: t('common.paste'), variant: 'subtle', style: 'flex:1', id: 'es-paste-lnurl' }),
              ss.button({ label: t('common.scan'), variant: 'subtle', style: 'flex:1', id: 'es-paste-lnurl' })),
            ss.button({ label: t('ecash.receive.createInvoice'), variant: 'gradient', id: 'es-invoice-btn', disabled: !amt }))
        : ss.vstack({ gap: 'md' },
            ss.vstack({ itemsCenter: true, gap: 'md', style: 'padding:20px 0' }, ss.qr({ value: s.quote, size: 280 }), ss.clipboardCopy({ text: s.quote }, ss.button({ label: t('common.copy'), variant: 'outline' }))),
            ss.vstack({ gap: 'none' },
              ss.text({ style: `color:${s.status === 'paid' ? 'var(--success)' : 'var(--warning)'}` }, t('ecash.quote.' + s.status)),
              s.status === 'pending' ? ss.text({ color: 'muted', size: 'xs' }, t('ecash.receive.polling')) : '')))
    return ss.vstack({ gap: 'lg', style: 'padding-bottom:60px' },
      esTabs('es-recv-tab', [['ecash', t('ecash.receive.ecashTab')], ['lightning', t('ecash.receive.lightningTab')]], s.tab),
      s.tab === 'ecash' ? ecash : lightning)
  },
  bind: (body) => {
    const s = esReceive
    const rerender = () => openKitScreen('ecash-receive-page')
    body.addEventListener('input', (e) => {
      if (e.target.closest('#es-token')) {
        s.token = e.target.value.trim()
        s.redeemed = false
      }
      if (e.target.closest('#es-amount')) s.amount = e.target.value.replace(/[^0-9]/g, '')
      if (e.target.closest('#es-rmemo')) s.memo = e.target.value
    })
    body.addEventListener('change', (e) => {
      if (e.target.closest('#es-token, #es-amount')) rerender()
    })
    body.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-es-tab]')
      if (tab) {
        s.tab = tab.dataset.value
        return rerender()
      }
      const mint = e.target.closest('[data-es-mint]')
      if (mint) {
        s.mint = mint.dataset.esMint
        return rerender()
      }
      if (e.target.closest('#es-paste-token')) {
        s.token = esToken('receive', 'v4')
        s.redeemed = false
        return rerender()
      }
      if (e.target.closest('#es-redeem')) {
        const btn = e.target.closest('#es-redeem')
        btn.disabled = true
        btn.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          s.redeemed = true
          rerender()
        }, 900)
      }
      if (e.target.closest('#es-switch')) {
        s.fiatMode = !s.fiatMode
        return rerender()
      }
      if (e.target.closest('#es-paste-lnurl')) {
        s.amount = '5000'
        return rerender()
      }
      if (e.target.closest('#es-invoice-btn')) {
        s.quote = 'lnbc' + (+s.amount || 1) / 10 + 'n1pjdemo0pp5' + esHex('quote' + s.amount, 160)
        s.status = 'pending'
        rerender()
        setTimeout(() => {
          if (s.quote) s.status = 'paid'
          if (kitCurrent === 'ecash-receive-page') rerender()
        }, 3000)
      }
    })
  }
})

// signer/ecash/transaction/[id]/index.tsx

const ES_TX_ICON = { send: '↗', receive: '↙', mint: '⚡↙', melt: '⚡↗' }
const ES_STATUS_COLOR = { pending: 'var(--warning)', completed: 'var(--success)', failed: 'var(--error)', expired: 'var(--error)', settled: 'var(--soft-bar-red)' }

registerScreen('ecash-transaction', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/ecash/transaction/[id]/index.tsx',
  title: () => t('ecash.transactionDetail.title'),
  back: 'ecash-account',
  render: () => {
    const x = esState.transactions.find((tx) => tx.id === esState.txId) || esState.transactions[0]
    const mint = esState.mints.find((m) => m.url === x.mintUrl)
    const dir = x.type === 'mint' ? 'receive' : x.type === 'melt' ? 'send' : x.type
    const data = x.token ? esToken(x.id) : 'lnbc' + Math.round(x.amount / 10) + 'n1pjdemo0pp5' + esHex(x.id, 180)
    const ago = Math.round((Date.now() - x.timestamp) / 36e5)
    const row = (label, value) => `<div class="es-row">${ss.text({ color: 'muted' }, label)}${ss.text({}, ss.esc(value))}</div>`
    return ss.vstack({ gap: 'lg', style: 'padding-bottom:40px' },
      ss.vstack({ gap: 'md' },
        ss.hstack({ gap: 'md' },
          `<span class="es-tx-icon">${ES_TX_ICON[x.type]}</span>`,
          ss.vstack({ gap: 'xs' },
            ss.text({ size: 'lg', weight: 'medium' }, t('ecash.transaction.' + x.type)),
            ss.hstack({ gap: 'sm', style: 'align-items:baseline' }, ss.amountDisplay({ amount: x.amount, type: dir, noColor: false, textSize: 'xl', weight: 'light', unitSize: 'sm' })),
            ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ color: 'muted' }, esUsd(x.amount)), ss.text({ size: 'xs', style: 'color:var(--gray-500)' }, 'USD')))),
        ss.hstack({ justifyBetween: true },
          ss.text({ color: 'muted' }, ago < 24 ? `${ago} hours ago` : `${Math.round(ago / 24)} days ago`),
          ss.hstack({ gap: 'sm' },
            x.status ? ss.text({ uppercase: true, weight: 'medium', style: `color:${ES_STATUS_COLOR[x.status]}` }, t('ecash.quote.' + x.status)) : '',
            x.type === 'send' ? ss.text({ uppercase: true, weight: 'medium', style: `color:${x.tokenStatus === 'spent' ? 'var(--gray-500)' : 'var(--warning)'}`, id: 'es-token-status' }, (x.tokenStatus || 'Unknown').toUpperCase()) : ''))),
      x.token
        ? ss.vstack({ gap: 'sm' },
            ss.button({ label: t('ecash.transactionDetail.checkStatus'), variant: 'outline', id: 'es-check' }),
            x.type === 'send' && x.tokenStatus === 'unspent' ? ss.button({ label: t('ecash.transactionDetail.redeemToken'), variant: 'gradient', id: 'es-reclaim' }) : '')
        : '',
      x.status === 'pending' && x.invoice
        ? ss.vstack({ gap: 'sm' },
            ss.text({ color: 'muted', center: true }, t('ecash.receive.polling')),
            ss.hstack({ gap: 'sm' },
              ss.button({ label: t('ecash.transactionDetail.showQR'), variant: 'subtle', style: 'flex:1', id: 'es-show-qr' }),
              ss.clipboardCopy({ text: data }, ss.button({ label: t('ecash.transactionDetail.copyInvoice'), variant: 'subtle' }))))
        : '',
      ss.vstack({ gap: 'md' },
        ss.text({ uppercase: true }, t('ecash.transactionDetail.details')),
        ss.vstack({ gap: 'sm' },
          row(t('ecash.transactionDetail.id'), x.id),
          row(t('ecash.transactionDetail.mint'), (mint && mint.name) || x.mintUrl),
          x.memo ? row(t('ecash.transactionDetail.label') + ':', x.memo) : '',
          x.quoteId ? row(t('ecash.transactionDetail.quoteId') + ':', x.quoteId) : '',
          x.expiry ? row(t('ecash.transactionDetail.expiry') + ':', new Date(x.expiry * 1000).toLocaleString()) : '')),
      ss.vstack({ gap: 'md' },
        ss.text({ uppercase: true }, x.token ? t('ecash.transactionDetail.token') : t('ecash.transactionDetail.invoice')),
        ss.vstack({ gap: 'sm' },
          ss.textInput({ value: data, multiline: true, mono: true, readOnly: true, className: 'es-token' }),
          ss.clipboardCopy({ text: data }, ss.button({ label: t('common.copy'), variant: 'subtle' })))))
  },
  overlays: () => {
    const x = esState.transactions.find((tx) => tx.id === esState.txId) || esState.transactions[0]
    return ss.modal({ id: 'es-tx-qr', label: t('common.close') },
      ss.vstack({ gap: 'md', itemsCenter: true }, ss.text({ size: 'lg', weight: 'medium', center: true }, t('ecash.transactionDetail.lightningInvoice')), ss.shareableQR({ value: 'lnbc' + x.id, size: 250 })))
  },
  bind: (body) => {
    const x = esState.transactions.find((tx) => tx.id === esState.txId) || esState.transactions[0]
    body.addEventListener('click', (e) => {
      if (e.target.closest('#es-show-qr')) ss.open('es-tx-qr')
      if (e.target.closest('#es-check')) {
        const btn = e.target.closest('#es-check')
        btn.disabled = true
        btn.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => openKitScreen('ecash-transaction'), 700)
      }
      if (e.target.closest('#es-reclaim')) {
        x.tokenStatus = 'spent'
        ss.toast(t('ecash.quote.completed'), document.getElementById('view-kit'))
        openKitScreen('ecash-transaction')
      }
    })
  }
})
