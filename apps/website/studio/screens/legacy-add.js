/* Add-account and multisig screens rebuilt on the SS kit. These replace the hand-made
   legacy sections in index.html (same ids, so go() resolves here first):

     new-account        app/.../signer/bitcoin/account/add/index.tsx
     new-singlesig      app/.../add/singleSig/index.tsx
     entropy-dice|coin|drawing   app/.../add/(common)/entropy/*.tsx
     multisig-setup     app/.../add/multiSig/index.tsx
     multisig-keys      app/.../add/multiSig/manager.tsx
     multisig-key       app/.../add/multiSig/keySettings/[index].tsx
     multisig-settings  app/.../account/[id]/settings/index.tsx (multisig branch)
     multisig-sign      app/.../signAndSend/previewTransaction.tsx (multisig branch)
     duress             alias of set-duress-pin (screens/ecash-shell.js)

   Shares the fixture globals from screen.js: newAccountName, newAccountPolicy,
   multisigKeys, msigRequired, msigTotal, msigScript, accounts, openAccountData. */

document.head.insertAdjacentHTML('beforeend', `<style>
/* SSSelectModal: opaque black page, title, options, Select / Cancel */
.lx-select { background: var(--black); }
.lx-select > .ss-vstack { align-items: stretch; }
.lx-select-body { display: flex; flex-direction: column; gap: var(--layout-v-stack-gap-lg); width: 100%; overflow: auto; }
.lx-select-title { min-height: 40px; }
/* SSMultisigCountSelector + SSSignatureRequiredDisplay */
.lx-count svg { display: block; width: 100%; height: auto; touch-action: none; cursor: pointer; overflow: visible; }
.lx-count-big { font-size: 55px; font-weight: var(--sizes-text-font-weight-light); text-transform: lowercase; line-height: 1.1; }
.lx-sigs { display: flex; justify-content: center; }
.lx-sigs svg { display: block; height: auto; overflow: visible; }
/* SSMultisigKeyControl / SSSignatureDropdown rows */
.lx-key { border-top: 1px solid #444444; padding: 16px 0; }
.lx-key.is-last { border-bottom: 1px solid #444444; }
.lx-key.is-sig { border-color: var(--gray-700); }
.lx-key-head { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.lx-key-head[disabled] { opacity: 0.5; cursor: default; }
.lx-key-left { display: flex; align-items: center; gap: var(--layout-h-stack-gap-sm); flex: 1; min-width: 0; }
.lx-key-left .lx-key-no { padding: 0 10px; white-space: nowrap; }
.lx-key-copy { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.lx-key-copy .ss-text, .lx-key-ids .ss-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.lx-key-ids { display: flex; flex-direction: column; align-items: flex-end; flex: 0 1 auto; max-width: 52%; min-width: 0; margin-left: 8px; text-align: right; }
.lx-key-body { padding: 16px 0 24px; animation: lx-open 120ms ease-out; }
@keyframes lx-open { from { opacity: 0; transform: translateY(-4px); } }
.lx-sig-dot { display: inline-block; width: 24px; height: 24px; border-radius: 12px; background: var(--gray-800); flex: none; }
.lx-psbt { box-sizing: border-box; min-height: 200px; max-height: 600px; overflow: auto; padding: 12px; border: 1px solid var(--gray-700); border-radius: var(--sizes-text-input-border-radius); background: var(--gray-900); color: var(--white); font: 12px/18px ui-monospace, "SF Mono", Menlo, monospace; word-break: break-all; }
.lx-psbt.is-valid { border-color: var(--main-green); }
.lx-psbt.is-empty { color: var(--gray-300); }
.lx-half { width: 48% !important; }
/* manager header block (#131313) and settings multisig container */
.lx-msig-head { margin: 0 calc(-1 * var(--layout-main-container-padding-horizontal)); padding: 16px; background: #131313; }
.lx-keys { padding-top: 16px; }
/* white confirm card used by drop seed / reset key */
.lx-confirm { width: 100%; max-width: 300px; margin: auto 40px; padding: 20px 16px; border-radius: 8px; background: var(--white); box-shadow: 0 2px 3.84px rgba(0,0,0,0.25); }
.lx-confirm .ss-button.v-ghost { background: var(--gray-100); color: var(--black); }
/* entropy screens */
.lx-binary { display: flex; flex-wrap: wrap; justify-content: center; align-content: center; gap: var(--layout-h-stack-gap-sm); box-sizing: border-box; width: 100%; min-height: 180px; padding: 16px 8px; border-radius: 8px; background: var(--gray-950); }
.lx-binary .ss-text { font-size: var(--sizes-text-font-size-lg); }
.lx-count-num { font-size: var(--sizes-text-font-size-8xl); line-height: 1; }
.lx-dice { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 24px; }
.lx-die { border: 0; border-radius: 12px; padding: 4px; background: none; color: var(--white); opacity: 0.2; cursor: pointer; }
.lx-die:active { opacity: 1; }
.lx-coins { display: flex; justify-content: space-between; width: 100%; margin-top: 24px; }
.lx-coin { display: flex; align-items: center; justify-content: center; width: 120px; height: 120px; border-radius: 60px; border: 0; font: inherit; font-size: var(--sizes-text-font-size-xl); font-weight: var(--sizes-text-font-weight-bold); cursor: pointer; }
.lx-coin:active { opacity: 0.7; }
.lx-coin.is-heads { background: var(--gray-75); color: var(--gray-950); }
.lx-coin.is-tails { background: var(--gray-700); color: var(--white); border: 2px solid var(--gray-75); }
.lx-log { box-sizing: border-box; width: 100%; padding: 12px; border-radius: 8px; background: var(--gray-900); }
.lx-log .ss-text:last-child { font-variant-numeric: tabular-nums; letter-spacing: 1px; word-break: break-all; }
.lx-canvas { display: block; width: 100%; height: 260px; border: 1px solid var(--gray-850); border-radius: 2px; background: var(--gray-900); touch-action: none; cursor: crosshair; }
.lx-demo-fill { align-self: center; border: 0; padding: 4px 0; background: none; color: var(--gray-500); font: inherit; font-size: var(--sizes-text-font-size-xs); text-decoration: underline; cursor: pointer; }
.lx-info { display: flex; flex-direction: column; gap: var(--layout-v-stack-gap-xs); }
</style>`)

// --- shared state ----------------------------------------------------------------------

const LX_SCRIPT_NAMES = {
  P2PKH: 'Legacy (P2PKH)',
  P2SH: 'Legacy (P2SH)',
  'P2SH-P2WPKH': 'Nested Segwit (P2SH-P2WPKH)',
  'P2SH-P2WSH': 'Nested Segwit (P2SH-P2WSH)',
  P2TR: 'Taproot (P2TR)',
  P2WPKH: 'Native Segwit (P2WPKH)',
  P2WSH: 'Native Segwit (P2WSH)'
}
const LX_SINGLE_SCRIPTS = ['P2PKH', 'P2SH-P2WPKH', 'P2WPKH', 'P2TR']
const LX_MULTI_SCRIPTS = ['P2SH', 'P2SH-P2WSH', 'P2WSH']
const LX_WORD_COUNTS = [24, 21, 18, 15, 12]
const LX_WORD_LISTS = ['chinese_simplified', 'chinese_traditional', 'czech', 'english', 'french', 'italian', 'japanese', 'korean', 'portuguese', 'spanish']
const LX_ENTROPY = ['none', 'drawing', 'coin', 'dice']
const LX_MAX_KEYS = 15

