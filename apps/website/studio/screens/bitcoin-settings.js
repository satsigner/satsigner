/* Bitcoin account settings — app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/*
   Birthday, exports (descriptor, descriptors, labels, pubkeys, public key, seed words), label import,
   watched-address management, and Nostr label sync (keys, devices, group chat, relays).
   Registered with registerScreen() from screens.js. Everything is fixture data. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  .bs-page { padding: 20px 0; }
  .bs-box { box-sizing: border-box; width: 100%; padding: 10px; border-radius: 5px; background: var(--gray-950); word-break: break-all; }
  .bs-box.is-bordered { border: 1px solid var(--gray-800); }
  .bs-box.is-invalid { border-color: var(--error); }
  .bs-qr { display: flex; justify-content: center; margin: 20px 0; }
  .bs-qr-card { padding: 20px; border-radius: 10px; background: var(--white); }
  .bs-qr-card.is-tight { padding: 16px; border-radius: 2px; }
  .bs-qr-card .ss-qr { border-radius: 0; }
  .bs-warning { padding: 10px; border: 1px solid var(--warning); border-radius: 5px; }
  .bs-warning p { color: var(--warning); }
  .bs-filetypes { display: flex; gap: 8px; padding: 0 20px; }
  .bs-filetypes > * { flex: 1; }
  .bs-filetypes .ss-checkbox { gap: 8px; }
  .bs-filetypes .ss-checkbox .ss-text { font-size: var(--sizes-text-font-size-sm); }
  /* SSDatePicker — three snap-scrolling wheels with a centre mark */
  .bs-wheels { position: relative; display: flex; justify-content: center; width: 90%; height: 200px; margin: 0 auto; }
  .bs-wheel { flex: 1; height: 200px; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; -webkit-mask-image: linear-gradient(180deg, transparent, #000 35%, #000 65%, transparent); mask-image: linear-gradient(180deg, transparent, #000 35%, #000 65%, transparent); }
  .bs-wheel::-webkit-scrollbar { display: none; }
  .bs-wheel i { display: block; height: 77px; }
  .bs-wheel button { display: block; width: 100%; height: 46px; border: 0; background: none; color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-2xl); scroll-snap-align: center; cursor: pointer; }
  .bs-wheels::after { content: ""; position: absolute; left: 0; right: 0; top: 77px; height: 46px; border-top: 1px solid var(--gray-800); border-bottom: 1px solid var(--gray-800); pointer-events: none; }
  /* Seed words grid (export/seedWords.tsx) */
  .bs-seed-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 8px; width: 100%; }
  .bs-seed-col { display: flex; flex-direction: column; }
  .bs-word { display: flex; align-items: center; gap: var(--layout-h-stack-gap-sm); height: 48px; margin-bottom: 8px; padding: 3px 8px; box-sizing: border-box; border: 1px solid var(--gray-800); border-radius: 8px; background: var(--gray-900); }
  /* PIN pad (SSPinAuth approximation) */
  .bs-pin-dots { display: flex; justify-content: center; gap: 16px; }
  .bs-pin-dots i { width: 14px; height: 14px; border: 1px solid var(--gray-300); border-radius: 50%; }
  .bs-pin-dots i.is-on { background: var(--white); border-color: var(--white); }
  .bs-pin-pad { display: grid; grid-template-columns: repeat(3, 72px); gap: 16px; justify-content: center; }
  .bs-pin-pad button { height: 72px; border: 1px solid var(--gray-700); border-radius: 50%; background: none; color: var(--white); font: inherit; font-size: 24px; font-weight: 300; cursor: pointer; }
  .bs-pin-pad button:active { background: var(--gray-800); }
  .bs-pin-pad button.is-blank { visibility: hidden; }
  /* Address cards (SSAddressCard) */
  .bs-addr { padding: 12px 0; border-bottom: 1px solid var(--gray-850); }
  .bs-addr-actions { display: flex; gap: 12px; }
  .bs-addr-actions button { border: 0; padding: 0; background: none; color: var(--white); cursor: pointer; }
  /* Nostr sync */
  .bs-keys { box-sizing: border-box; padding: 10px 28px 30px; border: 1px solid var(--white); border-radius: 8px; background: #1a1a1a; }
  .bs-members { box-sizing: border-box; padding: 12px; border: 1px solid var(--white); border-radius: 8px; background: #1a1a1a; }
  .bs-dot { flex: none; width: 10px; height: 10px; border-radius: 5px; }
  .bs-dot.is-small { width: 8px; height: 8px; border-radius: 4px; }
  .bs-avatar { flex: none; width: 24px; height: 24px; border-radius: 12px; }
  .bs-avatar.is-large { width: 64px; height: 64px; border-radius: 32px; margin: 0 auto; }
  .bs-member { flex: 0.7; min-width: 0; border: 0; padding: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .bs-member-trust { flex: 0.3; }
  .bs-member-trust .ss-button { height: 44px; }
  .bs-relays { padding: 12px; border-radius: 4px; background: #1a1a1a; }
  .bs-reveal { display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; padding: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
  .bs-npub-row { justify-content: center; }
  .bs-mono-xl { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: var(--sizes-text-font-size-xl); }
  .bs-addon { padding: 14px 7px; border-radius: 2px; background: var(--bar-gray); }
  .bs-grow { flex-grow: 1; }
  .bs-relay .ss-checkbox { flex: none; width: auto; }
  /* Devices group chat */
  .bs-chat { display: flex; flex-direction: column; height: 100%; }
  .bs-chat-list { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 8px; padding-bottom: 8px; }
  .bs-msg { padding: 5px 10px 15px; border-radius: 8px; background: var(--gray-900); }
  .bs-msg.is-mine { background: var(--gray-800); }
  .bs-msg-author { border: 0; padding: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .bs-chat-input { display: flex; gap: 8px; align-items: flex-end; padding-bottom: 16px; }
  .bs-chat-input textarea { flex: 1; box-sizing: border-box; min-height: 44px; max-height: 120px; padding: 10px; border: 0; border-radius: 8px; background: var(--gray-900); color: var(--white); font: inherit; font-size: 15px; resize: none; outline: none; }
  .bs-chat-input textarea::placeholder { color: var(--gray-500); }
  .bs-chat-input .ss-button { width: 80px; height: 44px; }
  #kit-body:has(.bs-chat) { display: flex; flex-direction: column; }
  </style>`
)

/* ---------- fixtures ---------- */

const bsAcct = () => (typeof openAccountData !== 'undefined' && openAccountData) || accounts[0]
const bsName = () => bsAcct().name

// Keyed by account fingerprint so each fixture account keeps its own state.
const bsStore = {}
function bsState() {
  const fp = bsAcct().fingerprint
  if (!bsStore[fp]) {
    bsStore[fp] = {
      birthday: null, // { date: ms } once saved
      birthdayMode: 'date',
      pubFormat: 'vpub',
      publicKeyFormat: 'vpub',
      descriptorsSeparate: false,
      labelFormat: 'JSONL',
      importFormat: 'JSONL',
      importContent: '',
      seedUnlocked: false,
      addresses: [
        { address: 'tb1qrent000001qz7pw9y6qh5c4sxd8u0lmk2gq3vf', label: 'Rent', summary: { balance: 210000, satsInMempool: 0, transactions: 3, utxos: 1 } },
        { address: 'tb1qchange0001wv5h3r3nf2sxk6mdq9y7ue4ac8s0pz', label: 'Change', summary: { balance: 589758, satsInMempool: 0, transactions: 2, utxos: 1 } },
        { address: 'tb1qsalary0001g9t8z4lh2e3x5c6v7b8n9m0q1w2e3r', label: '', summary: { balance: 0, satsInMempool: 50000, transactions: 1, utxos: 0 } }
      ],
      nostr: {
        autoSync: true,
        lastSync: Date.now() - 1000 * 60 * 42,
        relays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'],
        deviceNpub: 'npub1s8gx3r0d6m4kpz2wq9cl7yv5ht3nf8ue6aj0rxk2ds4gq7vz5mfqh2l9wc',
        deviceNsec: 'nsec1demo7k3qv0x5w8p2r6t9y4u1i3o5p7a9s2d4f6g8h0j2k4l6z8x0c2v4b6nq',
        commonNpub: 'npub1c0mm0nk3y8rq2f6wz4ld9xs7vp3hn5tj1eu8ga2mky6qr0w4zc5s9fx3ue',
        commonNsec: 'nsec1c0mm0ndem0x4w9q2r7t5y8u3i6o1p4a7s0d3f6g9h2j5k8l1z4x7c0v3bq',
        kind0: { displayName: 'Satoshi’s laptop' },
        members: [
          { npub: 'npub1q3sle0k6qwhzrx4t7vp2mfg9yjc5u8ldn0ea3xs6h2k4w7r9tz5qp8g0vx', color: '#E5A33A', alias: 'Coldcard desk', displayName: '' },
          { npub: 'npub1w8v4fq7m2ejx0zn6t3cak5yhr9lpd4g1us8w6q2fx7c3nmz0jk5spyt9re', color: '#6EA8FE', alias: '', displayName: 'Phone (Alice)' },
          { npub: 'npub1z9k3mq6p8sxe4wv2rt7yjd0ufhc5lg1an3e7q9xk2w6p4m8ts0r5cqzl3h', color: '#9B7BE0', alias: '', displayName: '' }
        ],
        trusted: new Set(['npub1q3sle0k6qwhzrx4t7vp2mfg9yjc5u8ldn0ea3xs6h2k4w7r9tz5qp8g0vx']),
        messages: [
          { from: 'npub1q3sle0k6qwhzrx4t7vp2mfg9yjc5u8ldn0ea3xs6h2k4w7r9tz5qp8g0vx', text: 'Labels synced from the desk machine. 14 labels.', at: Date.now() - 1000 * 60 * 60 * 26 },
          { from: 'npub1w8v4fq7m2ejx0zn6t3cak5yhr9lpd4g1us8w6q2fx7c3nmz0jk5spyt9re', text: 'Got them. Can you sign the rent payment PSBT tonight?', at: Date.now() - 1000 * 60 * 60 * 3 },
          { from: 'self', text: 'Yes, sending the PSBT here after I review fees.', at: Date.now() - 1000 * 60 * 52 }
        ]
      },
      selectedNpub: null
    }
  }
  return bsStore[fp]
}

const BS_SEED = 'abandon ability able about above absent absorb abstract absurd abuse access accident'.split(' ')
const BS_XPRV_PATH = "84'/1'/0'"

function bsKeys() {
  const fp = bsAcct().fingerprint
  // Stable, real-looking extended keys per fingerprint (fixture strings, not derived).
  const tail = (fp + 'Q7kLm2Nn9pRsT4uVwX5yZ6aB8cD').slice(0, 30)
  return {
    fingerprint: fp,
    path: BS_XPRV_PATH,
    tpub: `tpubDC8msFGeGuwnKG9Upg7DM2b4DaRqg3CUZa5g8v2SRQ6K${tail}mrGQr4`,
    vpub: `vpub5Y6cjg78GGuNLsaPhmYsiw4gYX3HoQiRBiSwDaBXKUafCt${tail}J2HVe`,
    xpub: `xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL${tail}Ns`,
    zpub: `zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPh${tail}3Xg`,
    script: 'P2WPKH'
  }
}

function bsDescriptor(change) {
  const k = bsKeys()
  const body = `wpkh([${k.fingerprint}/${k.path}]${k.tpub}/${change ? 1 : 0}/*)`
  // Fake but well-formed 8-char checksum, stable per descriptor.
  let h = 7
  for (const c of body) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0
  const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
  let sum = ''
  for (let i = 0; i < 8; i += 1) sum += alphabet[(h >>> (i * 4)) & 31]
  return `${body}#${sum}`
}

function bsLabels(format) {
  const rows = [
    { type: 'tx', ref: 'b20d91aa77c0e11f44aa91b20d91aa77c0e11f44aa91b20d91aa77c0e191aa', label: 'Rent' },
    { type: 'addr', ref: 'tb1qrent000001qz7pw9y6qh5c4sxd8u0lmk2gq3vf', label: 'Rent' },
    { type: 'output', ref: 'a91c8f21b04e20aa11c0d4e20aa91c8f21b04e20aa11c0d4e20aa91c8f4e20:0', label: 'Salary', spendable: true }
  ]
  if (format === 'CSV') return ['Type,Ref,Label', ...rows.map((r) => `${r.type},${r.ref},${r.label}`)].join('\n')
  if (format === 'JSON') return JSON.stringify(rows, null, 2)
  return rows.map((r) => JSON.stringify(r)).join('\n')
}

const BS_RELAYS = [['0xchat','wss://relay.0xchat.com'], ['Agora','wss://relay.agora.social'], ['Angani','wss://nostr-1.nbo.angani.co'], ['Azzamo','wss://relay.azzamo.net'], ['Bitcoiner Social','wss://nostr.bitcoiner.social'], ['Bostr','wss://bostr.online'], ['Btc Library','wss://nostr.btc-library.com'], ['Coracle','wss://bucket.coracle.social'], ['Creatr','wss://creatr.nostr.wine'], ['Damus','wss://relay.damus.io'], ['Data Haus','wss://nostr.data.haus'], ['Dwadziesciajeden','wss://relay.dwadziesciajeden.pl'], ['Einundzwanzig Space','wss://nostr.einundzwanzig.space'], ['Flashsoft','wss://relay.flashsoft.eu'], ['Hodlbod','wss://relay.hodlbod.com'], ['JB55','wss://relay.jb55.com'], ['Lume','wss://relay.lume.nu'], ['Mostro','wss://relay.mostro.network'], ['Mutinywallet','wss://nostr.mutinywallet.com'], ['Nos lol (POW 28 bits required)','wss://nos.lol'], ['Nostr Band','wss://relay.nostr.band'], ['Nostr BG','wss://relay.nostr.bg'], ['Nostr Land','wss://relay.nostr.land'], ['Nostr Mom','wss://nostr.mom'], ['Nostr Online','wss://relay.nostr.online'], ['Nostr Wine','wss://nostr.wine'], ['Nostr World','wss://relay.nostr.world'], ['Nostrich House','wss://relay.nostrich.house'], ['Nostromo','wss://relay.nostromo.social'], ['Nostrue','wss://nostrue.com'], ['Offchain','wss://offchain.pub'], ['Openhoofd','wss://strfry.openhoofd.nl'], ['Orangepill','wss://relay.orangepill.dev'], ['Plebs Town','wss://relay.plebs.town'], ['Plebstr','wss://plebstr.com'], ['Primal','wss://relay.primal.net'], ['Primal Premium','wss://premium.primal.net'], ['Purple Relay','wss://ch.purplerelay.com'], ['Purplepag.es','wss://purplepag.es'], ['Sathoarder','wss://nostr.sathoarder.com'], ['Satlantis','wss://relay.satlantis.io'], ['Satoshi Stream','wss://relay.satoshi.stream'], ['Schneimi','wss://nostr.schneimi.de'], ['Siamstr','wss://siamstr.com'], ['Snort','wss://relay.snort.social'], ['Stacker News','wss://relay.stacker.news'], ['Swiss Enigma','wss://nostr.swiss-enigma.ch'], ['The Dude','wss://relay.thedude.cloud'], ['Utxo One','wss://relay.utxo.one'], ['Vulpem','wss://nostr.vulpem.com'], ['Wellorder','wss://wellorder.net'], ['YakiHonne','wss://nostr-01.yakihonne.com'], ['Yakihonne','wss://relay.yakihonne.com'], ['Zap Band','wss://relay.zap.band'], ['Zapstore','wss://relay.zapstore.dev']]
const BS_NPUB_FALLBACK = '#404040'
const BS_TIP = 972231

/* ---------- small helpers ---------- */

const bsShort = (v) => `${v.slice(0, 12)}...${v.slice(-4)}`
const bsDate = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const bsDateShort = (ms) => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const bsSection = (...kids) => `<div class="bs-page">${ss.vstack({}, ...kids)}</div>`
const bsQr = (value, size = 250, tight) => `<div class="bs-qr"><div class="bs-qr-card${tight ? ' is-tight' : ''}">${ss.qr({ value, size })}</div></div>`
const bsMonoBox = (value, size = 'lg', extra = '') =>
  `<div class="bs-box${extra}">${ss.text({ type: 'mono', size, style: 'white-space:pre-wrap' }, ss.esc(value))}</div>`
// Fake "download"/"share": copies and confirms, since the browser has no native share sheet here.
const bsShareButton = (value) => ss.button({ variant: 'outline', label: t('common.share'), data: { 'ss-copy': value } })
const bsToast = (msg) => ss.toast(msg, document.getElementById('view-kit'))
const bsRerender = () => openKitScreen(kitCurrent)
// #kit-overlays persists across screens; swap in a fresh node so listeners never pile up.
function bsOverlays() {
  const old = document.getElementById('kit-overlays')
  const fresh = old.cloneNode(true)
  old.replaceWith(fresh)
  return fresh
}

/* ---------- birthday.tsx ---------- */

const BS_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const bsPicker = { y: 2024, m: 2, d: 12 }

function bsWheel(name, values, selected) {
  return `<div class="bs-wheel" data-wheel="${name}"><i></i>${values
    .map((v) => `<button type="button" data-v="${v[0]}"${v[0] === selected ? ' data-selected' : ''}>${v[1]}</button>`)
    .join('')}<i></i></div>`
}

registerScreen('account-birthday', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/birthday.tsx',
  title: () => t('account.birthdayDate.label').toUpperCase(),
  back: 'account-settings',
  render: () => {
    const st = bsState()
    const date = new Date(bsPicker.y, bsPicker.m, bsPicker.d)
    const isToday = date.toDateString() === new Date().toDateString()
    const years = []
    for (let y = 2009; y <= new Date().getFullYear(); y += 1) years.push([y, y])
    const days = []
    for (let d = 1; d <= new Date(bsPicker.y, bsPicker.m + 1, 0).getDate(); d += 1) days.push([d, d])
    const modeRow = ss.hstack({ gap: 'sm' },
      ss.radio({ variant: 'outline', label: t('account.birthdayDate.mode.date'), selected: st.birthdayMode === 'date', style: 'flex:1', data: { mode: 'date' } }),
      ss.radio({ variant: 'outline', label: t('account.birthdayDate.mode.block'), selected: st.birthdayMode === 'block', style: 'flex:1', data: { mode: 'block' } }))
    const body = st.birthdayMode === 'date'
      ? ss.vstack({ gap: 'md' },
          `<div class="bs-wheels">${bsWheel('m', BS_MONTHS.map((m, i) => [i, m]), bsPicker.m)}${bsWheel('d', days, bsPicker.d)}${bsWheel('y', years, bsPicker.y)}</div>`,
          ss.text({ center: true, color: 'muted', id: 'bs-bday-date' }, bsDate(date)),
          ss.button({ label: t('date.today'), variant: 'outline', disabled: isToday, id: 'bs-today' }),
          ss.button({ label: t('common.save'), variant: 'secondary', id: 'bs-save-date' }))
      : ss.vstack({ gap: 'md' },
          ss.text({ color: 'muted' }, t('account.birthdayDate.blockHelper')),
          ss.textInput({ placeholder: t('account.birthdayDate.blockPlaceholder'), inputMode: 'numeric', name: 'block', value: st.blockInput || '', className: 'bs-block-input' }),
          `<div id="bs-block-estimate">${bsBlockEstimate(st.blockInput)}</div>`,
          ss.text({ center: true, color: 'muted', size: 'xs' }, t('account.birthdayDate.currentTip', { tip: BS_TIP.toLocaleString('en-US') })),
          ss.button({ label: t('common.save'), variant: 'secondary', id: 'bs-save-block' }))
    return `<div style="padding:12px 0 24px">${ss.vstack({ gap: 'lg' },
      ss.text({ color: 'muted', center: true }, t('account.birthdayDate.pageHelper')),
      modeRow,
      body)}</div>`
  },
  bind: (body) => {
    const st = bsState()
    // Centre each wheel on its selected value.
    body.querySelectorAll('.bs-wheel').forEach((wheel) => {
      // bind() runs before the section is shown, so wait a frame for layout.
      const sel = wheel.querySelector('[data-selected]')
      if (sel) requestAnimationFrame(() => (wheel.scrollTop = sel.offsetTop - 77))
      let timer = 0
      wheel.addEventListener('scroll', () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          const idx = Math.round(wheel.scrollTop / 46)
          const btn = wheel.querySelectorAll('button')[idx]
          if (!btn) return
          const v = Number(btn.dataset.v)
          const key = wheel.dataset.wheel
          if (bsPicker[key] === v) return
          bsPicker[key] = v
          const max = new Date(bsPicker.y, bsPicker.m + 1, 0).getDate()
          if (bsPicker.d > max) bsPicker.d = max
          if (key !== 'd') bsRerender()
          else {
            body.querySelector('#bs-bday-date').textContent = bsDate(new Date(bsPicker.y, bsPicker.m, bsPicker.d))
            body.querySelector('#bs-today').disabled = new Date(bsPicker.y, bsPicker.m, bsPicker.d).toDateString() === new Date().toDateString()
          }
        }, 120)
      })
    })
    body.addEventListener('click', (e) => {
      const tap = e.target.closest('.bs-wheel button')
      if (tap) tap.closest('.bs-wheel').scrollTo({ top: tap.offsetTop - 77, behavior: 'smooth' })
      const mode = e.target.closest('[data-mode]')
      if (mode) {
        st.birthdayMode = mode.dataset.mode
        return bsRerender()
      }
      if (e.target.closest('#bs-today')) {
        const now = new Date()
        Object.assign(bsPicker, { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() })
        return bsRerender()
      }
      if (e.target.closest('#bs-save-date')) {
        st.birthday = { date: new Date(bsPicker.y, bsPicker.m, bsPicker.d).getTime() }
        bsToast(t('account.birthdayDate.rescanQueued'))
        setTimeout(() => go('account-settings'), 700)
      }
      if (e.target.closest('#bs-save-block')) {
        const input = body.querySelector('.bs-block-input')
        const v = Number(input.querySelector('input').value)
        if (!Number.isInteger(v) || v <= 0 || v > BS_TIP) {
          input.classList.add('is-invalid')
          if (!input.querySelector('.is-error')) input.insertAdjacentHTML('beforeend', `<p class="ss-input-note is-error">${t('account.birthdayDate.blockError')}</p>`)
          return
        }
        st.birthday = { date: bsBlockToDate(v).getTime(), block: v }
        bsToast(t('account.birthdayDate.rescanQueued'))
        setTimeout(() => go('account-settings'), 700)
      }
    })
    body.addEventListener('input', (e) => {
      if (!e.target.closest('.bs-block-input')) return
      st.blockInput = e.target.value
      const wrap = body.querySelector('.bs-block-input')
      wrap.classList.remove('is-invalid')
      wrap.querySelector('.is-error')?.remove()
      body.querySelector('#bs-block-estimate').innerHTML = bsBlockEstimate(e.target.value)
    })
  }
})

// ~10 minutes per block back from the tip.
function bsBlockToDate(height) {
  return new Date(Date.now() - (BS_TIP - height) * 600 * 1000)
}
function bsBlockEstimate(value) {
  const v = Number(value)
  if (!value || !Number.isInteger(v) || v <= 0 || v > BS_TIP) return ''
  return ss.text({ center: true, color: 'muted' }, t('account.birthdayDate.estimatedDate', { date: bsDate(bsBlockToDate(v)) }))
}

/* ---------- export/descriptor.tsx (per key) ---------- */

registerScreen('account-export-descriptor', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/export/descriptor.tsx',
  title: () => t('account.descriptor.title').toUpperCase(),
  back: 'account-settings',
  render: () => {
    const d = bsDescriptor(false)
    return bsSection(
      ss.text({ center: true, uppercase: true, color: 'muted' }, t('account.descriptor.title')),
      ss.vstack({ gap: 'sm', style: 'margin-bottom:20px' },
        ss.text({ center: true, color: 'muted' }, 'Key 1'),
        ss.text({ center: true, color: 'muted' }, t('account.descriptor.creationType', { type: 'generateMnemonic' })),
        ss.text({ center: true, color: 'muted' }, t('account.descriptor.scriptVersion', { version: bsKeys().script }))),
      bsQr(d),
      bsMonoBox(d),
      ss.clipboardCopy({ text: d }, ss.button({ label: t('common.copyToClipboard') })),
      ss.button({ label: t('common.downloadFile'), variant: 'secondary', data: { 'bs-download': 'descriptor.txt' } }),
      bsShareButton(d),
      ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'account-settings' }))
  },
  bind: bsBindDownload
})

