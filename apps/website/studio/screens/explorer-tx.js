/* Explorer — address, transaction, node, network.
   app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/{address,transaction,node,network}
   Registered with registerScreen() from screens.js. Fixture data only; nothing is fetched. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  /* address/index.tsx, transaction/index.tsx — example cards */
  .ex-entry { padding-top: 16px; }
  .ex-entry .ss-input textarea { height: 96px; font-size: var(--sizes-text-input-font-size-default); }
  .ex-entry .ss-input textarea.is-mono { font-size: 16px; }
  .ex-example { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 14px 0; border: 0; border-bottom: 1px solid var(--gray-800); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .ex-example:active { opacity: 0.6; }
  .ex-example-copy { flex: 1; padding-right: 12px; }
  .ex-example .ss-icon { color: var(--gray-600); }
  .ex-label-row { flex-wrap: wrap; align-items: baseline; }
  /* SSExplorerCapabilityBanner */
  .ex-banner { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid var(--gray-800); border-radius: 8px; }
  /* detail screens */
  .ex-detail { padding: 20px 0 40px; }
  .ex-header-title { display: flex; flex-direction: column; align-items: center; line-height: 1.2; }
  .ex-header-title small { color: var(--gray-300); font-size: var(--sizes-text-font-size-xs); letter-spacing: 0; text-transform: none; }
  .ex-source { color: var(--main-green); opacity: 0.8; }
  .ex-external { color: var(--gray-500); }
  .ex-server-url { color: var(--gray-500); opacity: 0.9; }
  .ex-list-item { display: flex; flex-direction: column; gap: 4px; width: 100%; padding: 10px 0; border: 0; border-top: 1px solid var(--gray-800); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .ex-list-item:active { opacity: 0.6; }
  .ex-break { word-break: break-all; }
  .ex-io { padding-top: 50px; }
  .ex-chart { overflow: hidden; }
  .ex-chart svg { max-width: 100%; }
  /* node.tsx, network.tsx rows */
  .ex-section-title { color: var(--gray-400); letter-spacing: 1.5px; }
  .ex-row { padding: 4px 0; }
  .ex-row .ex-k { color: var(--gray-400); }
  .ex-row .ex-v { color: var(--gray-100); text-align: right; }
  .ex-mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .ex-hash { color: var(--gray-100); }
  .ex-banner-text { color: var(--gray-300); white-space: pre-wrap; margin-top: 2px; }
  .ex-privacy { color: var(--gray-600); margin-top: 4px; text-align: center; }
  .ex-loading { display: flex; justify-content: center; padding: 24px 0; }
  /* SSNetworkDots approximation: one dot cluster per country, size by node count */
  .ex-dots { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: flex-end; padding: 8px 0; }
  .ex-dot { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .ex-dot i { display: block; border-radius: 50%; background: var(--white); opacity: 0.85; }
  .ex-dot span { color: var(--gray-400); font-size: var(--sizes-text-font-size-xxs); }
  </style>`
)

const exTn = (scope) => (key, vars) => t(scope + '.' + key, vars)
const exTa = exTn('explorer.address')
const exTt = exTn('explorer.transaction')
const exTnode = exTn('explorer.node')
const exTnet = exTn('explorer.network')

// Fixture explorer state (mirrors store/blockchain selectedNetwork + configs[network].server).
const exState = {
  network: 'bitcoin',
  server: { name: 'Blockstream', backend: 'electrum', url: 'ssl://electrum.blockstream.info:50002' },
  address: '',
  txid: '',
  addressInput: '',
  txInput: '',
  utxoView: 'list',
  addressTxLoaded: false,
  enrichLoaded: false,
  nodeExternal: false,
  netExternal: false,
  netViz: false
}

// constants/explorerExamples.ts
const EX_ADDRESSES = [
  { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', label: 'Genesis', description: 'Genesis block coinbase — first Bitcoin address, mined by Satoshi Nakamoto (Jan 3, 2009)' },
  { address: '12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX', label: 'Block 1', description: 'Block 1 coinbase address — second block ever mined' },
  { address: '17SkEw2md5avVNyYgj6RiXuQKNwkXaxFyQ', label: 'Pizza Day', description: 'Received 10,000 BTC for two pizzas — first real-world Bitcoin purchase (May 22, 2010)' },
  { address: '1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF', label: 'Dormant Whale', description: 'Large early dormant wallet — tens of thousands of BTC untouched for years' },
  { address: '1HB5XMLmzFVj8ALj6mfBsbifRoD4miY36v', label: 'WikiLeaks', description: 'WikiLeaks donation address — accepted Bitcoin from 2011' },
  { address: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX', label: 'Silk Road', description: 'Associated with Silk Road seized funds moved by US authorities' },
  { address: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo', label: 'Binance Cold', description: 'Long-running Binance cold storage address' },
  { address: '3D2oetdNuZUqQHPJmcMDDHYoqkyNVsFk9r', label: 'Bitfinex Cold', description: 'Bitfinex cold wallet — major exchange reserve address' }
]
const EX_TRANSACTIONS = [
  { txid: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b', label: 'Genesis', description: 'Genesis coinbase — first Bitcoin ever mined (Jan 3, 2009)', inputs: 1, outputs: 1 },
  { txid: '0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098', label: 'Block 1', description: 'Block 1 coinbase — second block ever mined', inputs: 1, outputs: 1 },
  { txid: 'da917699942e4a96272401b534381a75512eeebe8403084500bd637bd47168b3', label: 'SegWit coinbase', description: 'SegWit activation coinbase — includes OP_RETURN witness commitment (Aug 24, 2017)', inputs: 1, outputs: 2 },
  { txid: 'dfcec48bb8491856c353306ab5febeb7e99e4d783eedf3de98f3ee0812b92bad', label: 'SegWit', description: 'Early native SegWit spend (P2WPKH). Simple payment shape', inputs: 1, outputs: 1 },
  { txid: '777c998695de4b7ecec54c058c73b2cab71184cf1655840935cd9388923dc288', label: 'Taproot birth', description: 'First Taproot output in the activation block — Taproot + OP_RETURN (Nov 14, 2021)', inputs: 1, outputs: 2 },
  { txid: '1c293306cb10e8fd99257e5849cd8ed5b32cdf8e70429227c2bc886618d137d9', label: 'Taproot spend', description: 'Taproot spend — modern multi-input payment with Taproot inputs', inputs: 3, outputs: 2 },
  { txid: '1d8149eb8d8475b98113b5011cf70e0b7a4dccff71286d28b8b4b641f94f1e46', label: 'OP_RETURN', description: 'OP_RETURN data carrier — includes a null-data output', inputs: 1, outputs: 3 }
]
const EX_FIXTURE_ADDRESS = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'

// Deterministic pseudo-random numbers from a seed string.
function exRand(seed) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0
  return () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    return h / 4294967296
  }
}
function exHex(rand, len) {
  let s = ''
  while (s.length < len) s += Math.floor(rand() * 16).toString(16)
  return s
}
const exNum = (n) => Number(n).toLocaleString('en-US')
const exUsd = (sats) => ((sats / SATS_PER_BTC) * USD_PER_BTC).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const exBtc = (sats) => `${(sats / SATS_PER_BTC).toFixed(8).replace(/\.?0+$/, '')} BTC`
const exTxShort = (txid, n = 8) => (txid.length > n * 2 + 3 ? `${txid.slice(0, n)}...${txid.slice(-n)}` : txid)
const exTruncate = (v, head, tail) => (v.length > head + tail + 3 ? `${v.slice(0, head)}...${v.slice(-tail)}` : v)
const exDate = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const exTime = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const exAddrOf = (rand) => 'bc1q' + exHex(rand, 38).replace(/[^a-z0-9]/g, 'q')

function exAddressData(address) {
  const rand = exRand(address)
  const utxoCount = 1 + Math.floor(rand() * 4)
  const utxos = Array.from({ length: utxoCount }, () => ({ txid: exHex(rand, 64), vout: Math.floor(rand() * 3), value: 5000 + Math.floor(rand() * 4e7) }))
  const confirmed = utxos.reduce((s, u) => s + u.value, 0)
  const txids = Array.from({ length: utxoCount + 2 + Math.floor(rand() * 4) }, () => exHex(rand, 64))
  return { address, confirmed, unconfirmed: rand() > 0.7 ? 12000 : 0, utxos, txids }
}

function exTxData(txid) {
  const example = EX_TRANSACTIONS.find((e) => e.txid === txid)
  const rand = exRand(txid)
  const nIn = example ? example.inputs : 1 + Math.floor(rand() * 3)
  const nOut = example ? example.outputs : 1 + Math.floor(rand() * 3)
  const coinbase = example ? /coinbase|Genesis|Block 1/.test(example.label + example.description) : false
  const inputs = Array.from({ length: nIn }, () => ({
    isCoinbase: coinbase,
    value: coinbase ? undefined : 20000 + Math.floor(rand() * 3e7),
    address: coinbase ? '' : exAddrOf(rand),
    prevTxid: coinbase ? '0'.repeat(64) : exHex(rand, 64),
    prevVout: coinbase ? 4294967295 : Math.floor(rand() * 2),
    sequence: coinbase ? 0xffffffff : 0xfffffffd,
    witness: coinbase ? [] : ['3044' + exHex(rand, 136) + '01', '02' + exHex(rand, 64)]
  }))
  const inTotal = coinbase ? 5000000000 : inputs.reduce((s, i) => s + i.value, 0)
  const fee = coinbase ? 0 : 400 + Math.floor(rand() * 3000)
  let left = inTotal - fee
  const outputs = Array.from({ length: nOut }, (_, i) => {
    const opReturn = example && /OP_RETURN/.test(example.label + example.description) && i === nOut - 1
    const value = opReturn ? 0 : i === nOut - 1 ? left : Math.floor(left * (0.3 + rand() * 0.5))
    left -= value
    return {
      index: i,
      value,
      address: opReturn ? '' : exAddrOf(rand),
      script: opReturn ? '6a24aa21a9ed' + exHex(rand, 64) : '0014' + exHex(rand, 40),
      special: opReturn ? 'OP_RETURN' : ''
    }
  })
  const vsize = 10 + nIn * 68 + nOut * 31
  return {
    txid,
    example,
    version: 2,
    locktime: 0,
    size: vsize + nIn * 107,
    vsize,
    weight: vsize * 4 - nIn * 3,
    isSegwit: !coinbase,
    isCoinbase: coinbase,
    inputs,
    outputs,
    fee,
    height: 800000 + Math.floor(rand() * 90000),
    time: Date.UTC(2024, Math.floor(rand() * 12), 1 + Math.floor(rand() * 27), 12)
  }
}

// SSExplorerCapabilityBanner
function exBanner(why, fix, id) {
  return `<div class="ex-banner">${ss.vstack({ gap: 'sm' },
    ss.text({ color: 'muted' }, why),
    ss.text({ size: 'xs', color: 'muted' }, fix),
    ss.button({ variant: 'outline', label: t('explorer.capability.loadMempool'), id }),
    ss.text({ size: 'xxs', center: true, color: 'muted' }, t('explorer.capability.externalNote')))}</div>`
}

// Stack header with an optional example label above the title (address / tx detail).
function exHeaderTitle(label, title) {
  const el = document.getElementById('kit-title')
  el.innerHTML = `<span class="ex-header-title">${label ? `<small>${ss.esc(label)}</small>` : ''}<span>${ss.esc(title)}</span></span>`
}

// ---------------------------------------------------------------------------------------
// address/index.tsx

registerScreen('explorer-address', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/address/index.tsx',
  title: () => exTa('title'),
  back: 'explorer',
  render: () =>
    ss.vstack({ gap: 'md', className: 'ex-entry' },
      ss.textInput({ placeholder: exTa('placeholder'), align: 'left', multiline: true, mono: true, value: exState.addressInput, className: 'ex-input' }),
      ss.hstack({ gap: 'sm' },
        ss.button({ label: exTa('paste'), variant: 'outline', style: 'flex:1', id: 'ex-paste' }),
        ss.button({ label: exTa('scanQr'), variant: 'outline', style: 'flex:1', id: 'ex-scan' })),
      ss.button({ label: exTa('load'), variant: 'outline', id: 'ex-load', disabled: !exState.addressInput.trim() }),
      exState.network === 'bitcoin'
        ? ss.vstack({ gap: 'none' },
            EX_ADDRESSES.map((ex) =>
              `<button type="button" class="ex-example" data-ex-address="${ex.address}">${ss.vstack({ gap: 'xxs', className: 'ex-example-copy' },
                ss.text({ weight: 'medium' }, ex.label),
                ss.text({ size: 'xxs', color: 'muted' }, ex.description),
                ss.text({ type: 'mono', size: 'xxs', color: 'muted' }, exTruncate(ex.address, 10, 8)))}${ss.icon('chevronRight', { size: 12 })}</button>`))
        : ''),
  overlays: () => ss.modal({ id: 'ex-scan-modal' }, `<div style="width:100%;height:300px;background:var(--gray-900);display:flex;align-items:center;justify-content:center">${ss.text({ color: 'muted' }, 'Camera')}</div>`),
  bind: (body) => {
    const input = body.querySelector('.ex-input textarea')
    const load = body.querySelector('#ex-load')
    input.addEventListener('input', () => {
      exState.addressInput = input.value
      load.disabled = !input.value.trim()
    })
    body.addEventListener('click', (e) => {
      if (e.target.closest('#ex-paste')) {
        input.value = exState.addressInput = EX_FIXTURE_ADDRESS
        load.disabled = false
      }
      if (e.target.closest('#ex-scan')) ss.open('ex-scan-modal')
      if (e.target.closest('#ex-load')) exOpenAddress(input.value.trim().replace(/^bitcoin:/i, '').split('?')[0])
      const ex = e.target.closest('[data-ex-address]')
      if (ex) exOpenAddress(ex.dataset.exAddress)
    })
  }
})

function exOpenAddress(address) {
  exState.address = address
  exState.addressTxLoaded = false
  exState.utxoView = 'list'
  go('explorer-address-detail')
}

// address/[address]/index.tsx

registerScreen('explorer-address-detail', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/address/[address]/index.tsx',
  title: () => exTa('detailsTitle'),
  back: 'explorer-address',
  render: () => {
    if (!exState.address) exState.address = EX_ADDRESSES[2].address
    const example = EX_ADDRESSES.find((e) => e.address === exState.address)
    setTimeout(() => exHeaderTitle(example && example.label, exTa('detailsTitle')))
    const data = exAddressData(exState.address)
    const n = data.utxos.length
    const utxoList = data.utxos
      .map((u) => `<button type="button" class="ex-list-item" data-ex-tx="${u.txid}">${ss.text({ type: 'mono', size: 'xs' }, `${u.txid.slice(0, 12)}…:${u.vout}`)}${ss.text({}, `${exNum(u.value)} ${t('bitcoin.sats')}`)}</button>`)
      .join('')
    const txCards = exState.addressTxLoaded
      ? ss.vstack({ gap: 'none' },
          data.txids.map((txid) => {
            const rand = exRand(txid)
            const value = Math.floor(rand() * 2e7) * (rand() > 0.4 ? 1 : -1)
            return `<button type="button" class="ex-list-item" data-ex-tx="${txid}">${ss.hstack({ justifyBetween: true },
              ss.text({ type: 'mono', size: 'xs' }, exTxShort(txid)),
              ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.styledSat({ amount: Math.abs(value), textSize: 'sm', noColor: false, type: value < 0 ? 'send' : 'receive' }), ss.text({ size: 'xs', color: 'muted' }, t('bitcoin.sats'))))}${ss.hstack({ justifyBetween: true },
              ss.text({ size: 'xs', color: 'muted' }, `${exDate(Date.UTC(2023, 0, 1) + rand() * 5e10)}`),
              ss.text({ size: 'xs', color: 'muted' }, `${exUsd(Math.abs(value))} USD`))}</button>`
          }))
      : ss.button({ label: exTa('loadTxDetails'), variant: 'outline', id: 'ex-load-txs' })
    return ss.vstack({ className: 'ex-detail' },
      ss.vstack({ gap: 'none', itemsCenter: true },
        ss.hstack({ gap: 'xs', style: 'align-items:baseline;margin-top:var(--layout-v-stack-gap-md)' },
          ss.styledSat({ amount: data.confirmed + data.unconfirmed, textSize: '3xl', weight: 'light' }),
          ss.text({ color: 'muted' }, t('bitcoin.sats'))),
        ss.hstack({ gap: 'xs' },
          ss.text({}, `${n} ${(n === 1 ? t('bitcoin.utxo') : t('bitcoin.utxos')).toLowerCase()}`),
          ss.text({ color: 'muted' }, '·'),
          ss.text({}, `${data.txids.length} ${(data.txids.length === 1 ? t('bitcoin.transaction') : t('bitcoin.transactions')).toLowerCase()}`))),
      ss.detailsList({
        columns: 2, headerSize: 'sm', textSize: 'md', uppercase: false,
        items: [
          [exTa('confirmed'), `${exNum(data.confirmed)} ${t('bitcoin.sats')}`],
          [exTa('unconfirmed'), `${exNum(data.unconfirmed)} ${t('bitcoin.sats')}`],
          [exTa('utxoCount'), String(n)],
          [exTa('txCount'), String(data.txids.length)]
        ]
      }),
      ss.separator(),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, color: 'muted' }, exTa('address')),
        ss.clipboardCopy({ text: data.address }, ss.text({ type: 'mono', size: 'xs', className: 'ex-break' }, data.address)),
        ss.text({ size: 'xxs', className: 'ex-source' }, `${exState.server.name} · ${exState.server.backend}`),
        ss.button({ label: t('address.details.verifyMessage'), variant: 'subtle', go: 'explorer-address-verify' })),
      ss.separator(),
      ss.vstack({ gap: 'sm', style: 'padding-top:24px' },
        ss.hstack({ justifyBetween: true },
          ss.text({ size: 'lg' }, exTa('utxos')),
          n ? ss.iconButton({ label: 'Toggle view', id: 'ex-utxo-view' }, ss.icon(exState.utxoView === 'list' ? 'bubbles' : 'list', { size: 16 })) : ''),
        !n
          ? ss.text({ color: 'muted' }, exTa('noUtxos'))
          : exState.utxoView === 'bubbles'
            ? exBubbles(data.utxos)
            : ss.vstack({ gap: 'none' }, utxoList)),
      ss.vstack({ gap: 'sm', style: 'padding-top:24px' }, ss.text({ size: 'lg' }, exTa('transactions')), txCards))
  },
  bind: (body) => {
    body.addEventListener('click', (e) => {
      if (e.target.closest('#ex-utxo-view')) {
        exState.utxoView = exState.utxoView === 'list' ? 'bubbles' : 'list'
        openKitScreen('explorer-address-detail')
      }
      const load = e.target.closest('#ex-load-txs')
      if (load) {
        load.disabled = true
        load.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          exState.addressTxLoaded = true
          openKitScreen('explorer-address-detail')
        }, 600)
      }
      const tx = e.target.closest('[data-ex-tx]')
      if (tx) exOpenTx(tx.dataset.exTx)
    })
  }
})

// SSBubbleChart approximation for the address UTXO set: circles sized by sqrt(value).
function exBubbles(utxos) {
  const max = Math.max(...utxos.map((u) => u.value))
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;min-height:220px">${utxos
    .map((u) => {
      const d = Math.max(36, Math.round(180 * Math.sqrt(u.value / max)))
      return `<button type="button" data-ex-tx="${u.txid}" style="width:${d}px;height:${d}px;border-radius:50%;border:0;background:var(--gray-500);color:var(--black);font:inherit;font-size:${Math.max(8, d / 9)}px;cursor:pointer">${exNum(u.value)}</button>`
    })
    .join('')}</div>`
}

// address/[address]/verifyMessage.tsx + components/SSVerifyMessage.tsx

registerScreen('explorer-address-verify', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/address/[address]/verifyMessage.tsx',
  title: () => t('address.verifyMessage.title'),
  back: 'explorer-address-detail',
  render: () => {
    if (!exState.address) exState.address = EX_ADDRESSES[2].address
    return ss.vstack({ gap: 'lg', style: 'padding:20px 0' },
      ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true, weight: 'bold' }, t('bitcoin.address')), ss.addressDisplay({ address: exState.address })),
      ss.separator(),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, weight: 'bold' }, t('address.verifyMessage.message')),
        ss.textInput({ align: 'left', multiline: true, placeholder: t('address.verifyMessage.messagePlaceholder'), className: 'ex-msg', style: '--h:140px' })),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, weight: 'bold' }, t('address.verifyMessage.signature')),
        ss.textInput({ align: 'left', multiline: true, mono: true, placeholder: t('address.verifyMessage.signaturePlaceholder'), className: 'ex-sig' })),
      ss.button({ label: t('address.verifyMessage.verify'), variant: 'secondary', disabled: true, id: 'ex-verify' }),
      '<div id="ex-verify-result"></div>')
  },
  bind: (body) => {
    body.querySelector('.ex-msg textarea').style.minHeight = '140px'
    const sig = body.querySelector('.ex-sig textarea')
    sig.style.height = '100px'
    const verify = body.querySelector('#ex-verify')
    const result = body.querySelector('#ex-verify-result')
    sig.addEventListener('input', () => {
      verify.disabled = !sig.value.trim()
      result.innerHTML = ''
    })
    verify.addEventListener('click', () => {
      // Fixture rule: base64-looking signatures of 88 chars verify; anything else is invalid.
      const valid = /^[A-Za-z0-9+/]{86}==$/.test(sig.value.trim())
      result.innerHTML = ss.text({ center: true, style: `color:var(${valid ? '--main-green' : '--main-red'})` }, t(valid ? 'address.verifyMessage.valid' : 'address.verifyMessage.invalid'))
    })
  }
})