const lxState = {
  name: typeof newAccountName !== 'undefined' ? newAccountName : 'Spending',
  // singleSig
  script: 'P2WPKH',
  words: 24,
  wordList: 'english',
  entropy: 'none',
  // multiSig/keySettings
  keyWords: 24,
  keyEntropy: 'none',
  keyIndex: 0,
  // entropy screen context
  entropyWords: 24,
  entropyFrom: 'new-singlesig',
  // manager / settings / sign
  expanded: null,
  sigExpanded: null,
  pending: null, // { index, type } filled when we come back from an add-* screen
  signedPsbt: {} // index -> psbt string
}

// The multisig account used by settings / signing (no multisig account exists in `accounts`).
const lxVault = {
  name: 'Vault',
  network: 'signet',
  balance: 2400000,
  fiat: '2,400.00',
  fingerprint: 'c0ffee01',
  watchOnly: false,
  multisig: true,
  stats: [['4', 'Transactions'], ['12', 'Addresses'], ['3', 'Outputs'], ['0', 'Mempool']]
}

function lxScriptVersion() {
  // msigScript (screen.js) holds a display name; map it back to the script version.
  const hit = Object.entries(LX_SCRIPT_NAMES).find(([, n]) => n.toLowerCase() === String(msigScript).toLowerCase())
  if (hit && LX_MULTI_SCRIPTS.includes(hit[0])) return hit[0]
  if (/P2SH-P2WSH/i.test(msigScript)) return 'P2SH-P2WSH'
  if (/Legacy/i.test(msigScript) || /\(P2SH\)/.test(msigScript)) return 'P2SH'
  return 'P2WSH'
}

// Key shape bridge: legacy multisigKeys entries → the app's key semantics.
function lxKeyType(key) {
  if (!key || !key.fingerprint) return null
  if (key.creationType) return key.creationType
  if (/descriptor/i.test(key.source)) return 'importDescriptor'
  if (/extended|xpub|tpub/i.test(key.source)) return 'importExtendedPub'
  if (/import/i.test(key.source)) return 'importMnemonic'
  return 'generateMnemonic'
}

function lxSourceLabel(key, script) {
  const type = lxKeyType(key)
  if (!type) return t('account.selectKeySource')
  if (type === 'generateMnemonic') return key.seed ? t('account.seed.newSeed', { name: script }) : t('account.seed.droppedSeed', { name: script })
  if (type === 'importMnemonic') return key.seed ? t('account.seed.importedSeed', { name: script }) : t('account.seed.droppedSeed', { name: script })
  if (type === 'importDescriptor') return t('account.seed.external')
  return t('account.import.tpub') // signet: every script version maps to tpub
}

function lxDropSeedLabel(script) {
  if (script === 'P2SH') return t('account.seed.dropAndKeep.tpub')
  if (script === 'P2SH-P2WSH') return t('account.seed.dropAndKeep.upub')
  return t('account.seed.dropAndKeep.vpub')
}

function lxHex(seed, len) {
  let h = 2166136261
  let out = ''
  for (let i = 0; out.length < len; i++) {
    h = Math.imul(h ^ (seed.charCodeAt(i % Math.max(seed.length, 1)) || 7) ^ i, 16777619) >>> 0
    out += h.toString(16).padStart(8, '0')
  }
  return out.slice(0, len)
}

function lxShortPub(pub) {
  return pub && pub.length > 12 ? `${pub.slice(0, 7)}...${pub.slice(-4)}` : pub
}

// Fill a key after an add-* screen returns to the manager (imports/generation are fixtures).
function lxApplyPending() {
  const p = lxState.pending
  if (!p) return
  lxState.pending = null
  const key = multisigKeys[p.index]
  if (!key) return
  const fp = lxHex(`${key.name}${p.type}${p.index}`, 8)
  key.creationType = p.type
  key.fingerprint = fp
  key.pub = `tpubD6NzVbkrYhZ4${lxHex(fp, 30)}${fp.slice(0, 4)}`
  key.seed = p.type === 'generateMnemonic' || p.type === 'importMnemonic'
  key.source = { generateMnemonic: 'This device', importMnemonic: 'Imported seed', importDescriptor: 'Imported descriptor', importExtendedPub: 'Extended public key' }[p.type]
  key.signed = false
}

function lxBits(seed, count) {
  if (count <= 0) return ''
  let out = ''
  const hex = lxHex(seed || 'x', Math.ceil(count / 4) + 8)
  for (const ch of hex) out += parseInt(ch, 16).toString(2).padStart(4, '0')
  return out.slice(0, count)
}

// --- local components ------------------------------------------------------------------

// SSSelectModal: full-screen black page with options and Select / Cancel.
function lxSelectModal(id, title, options, selected, description) {
  return ss.modal({ id, fullOpacity: true, showLabel: false },
    `<div class="lx-select-body">${ss.vstack({ gap: 'lg' },
      ss.text({ center: true, color: 'muted', uppercase: true, className: 'lx-select-title' }, ss.esc(title)),
      ss.vstack({ style: 'padding-bottom:16px' },
        options.map(([value, label]) => ss.radio({ label, group: id, selected: value === selected, data: { value } }))),
      description ? ss.vstack({ gap: 'sm', style: 'padding-top:16px' }, ss.text({ color: 'muted', className: 'lx-select-desc' }, description)) : '')}</div>`,
    ss.vstack({ gap: 'sm', widthFull: true },
      ss.button({ label: t('common.select'), variant: 'secondary', data: { 'lx-select': id } }),
      ss.button({ label: t('common.cancel'), variant: 'ghost', data: { 'ss-close': '' } })))
}

function lxSelected(id) {
  const on = document.querySelector(`#${id} [data-ss-radio].is-on`)
  return on ? on.dataset.value : null
}

// Opens an SSSelectModal and calls onSelect(value) when Select is pressed.
function lxBindSelect(id, onSelect, describe) {
  const modal = document.getElementById(id)
  if (!modal) return
  modal.addEventListener('click', (e) => {
    if (describe && e.target.closest('[data-ss-radio]')) {
      const desc = modal.querySelector('.lx-select-desc')
      if (desc) desc.textContent = describe(lxSelected(id))
    }
    if (e.target.closest(`[data-lx-select="${id}"]`)) {
      modal.setAttribute('hidden', '')
      onSelect(lxSelected(id))
    }
  })
}

function lxScriptModal(id, current, multisig) {
  const list = multisig ? LX_MULTI_SCRIPTS : LX_SINGLE_SCRIPTS
  return lxSelectModal(id, t('account.script'), list.map((s) => [s, LX_SCRIPT_NAMES[s]]), current, lxScriptDesc(current))
}

function lxScriptDesc(script) {
  const k = String(script).toLowerCase()
  return `${t(`script.${k}.description.1`)} ${t(`script.${k}.link.name`)} ${t(`script.${k}.description.2`)}`
}

function lxWordCountModal(id, current) {
  return lxSelectModal(id, t('account.mnemonic.title'),
    LX_WORD_COUNTS.map((c) => [String(c), `${c} ${t('bitcoin.words').toLowerCase()}`]), String(current), t(`account.mnemonic.${current}`))
}

function lxEntropyModal(id, current) {
  return lxSelectModal(id, t('account.entropy.title'), LX_ENTROPY.map((e) => [e, t(`account.entropy.${e}.label`)]), current)
}