function bsBindDownload(body) {
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bs-download]')
    if (b) bsToast(`${b.dataset.bsDownload} — ${t('common.download')}`)
  })
}

/* ---------- export/descriptors.tsx ---------- */

registerScreen('account-export-descriptors', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/export/descriptors.tsx',
  title: () => bsName().toUpperCase(),
  back: 'account-settings',
  render: () => {
    const st = bsState()
    const ext = bsDescriptor(false)
    const int = bsDescriptor(true)
    const together = `${ext}\n${int}`
    return `<div class="bs-page">${ss.vstack({ gap: 'lg' },
      ss.text({ center: true, uppercase: true, color: 'muted' }, t('account.export.descriptors')),
      ss.hstack({ gap: 'sm', justifyBetween: true },
        ss.radio({ variant: 'outline', label: 'Together', selected: !st.descriptorsSeparate, style: 'width:48%', data: { sep: '0' } }),
        ss.radio({ variant: 'outline', label: 'Separate', selected: st.descriptorsSeparate, style: 'width:48%', data: { sep: '1' } })),
      st.descriptorsSeparate
        ? ss.vstack({ gap: 'md' },
            [[ext, 'External'], [int, 'Internal']].map(([d, l]) =>
              ss.vstack({ itemsCenter: true, gap: 'none' },
                `<div class="bs-qr-card is-tight">${ss.qr({ value: d, size: 150 })}</div>`,
                ss.text({ color: 'muted', style: 'margin:8px 0' }, `${l} ${t('common.descriptor')}`),
                bsShareButton(d))))
        : bsQr(together, 250, true),
      bsMonoBox(together, 'md'),
      ss.clipboardCopy({ text: together }, ss.button({ label: t('common.copyToClipboard') })),
      ss.button({ label: t('account.export.descriptorsPDF'), variant: 'secondary', data: { 'bs-download': 'descriptors.pdf' } }),
      ss.button({ label: t('common.downloadFile'), variant: 'outline', data: { 'bs-download': 'descriptors.txt' } }),
      st.descriptorsSeparate ? '' : bsShareButton(together),
      ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'account-settings' }))}</div>`
  },
  bind: (body) => {
    bsBindDownload(body)
    body.addEventListener('click', (e) => {
      const sep = e.target.closest('[data-sep]')
      if (!sep) return
      bsState().descriptorsSeparate = sep.dataset.sep === '1'
      bsRerender()
    })
  }
})