// ---------------------------------------------------------------------------------------
// transaction/index.tsx

function exTxInputType(v) {
  const s = v.trim()
  if (/^[0-9a-fA-F]{64}$/.test(s)) return 'txid'
  if (/^[0-9a-fA-F]{120,}$/.test(s)) return 'rawTx'
  return null
}

function exIoCount(count, kind) {
  const word = kind === 'in'
    ? t(count === 1 ? 'transaction.input.singular' : 'transaction.input.plural')
    : t(count === 1 ? 'transaction.output.singular' : 'transaction.output.plural')
  return ss.hstack({ gap: 'xs', style: 'align-items:baseline;flex-shrink:0' }, ss.text({ size: 'xs' }, String(count)), ss.text({ size: 'xs', color: 'muted' }, word.toLowerCase()))
}

registerScreen('explorer-transaction', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/transaction/index.tsx',
  title: () => exTt('title'),
  back: 'explorer',
  render: () => {
    const type = exTxInputType(exState.txInput)
    return ss.vstack({ gap: 'md', className: 'ex-entry' },
      ss.textInput({ placeholder: exTt('placeholder'), align: 'left', multiline: true, mono: true, value: exState.txInput, className: 'ex-input' }),
      ss.hstack({ gap: 'sm' },
        ss.button({ label: exTt('paste'), variant: 'outline', style: 'flex:1', id: 'ex-paste' }),
        ss.button({ label: exTt('scanQr'), variant: 'outline', style: 'flex:1', id: 'ex-scan' }),
        ss.button({ label: exTt('nfc'), variant: 'outline', style: 'flex:1', id: 'ex-nfc' })),
      ss.button({ label: type === 'rawTx' ? exTt('broadcast') : exTt('load'), variant: 'outline', id: 'ex-load', disabled: !type }),
      exState.network === 'bitcoin'
        ? ss.vstack({ gap: 'none' },
            EX_TRANSACTIONS.map((ex) =>
              `<button type="button" class="ex-example" data-ex-txid="${ex.txid}">${ss.vstack({ gap: 'xxs', className: 'ex-example-copy' },
                ss.hstack({ gap: 'sm', className: 'ex-label-row' }, ss.text({ weight: 'medium', style: 'flex-shrink:1' }, ex.label), exIoCount(ex.inputs, 'in'), exIoCount(ex.outputs, 'out')),
                ss.text({ size: 'xxs', color: 'muted' }, ex.description),
                ss.text({ type: 'mono', size: 'xxs', color: 'muted' }, exTxShort(ex.txid)))}${ss.icon('chevronRight', { size: 12 })}</button>`))
        : '')
  },
  overlays: () => ss.modal({ id: 'ex-scan-modal' }, `<div style="width:100%;height:300px;background:var(--gray-900);display:flex;align-items:center;justify-content:center">${ss.text({ color: 'muted' }, 'Camera')}</div>`),
  bind: (body) => {
    const input = body.querySelector('.ex-input textarea')
    const load = body.querySelector('#ex-load')
    const sync = () => {
      exState.txInput = input.value
      const type = exTxInputType(input.value)
      load.disabled = !type
      load.querySelector('.ss-button-label').textContent = type === 'rawTx' ? exTt('broadcast') : exTt('load')
    }
    input.addEventListener('input', sync)
    body.addEventListener('click', (e) => {
      if (e.target.closest('#ex-paste')) {
        input.value = EX_TRANSACTIONS[5].txid
        sync()
      }
      if (e.target.closest('#ex-scan')) ss.open('ex-scan-modal')
      if (e.target.closest('#ex-nfc')) ss.toast('NFC', document.getElementById('view-kit'))
      if (e.target.closest('#ex-load') && !load.disabled) {
        if (exTxInputType(input.value) === 'rawTx') {
          load.disabled = true
          load.innerHTML = '<span class="ss-spinner"></span>'
          setTimeout(() => exOpenTx(demoTxid(input.value)), 800)
        } else exOpenTx(input.value.trim().toLowerCase())
      }
      const ex = e.target.closest('[data-ex-txid]')
      if (ex) exOpenTx(ex.dataset.exTxid)
    })
  }
})