// SSMultisigCountSelector: 15 slots, grey bar to `total`, light bar to `required`, draggable ends.
function lxCountSelector(required, total) {
  const W = 320
  const R_OUT = 16
  const R_IN = 13
  const R_DOT = 8
  const step = (W - R_OUT * 2) / (LX_MAX_KEYS - 1)
  const cx = (i) => R_OUT + step * i
  const labels = Array.from({ length: LX_MAX_KEYS }, (_, i) => {
    const n = i + 1
    const fill = n > total ? '#FFFFFF17' : n === total || n === required ? 'white' : '#FFFFFF33'
    return `<text x="${cx(i)}" y="10" fill="${fill}" font-size="12" text-anchor="middle">${n}</text>`
  }).join('')
  const bar = (r, upto, fill) =>
    `<circle cx="${R_OUT}" cy="35" r="${r}" fill="${fill}"/><rect x="${R_OUT}" y="${35 - r}" width="${step * (upto - 1)}" height="${r * 2}" fill="${fill}"/><circle cx="${cx(upto - 1)}" cy="35" r="${r}" fill="${fill}"/>`
  const dots = Array.from({ length: LX_MAX_KEYS }, (_, i) => {
    const n = i + 1
    const fill = n > total ? '#242424' : n === total || n === required ? 'white' : 'transparent'
    return `<circle cx="${cx(i)}" cy="35" r="${R_DOT}" stroke-width="1" stroke="${n <= total ? 'white' : 'transparent'}" fill="${fill}"/>`
  }).join('')
  return `<div class="lx-count" data-lx-count>
    ${ss.text({ center: true }, t('account.signatureRequired'))}
    <p class="ss-text is-center lx-count-big">${required} ${t('common.of')} ${total}</p>
    <svg viewBox="0 0 ${W} 60" aria-label="${ss.esc(t('account.signatureRequired'))}">
      <g>${labels}</g>
      <g><circle cx="${R_OUT}" cy="35" r="${R_OUT}" fill="black"/><rect x="${R_OUT}" y="${35 - R_OUT}" width="${W - R_OUT * 2}" height="${R_OUT * 2}" fill="black"/><circle cx="${W - R_OUT}" cy="35" r="${R_OUT}" fill="black"/></g>
      <g>${bar(R_IN, total, '#4A4A4A')}</g>
      <g>${bar(R_IN, required, '#BFBFBF')}</g>
      <g>${dots}</g>
    </svg></div>`
}

// Drag either handle (or tap a slot) to change required / total, like the app's pan gesture.
function lxBindCountSelector(root, get, set) {
  const svg = root.querySelector('[data-lx-count] svg')
  if (!svg) return
  const slotAt = (e) => {
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 320
    return Math.max(1, Math.min(LX_MAX_KEYS, Math.round((x - 16) / ((320 - 32) / (LX_MAX_KEYS - 1))) + 1))
  }
  let handle = null
  svg.addEventListener('pointerdown', (e) => {
    const n = slotAt(e)
    const { required, total } = get()
    handle = Math.abs(n - required) < Math.abs(n - total) || (n < required) ? 'required' : 'total'
    if (n === total) handle = 'total'
    if (n === required) handle = 'required'
    svg.setPointerCapture(e.pointerId)
    apply(n)
  })
  svg.addEventListener('pointermove', (e) => {
    if (handle) apply(slotAt(e))
  })
  svg.addEventListener('pointerup', () => (handle = null))
  function apply(n) {
    let { required, total } = get()
    if (handle === 'total') {
      total = Math.max(2, n)
      if (required > total) required = total
    } else {
      required = Math.max(1, n)
      if (required > total) total = required
    }
    set(required, total)
  }
}

// SSSignatureRequiredDisplay: one ring per key, required ones outlined white, collected green.
function lxSigDisplay(required, total, collected) {
  const R_OUT = 16
  const width = Math.max(80, Math.min(140, total <= 1 ? 80 : Math.max((140 - R_OUT * 2) / (total - 1), 15) * (total - 1) + R_OUT * 2))
  const step = total <= 1 ? 0 : Math.max((Math.min(width, 140) - R_OUT * 2) / (total - 1), 15)
  const cx = (i) => R_OUT + step * i
  const labels = Array.from({ length: total }, (_, i) => `<text x="${cx(i)}" y="10" fill="white" font-size="12" text-anchor="middle">${i + 1}</text>`).join('')
  const dots = Array.from({ length: total }, (_, i) =>
    `<circle cx="${cx(i)}" cy="35" r="8" stroke-width="2" stroke="${i + 1 <= required ? 'white' : '#4F4F4F'}" opacity="0.9" fill="${i < collected ? '#A7FFAF' : 'transparent'}"/>`).join('')
  return `<div class="lx-sigs"><svg width="${width}" viewBox="0 0 ${width} 60">
    <g>${labels}</g>
    <g><circle cx="${R_OUT}" cy="35" r="${R_OUT}" fill="black"/><rect x="${R_OUT}" y="${35 - R_OUT}" width="${width - R_OUT * 2}" height="${R_OUT * 2}" fill="black"/><circle cx="${width - R_OUT}" cy="35" r="${R_OUT}" fill="black"/></g>
    <g>${dots}</g></svg></div>`
}

function lxKeyIcon(key) {
  if (!lxKeyType(key)) return ss.icon('add', { size: 24 })
  return ss.icon(key.seed ? 'green' : 'greenNoSecret', { size: 24 })
}

function lxKeyHead(key, index, iconHtml, attrs = '') {
  return `<button type="button" class="lx-key-head" ${attrs}>
    <span class="lx-key-left">${iconHtml}
      ${ss.text({ as: 'span', color: 'muted', size: 'lg', className: 'lx-key-no' }, `${t('common.key')} ${index + 1}`)}
      <span class="lx-key-copy">${ss.text({ as: 'span', color: 'muted' }, ss.esc(lxSourceLabel(key, key.scriptForLabel || lxScriptVersion())))}${ss.text(
        { as: 'span', color: key && key.name ? 'white' : 'muted' }, ss.esc((key && key.name) || t('account.seed.noLabel')))}</span></span>
    <span class="lx-key-ids">${ss.text({ as: 'span', type: 'mono', color: key && key.fingerprint ? 'white' : 'muted' }, ss.esc((key && key.fingerprint) || t('account.fingerprint')))}${ss.text(
      { as: 'span', type: 'mono', color: key && key.pub ? 'white' : 'muted' }, ss.esc(lxShortPub(key && key.pub) || t('account.seed.publicKey')))}</span>
  </button>`
}