/* ---------- export/labels.tsx ---------- */

registerScreen('account-export-labels', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/export/labels.tsx',
  title: () => bsName().toUpperCase(),
  back: 'account-settings',
  render: () => {
    const st = bsState()
    const content = bsLabels(st.labelFormat)
    return bsSection(
      ss.text({ center: true, uppercase: true, color: 'muted' }, t('account.export.labels')),
      `<div class="bs-filetypes">${['JSONL', 'JSON', 'CSV'].map((ext) => ss.checkbox({ label: ext, selected: st.labelFormat === ext, data: { ext } })).join('')}</div>`,
      bsMonoBox(content, 'sm', ' is-bordered'),
      ss.clipboardCopy({ text: content }, ss.button({ label: t('common.copyToClipboard') })),
      ss.button({ label: `${t('common.download')} ${st.labelFormat}`, variant: 'secondary', data: { 'bs-download': `labels.${st.labelFormat.toLowerCase()}` } }),
      ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'account-settings' }))
  },
  bind: (body) => {
    bsBindDownload(body)
    body.addEventListener('click', (e) => {
      const ext = e.target.closest('[data-ext]')
      if (!ext) return
      bsState().labelFormat = ext.dataset.ext
      bsRerender()
    })
  }
})

/* ---------- export/pubkeys.tsx ---------- */