function exOpenTx(txid) {
  exState.txid = txid
  exState.enrichLoaded = false
  go('explorer-transaction-detail')
}

// transaction/[txid]/index.tsx

function exSatsAmount(sats) {
  return ss.vstack({ gap: 'none' },
    ss.text({ color: 'muted' }, t('transaction.value')),
    ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({ size: 'lg' }, exNum(sats)), ss.text({ color: 'muted' }, t('bitcoin.sats'))),
    ss.text({ color: 'muted' }, exBtc(sats)),
    ss.text({ color: 'muted' }, `${exUsd(sats)} USD`))
}

registerScreen('explorer-transaction-detail', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/transaction/[txid]/index.tsx',
  title: () => t('transaction.details.title'),
  back: 'explorer-transaction',
  render: () => {
    if (!exState.txid) exState.txid = EX_TRANSACTIONS[5].txid
    const tx = exTxData(exState.txid)
    setTimeout(() => exHeaderTitle(tx.example && tx.example.label, t('transaction.details.title')))
    const total = tx.outputs.reduce((s, o) => s + o.value, 0)
    const chart = {
      type: 'send',
      txid: tx.txid,
      amount: total,
      fee: tx.fee,
      size: tx.size,
      vsize: tx.vsize,
      inputs: tx.inputs.length,
      outputs: tx.outputs.length,
      flowInputs: tx.inputs.map((i) => ({ value: i.isCoinbase ? 5000000000 / tx.inputs.length : i.value, label: i.isCoinbase ? 'Coinbase' : exTxShort(i.prevTxid, 4), ours: false, from: i.prevTxid })),
      flowOutputs: tx.outputs
        .map((o) => ({ value: Math.max(o.value, 1), label: o.special || exTruncate(o.address, 6, 4), ours: false, to: o.address || o.script }))
        .concat([{ value: Math.max(tx.fee, 1), label: 'Miner fee', fee: true }])
    }
    const inputs = tx.inputs.map((inp, i) =>
      ss.vstack({ className: 'ex-io' },
        ss.separator(),
        ss.text({ size: 'lg' }, `${t('transaction.input.title')} ${i}`),
        inp.isCoinbase
          ? ss.text({ color: 'muted' }, exTt('coinbaseInput'))
          : [
              exSatsAmount(inp.value),
              ss.vstack({ gap: 'none' }, ss.text({ color: 'muted' }, t('bitcoin.address')), ss.clipboardCopy({ text: inp.address }, ss.text({ type: 'mono', size: 'md', className: 'ex-break' }, inp.address))),
              ss.vstack({ gap: 'none' }, ss.text({ color: 'muted' }, t('transaction.input.previousOutput.transaction')), ss.clipboardCopy({ text: inp.prevTxid }, ss.text({ type: 'mono', size: 'md', className: 'ex-break' }, inp.prevTxid))),
              ss.vstack({ gap: 'none' }, ss.text({ color: 'muted' }, t('transaction.input.previousOutput.vout')), ss.text({ size: 'lg' }, String(inp.prevVout)))
            ].join(''),
        ss.vstack({ gap: 'none' }, ss.text({ color: 'muted' }, t('transaction.input.sequence')), ss.text({ size: 'lg' }, `0x${inp.sequence.toString(16).padStart(8, '0')}`)),
        inp.witness.length
          ? ss.vstack({ gap: 'none' },
              ss.text({ color: 'muted' }, exTt('witness', { count: inp.witness.length })),
              inp.witness.map((w) => ss.clipboardCopy({ text: w }, ss.text({ type: 'mono', size: 'xxs', className: 'ex-break' }, w))))
          : ''))
    const outputs = tx.outputs.map((out) =>
      ss.vstack({ className: 'ex-io' },
        ss.separator(),
        ss.text({ size: 'lg' }, `${t('transaction.output.title')} ${out.index}`),
        out.special ? ss.vstack({ gap: 'none' }, ss.text({ color: 'muted' }, t('common.type')), ss.text({ size: 'lg' }, out.special)) : '',
        exSatsAmount(out.value),
        out.address ? ss.vstack({ gap: 'none' }, ss.text({ color: 'muted' }, t('bitcoin.address')), ss.clipboardCopy({ text: out.address }, ss.text({ type: 'mono', size: 'md', className: 'ex-break' }, out.address))) : '',
        ss.vstack({}, ss.text({ color: 'muted' }, exTt('script')), ss.clipboardCopy({ text: out.script }, ss.text({ type: 'mono', size: 'xxs', className: 'ex-break' }, out.script)))))
    const enrichment = exState.enrichLoaded
      ? ss.vstack({ gap: 'xs' },
          ss.text({ size: 'xxs', className: 'ex-external' }, 'mempool.space'),
          ss.detailsList({
            columns: 2, headerSize: 'sm', textSize: 'md', uppercase: false,
            items: [
              [exTt('confirmed'), exTt('yes')],
              [exTt('blockHeight'), String(tx.height)],
              [exTt('blockTime'), exDate(tx.time)],
              [exTt('spentOutputs'), String(Math.max(0, tx.outputs.filter((o) => o.value > 0).length - 1))]
            ]
          }))
      : exBanner(exTt('enrichWhy'), exTt('enrichFix'), 'ex-enrich')
    return ss.vstack({ className: 'ex-detail' },
      ss.vstack({ gap: 'none', itemsCenter: true },
        ss.hstack({ gap: 'xs', style: 'align-items:baseline;margin-top:16px' }, ss.styledSat({ amount: total, textSize: '3xl', weight: 'light' }), ss.text({ color: 'muted' }, t('bitcoin.sats'))),
        ss.hstack({ gap: 'xs' },
          ss.text({ color: 'muted' }, t('common.from').toLowerCase()),
          ss.text({}, `${tx.inputs.length} ${t(tx.inputs.length === 1 ? 'transaction.input.singular' : 'transaction.input.plural').toLowerCase()}`),
          ss.text({ color: 'muted' }, t('common.to').toLowerCase()),
          ss.text({}, `${tx.outputs.length} ${t(tx.outputs.length === 1 ? 'transaction.output.singular' : 'transaction.output.plural').toLowerCase()}`))),
      `<div class="ex-chart">${txDetailSankey(chart)}</div>`,
      tx.isCoinbase ? '' : ss.button({ label: t('transaction.loadHistory'), variant: 'outline', id: 'ex-history' }),
      enrichment,
      ss.separator(),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, color: 'muted' }, exTt('txid')),
        ss.clipboardCopy({ text: tx.txid }, ss.text({ type: 'mono', size: 'xs', className: 'ex-break' }, tx.txid)),
        ss.text({ size: 'xxs', className: 'ex-source' }, `${exState.server.name} · ${exState.server.backend}`)),
      ss.separator(),
      ss.detailsList({
        columns: 3, headerSize: 'sm', textSize: 'md', uppercase: false,
        items: [
          [exTt('version'), String(tx.version)],
          [exTt('locktime'), String(tx.locktime)],
          [exTt('size'), `${tx.size} B`],
          [exTt('vsize'), `${tx.vsize} vB`],
          [exTt('weight'), `${tx.weight} WU`],
          [t('transaction.input.count'), String(tx.inputs.length)],
          [t('transaction.output.count'), String(tx.outputs.length)],
          [exTt('segwit'), tx.isSegwit ? exTt('yes') : exTt('no')],
          [exTt('coinbase'), tx.isCoinbase ? exTt('yes') : exTt('no')]
        ]
      }),
      ss.separator(),
      ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true, color: 'muted' }, t('transaction.decoded.title')), decodedMarkup()),
      inputs.join(''),
      outputs.join(''))
  },
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const enrich = e.target.closest('#ex-enrich')
      if (enrich) {
        enrich.disabled = true
        enrich.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          exState.enrichLoaded = true
          openKitScreen('explorer-transaction-detail')
        }, 700)
      }
      if (e.target.closest('#ex-history')) go('builder')
    })
  }
})