// SSMultisigKeyControl. mode 'setup' (manager) or 'settings' (account settings).
function lxKeyControl(key, index, total, mode) {
  const complete = !!lxKeyType(key)
  const open = lxState.expanded === index
  const script = lxScriptVersion()
  let body = ''
  if (open) {
    const nameForm = !complete || mode === 'settings'
      ? ss.form({},
          ss.form.item({},
            ss.form.label({ label: t('account.participant.keyName') }),
            ss.textInput({ value: key.name || '', className: 'lx-key-name', data: { key: index } }),
            mode === 'settings' ? ss.button({ label: t('common.save'), variant: 'secondary', className: 'lx-key-save', style: 'margin-top:8px;display:none', data: { save: index } }) : ''))
      : ''
    const noName = !String(key.name || '').trim()
    const actions = complete
      ? [
          key.seed ? ss.button({ label: t('account.seed.viewSeedWords'), variant: 'secondary', data: { act: 'seed', i: index } }) : '',
          ss.button({ label: t('account.seed.shareXpub'), data: { act: 'xpub', i: index } }),
          ss.button({ label: t('account.seed.shareDescriptor'), data: { act: 'descriptor', i: index } }),
          key.seed ? ss.button({ label: lxDropSeedLabel(script), variant: 'outline', data: { act: 'drop', i: index } }) : '',
          ss.button({ label: t('account.seed.resetKey'), variant: 'danger', data: { act: 'reset', i: index } })
        ]
      : [
          ss.button({ label: t('account.generate.newSecretSeed'), disabled: noName, className: 'lx-needs-name', data: { act: 'generate', i: index } }),
          ss.button({ label: t('account.import.title2'), disabled: noName, className: 'lx-needs-name', data: { act: 'import-seed', i: index } }),
          ss.button({ label: t('account.import.descriptor'), disabled: noName, className: 'lx-needs-name', data: { act: 'import-descriptor', i: index } }),
          ss.button({ label: t('account.import.tpub'), disabled: noName, className: 'lx-needs-name', data: { act: 'import-xpub', i: index } })
        ]
    body = `<div class="lx-key-body">${ss.vstack({ gap: 'lg' }, nameForm, ss.vstack({ gap: 'sm' }, actions))}</div>`
  }
  return `<div class="lx-key${index === total - 1 ? ' is-last' : ''}">${lxKeyHead(key, index, lxKeyIcon(key), `data-lx-toggle="${index}"`)}${body}</div>`
}

function lxConfirmModal(id, title, message, confirmLabel, act) {
  return ss.modal({ id, showLabel: false },
    `<div class="lx-confirm">${ss.vstack({ itemsCenter: true, gap: 'lg' },
      ss.text({ size: 'lg', weight: 'bold', center: true, style: 'color:var(--black);margin-bottom:4px' }, title),
      ss.text({ color: 'muted', center: true, size: 'md', style: 'line-height:20px;margin-bottom:8px;max-width:260px' }, message),
      ss.hstack({ gap: 'sm', style: 'width:100%' },
        ss.button({ label: t('common.cancel'), variant: 'ghost', style: 'flex:1', data: { 'ss-close': '' } }),
        ss.button({ label: confirmLabel, variant: 'danger', style: 'flex:1', data: { 'lx-confirm': act } })))}</div>`)
}

// Wires the key list in the manager (setup) or account settings (settings).
function lxBindKeys(body, mode, rerender) {
  let pendingAct = null
  body.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-lx-toggle]')
    if (toggle) {
      const i = +toggle.dataset.lxToggle
      lxState.expanded = lxState.expanded === i ? null : i
      return rerender()
    }
    const act = e.target.closest('[data-act]')
    if (!act || act.disabled) return
    const i = +act.dataset.i
    const key = multisigKeys[i]
    lxState.keyIndex = i
    if (typeof bdState !== 'undefined') bdState.keyIndex = i
    const exportTo = (setupId, settingsId) => go(mode === 'settings' ? settingsId : setupId)
    switch (act.dataset.act) {
      case 'generate':
        go('multisig-key')
        break
      case 'import-seed':
        ss.open('lx-import-words')
        break
      case 'import-descriptor':
        lxState.pending = { index: i, type: 'importDescriptor' }
        go('add-import-descriptor')
        break
      case 'import-xpub':
        lxState.pending = { index: i, type: 'importExtendedPub' }
        go('add-import-xpub')
        break
      case 'seed':
        exportTo('add-multisig-export-seed-words', 'account-export-seed-words')
        break
      case 'xpub':
        exportTo('add-multisig-export-public-key', 'account-export-public-key')
        break
      case 'descriptor':
        exportTo('add-multisig-export-descriptor', 'account-export-descriptor')
        break
      case 'drop':
        pendingAct = { act: 'drop', i }
        ss.open('lx-drop-seed')
        break
      case 'reset':
        pendingAct = { act: 'reset', i }
        ss.open('lx-reset-key')
        break
    }
  })
  body.addEventListener('input', (e) => {
    const input = e.target.closest('.lx-key-name input')
    if (!input) return
    const i = +input.closest('[data-key]').dataset.key
    const name = input.value
    if (mode === 'setup') multisigKeys[i].name = name
    const row = input.closest('.lx-key')
    row.querySelectorAll('.lx-needs-name').forEach((b) => (b.disabled = !name.trim()))
    const save = row.querySelector('.lx-key-save')
    if (save) save.style.display = name.trim() !== (multisigKeys[i].name || '') ? '' : 'none'
  })
  // Overlays live outside the body; listen on the section for confirm / save buttons.
  document.getElementById('view-kit').onclick = (e) => {
    const save = e.target.closest('.lx-key-save')
    if (save) {
      const i = +save.dataset.save
      const input = document.querySelector(`.lx-key-name[data-key="${i}"] input`)
      if (input && input.value.trim()) multisigKeys[i].name = input.value.trim()
      ss.toast('Key name saved', document.getElementById('view-kit'))
      return rerender()
    }
    const confirm = e.target.closest('[data-lx-confirm]')
    if (confirm && pendingAct) {
      const key = multisigKeys[pendingAct.i]
      if (pendingAct.act === 'drop') key.seed = false
      if (pendingAct.act === 'reset') {
        Object.assign(key, { name: '', source: '', fingerprint: '', pub: '', seed: false, signed: false, creationType: null })
        ss.toast('Key has been reset', document.getElementById('view-kit'))
      }
      pendingAct = null
      rerender()
    }
  }
  lxBindSelect('lx-import-words', (count) => {
    lxState.keyWords = +count || lxState.keyWords
    lxState.pending = { index: lxState.keyIndex, type: 'importMnemonic' }
    go('add-import-mnemonic')
  }, (v) => t(`account.mnemonic.${v}`))
}

function lxKeyOverlays() {
  return lxWordCountModal('lx-import-words', lxState.keyWords) +
    lxConfirmModal('lx-drop-seed', t('account.seed.dropSeedConfirm.title'), t('account.seed.dropSeedConfirm.message'), t('account.seed.dropSeedConfirm.confirm'), 'drop') +
    lxConfirmModal('lx-reset-key', t('account.seed.resetKeyConfirm.title'), t('account.seed.resetKeyConfirm.message'), t('account.seed.resetKeyConfirm.confirm'), 'reset')
}

function lxEnsureKeys() {
  while (multisigKeys.length < msigTotal) multisigKeys.push({ name: '', source: '', fingerprint: '', pub: '', seed: false, signed: false })
}

// --- add/index.tsx ---------------------------------------------------------------------

function lxNameStatus(name) {
  const trimmed = name.trim()
  if (!trimmed) return { status: undefined }
  if (accounts.some((a) => a.name === trimmed)) return { status: 'invalid', error: t('account.error.nameDuplicated') }
  if (accounts.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) return { status: 'valid', warning: t('account.error.namePseudoDuplicated') }
  return { status: 'valid' }
}