registerScreen('account-export-pubkeys', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/export/pubkeys.tsx',
  title: () => bsName().toUpperCase(),
  back: 'account-settings',
  render: () => {
    const st = bsState()
    const k = bsKeys()
    const content = { xpub: k.xpub, zpub: k.zpub, vpub: k.vpub }[st.pubFormat]
    return bsSection(
      ss.text({ center: true, uppercase: true, color: 'muted' }, t('account.export.pubkeys')),
      ss.hstack({ gap: 'sm', style: 'gap:10px;justify-content:center' },
        ['xpub', 'zpub', 'vpub'].map((f) =>
          ss.button({ label: t(`account.export.${f}Format`), variant: st.pubFormat === f ? 'outline' : 'subtle', style: 'flex:1', data: { fmt: f } }))),
      bsQr(content),
      bsMonoBox(content),
      ss.clipboardCopy({ text: content }, ss.button({ label: t('common.copyToClipboard') })),
      ss.button({ label: t('common.downloadFile'), variant: 'secondary', data: { 'bs-download': `${st.pubFormat}.txt` } }),
      bsShareButton(content),
      ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'account-settings' }))
  },
  bind: (body) => {
    bsBindDownload(body)
    body.addEventListener('click', (e) => {
      const f = e.target.closest('[data-fmt]')
      if (!f) return
      bsState().pubFormat = f.dataset.fmt
      bsRerender()
    })
  }
})

/* ---------- export/publicKey.tsx (per key; P2WPKH on signet → tpub / vpub) ---------- */

registerScreen('account-export-public-key', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/export/publicKey.tsx',
  title: () => t('common.publicKeys'),
  back: 'account-settings',
  render: () => {
    const st = bsState()
    const k = bsKeys()
    const value = st.publicKeyFormat === 'tpub' ? k.tpub : k.vpub
    return bsSection(
      ss.text({ center: true, uppercase: true, color: 'muted' }, t('common.publicKeys')),
      ss.hstack({ gap: 'sm', style: 'justify-content:center' },
        ['tpub', 'vpub'].map((f) =>
          ss.button({ label: t(`account.seed.formatButtons.${f}`), variant: st.publicKeyFormat === f ? 'secondary' : 'default', style: 'flex:1', data: { fmt: f } }))),
      bsQr(value),
      bsMonoBox(value),
      ss.clipboardCopy({ text: value }, ss.button({ label: t('common.copyToClipboard') })),
      ss.button({ label: t('common.downloadFile'), variant: 'secondary', data: { 'bs-download': `${st.publicKeyFormat}.txt` } }),
      bsShareButton(value),
      ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'account-settings' }))
  },
  bind: (body) => {
    bsBindDownload(body)
    body.addEventListener('click', (e) => {
      const f = e.target.closest('[data-fmt]')
      if (!f) return
      bsState().publicKeyFormat = f.dataset.fmt
      bsRerender()
    })
  }
})

/* ---------- export/seedWords.tsx — PIN gated ---------- */

function bsPinPad(id) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']
  return ss.modal({ id, fullOpacity: true },
    ss.vstack({ gap: 'lg', itemsCenter: true, style: 'margin:auto 0' },
      ss.text({ uppercase: true, size: 'lg' }, t('account.enter.pin')),
      `<div class="bs-pin-dots" data-pin-dots>${'<i></i>'.repeat(4)}</div>`,
      ss.text({ color: 'muted', size: 'xs', center: true }, 'Demo: any 4 digits unlock'),
      `<div class="bs-pin-pad">${keys.map((k) => `<button type="button"${k ? ` data-pin="${k}"` : ' class="is-blank" tabindex="-1"'}>${k}</button>`).join('')}</div>`))
}

function bsBindPin(scope, onDone) {
  let entered = ''
  scope.addEventListener('click', (e) => {
    const k = e.target.closest('[data-pin]')
    if (!k) return
    entered = k.dataset.pin === '⌫' ? entered.slice(0, -1) : (entered + k.dataset.pin).slice(0, 4)
    scope.querySelectorAll('[data-pin-dots] i').forEach((dot, i) => dot.classList.toggle('is-on', i < entered.length))
    if (entered.length === 4) setTimeout(onDone, 150)
  })
}

registerScreen('account-export-seed-words', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/export/seedWords.tsx',
  title: () => `${t('account.seed.viewSeedWords')} - Key 1`.toUpperCase(),
  back: 'account-settings',
  render: () => {
    const st = bsState()
    if (bsAcct().watchOnly) {
      return `<div style="padding:16px">${ss.vstack({ itemsCenter: true, gap: 'lg' },
        ss.text({ center: true, color: 'muted' }, t('account.seed.noSeedAvailable')),
        ss.button({ label: t('common.back'), go: 'account-settings' }))}</div>`
    }
    if (!st.seedUnlocked) {
      return `<div style="padding:16px;display:flex;flex-direction:column;justify-content:center;min-height:60%">${ss.vstack({ itemsCenter: true, gap: 'lg' },
        ss.text({ center: true, color: 'muted' }, t('account.seed.enterPinToView')),
        ss.button({ label: t('account.enter.pin'), variant: 'outline', id: 'bs-open-pin' }))}</div>`
    }
    const per = Math.ceil(BS_SEED.length / 3)
    const cols = [0, 1, 2].map((c) =>
      `<div class="bs-seed-col">${BS_SEED.slice(c * per, c * per + per)
        .map((w, i) => `<div class="bs-word">${ss.text({ color: 'muted', as: 'span' }, String(c * per + i + 1).padStart(2, '0'))}${ss.text({ size: 'md', as: 'span' }, w)}</div>`)
        .join('')}</div>`)
    return `<div style="padding:16px">${ss.vstack({ gap: 'lg' },
      ss.vstack({ gap: 'md' },
        ss.text({ center: true, uppercase: true }, 'Key 1'),
        ss.text({ center: true, uppercase: true }, `${BS_SEED.length} ${t('account.mnemonic.title')} (english)`),
        ss.text({ center: true, uppercase: true, color: 'muted' }, t('account.seed.keepItSecret'))),
      `<div class="bs-seed-grid">${cols.join('')}</div>`,
      ss.vstack({ gap: 'sm', style: 'padding-top:32px' },
        ss.hstack({ gap: 'sm' },
          ss.button({ label: t('account.seed.seedqr.title'), variant: 'outline', style: 'flex:1', id: 'bs-seedqr' }),
          `<div style="flex:1">${ss.clipboardCopy({ text: BS_SEED.join(' ') }, ss.button({ label: t('common.copy'), variant: 'outline' }))}</div>`),
        ss.button({ label: t('common.back'), variant: 'ghost', go: 'account-settings' })))}</div>`
  },
  overlays: () =>
    bsPinPad('bs-pin') +
    ss.modal({ id: 'bs-seedqr-modal', fullOpacity: true, label: t('common.close') },
      ss.vstack({ gap: 'md', itemsCenter: true, style: 'margin:auto 0' },
        ss.text({ uppercase: true, center: true }, t('account.seed.qr.title')),
        `<div class="bs-qr-card">${ss.qr({ value: BS_SEED.map((w) => String(BIP39_DEMO_INDEX[w] || 0).padStart(4, '0')).join(''), size: 240 })}</div>`,
        ss.text({ color: 'muted', center: true }, t('account.seed.qr.description')))),
  bind: (body) => {
    const st = bsState()
    // SeedWords prompts for the PIN as soon as it opens (like the app).
    if (!st.seedUnlocked && !bsAcct().watchOnly) setTimeout(() => ss.open('bs-pin'), 50)
    body.addEventListener('click', (e) => {
      if (e.target.closest('#bs-open-pin')) ss.open('bs-pin')
      if (e.target.closest('#bs-seedqr')) ss.open('bs-seedqr-modal')
    })
    bsBindPin(bsOverlays(), () => {
      st.seedUnlocked = true
      bsRerender()
    })
  }
})

// SeedQR encodes each word as its 4-digit BIP39 index; these are the real indices of the demo words.
const BIP39_DEMO_INDEX = { abandon: 0, ability: 1, able: 2, about: 3, above: 4, absent: 5, absorb: 6, abstract: 7, absurd: 8, abuse: 9, access: 10, accident: 11 }

/* ---------- import/labels.tsx ---------- */