// ---------------------------------------------------------------------------------------
// node.tsx / network.tsx shared rows

function exSectionHeader(title, source, sourceLabel) {
  return ss.hstack({ justifyBetween: true },
    ss.text({ uppercase: true, size: 'md', className: 'ex-section-title' }, title),
    source ? ss.text({ size: 'xxs', className: source === 'backend' ? 'ex-source' : 'ex-external' }, sourceLabel) : '')
}
function exRow(label, value) {
  return ss.hstack({ justifyBetween: true, className: 'ex-row' }, ss.text({ className: 'ex-k' }, label), ss.text({ className: 'ex-v' }, value))
}

const EX_TIP = { height: 919874, timestamp: Date.now() - 7 * 60 * 1000 }

// node/index.tsx
registerScreen('explorer-node', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/node/index.tsx',
  title: () => exTnode('title'),
  back: 'explorer',
  render: () => {
    const server = exState.server
    const backendLabel = `${server.name} (${server.backend})`
    const mins = Math.floor((Date.now() - EX_TIP.timestamp) / 60000)
    const showInfo = server.backend === 'electrum' || server.backend === 'rpc'
    return ss.vstack({ gap: 'xl', style: 'padding:20px 0 32px' },
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, size: 'md', className: 'ex-section-title' }, exTnode('serverConfig')),
        ss.vstack({ gap: 'xs' },
          exRow(exTnode('serverName'), server.name),
          exRow(exTnode('backend'), server.backend),
          exRow(exTnode('network'), exState.network),
          ss.vstack({ gap: 'none' },
            ss.text({ size: 'xs', className: 'ex-k', style: 'color:var(--gray-400)' }, exTnode('serverUrl')),
            ss.text({ size: 'xs', className: 'ex-mono ex-hash' }, server.url)))),
      ss.vstack({ gap: 'sm' },
        exSectionHeader(exTnode('currentTip'), 'backend', backendLabel),
        ss.vstack({ gap: 'xs' },
          exRow(exTnode('height'), EX_TIP.height.toLocaleString('en-US')),
          exRow(exTnode('timestamp'), `${exDate(EX_TIP.timestamp)} · ${exTime(EX_TIP.timestamp)}`),
          exRow(exTnode('blockAge'), mins < 1 ? t('time.justNow') : mins === 1 ? t('time.minuteAgo') : t('time.minutesAgo', { value: String(mins) })))),
      showInfo
        ? ss.vstack({ gap: 'sm' },
            exSectionHeader(exTnode('serverInfo'), 'backend', backendLabel),
            ss.vstack({ gap: 'xs' },
              exRow(exTnode('software'), 'electrs-esplora 0.4.1'),
              exRow(exTnode('protocolVersion'), '1.4'),
              ss.vstack({ gap: 'none' },
                ss.text({ size: 'xs', style: 'color:var(--gray-400)' }, exTnode('banner')),
                ss.text({ size: 'xs', className: 'ex-mono ex-banner-text' }, 'Welcome to Blockstream Electrum server.\nelectrs-esplora 0.4.1'))))
        : '',
      exState.nodeExternal
        ? ss.vstack({ gap: 'sm' },
            exSectionHeader(exTnode('bitnodesInfo'), 'mempool', 'bitnodes.io'),
            ss.vstack({ gap: 'xs' },
              exRow(exTnode('address'), '34.107.12.88:8333'),
              exRow(exTnode('userAgent'), '/Satoshi:28.1.0/'),
              exRow(exTnode('nodeHeight'), EX_TIP.height.toLocaleString('en-US')),
              exRow(exTnode('lastSeen'), exDate(Date.now() - 36e5))))
        : ss.vstack({ itemsCenter: true },
            ss.button({ label: exTnode('loadBitnodes'), variant: 'outline', id: 'ex-node-external' }),
            ss.text({ size: 'xs', className: 'ex-privacy' }, exTnode('externalNote'))))
  },
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const b = e.target.closest('#ex-node-external')
      if (!b) return
      b.disabled = true
      b.innerHTML = '<span class="ss-spinner"></span>'
      setTimeout(() => {
        exState.nodeExternal = true
        openKitScreen('explorer-node')
      }, 600)
    })
  }
})