registerScreen('new-account', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/index.tsx',
  title: () => t('account.add').toUpperCase(),
  back: 'accounts',
  render: () => {
    if (!lxState.typedName) lxState.typedName = ''
    const st = lxNameStatus(lxState.typedName)
    const policy = (value, key) =>
      ss.checkbox({
        label: t(`account.policy.${key}.title`),
        description: t(`account.policy.${key}.description`),
        selected: newAccountPolicy === value,
        data: { policy: value }
      })
    return ss.vstack({ gap: 'lg', justifyBetween: true },
      ss.form({},
        ss.form.item({},
          ss.form.label({ label: t('account.name') }),
          ss.textInput({ value: lxState.typedName, status: st.status, error: st.error, warning: st.warning, className: 'lx-account-name' })),
        `<div style="margin-top:24px">${ss.form.item({},
          ss.form.label({ label: t('account.policy.title') }),
          ss.vstack({}, policy('singlesig', 'singleSignature'), policy('multisig', 'multiSignature'), policy('watchonly', 'watchOnly')))}</div>`),
      ss.vstack({},
        ss.button({ label: t('common.continue'), variant: 'secondary', id: 'lx-continue', disabled: st.status !== 'valid' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'accounts' })))
  },
  bind: (body) => {
    const input = body.querySelector('.lx-account-name input')
    input.addEventListener('input', () => {
      lxState.typedName = input.value
      const pos = input.selectionStart
      openKitScreen('new-account')
      const next = document.querySelector('#kit-body .lx-account-name input')
      next.focus()
      next.setSelectionRange(pos, pos)
    })
    body.addEventListener('click', (e) => {
      const p = e.target.closest('[data-policy]')
      if (p) {
        newAccountPolicy = p.dataset.policy
        return openKitScreen('new-account')
      }
      if (e.target.closest('#lx-continue')) {
        newAccountName = lxState.typedName.trim()
        if (newAccountPolicy === 'multisig') go('multisig-setup')
        else if (newAccountPolicy === 'watchonly') go('add-watch-only')
        else go('new-singlesig')
      }
    })
  }
})

// --- singleSig/index.tsx ---------------------------------------------------------------

registerScreen('new-singlesig', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/singleSig/index.tsx',
  title: () => String(newAccountName).toUpperCase(),
  back: 'new-account',
  render: () =>
    ss.vstack({ justifyBetween: true },
      ss.form({},
        ss.form.item({}, ss.form.label({ label: t('account.policy.title') }),
          ss.text({ center: true, weight: 'bold' }, t('account.policy.singleSignature.title').toUpperCase())),
        ss.form.item({}, ss.form.label({ label: t('account.script') }),
          ss.button({ label: `${LX_SCRIPT_NAMES[lxState.script].replace(/ \(.*\)$/, '')} (${lxState.script})`, withSelect: true, data: { open: 'lx-script' } })),
        ss.form.item({}, ss.form.label({ label: t('account.mnemonic.title') }),
          ss.button({ label: `${lxState.words} ${t('bitcoin.words').toLowerCase()}`, withSelect: true, data: { open: 'lx-words' } })),
        ss.form.item({}, ss.form.label({ label: t('account.mnemonic.wordList') }),
          ss.button({ label: lxState.wordList, withSelect: true, data: { open: 'lx-wordlist' } })),
        ss.form.item({}, ss.form.label({ label: t('account.entropy.title') }),
          ss.button({ label: t(`account.entropy.${lxState.entropy}.label`), withSelect: true, data: { open: 'lx-entropy' } }))),
      ss.vstack({ gap: 'sm' },
        ss.button({ label: t('account.import.title2'), id: 'lx-import' }),
        ss.button({ label: t('account.generate.title'), variant: 'secondary', id: 'lx-generate' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'signer' }))),
  overlays: () =>
    lxScriptModal('lx-script', lxState.script, false) +
    lxWordCountModal('lx-words', lxState.words) +
    lxSelectModal('lx-wordlist', t('account.mnemonic.wordList'), LX_WORD_LISTS.map((w) => [w, w.replaceAll('_', ' ')]), lxState.wordList,
      t('account.mnemonic.wordListDescription', { wordList: lxState.wordList.replaceAll('_', ' ') })) +
    lxEntropyModal('lx-entropy', lxState.entropy),
  bind: (body) => {
    const reopen = () => openKitScreen('new-singlesig')
    body.addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]')
      if (open) ss.open(open.dataset.open)
      if (e.target.closest('#lx-import')) {
        if (typeof bdState !== 'undefined') bdState.keyIndex = 0
        go('add-import-mnemonic')
      }
      if (e.target.closest('#lx-generate')) {
        if (lxState.entropy === 'none') return go('add-generate-mnemonic')
        lxState.entropyWords = lxState.words
        lxState.entropyFrom = 'new-singlesig'
        go(`entropy-${lxState.entropy}`)
      }
    })
    lxBindSelect('lx-script', (v) => { if (v) lxState.script = v; reopen() }, lxScriptDesc)
    lxBindSelect('lx-words', (v) => { if (v) lxState.words = +v; reopen() }, (v) => t(`account.mnemonic.${v}`))
    lxBindSelect('lx-wordlist', (v) => { if (v) lxState.wordList = v; reopen() },
      (v) => t('account.mnemonic.wordListDescription', { wordList: String(v).replaceAll('_', ' ') }))
    lxBindSelect('lx-entropy', (v) => { if (v) lxState.entropy = v; reopen() })
  }
})

// --- (common)/entropy/{dice,coin,drawing}.tsx -------------------------------------------

function lxBinaryDisplay(bits) {
  return `<div class="lx-binary">${(bits.match(/.{1,11}/g) || []).map((b) => ss.text({ as: 'span', type: 'mono' }, b)).join('')}</div>`
}

function lxEntropyBits() {
  return { 12: 128, 15: 160, 18: 192, 21: 224, 24: 256 }[lxState.entropyWords] || 256
}

function lxWeak(symbols, faces) {
  if (symbols.length < 8) return false
  const counts = {}
  symbols.forEach((s) => (counts[s] = (counts[s] || 0) + 1))
  const max = Math.max(...Object.values(counts))
  const runs = symbols.join('').match(/(.)\1{5,}/)
  return max / symbols.length > Math.min(0.9, 2 / faces + 0.25) || !!runs
}

function lxEntropyFooter(input, complete, mixKey) {
  return ss.vstack({ gap: 'sm', style: 'margin-top:24px;width:100%' },
    ss.checkbox({ selected: lxState[mixKey] !== false, label: t('account.entropy.mixWithDevice'), id: 'lx-mix' }),
    ss.text({ size: 'xs', color: 'muted' }, t('account.entropy.mixWithDeviceDescription')),
    input.length ? ss.button({ variant: 'ghost', label: t('common.undo'), id: 'lx-undo' }) : '',
    complete ? ss.button({ variant: 'secondary', label: t('common.continue'), id: 'lx-entropy-done' }) : '')
}