registerScreen('account-import-labels', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/import/labels.tsx',
  title: () => bsName().toUpperCase(),
  back: 'account-settings',
  render: () => {
    const st = bsState()
    const invalid = st.importContent && st.importInvalid
    return bsSection(
      ss.text({ center: true, uppercase: true, color: 'muted' }, t('account.import.labels')),
      `<div class="bs-filetypes">${['JSONL', 'JSON', 'CSV'].map((ext) => ss.checkbox({ label: ext, selected: st.importFormat === ext, data: { ext } })).join('')}</div>`,
      st.importContent ? bsMonoBox(st.importContent, 'sm', ` is-bordered${invalid ? ' is-invalid' : ''}`) : '',
      invalid ? ss.text({ size: 'xs', style: 'color:var(--error)' }, t('account.import.labelsInvalidFormat')) : '',
      st.importContent && !invalid
        ? ss.vstack({ gap: 'sm' },
            ss.button({ label: t('common.import'), variant: 'secondary', id: 'bs-import' }),
            ss.button({ label: t('common.cancel'), variant: 'ghost', id: 'bs-import-clear' }))
        : ss.vstack({ gap: 'sm' },
            ss.button({ label: t('common.pasteFromClipboard'), id: 'bs-import-paste' }),
            ss.button({ label: t('import.from', { name: st.importFormat }), variant: 'secondary', id: 'bs-import-file' }),
            ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'account-settings' })))
  },
  overlays: () =>
    ss.modal({ id: 'bs-import-done', fullOpacity: true, showLabel: false },
      ss.vstack({ gap: 'lg', style: 'margin:auto 0;width:100%' },
        ss.text({ uppercase: true, size: 'md', center: true, weight: 'bold' }, t('import.success', { importCount: 3, total: 3 })),
        ss.button({ label: t('common.close'), go: 'account-settings' }))),
  bind: (body) => {
    const st = bsState()
    body.addEventListener('click', (e) => {
      const ext = e.target.closest('[data-ext]')
      if (ext) {
        st.importFormat = ext.dataset.ext
        if (st.importContent) st.importContent = bsLabels(st.importFormat)
        return bsRerender()
      }
      if (e.target.closest('#bs-import-paste') || e.target.closest('#bs-import-file')) {
        st.importContent = bsLabels(st.importFormat)
        st.importInvalid = false
        return bsRerender()
      }
      if (e.target.closest('#bs-import-clear')) {
        st.importContent = ''
        return bsRerender()
      }
      if (e.target.closest('#bs-import')) {
        st.importContent = ''
        ss.open('bs-import-done')
      }
    })
  }
})

/* ---------- manageAddresses.tsx (watch-only address accounts) ---------- */

function bsAddressCard(a, index, canDelete) {
  const tl = (k, v) => t('account.settings.manageAddresses.' + k, v)
  return `<div class="bs-addr">${ss.vstack({ gap: 'sm' },
    ss.hstack({ justifyBetween: true },
      ss.text({ uppercase: true, weight: 'bold' }, a.new ? tl('addressIndexNew', { index }) : tl('addressIndex', { index })),
      `<div class="bs-addr-actions"><button type="button" data-view-addr="${a.address}" aria-label="View">${ss.icon('eyeOn', { size: 16 })}</button>${
        canDelete ? `<button type="button" data-del-addr="${a.address}" aria-label="Delete">${ss.icon('trash', { size: 16 })}</button>` : ''
      }</div>`),
    ss.addressDisplay({ address: a.address }),
    a.new
      ? ''
      : ss.detailsList({
          columns: 2,
          items: [
            [tl('summary.balance'), a.summary.balance.toLocaleString('en-US')],
            [tl('summary.balanceUncofirmed'), a.summary.satsInMempool.toLocaleString('en-US')],
            [tl('summary.tx'), a.summary.transactions],
            [tl('summary.utxo'), a.summary.utxos],
            [t('common.label'), a.label, { width: '100%' }]
          ]
        }))}</div>`
}

registerScreen('account-manage-addresses', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/manageAddresses.tsx',
  title: () => bsName().toUpperCase(),
  back: 'account-settings',
  render: () => {
    const st = bsState()
    const draft = st.addressDraft || (st.addressDraft = st.addresses.map((a) => ({ ...a })))
    return ss.vstack({ justifyBetween: true, style: 'padding-bottom:24px' },
      ss.vstack({},
        ss.text({ uppercase: true, size: 'lg', weight: 'bold', center: true }, t('account.settings.manageAddresses.title')),
        draft.map((a, i) => bsAddressCard(a, i, draft.length > 2)).join('')),
      ss.vstack({ gap: 'sm' },
        ss.button({ label: t('account.settings.manageAddresses.addBtn'), variant: 'outline', id: 'bs-add-addr' }),
        ss.button({ label: t('common.save'), variant: 'secondary', disabled: draft.length < 2, id: 'bs-save-addr' })))
  },
  overlays: () =>
    ss.modal({ id: 'bs-add-addr-modal', fullOpacity: true, showLabel: false },
      ss.vstack({ gap: 'lg', widthFull: true, style: 'margin:auto 0' },
        ss.textInput({ placeholder: t('account.settings.manageAddresses.addInputPlaceholder'), multiline: true, align: 'left', className: 'bs-addr-input' }),
        ss.vstack({ gap: 'sm' },
          ss.button({ label: t('common.save'), variant: 'secondary', id: 'bs-add-addr-save' }),
          ss.button({ label: t('common.cancel'), variant: 'ghost', data: { 'ss-close': '' } })))) +
    ss.modal({ id: 'bs-del-addr-modal', fullOpacity: true, showLabel: false },
      ss.vstack({ gap: 'lg', widthFull: true, style: 'margin:auto 0' },
        ss.text({ size: 'lg', center: true }, t('account.settings.manageAddresses.deleteWarn')),
        '<div id="bs-del-addr-target"></div>',
        ss.vstack({ gap: 'sm' },
          ss.button({ label: t('common.yes'), variant: 'outline', id: 'bs-del-addr-yes' }),
          ss.button({ label: t('common.no'), variant: 'danger', data: { 'ss-close': '' } })))),
  bind: (body) => {
    const st = bsState()
    const overlays = bsOverlays()
    let pending = ''
    body.addEventListener('click', (e) => {
      if (e.target.closest('#bs-add-addr')) {
        overlays.querySelector('.bs-addr-input textarea').value = ''
        ss.open('bs-add-addr-modal')
      }
      const view = e.target.closest('[data-view-addr]')
      if (view) {
        if (kitScreens['explorer-address-detail']) go('explorer-address-detail')
        else bsToast(ss.shortId(view.dataset.viewAddr))
      }
      const del = e.target.closest('[data-del-addr]')
      if (del) {
        pending = del.dataset.delAddr
        overlays.querySelector('#bs-del-addr-target').innerHTML = ss.addressDisplay({ address: pending, variant: 'bare', copyToClipboard: false })
        ss.open('bs-del-addr-modal')
      }
      if (e.target.closest('#bs-save-addr')) {
        st.addresses = st.addressDraft.map((a) => ({ ...a, new: false }))
        st.addressDraft = null
        go('account-settings')
      }
    })
    overlays.addEventListener('click', (e) => {
      if (e.target.closest('#bs-add-addr-save')) {
        const value = overlays.querySelector('.bs-addr-input textarea').value.trim()
        if (!/^(bc1|tb1|[13mn2])[a-zA-HJ-NP-Z0-9]{20,}$/.test(value)) return bsToast(t('account.settings.manageAddresses.error.invalid'))
        if (st.addressDraft.some((a) => a.address === value)) return bsToast(t('account.settings.manageAddresses.error.duplicated'))
        st.addressDraft.push({ address: value, label: '', new: true, summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 } })
        bsRerender()
      }
      if (e.target.closest('#bs-del-addr-yes')) {
        st.addressDraft = st.addressDraft.filter((a) => a.address !== pending)
        bsRerender()
      }
    })
  }
})

/* ---------- nostr/index.tsx ---------- */

const bsTn = (k, v) => t('account.nostrSync.' + k, v)

function bsMemberName(m) {
  const title = m.displayName || m.alias
  if (!title) return ss.text({ type: 'mono', size: 'sm' }, bsShort(m.npub))
  return ss.vstack({ gap: 'xxs' },
    ss.hstack({ gap: 'xxs' }, ss.text({ size: 'sm' }, ss.esc(title)), m.displayName && m.alias ? ss.text({ color: 'muted' }, `(${ss.esc(m.alias)})`) : ''),
    ss.text({ type: 'mono', color: 'muted' }, bsShort(m.npub)))
}