// network/index.tsx
const EX_VERSIONS = [
  ['/Satoshi:28.1.0/', 6214], ['/Satoshi:27.1.0/', 3402], ['/Satoshi:29.0.0/', 2876], ['/Satoshi:27.0.0/', 1588],
  ['/Satoshi:26.0.0/', 1210], ['/Satoshi:28.0.0/', 984], ['/Satoshi:25.0.0/', 612], ['/Knots:20250305/', 1903]
]
const EX_COUNTRIES = [
  ['US', 2710], ['DE', 1954], ['FR', 688], ['NL', 612], ['CA', 498], ['FI', 446], ['GB', 421], ['CH', 336],
  ['SG', 289], ['JP', 244], ['AU', 198], ['BR', 141]
]

registerScreen('explorer-network', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/explorer/network/index.tsx',
  title: () => exTnet('title'),
  back: 'explorer',
  render: () => {
    const total = 21847
    const max = EX_COUNTRIES[0][1]
    const list = (rows) => ss.vstack({ gap: 'xs' }, rows.map(([k, v]) => exRow(k, v.toLocaleString('en-US'))))
    return ss.vstack({ gap: 'xl', style: 'padding:20px 0 32px' },
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, size: 'md', className: 'ex-section-title' }, exTnet('localView')),
        ss.vstack({ gap: 'xs' }, exRow(exTnet('network'), exState.network), exRow(exTnet('height'), EX_TIP.height.toLocaleString('en-US')))),
      !exState.netExternal
        ? ss.vstack({ itemsCenter: true },
            ss.button({ label: exTnet('loadExternal'), variant: 'outline', id: 'ex-net-external' }),
            ss.text({ size: 'xs', className: 'ex-privacy' }, exTnet('externalNote')))
        : [
            ss.vstack({ gap: 'sm' }, exSectionHeader(exTnet('networkOverview'), 'mempool', 'bitnodes.io'), ss.vstack({ gap: 'xs' }, exRow(exTnet('totalNodes'), total.toLocaleString('en-US')))),
            ss.vstack({ gap: 'sm' }, exSectionHeader(exTnet('clientVersions'), 'mempool', 'bitnodes.io'), list(EX_VERSIONS)),
            ss.vstack({ gap: 'sm' }, exSectionHeader(exTnet('countryDistribution'), 'mempool', 'bitnodes.io'), list(EX_COUNTRIES)),
            exState.netViz
              ? ss.vstack({ gap: 'sm' },
                  ss.text({ uppercase: true, size: 'md', className: 'ex-section-title' }, exTnet('nodeDistribution')),
                  `<div class="ex-dots">${EX_COUNTRIES.map(([c, n]) => {
                    const d = Math.round(10 + 50 * Math.sqrt(n / max))
                    return `<span class="ex-dot"><i style="width:${d}px;height:${d}px"></i><span>${c}</span></span>`
                  }).join('')}</div>`)
              : ss.vstack({ itemsCenter: true }, ss.button({ label: exTnet('showVisualization'), variant: 'outline', id: 'ex-net-viz' }))
          ].join(''))
  },
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const ext = e.target.closest('#ex-net-external')
      if (ext) {
        ext.disabled = true
        ext.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          exState.netExternal = true
          openKitScreen('explorer-network')
        }, 600)
      }
      if (e.target.closest('#ex-net-viz')) {
        exState.netViz = true
        openKitScreen('explorer-network')
      }
    })
  }
})