function lxEntropyScreen(kind, { faces, perInput, pad }) {
  const stateKey = `${kind}Input`
  return {
    source: `app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/(common)/entropy/${kind}.tsx`,
    title: () => t(`account.entropy.${kind}.title`).toUpperCase(),
    back: () => lxState.entropyFrom,
    render: () => {
      const input = lxState[stateKey] || (lxState[stateKey] = [])
      const bits = lxEntropyBits()
      const total = kind === 'dice' ? Math.ceil(bits / Math.log2(6)) : bits
      const complete = input.length >= total
      const preview = input.length ? lxBits(input.join(''), Math.min(bits, Math.floor(input.length * perInput))) : ''
      const mixed = lxState.mix !== false
      const weak = lxWeak(input.map(String), faces)
      return ss.vstack({ itemsCenter: true, gap: 'lg', style: 'padding-bottom:12px' },
        `<div style="width:100%">${lxBinaryDisplay(preview)}${
          input.length ? ss.text({ size: 'xs', color: 'muted', center: true, style: 'margin-top:4px' }, mixed ? t('account.entropy.previewMixedNote') : t('account.entropy.previewNote')) : ''
        }</div>`,
        ss.vstack({ itemsCenter: true, gap: 'lg', widthFull: true },
          ss.vstack({ itemsCenter: true, gap: 'none' },
            `<p class="ss-text lx-count-num">${input.length}</p>`,
            ss.text({ color: 'muted', uppercase: true }, `${t('common.of')} ${total}`)),
          ss.text({ color: 'muted', center: true, style: 'letter-spacing:0.5px' }, t(`account.entropy.${kind}.desc.${lxState.entropyWords}`)),
          weak ? ss.text({ center: true, style: 'color:var(--warning)' }, mixed ? t('account.entropy.biasWarningMixed') : t('account.entropy.biasWarningUnmixed')) : '',
          complete ? '' : pad(),
          complete
            ? `<div class="lx-log">${ss.vstack({ gap: 'xs' }, ss.text({ size: 'xs', color: 'muted', uppercase: true }, t('account.entropy.recordedInput')),
                ss.text({}, input.join(kind === 'dice' ? ' ' : '')))}</div>`
            : '<button type="button" class="lx-demo-fill" id="lx-fill">Demo: fill remaining</button>',
          lxEntropyFooter(input, complete, 'mix')))
    },
    bind: (body) => {
      const input = lxState[stateKey]
      const rerender = () => openKitScreen(`entropy-${kind}`)
      const total = () => (kind === 'dice' ? Math.ceil(lxEntropyBits() / Math.log2(6)) : lxEntropyBits())
      body.addEventListener('click', (e) => {
        const v = e.target.closest('[data-lx-in]')
        if (v && input.length < total()) {
          input.push(v.dataset.lxIn)
          return rerender()
        }
        if (e.target.closest('#lx-undo')) {
          input.pop()
          return rerender()
        }
        if (e.target.closest('#lx-fill')) {
          let h = input.length + 7
          while (input.length < total()) {
            h = (Math.imul(h, 1664525) + 1013904223) >>> 0
            input.push(kind === 'dice' ? String((h >>> 24) % 6 + 1) : String((h >>> 24) & 1))
          }
          return rerender()
        }
        if (e.target.closest('#lx-mix')) {
          lxState.mix = lxState.mix === false
          return rerender()
        }
        if (e.target.closest('#lx-entropy-done')) {
          lxState[stateKey] = []
          lxEntropyFinish()
        }
      })
    }
  }
}

// Entropy completes into the generated mnemonic screen (bitcoin-add.js); multisig keys come
// back to the manager from there and pick up the pending key.
function lxEntropyFinish() {
  go('add-generate-mnemonic')
}

registerScreen('entropy-dice', lxEntropyScreen('dice', {
  faces: 6,
  perInput: Math.log2(6),
  pad: () => `<div class="lx-dice">${['diceOne', 'diceTwo', 'diceThree', 'diceFour', 'diceFive', 'diceSix']
    .map((name, i) => `<button type="button" class="lx-die" data-lx-in="${i + 1}" aria-label="${i + 1}">${ss.icon(name, { size: 92 })}</button>`).join('')}</div>`
}))

registerScreen('entropy-coin', lxEntropyScreen('coin', {
  faces: 2,
  perInput: 1,
  pad: () => `<div class="lx-coins"><button type="button" class="lx-coin is-heads" data-lx-in="0">0</button><button type="button" class="lx-coin is-tails" data-lx-in="1">1</button></div>`
}))

// drawing.tsx: about 1 bit per accepted sample; finishes on its own when enough samples land.
registerScreen('entropy-drawing', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/(common)/entropy/drawing.tsx',
  title: () => t('account.entropy.drawing.title').toUpperCase(),
  back: () => lxState.entropyFrom,
  render: () => {
    const bits = lxEntropyBits()
    return ss.vstack({ gap: 'md', style: 'padding-bottom:var(--layout-main-container-padding-bottom)' },
      `<div id="lx-draw-bits">${lxBinaryDisplay('')}</div>`,
      ss.vstack({ itemsCenter: true, gap: 'sm', widthFull: true },
        ss.vstack({ itemsCenter: true, gap: 'none' },
          '<p class="ss-text lx-count-num" id="lx-draw-count">0</p>',
          ss.text({ color: 'muted', uppercase: true }, `${t('common.of')} ${bits}`)),
        ss.text({ color: 'muted', center: true, style: 'letter-spacing:0.5px' }, t(`account.entropy.drawing.desc.${lxState.entropyWords}`)),
        ss.text({ color: 'muted', center: true }, t('account.entropy.drawing.bitsNote')),
        '<canvas class="lx-canvas" id="lx-canvas"></canvas>',
        '<button type="button" class="lx-demo-fill" id="lx-fill">Demo: fill remaining</button>',
        ss.button({ label: t('common.clear'), variant: 'ghost', id: 'lx-clear', disabled: true })))
  },
  bind: (body) => {
    const bits = lxEntropyBits()
    const canvas = body.querySelector('#lx-canvas')
    const ctx = canvas.getContext('2d')
    let samples = []
    let last = null
    let drawing = false
    let done = false
    const fit = () => {
      const r = canvas.getBoundingClientRect()
      canvas.width = r.width || 320
      canvas.height = r.height || 260
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
    requestAnimationFrame(fit)
    const paint = () => {
      body.querySelector('#lx-draw-count').textContent = Math.min(samples.length, bits)
      body.querySelector('#lx-draw-bits').innerHTML = lxBinaryDisplay(lxBits(samples.map((p) => `${p.x | 0},${p.y | 0}`).join(';'), Math.min(samples.length, bits)))
      body.querySelector('#lx-clear').disabled = samples.length === 0
      if (!done && samples.length >= bits) {
        done = true
        setTimeout(lxEntropyFinish, 250)
      }
    }
    const pos = (e) => {
      const r = canvas.getBoundingClientRect()
      return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height }
    }
    const add = (p) => {
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 4) return
      last = p
      samples.push(p)
      paint()
    }
    canvas.addEventListener('pointerdown', (e) => {
      drawing = true
      canvas.setPointerCapture(e.pointerId)
      const p = pos(e)
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      add(p)
    })
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return
      const p = pos(e)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      add(p)
    })
    canvas.addEventListener('pointerup', () => (drawing = false))
    body.querySelector('#lx-clear').addEventListener('click', () => {
      if (done) return
      samples = []
      last = null
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      paint()
    })
    body.querySelector('#lx-fill').addEventListener('click', () => {
      ctx.beginPath()
      let x = 20
      let y = 130
      ctx.moveTo(x, y)
      while (samples.length < bits) {
        x = 20 + ((samples.length * 37) % (canvas.width - 40))
        y = 30 + ((samples.length * 53) % (canvas.height - 60))
        ctx.lineTo(x, y)
        samples.push({ x, y })
      }
      ctx.stroke()
      paint()
    })
  }
})

// --- multiSig/index.tsx ----------------------------------------------------------------