registerScreen('account-nostr', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/nostr/index.tsx',
  title: () => bsName().toUpperCase(),
  back: 'account-settings',
  render: () => {
    const n = bsState().nostr
    const syncing = n.syncing
    const relayStatus = (url) => (n.autoSync ? (url === n.relays[2] && syncing ? 'connecting' : 'connected') : 'disconnected')
    const statusInfo = {
      connected: ['var(--main-green)', bsTn('relayStatusConnected')],
      connecting: ['var(--warning)', bsTn('relayStatusConnecting')],
      disconnected: ['var(--main-red)', bsTn('relayStatusDisconnected')]
    }
    return `<div style="padding:10px 0 20px">${ss.vstack({ gap: 'lg' },
      ss.text({ center: true, uppercase: true, color: 'muted' }, bsTn('title')),
      ss.vstack({ gap: 'md' },
        ss.button({
          variant: n.autoSync ? 'danger' : 'secondary',
          label: n.autoSync ? 'Turn sync OFF' : 'Turn sync ON',
          disabled: syncing || (!n.autoSync && n.relays.length === 0),
          id: 'bs-sync-toggle'
        }),
        !n.autoSync && n.relays.length === 0 ? ss.text({ color: 'muted', center: true }, bsTn('noRelaysWarning')) : '',
        syncing
          ? ss.hstack({ gap: 'sm', style: 'justify-content:center' }, '<span class="ss-spinner"></span>', ss.text({ color: 'muted' }, bsTn('syncingFetching')))
          : ss.hstack({ gap: 'sm', style: 'justify-content:center' }, ss.text({ color: 'muted' }, `Last sync: ${n.lastSync ? bsDateShort(n.lastSync) : 'Never'}`)),
        ss.button({ label: bsTn('manageRelays', { count: n.relays.length }), go: 'account-nostr-relays', disabled: syncing }),
        n.relays.length === 0 && n.autoSync ? ss.text({ weight: 'bold', center: true }, bsTn('noRelaysWarning')) : '',
        ss.vstack({ gap: 'sm' },
          ss.text({ center: true }, bsTn('deviceKeys')),
          `<div class="bs-keys">${
            n.deviceNpub
              ? ss.vstack({ gap: 'xxs' },
                  n.kind0 && n.kind0.displayName ? ss.text({ center: true, size: 'lg' }, ss.esc(n.kind0.displayName)) : '',
                  ss.text({ color: 'muted', center: true }, bsTn('npub')),
                  ss.hstack({ gap: 'xs', className: 'bs-npub-row' },
                    '<span class="bs-dot" style="background:#E05D5D"></span>',
                    ss.clipboardCopy({ text: n.deviceNpub }, `<span class="bs-mono-xl">${bsShort(n.deviceNpub)}</span>`)))
              : ss.text({ center: true, color: 'muted' }, bsTn('noNsec'))
          }</div>`),
        n.deviceNpub ? '' : ss.button({ label: bsTn('createNewKey'), id: 'bs-create-key', disabled: syncing }),
        ss.button({ label: bsTn('setKeys'), go: 'account-nostr-key', disabled: syncing }),
        ss.button({ variant: 'secondary', label: bsTn('devicesGroupChat.title'), go: 'account-nostr-group-chat', disabled: syncing, style: 'margin:30px 0 10px' }),
        ss.vstack({ gap: 'sm' },
          ss.text({ center: true }, bsTn('members')),
          n.members.length
            ? `<div class="bs-members">${ss.vstack({ gap: 'md' },
                n.members.map((m) =>
                  ss.hstack({ gap: 'md' },
                    `<button type="button" class="bs-member" data-member="${m.npub}"${syncing ? ' disabled' : ''}>${ss.hstack({ gap: 'sm' },
                      `<span class="bs-avatar" style="background:${m.color || BS_NPUB_FALLBACK}"></span>`,
                      bsMemberName(m))}</button>`,
                    `<div class="bs-member-trust">${ss.button({
                      variant: n.trusted.has(m.npub) ? 'danger' : 'outline',
                      label: n.trusted.has(m.npub) ? 'Distrust' : 'Trust',
                      disabled: syncing,
                      data: { trust: m.npub }
                    })}</div>`)))}</div>`
            : ss.text({ center: true, color: 'muted' }, bsTn('noMembers'))),
        n.relays.length
          ? ss.vstack({ gap: 'sm' },
              ss.text({ center: true }, bsTn('relayStatus')),
              `<div class="bs-relays">${ss.vstack({ gap: 'sm' },
                n.relays.map((url) => {
                  const [color, label] = statusInfo[relayStatus(url)]
                  return ss.hstack({ gap: 'sm', style: 'padding:4px 0' },
                    `<span class="bs-dot is-small" style="background:${color};margin-right:8px"></span>`,
                    ss.text({ style: 'flex:1' }, url),
                    ss.text({ style: `color:${color}` }, label))
                }))}</div>`)
          : ''),
      ss.button({ label: bsTn('clearCaches'), variant: 'subtle', style: 'margin-top:30px', id: 'bs-clear-caches' }),
      ss.button({ label: bsTn('requestToDeletion'), variant: 'subtle', style: 'margin:12px 0 20px', disabled: syncing, id: 'bs-request-deletion' }))}</div>`
  },
  overlays: () =>
    ss.modal({ id: 'bs-deletion', fullOpacity: true, label: t('common.cancel') },
      ss.vstack({ gap: 'lg', style: 'padding:8px 0;margin:auto 0' },
        ss.text({ center: true }, bsTn('deletionModalMessage', { count: 42 })),
        ss.vstack({ gap: 'xs', itemsCenter: true }, ss.icon('warning', { size: 20 }), ss.text({ center: true, color: 'muted' }, bsTn('deletionModalRelayWarning'))),
        ss.text({ center: true, weight: 'bold' }, bsTn('deletionModalActionsPrompt')),
        ss.vstack({ gap: 'sm' },
          ss.button({ label: bsTn('backupEvents'), variant: 'secondary', id: 'bs-backup-events' }),
          ss.button({ label: bsTn('requestDeletionConfirm'), variant: 'danger', id: 'bs-confirm-deletion' })))) +
    ss.modal({ id: 'bs-clear', fullOpacity: true, label: t('common.cancel') },
      ss.vstack({ gap: 'lg', style: 'padding:8px 0;margin:auto 0' },
        ss.vstack({ gap: 'xs', itemsCenter: true }, ss.icon('warning', { size: 20 }), ss.text({ center: true, color: 'muted' }, bsTn('clearCachesModalMessage'))),
        ss.button({ label: bsTn('clearCachesConfirm'), variant: 'danger', id: 'bs-confirm-clear' }))) +
    ss.modal({ id: 'bs-trust', fullOpacity: true, showLabel: false },
      ss.vstack({ gap: 'lg', style: 'margin:auto 0;width:100%' },
        ss.text({ center: true, style: 'white-space:pre-line' }, bsTn('memberConfirmNew')),
        ss.vstack({ gap: 'sm' },
          ss.button({ label: 'Trust', variant: 'secondary', id: 'bs-trust-yes' }),
          ss.button({ label: t('common.cancel'), variant: 'ghost', data: { 'ss-close': '' } })))),
  bind: (body) => {
    const n = bsState().nostr
    const overlays = bsOverlays()
    let pendingTrust = ''
    body.addEventListener('click', (e) => {
      if (e.target.closest('#bs-sync-toggle')) {
        n.autoSync = !n.autoSync
        if (n.autoSync) {
          n.syncing = true
          setTimeout(() => {
            n.syncing = false
            n.lastSync = Date.now()
            if (kitCurrent === 'account-nostr') bsRerender()
          }, 1400)
        }
        return bsRerender()
      }
      if (e.target.closest('#bs-create-key')) {
        n.deviceNpub = 'npub1s8gx3r0d6m4kpz2wq9cl7yv5ht3nf8ue6aj0rxk2ds4gq7vz5mfqh2l9wc'
        return bsRerender()
      }
      const member = e.target.closest('[data-member]')
      if (member) {
        bsState().selectedNpub = member.dataset.member
        return go('account-nostr-device')
      }
      const trust = e.target.closest('[data-trust]')
      if (trust) {
        if (n.trusted.has(trust.dataset.trust)) {
          n.trusted.delete(trust.dataset.trust)
          bsToast(bsTn('deviceDistrusted'))
          return bsRerender()
        }
        pendingTrust = trust.dataset.trust
        ss.open('bs-trust')
      }
      if (e.target.closest('#bs-clear-caches')) ss.open('bs-clear')
      if (e.target.closest('#bs-request-deletion')) ss.open('bs-deletion')
    })
    overlays.addEventListener('click', (e) => {
      if (e.target.closest('#bs-trust-yes')) {
        n.trusted.add(pendingTrust)
        bsToast(bsTn('deviceTrusted'))
        bsRerender()
      }
      if (e.target.closest('#bs-backup-events')) bsToast(bsTn('backupSuccess'))
      if (e.target.closest('#bs-confirm-deletion')) {
        ss.close('bs-deletion')
        bsToast(bsTn('deletionSuccess'))
      }
      if (e.target.closest('#bs-confirm-clear')) {
        Object.assign(n, { autoSync: false, relays: [], kind0: null, messages: [], trusted: new Set(), lastSync: 0 })
        bsToast(bsTn('clearCachesSuccess'))
        bsRerender()
      }
    })
  }
})

/* ---------- nostr/nostrKey.tsx ---------- */

registerScreen('account-nostr-key', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/nostr/nostrKey.tsx',
  title: () => bsName().toUpperCase(),
  back: 'account-nostr',
  render: () => {
    const n = bsState().nostr
    const ui = n.keyUi || (n.keyUi = { commonRevealed: false, nsecRevealed: false, seedRevealed: false, nsecDraft: n.deviceNsec })
    const eye = (on) => ss.icon(on ? 'eyeOn' : 'eyeOff', { size: 18 })
    return `<div style="padding:10px 0 20px">${ss.vstack({ gap: 'lg' },
      ss.vstack({ gap: 'sm' },
        ss.text({ center: true }, bsTn('commonNostrKeys')),
        `<div class="bs-keys">${ss.vstack({ gap: 'xxs' },
          ss.text({ color: 'muted', center: true }, bsTn('nsec')),
          ui.commonRevealed
            ? ss.clipboardCopy({ text: n.commonNsec }, `<p class="ss-text is-center bs-mono-xl">${bsShort(n.commonNsec)}</p>`) +
                `<button type="button" class="bs-reveal" data-reveal="common">${eye(true)}${ss.text({ color: 'muted', as: 'span' }, bsTn('hideNsec'))}</button>`
            : `<button type="button" class="bs-reveal" data-reveal="common"><span class="bs-mono-xl">••••••••••••••••</span>${eye(false)}</button>`,
          ss.text({ color: 'muted', center: true }, bsTn('npub')),
          ss.clipboardCopy({ text: n.commonNpub }, `<p class="ss-text is-center bs-mono-xl">${bsShort(n.commonNpub)}</p>`))}</div>`),
      ss.vstack({ gap: 'sm' },
        ss.text({ center: true }, bsTn('deviceKeys')),
        `<div class="bs-keys">${ss.vstack({ gap: 'xxs' },
          n.kind0 && n.kind0.displayName
            ? ss.vstack({ gap: 'xs' }, '<span class="bs-avatar is-large" style="background:#E05D5D"></span>', ss.text({ center: true, size: 'lg' }, ss.esc(n.kind0.displayName)))
            : '',
          ss.text({ color: 'muted', center: true }, bsTn('npub')),
          n.deviceNpub
            ? ss.hstack({ gap: 'xs', className: 'bs-npub-row' }, '<span class="bs-dot" style="background:#E05D5D"></span>',
                ss.clipboardCopy({ text: n.deviceNpub }, `<span class="bs-mono-xl">${bsShort(n.deviceNpub)}</span>`))
            : ss.text({ center: true, color: 'muted' }, bsTn('npubPlaceholder')),
          n.deviceNpub
            ? ss.vstack({ gap: 'sm', style: 'margin-top:8px' },
                ss.button({ label: t('common.showQR'), data: { qr: 'npub' } }),
                ss.hstack({ gap: 'sm' },
                  ss.button({ label: bsTn('clearKind0'), disabled: !(n.kind0 && n.kind0.displayName), style: 'flex:1', id: 'bs-clear-kind0' }),
                  ss.button({ variant: 'secondary', label: bsTn('fetchKind0'), style: 'flex:1', id: 'bs-fetch-kind0' })))
            : '',
          n.fetchingKind0 ? ss.hstack({ gap: 'sm', style: 'justify-content:center' }, '<span class="ss-spinner"></span>', ss.text({ color: 'muted' }, bsTn('fetchKind0Loading'))) : '')}</div>`,
        ss.vstack({ gap: 'xxs' },
          ss.text({ color: 'muted', center: true }, bsTn('nsec')),
          ui.nsecRevealed
            ? ss.vstack({ gap: 'xs' },
                ss.textInput({ multiline: true, mono: true, align: 'left', value: ui.nsecDraft, placeholder: bsTn('nsec'), className: 'bs-nsec-input' }),
                ui.nsecDraft
                  ? ss.hstack({ gap: 'sm' },
                      ss.button({ label: t('common.showQR'), style: 'flex:1', data: { qr: 'nsec' } }),
                      ss.button({ label: ui.seedRevealed ? bsTn('hideSeed') : bsTn('showSeed'), style: 'flex:1', id: 'bs-toggle-seed' }))
                  : '',
                ui.seedRevealed
                  ? ss.vstack({ gap: 'xs' },
                      ss.text({ color: 'muted', center: true }, bsTn('seedWords')),
                      ss.text({ center: true, type: 'mono' }, 'zoo zone zero youth yellow year wrist wrong write world worth wood'),
                      ss.button({ variant: 'secondary', label: t('account.seed.seedqr.title'), data: { qr: 'seed' } }))
                  : '',
                `<button type="button" class="bs-reveal" data-reveal="nsec">${eye(true)}${ss.text({ color: 'muted', as: 'span' }, bsTn('hideNsec'))}</button>`,
                ss.hstack({ gap: 'md' },
                  ss.button({ variant: 'danger', label: t('common.clear'), style: 'flex:1', id: 'bs-nsec-clear' }),
                  ss.button({ variant: 'secondary', label: t('common.paste'), style: 'flex:1', id: 'bs-nsec-paste' })))
            : `<button type="button" class="bs-reveal" data-reveal="nsec"><span class="bs-mono-xl">••••••••••••••••</span>${eye(false)}</button>`)),
      ss.button({ variant: 'secondary', label: bsTn('newNsec'), id: 'bs-new-nsec' }),
      ss.button({ label: bsTn('save'), id: 'bs-save-keys' }),
      ss.button({ variant: 'ghost', label: t('common.cancel'), go: 'account-nostr' }))}</div>`
  },
  overlays: () =>
    ss.modal({ id: 'bs-key-qr', fullOpacity: true, label: t('common.cancel') },
      ss.vstack({ gap: 'lg', itemsCenter: true, style: 'margin:auto 0' }, '<div id="bs-key-qr-body"></div>')),
  bind: (body) => {
    const n = bsState().nostr
    const ui = n.keyUi
    const overlays = bsOverlays()
    body.addEventListener('input', (e) => {
      if (e.target.closest('.bs-nsec-input')) ui.nsecDraft = e.target.value
    })
    body.addEventListener('click', (e) => {
      const reveal = e.target.closest('[data-reveal]')
      if (reveal) {
        if (reveal.dataset.reveal === 'common') ui.commonRevealed = !ui.commonRevealed
        else ui.nsecRevealed = !ui.nsecRevealed
        return bsRerender()
      }
      const qr = e.target.closest('[data-qr]')
      if (qr) {
        const kind = qr.dataset.qr
        const value = kind === 'npub' ? n.deviceNpub : kind === 'nsec' ? ui.nsecDraft : 'zoo zone zero youth yellow year wrist wrong write world worth wood'
        overlays.querySelector('#bs-key-qr-body').innerHTML = ss.vstack({ gap: 'md', itemsCenter: true },
          ss.text({ center: true, uppercase: true }, kind === 'seed' ? bsTn('seedWords') : bsTn(kind)),
          `<div class="bs-qr-card">${ss.qr({ value, size: 240 })}</div>`,
          ss.text({ type: 'mono', size: 'xs', color: 'muted', center: true, style: 'word-break:break-all;max-width:280px' }, ss.esc(value)))
        ss.open('bs-key-qr')
      }
      if (e.target.closest('#bs-toggle-seed')) {
        ui.seedRevealed = !ui.seedRevealed
        return bsRerender()
      }
      if (e.target.closest('#bs-nsec-clear')) {
        ui.nsecDraft = ''
        return bsRerender()
      }
      if (e.target.closest('#bs-nsec-paste') || e.target.closest('#bs-new-nsec')) {
        ui.nsecDraft = 'nsec1new0demo' + Math.random().toString(36).slice(2, 12) + 'q8w7e6r5t4y3u2i1o0p9a8s7d6f5g4h3j2k1lz'
        ui.nsecRevealed = true
        return bsRerender()
      }
      if (e.target.closest('#bs-clear-kind0')) {
        n.kind0 = null
        bsToast(bsTn('clearKind0Success'))
        return bsRerender()
      }
      if (e.target.closest('#bs-fetch-kind0')) {
        n.fetchingKind0 = true
        bsRerender()
        setTimeout(() => {
          n.fetchingKind0 = false
          n.kind0 = { displayName: 'Satoshi’s laptop' }
          bsToast(bsTn('fetchKind0Success'))
          if (kitCurrent === 'account-nostr-key') bsRerender()
        }, 900)
      }
      if (e.target.closest('#bs-save-keys')) {
        if (ui.nsecDraft && !/^nsec1[a-z0-9]{20,}$/.test(ui.nsecDraft.trim())) return bsToast(bsTn('invalidDeviceNsec'))
        n.deviceNsec = ui.nsecDraft
        if (!n.deviceNsec) n.deviceNpub = ''
        n.keyUi = null
        bsToast(bsTn('keysSaved'))
        go('account-nostr')
      }
    })
  }
})

/* ---------- nostr/device/[npub].tsx ---------- */

registerScreen('account-nostr-device', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/nostr/device/[npub].tsx',
  title: () => bsName().toUpperCase(),
  back: () => bsState().deviceBack || 'account-nostr',
  render: () => {
    const st = bsState()
    const n = st.nostr
    const m = n.members.find((x) => x.npub === st.selectedNpub) || n.members[0]
    st.selectedNpub = m.npub
    if (st.aliasDraft === undefined || st.aliasFor !== m.npub) {
      st.aliasDraft = m.alias || ''
      st.aliasFor = m.npub
    }
    const trusted = n.trusted.has(m.npub)
    return `<div style="padding:10px 0 20px">${ss.vstack({ gap: 'lg' },
      ss.vstack({ gap: 'sm' },
        m.displayName ? ss.vstack({ gap: 'xs' }, `<span class="bs-avatar is-large" style="background:${m.color}"></span>`, ss.text({ center: true, size: 'lg' }, ss.esc(m.displayName))) : '',
        ss.text({ center: true, color: 'muted' }, bsTn('npub')),
        ss.hstack({ gap: 'xxs', className: 'bs-npub-row' }, `<span class="bs-dot" style="background:${m.color || BS_NPUB_FALLBACK}"></span>`,
          ss.clipboardCopy({ text: m.npub }, `<span class="bs-mono-xl">${bsShort(m.npub)}</span>`)),
        ss.hstack({ gap: 'md' },
          ss.button({ variant: 'subtle', label: bsTn('clearKind0'), disabled: !m.displayName, style: 'flex:1', id: 'bs-dev-clear-kind0' }),
          ss.button({ label: bsTn('fetchKind0'), style: 'flex:1', id: 'bs-dev-fetch-kind0', disabled: !!st.devFetching })),
        st.devFetching ? ss.hstack({ gap: 'sm', style: 'justify-content:center' }, '<span class="ss-spinner"></span>', ss.text({ color: 'muted' }, bsTn('fetchKind0Loading'))) : ''),
      ss.vstack({ gap: 'sm' },
        ss.text({ center: true, color: 'muted' }, bsTn('deviceAlias.alias')),
        ss.textInput({ value: st.aliasDraft, placeholder: bsTn('deviceAlias.aliasPlaceholder'), className: 'bs-alias' })),
      ss.hstack({ gap: 'md' },
        ss.button({ variant: 'subtle', label: t('common.clear'), disabled: !st.aliasDraft.trim(), style: 'flex:1', id: 'bs-alias-clear' }),
        ss.button({ variant: 'secondary', label: bsTn('save'), disabled: st.aliasDraft.trim() === (m.alias || '').trim(), style: 'flex:1', id: 'bs-alias-save' })),
      ss.button({ label: trusted ? 'Distrust' : 'Trust', variant: trusted ? 'danger' : 'outline', id: 'bs-dev-trust' }),
      ss.button({ variant: 'ghost', label: t('common.cancel'), id: 'bs-dev-cancel' }))}</div>`
  },
  bind: (body) => {
    const st = bsState()
    const n = st.nostr
    const m = n.members.find((x) => x.npub === st.selectedNpub)
    body.addEventListener('input', (e) => {
      if (!e.target.closest('.bs-alias')) return
      st.aliasDraft = e.target.value
      body.querySelector('#bs-alias-clear').disabled = !st.aliasDraft.trim()
      body.querySelector('#bs-alias-save').disabled = st.aliasDraft.trim() === (m.alias || '').trim()
    })
    body.addEventListener('click', (e) => {
      if (e.target.closest('#bs-alias-clear')) {
        st.aliasDraft = ''
        return bsRerender()
      }
      if (e.target.closest('#bs-alias-save')) {
        m.alias = st.aliasDraft.trim()
        bsToast(bsTn('deviceAlias.aliasSaved'))
        return bsRerender()
      }
      if (e.target.closest('#bs-dev-clear-kind0')) {
        m.displayName = ''
        bsToast(bsTn('clearKind0Success'))
        return bsRerender()
      }
      if (e.target.closest('#bs-dev-fetch-kind0')) {
        st.devFetching = true
        bsRerender()
        setTimeout(() => {
          st.devFetching = false
          m.displayName = m.displayName || 'Hardware signer'
          bsToast(bsTn('fetchKind0Success'))
          if (kitCurrent === 'account-nostr-device') bsRerender()
        }, 900)
      }
      if (e.target.closest('#bs-dev-trust')) {
        if (n.trusted.has(m.npub)) {
          n.trusted.delete(m.npub)
          bsToast(bsTn('deviceDistrusted'))
        } else {
          n.trusted.add(m.npub)
          bsToast(bsTn('deviceTrusted'))
        }
        return bsRerender()
      }
      if (e.target.closest('#bs-dev-cancel')) go(st.deviceBack || 'account-nostr')
    })
  }
})