registerScreen('multisig-setup', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/multiSig/index.tsx',
  title: () => String(newAccountName).toUpperCase(),
  back: 'new-account',
  render: () =>
    ss.vstack({ justifyBetween: true },
      ss.form({},
        ss.form.item({}, ss.form.label({ label: t('account.policy.title') }),
          ss.text({ center: true, weight: 'bold' }, t('account.policy.multiSignature.title').toUpperCase())),
        ss.form.item({}, `<div id="lx-count-wrap">${lxCountSelector(msigRequired, msigTotal)}</div>`),
        ss.form.item({}, ss.form.label({ label: t('account.script') }),
          ss.button({ label: LX_SCRIPT_NAMES[lxScriptVersion()], withSelect: true, data: { open: 'lx-msig-script' } }))),
      ss.vstack({},
        ss.button({ label: t('account.import.descriptor'), variant: 'subtle', go: 'add-multisig-import-descriptor' }),
        ss.button({ label: t('common.continue'), variant: 'secondary', id: 'lx-msig-continue' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'signer' }))),
  overlays: () => lxScriptModal('lx-msig-script', lxScriptVersion(), true),
  bind: (body) => {
    const wrap = body.querySelector('#lx-count-wrap')
    const bindSelector = () =>
      lxBindCountSelector(wrap, () => ({ required: msigRequired, total: msigTotal }), (r, tot) => {
        if (r === msigRequired && tot === msigTotal) return
        msigRequired = r
        msigTotal = tot
        // Redraw only the selector so the drag keeps its pointer capture target.
        const svgOld = wrap.querySelector('svg')
        const tmp = document.createElement('div')
        tmp.innerHTML = lxCountSelector(msigRequired, msigTotal)
        wrap.querySelector('.lx-count-big').textContent = `${msigRequired} ${t('common.of')} ${msigTotal}`
        svgOld.innerHTML = tmp.querySelector('svg').innerHTML
      })
    bindSelector()
    body.addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]')
      if (open) ss.open(open.dataset.open)
      if (e.target.closest('#lx-msig-continue')) {
        lxEnsureKeys()
        lxState.expanded = null
        go('multisig-keys')
      }
    })
    lxBindSelect('lx-msig-script', (v) => {
      if (v) msigScript = LX_SCRIPT_NAMES[v]
      openKitScreen('multisig-setup')
    }, lxScriptDesc)
  }
})

// --- multiSig/manager.tsx --------------------------------------------------------------

registerScreen('multisig-keys', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/multiSig/manager.tsx',
  title: () => String(newAccountName).toUpperCase(),
  back: 'multisig-setup',
  render: () => {
    if (lxState.pending && String(routeId).startsWith('add-')) lxApplyPending()
    lxEnsureKeys()
    const shown = multisigKeys.slice(0, msigTotal)
    const ready = shown.every((k) => lxKeyType(k))
    return ss.vstack({},
      `<div class="lx-msig-head">${ss.vstack({ gap: 'md' },
        `<p class="ss-text is-center lx-count-big">${msigRequired} ${t('common.of')} ${msigTotal}</p>`,
        lxSigDisplay(msigRequired, msigTotal, 0),
        ss.text({ center: true }, t('account.addOrGenerateKeys')))}</div>`,
      `<div class="lx-keys">${shown.map((k, i) => lxKeyControl(k, i, msigTotal, 'setup')).join('')}</div>`,
      ss.vstack({ style: 'padding:16px 0' },
        ss.button({ label: t('common.confirm'), variant: 'secondary', disabled: !ready, id: 'lx-msig-confirm' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'multisig-setup' })))
  },
  overlays: lxKeyOverlays,
  bind: (body) => {
    lxBindKeys(body, 'setup', () => openKitScreen('multisig-keys'))
    body.addEventListener('click', (e) => {
      if (e.target.closest('#lx-msig-confirm')) {
        openAccountData = accounts.find((a) => a.multisig) || lxVault
        go('add-multisig-finish')
      }
    })
  }
})

// --- multiSig/keySettings/[index].tsx --------------------------------------------------

registerScreen('multisig-key', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/multiSig/keySettings/[index].tsx',
  title: () => String(newAccountName).toUpperCase(),
  back: 'multisig-keys',
  render: () =>
    ss.vstack({ justifyBetween: true },
      ss.form({},
        ss.form.item({}, ss.form.label({ label: t('account.policy.title') }),
          ss.text({ center: true, weight: 'bold' }, t('account.policy.multiSignature.title').toUpperCase())),
        ss.form.item({}, ss.form.label({ label: t('account.key.number') }),
          ss.text({ center: true, weight: 'bold' }, `${lxState.keyIndex + 1} ${t('common.of').toLowerCase()} ${msigTotal}`)),
        ss.form.item({}, ss.form.label({ label: t('account.mnemonic.title') }),
          ss.button({ label: `${lxState.keyWords} ${t('bitcoin.words').toLowerCase()}`, withSelect: true, data: { open: 'lx-key-words' } })),
        ss.form.item({}, ss.form.label({ label: t('account.entropy.title') }),
          ss.button({ label: t(`account.entropy.${lxState.keyEntropy}.label`), withSelect: true, data: { open: 'lx-key-entropy' } }))),
      ss.vstack({},
        ss.button({ label: t('account.generate.title'), variant: 'secondary', id: 'lx-key-generate' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'multisig-keys' }))),
  overlays: () => lxWordCountModal('lx-key-words', lxState.keyWords) + lxEntropyModal('lx-key-entropy', lxState.keyEntropy),
  bind: (body) => {
    const reopen = () => openKitScreen('multisig-key')
    body.addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]')
      if (open) ss.open(open.dataset.open)
      if (e.target.closest('#lx-key-generate')) {
        const i = lxState.keyIndex
        const key = multisigKeys[i]
        key.name = key.name || 'Phone'
        if (typeof bdState !== 'undefined') bdState.keyIndex = i
        lxState.pending = { index: i, type: 'generateMnemonic' }
        if (lxState.keyEntropy === 'none') return go('add-generate-mnemonic')
        lxState.entropyWords = lxState.keyWords
        lxState.entropyFrom = 'multisig-key'
        go(`entropy-${lxState.keyEntropy}`)
      }
    })
    lxBindSelect('lx-key-words', (v) => { if (v) lxState.keyWords = +v; reopen() }, (v) => t(`account.mnemonic.${v}`))
    lxBindSelect('lx-key-entropy', (v) => { if (v) lxState.keyEntropy = v; reopen() })
  }
})

// --- account/[id]/settings/index.tsx (multisig branch) ---------------------------------

registerScreen('multisig-settings', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/index.tsx',
  title: () => (openAccountData && openAccountData.multisig ? openAccountData.name : lxVault.name).toUpperCase(),
  back: 'account',
  render: () => {
    const acct = openAccountData && openAccountData.multisig ? openAccountData : lxVault
    const keys = multisigKeys.slice(0, msigTotal)
    const row = (label, value) => ss.hstack({ justifyBetween: true }, ss.text({ color: 'muted' }, label), ss.text({}, value))
    return ss.vstack({ gap: 'lg' },
      ss.text({ center: true, uppercase: true, color: 'muted' }, t('account.settings.title')),
      ss.form({}, ss.form.item({}, ss.form.label({ label: t('account.name') }), ss.textInput({ value: acct.name, status: 'valid' }))),
      `<div class="lx-info">${[
        row(t('account.policy.title'), t('account.policy.multiSignature.title')),
        row(t('account.script'), LX_SCRIPT_NAMES[lxScriptVersion()]),
        row(t('account.network.title'), acct.network),
        row(t('account.labeledTransactions'), `2 of ${acct.stats[0][0]}`)
      ].join('')}</div>`,
      ss.vstack({ gap: 'md' },
        `<p class="ss-text is-center lx-count-big">${msigRequired} ${t('common.of')} ${msigTotal}</p>`,
        lxSigDisplay(msigRequired, msigTotal, 0),
        ss.text({ center: true, uppercase: true }, t('account.accountKeys'))),
      `<div>${keys.map((k, i) => lxKeyControl(k, i, keys.length, 'settings')).join('')}</div>`)
  },
  overlays: lxKeyOverlays,
  bind: (body) => lxBindKeys(body, 'settings', () => openKitScreen('multisig-settings'))
})

// --- previewTransaction.tsx (multisig branch, SSSignatureDropdown) ----------------------

function lxSigDropdown(key, index, total) {
  const open = lxState.sigExpanded === index
  const signed = !!key.signed
  const psbt = lxState.signedPsbt[index] || (signed ? `cHNidP8BAH0CAAAAA${lxHex(`${key.fingerprint}sig${index}`, 120)}` : '')
  const icon = signed ? ss.icon('green', { size: 24 }) : '<span class="lx-sig-dot"></span>'
  let body = ''
  if (open) {
    body = `<div class="lx-key-body" style="padding:0 0 28px">${ss.vstack({ gap: 'sm' },
      key.seed
        ? ss.button({ label: t('transaction.preview.signWithLocalKey'), variant: 'secondary', style: 'margin-top:16px', data: { sign: index } })
        : ss.vstack({ gap: 'sm', style: 'margin-top:16px' },
            ss.button({ label: t('transaction.preview.SignWithSeedQR'), variant: 'secondary', data: { sign: index } }),
            ss.button({ label: t('transaction.preview.signWithSeedWords'), variant: 'secondary', data: { sign: index } })),
      ss.text({ center: true, color: 'muted', uppercase: true, style: 'margin-top:16px' }, t('transaction.preview.exportUnsigned')),
      ss.hstack({ gap: 'xxs', justifyBetween: true },
        ss.clipboardCopy({ text: `cHNidP8BAH0CAAAAA${lxHex('unsigned', 80)}` }, ss.button({ variant: 'outline', label: t('common.copy'), className: 'lx-half', style: 'width:100%' })),
        ss.button({ variant: 'outline', label: t('common.showQR'), className: 'lx-half', go: 'psbt-qr' })),
      ss.hstack({ gap: 'xxs', justifyBetween: true },
        ss.button({ variant: 'outline', label: t('common.usb'), className: 'lx-half', disabled: true }),
        ss.button({ variant: 'outline', label: t('transaction.preview.exportNFC'), className: 'lx-half', disabled: true })),
      ss.button({ variant: 'outline', label: t('transaction.preview.nip17group'), disabled: true }),
      ss.text({ center: true, color: 'muted', uppercase: true, style: 'margin-top:16px' }, t('transaction.preview.importSigned')),
      `<div class="lx-psbt${psbt ? ' is-valid' : ' is-empty'}">${ss.esc(psbt || t('transaction.preview.signedPsbt'))}</div>`,
      ss.hstack({ gap: 'xxs', justifyBetween: true },
        ss.button({ variant: 'outline', label: t('common.paste'), className: 'lx-half', data: { paste: index } }),
        ss.button({ variant: 'outline', label: t('common.scanQR'), className: 'lx-half', data: { paste: index } })),
      ss.hstack({ gap: 'xxs', justifyBetween: true },
        ss.button({ variant: 'outline', label: t('common.usb'), className: 'lx-half', disabled: true }),
        ss.button({ variant: 'outline', label: t('watchonly.read.nfc'), className: 'lx-half', disabled: true })))}</div>`
  }
  return `<div class="lx-key is-sig${index === total - 1 ? ' is-last' : ''}">${lxKeyHead(key, index, icon, `data-lx-sig="${index}"`)}${body}</div>`
}

registerScreen('multisig-sign', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/signAndSend/previewTransaction.tsx',
  title: () => (openAccountData && openAccountData.multisig ? openAccountData.name : lxVault.name).toUpperCase(),
  back: 'account',
  render: () => {
    // Fresh visit: the phone key has signed, the cosigners haven't (same as the legacy fixture).
    if (routeId !== 'multisig-sign') {
      multisigKeys.forEach((k, i) => (k.signed = i === 0 && !!k.fingerprint))
      lxState.signedPsbt = {}
      lxState.sigExpanded = null
    }
    const keys = multisigKeys.slice(0, msigTotal)
    const collected = keys.filter((k) => k.signed).length
    const txid = (typeof previewTxid !== 'undefined' && previewTxid) || demoTxid(`multisig${lxVault.fingerprint}`)
    const section = (title, content) => ss.vstack({ gap: 'xxs' }, ss.text({ color: 'muted', uppercase: true }, title), content)
    let contents = ''
    try {
      contents = txDetailSankey(draftTx(draftTotals()))
    } catch (e) {
      contents = ''
    }
    return ss.vstack({ gap: 'lg' },
      section(t('transaction.id'), ss.txid({ value: txid, size: 'lg' })),
      contents ? section(t('transaction.build.preview.contents'), `<div style="overflow:hidden">${contents}</div>`) : '',
      ss.vstack({ gap: 'md', style: 'margin-top:16px' },
        ss.text({ center: true, color: 'muted', uppercase: true }, t('transaction.preview.multisigSignatureRequired')),
        `<p class="ss-text is-center lx-count-big">${msigRequired} ${t('common.of')} ${msigTotal}</p>`,
        lxSigDisplay(msigRequired, msigTotal, collected),
        `<div>${keys.map((k, i) => lxSigDropdown(k, i, keys.length)).join('')}</div>`),
      ss.vstack({},
        ss.text({ center: true, color: 'muted', style: 'margin-bottom:8px' }, `${t('transaction.preview.signaturesCollected')}: ${collected} / ${msigRequired}`),
        ss.button({ variant: 'secondary', label: t('transaction.preview.checkAllSignatures'), disabled: collected < msigRequired, id: 'lx-check-sigs' })))
  },
  bind: (body) => {
    const rerender = () => openKitScreen('multisig-sign')
    body.addEventListener('click', (e) => {
      const head = e.target.closest('[data-lx-sig]')
      if (head) {
        const i = +head.dataset.lxSig
        lxState.sigExpanded = lxState.sigExpanded === i ? null : i
        return rerender()
      }
      const sign = e.target.closest('[data-sign]')
      if (sign) {
        const i = +sign.dataset.sign
        multisigKeys[i].signed = true
        ss.toast(t('transaction.build.sign.signed'), document.getElementById('view-kit'))
        return rerender()
      }
      const paste = e.target.closest('[data-paste]')
      if (paste) {
        const i = +paste.dataset.paste
        multisigKeys[i].signed = true
        lxState.signedPsbt[i] = `cHNidP8BAH0CAAAAA${lxHex(`pasted${i}`, 120)}`
        return rerender()
      }
      if (e.target.closest('#lx-check-sigs')) {
        const acct = openAccountData && openAccountData.multisig ? openAccountData : lxVault
        openAccountData = acct
        renderSent(demoTxid(`multisig${acct.fingerprint}`))
      }
    })
  }
})

// --- duress → setDuressPin ---------------------------------------------------------------
// The old duress view now lives at set-duress-pin (screens/ecash-shell.js). Delegate to it at
// open time so the alias works whatever order the scripts load in.
registerScreen('duress', {
  source: 'app/setDuressPin.tsx',
  get title() { return (kitScreens['set-duress-pin'] || {}).title || 'Duress PIN' },
  get back() { const d = kitScreens['set-duress-pin']; return d ? d.back : 'settings-security' },
  get gear() { return (kitScreens['set-duress-pin'] || {}).gear },
  get overlays() { return (kitScreens['set-duress-pin'] || {}).overlays },
  get bind() { return (kitScreens['set-duress-pin'] || {}).bind },
  render: (state) => {
    const d = kitScreens['set-duress-pin']
    return d ? d.render(state) : ss.text({ center: true, color: 'muted' }, 'Duress PIN')
  }
})