/* ---------- nostr/devicesGroupChat.tsx ---------- */

function bsMessage(msg, n) {
  const mine = msg.from === 'self'
  const m = mine ? { npub: n.deviceNpub, color: '#E05D5D', displayName: n.kind0 && n.kind0.displayName, alias: '' } : n.members.find((x) => x.npub === msg.from) || { npub: msg.from, color: BS_NPUB_FALLBACK }
  const name = m.displayName || m.alias
  return `<div class="bs-msg${mine ? ' is-mine' : ''}">${ss.vstack({ gap: 'xxs' },
    ss.hstack({ gap: 'xxs', justifyBetween: true, style: 'align-items:flex-start' },
      `<button type="button" class="bs-msg-author"${mine ? '' : ` data-author="${m.npub}"`}>${ss.hstack({ gap: 'xxs' },
        `<span class="bs-dot" style="background:${m.color}"></span>`,
        ss.vstack({ gap: 'none' },
          ss.hstack({ gap: 'xxs' },
            name ? ss.text({ size: 'sm' }, ss.esc(name)) : ss.text({ color: 'muted' }, bsShort(m.npub || 'npub1')),
            mine ? ss.text({ color: 'muted' }, bsTn('devicesGroupChat.youSuffix').trim()) : ''),
          name ? ss.text({ size: 'xs', color: 'muted' }, bsShort(m.npub || 'npub1')) : ''))}</button>`,
      ss.hstack({ gap: 'xs' },
        ss.text({ size: 'xs', color: 'muted' }, bsDateShort(msg.at)),
        msg.pending ? ss.text({ size: 'xs', color: 'muted' }, bsTn('devicesGroupChat.sending')) : '')),
    ss.text({ size: 'md', style: 'margin-top:4px' }, ss.esc(msg.text)))}</div>`
}

registerScreen('account-nostr-group-chat', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/nostr/devicesGroupChat.tsx',
  title: () => bsName().toUpperCase(),
  back: 'account-nostr',
  render: () => {
    const n = bsState().nostr
    return `<div class="bs-chat">${ss.vstack({ gap: 'sm', style: 'flex:1;min-height:0' },
      ss.text({ center: true, uppercase: true, color: 'muted' },
        bsTn('devicesGroupChat.title') + (n.autoSync ? bsTn('devicesGroupChat.syncOn') : bsTn('devicesGroupChat.syncOff'))),
      `<div class="bs-chat-list" id="bs-chat-list">${
        n.messages.length ? n.messages.map((m) => bsMessage(m, n)).join('') : ss.text({ center: true, color: 'muted' }, bsTn('devicesGroupChat.noMessages'))
      }</div>`,
      `<div class="bs-chat-input"><textarea rows="1" maxlength="500" placeholder="${ss.esc(bsTn('devicesGroupChat.messagePlaceholder'))}"></textarea>${ss.button({
        label: bsTn('devicesGroupChat.sendButton'),
        disabled: true,
        id: 'bs-chat-send',
        uppercase: false
      })}</div>`)}</div>`
  },
  bind: (body) => {
    const st = bsState()
    const n = st.nostr
    const list = body.querySelector('#bs-chat-list')
    list.scrollTop = list.scrollHeight
    const input = body.querySelector('textarea')
    const send = body.querySelector('#bs-chat-send')
    input.addEventListener('input', () => (send.disabled = !input.value.trim()))
    const submit = () => {
      const text = input.value.trim()
      if (!text) return
      const msg = { from: 'self', text, at: Date.now(), pending: true }
      n.messages.push(msg)
      bsRerender()
      setTimeout(() => {
        msg.pending = false
        if (kitCurrent === 'account-nostr-group-chat') bsRerender()
      }, 800)
    }
    send.addEventListener('click', submit)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    })
    body.addEventListener('click', (e) => {
      const a = e.target.closest('[data-author]')
      if (!a) return
      st.selectedNpub = a.dataset.author
      st.deviceBack = 'account-nostr-group-chat'
      go('account-nostr-device')
    })
  }
})

/* ---------- nostr/selectRelays.tsx ---------- */

registerScreen('account-nostr-relays', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/settings/nostr/selectRelays.tsx',
  title: () => t('account.nostrSync.relays.title').toUpperCase(),
  back: 'account-nostr',
  render: () => {
    const st = bsState()
    const draft = st.relayDraft || (st.relayDraft = [...st.nostr.relays])
    const tl = (k) => t('account.nostrSync.relays.' + k)
    const relayRow = (name, url, selected) =>
      ss.hstack({ gap: 'sm', className: 'bs-relay' },
        ss.checkbox({ selected, data: { relay: url } }),
        ss.vstack({ gap: 'none' }, ss.text({}, ss.esc(name)), ss.text({ size: 'xs', color: 'muted' }, ss.esc(url))))
    const custom = draft.filter((url) => !BS_RELAYS.some(([, u]) => u === url))
    return `<div style="padding:10px 0 20px">${ss.vstack({ gap: 'lg' },
      ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true }, tl('public')), BS_RELAYS.map(([name, url]) => relayRow(name, url, draft.includes(url))).join('')),
      ss.vstack({ gap: 'md' },
        ss.text({ uppercase: true }, tl('custom')),
        custom.map((url) => relayRow(url.replace('wss://', ''), url, true)).join(''),
        ss.vstack({ gap: 'sm' },
          ss.hstack({ gap: 'xs' },
            ss.text({ color: 'muted', size: 'lg', className: 'bs-addon' }, 'wss://'),
            `<div class="bs-grow">${ss.textInput({ placeholder: tl('inputPlaceholder'), align: 'left', className: 'bs-relay-input', value: st.relayInput || '' })}</div>`),
          ss.button({ label: tl('addCustomRelay'), variant: 'secondary', disabled: !/^[a-z0-9-]+\.[a-z0-9.-]+$/i.test(st.relayInput || ''), id: 'bs-add-relay' }))),
      ss.button({ label: t('common.save'), variant: 'secondary', id: 'bs-save-relays' }))}</div>`
  },
  bind: (body) => {
    const st = bsState()
    body.addEventListener('input', (e) => {
      if (!e.target.closest('.bs-relay-input')) return
      st.relayInput = e.target.value.trim()
      body.querySelector('#bs-add-relay').disabled = !/^[a-z0-9-]+\.[a-z0-9.-]+$/i.test(st.relayInput)
    })
    body.addEventListener('click', (e) => {
      // The kit checkbox toggles its own class; mirror it into the draft.
      const box = e.target.closest('[data-relay]')
      if (box) {
        // This listener runs before the kit's document-level toggle, so the new state is the inverse.
        const url = box.dataset.relay
        const on = !box.classList.contains('is-on')
        st.relayDraft = on ? [...new Set([...st.relayDraft, url])] : st.relayDraft.filter((u) => u !== url)
        if (!on && !BS_RELAYS.some(([, u]) => u === url)) setTimeout(bsRerender)
      }
      if (e.target.closest('#bs-add-relay')) {
        const url = 'wss://' + st.relayInput
        if (!st.relayDraft.includes(url)) st.relayDraft.push(url)
        st.relayInput = ''
        return bsRerender()
      }
      if (e.target.closest('#bs-save-relays')) {
        st.nostr.relays = [...st.relayDraft]
        st.relayDraft = null
        go('account-nostr')
      }
    })
  }
})
