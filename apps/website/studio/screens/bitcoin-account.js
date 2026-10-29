/* Bitcoin account — app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/
   receive, address detail / label / sign / verify, tx label, UTXO detail / label, import outputs.
   Fixtures come from screen.js (accounts, openAccountData, activity, usedAddresses, coins).
   Open with ids below; baOpenAddress(addr), baOpenUtxo(coinId) and baOpenTxLabel(tx) set context first. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  #kit-body:has(.ba-screen) { padding-top: 0; }
  .ba-screen { padding: 12px 0 24px; }
  .ba-pad { padding: 20px 0; }
  .ba-screen .ss-copy { display: block; width: 100%; }
  .ba-number { font-size: var(--sizes-text-font-size-4xl); }
  .ba-uri, .ba-addr-box {
    box-sizing: border-box; width: 100%; min-width: 0; margin: 0;
    border-radius: 4px; background: var(--gray-800); color: var(--white);
    font-family: ui-monospace, "SF Mono", Menlo, monospace; text-align: left; word-break: break-all;
  }
  .ba-uri { min-height: 80px; padding: 8px 8px 32px; font-size: 14px; line-height: 18px; letter-spacing: 0.5px; }
  .ba-addr-box { padding: 16px 16px 22px; font-size: 16px; line-height: 30px; letter-spacing: 1.5px; }
  .ba-switch { text-decoration: underline; cursor: pointer; }
  .ba-toggles { width: 100%; }
  .ba-toggles .ss-button { flex: 1; min-width: 0; }
  .ba-toggles .ss-button-label { padding: 0 8px; }
  .ba-fiat-input input { font-size: 21px; }
  .ba-label-details { display: flex; align-items: flex-start; justify-content: space-between; width: 100%; border: 0; padding: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .ba-label-details:active { opacity: 0.7; }
  .ba-label-details > .ss-vstack { flex: 1; max-width: 80%; }
  .ba-ph { color: var(--gray-500); }
  .ba-ph-dot { color: var(--gray-600); }
  .ba-tag { align-self: center; padding: 2px 6px; border-radius: 4px; background: var(--gray-700); color: var(--white); font-size: var(--sizes-text-font-size-xs); }
  .ba-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 42px; padding: 6px 8px; box-sizing: border-box; border-radius: 3px; background: var(--gray-850); }
  .ba-tags input { flex: 1; min-width: 80px; border: 0; background: none; color: var(--white); font: inherit; font-size: 16px; outline: none; }
  .ba-tags input::placeholder { color: var(--gray-400); }
  .ba-tag-x { margin-left: 4px; border: 0; padding: 0; background: none; color: var(--gray-300); font: inherit; cursor: pointer; }
  .ba-label-input textarea { height: 110px; font-size: 22px; font-weight: 300; }
  .ba-msg textarea { height: auto; min-height: 140px; font-size: 16px; }
  .ba-sig textarea { height: auto; min-height: 100px; font-size: 16px; }
  .ba-valid { color: var(--main-green); }
  .ba-invalid { color: var(--main-red); }
  .ba-tx-row { display: block; width: 100%; padding: 8px 0; border: 0; border-top: 1px solid var(--gray-700); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .ba-tx-row:first-child { border-top: 0; }
  .ba-tx-row:active { opacity: 0.7; }
  .ba-map { position: relative; width: 100%; height: 300px; overflow: hidden; }
  .ba-map .bubble { cursor: pointer; }
  .ba-map .bubble.ba-dim { opacity: 0.25; }
  .ba-map-wrap { position: relative; }
  .ba-map-fade { position: absolute; left: 0; right: 0; top: 0; height: 60px; pointer-events: none; background: linear-gradient(180deg, #0A0A0AFF 0%, #0A0A0AE0 40%, #0A0A0A80 70%, #0A0A0A00 100%); }
  .ba-script { display: flex; flex-wrap: wrap; gap: 6px; }
  .ba-script span { padding: 2px 6px; border-radius: 3px; background: var(--gray-850); font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color: var(--gray-75); word-break: break-all; }
  .ba-script span.is-op { color: var(--main-green); }
  .ba-import-box { box-sizing: border-box; width: 100%; min-height: 400px; margin: 0; padding: 10px; border-radius: 5px; background: var(--gray-950); color: var(--white); font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 14px; white-space: pre-wrap; word-break: break-all; }
  .ba-half { flex-grow: 1; width: 45%; }
  .ba-ellipsis::after { content: ''; animation: ba-dots 1.2s steps(4) infinite; }
  @keyframes ba-dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
  </style>`
)

// --- fixture state --------------------------------------------------------------------

const baState = {
  addr: null, // full address string
  coinId: null, // coins[].id for the UTXO screens
  tx: null, // activity entry for the tx label screen
  tags: { addr: {}, tx: {}, utxo: {} },
  receive: null // per-account receive state, built lazily
}

function baAccount() {
  if (!openAccountData) openAccountData = accounts[0]
  return openAccountData
}

function baBook() {
  return usedAddresses[baAccount().fingerprint] || usedAddresses.ab12cd34
}

function baAddressRow(addr) {
  const book = baBook()
  for (const keychain of ['receive', 'change']) {
    const row = book[keychain].find((r) => r.address === addr)
    if (row) return { row, keychain }
  }
  return null
}

// Full fixture address for a coin (coins only carry a shortened one).
function baCoinAddress(coin) {
  const receive = baBook().receive
  const byLabel = receive.find((r) => r.label && r.label === coin.label)
  if (byLabel) return byLabel.address
  return ('tb1q' + coin.id + 'utxo' + baAccount().fingerprint + '0'.repeat(40)).slice(0, 42)
}

function baCoinTxid(coin) {
  return demoTxid('utxo-' + coin.id)
}

function baCoinVout(coin) {
  return coins.indexOf(coin) % 3
}

function baTxs() {
  return activity[baAccount().fingerprint] || []
}

// Public entry points other screens can call before go().
function baOpenAddress(addr) {
  baState.addr = addr
  go('account-address')
}

function baOpenUtxo(coinId) {
  baState.coinId = coinId
  go('account-utxo')
}

function baOpenTxLabel(tx) {
  baState.tx = tx
  go('account-tx-label')
}

function baCurrentAddr() {
  if (!baState.addr || !baAddressRow(baState.addr)) baState.addr = baBook().receive[0].address
  return baState.addr
}

function baCurrentCoin() {
  return coins.find((c) => c.id === baState.coinId) || coins[0]
}

function baCurrentTx() {
  if (baState.tx && baTxs().includes(baState.tx)) return baState.tx
  if (typeof openTxData !== 'undefined' && openTxData && baTxs().includes(openTxData)) return openTxData
  return baTxs()[0]
}

const baPath = (keychain, index) => `m/84'/1'/0'/${keychain === 'change' ? 1 : 0}/${index}`

// --- shared pieces ----------------------------------------------------------------------

// SSLabelDetails: header, label or placeholders, tags, pencil.
function baLabelDetails(header, label, tags, go) {
  const body =
    !label && !tags.length
      ? ss.hstack({ gap: 'sm' },
          ss.text({ size: 'sm', weight: 'light', className: 'ba-ph', as: 'span' }, t('transaction.noLabel')),
          ss.text({ size: 'sm', weight: 'light', className: 'ba-ph-dot', as: 'span' }, '·'),
          ss.text({ size: 'sm', weight: 'light', className: 'ba-ph', as: 'span' }, t('transaction.noTags')))
      : ss.hstack({ gap: 'sm', style: 'flex-wrap:wrap' },
          label
            ? ss.text({ size: label.length > 24 ? 'md' : 'lg', weight: 'light', as: 'span' }, ss.esc(label))
            : ss.text({ size: 'sm', weight: 'light', className: 'ba-ph', as: 'span' }, t('transaction.noLabel')),
          tags.map((tag) => `<span class="ba-tag">${ss.esc(tag)}</span>`).join(''))
  return `<button type="button" class="ba-label-details" data-go="${go}" aria-label="${ss.esc(header)}">${ss.vstack({ gap: 'xxs' },
    ss.text({ uppercase: true, color: 'muted', size: 'xs' }, ss.esc(header)),
    body)}${ss.icon('editPencil', { size: 16 })}</button>`
}

// SSLabelInput: label textarea, tag input, save / cancel.
function baLabelInput(label, tags) {
  return ss.vstack({ gap: 'sm', className: 'ba-pad' },
    ss.text({ uppercase: true }, t('common.label')),
    ss.textInput({ align: 'left', multiline: true, value: label, className: 'ba-label-input', name: 'label' }),
    ss.text({ uppercase: true }, t('common.tags')),
    `<div class="ba-tags" id="ba-tags">${tags.map((tag) => baTagChip(tag)).join('')}<input id="ba-tag-input" placeholder="Add tag" aria-label="Add tag"></div>`,
    ss.button({ label: t('common.save'), variant: 'secondary', id: 'ba-save' }),
    ss.button({ label: t('common.cancel'), variant: 'ghost', id: 'ba-cancel' }))
}

function baTagChip(tag) {
  return `<span class="ba-tag" data-tag="${ss.esc(tag)}">${ss.esc(tag)}<button type="button" class="ba-tag-x" aria-label="Remove tag">×</button></span>`
}

// Wires the label input; onSave receives { label, tags }.
function baBindLabelInput(body, onSave, onCancel) {
  const tagsBox = body.querySelector('#ba-tags')
  const tagInput = body.querySelector('#ba-tag-input')
  const area = body.querySelector('.ba-label-input textarea')
  area.addEventListener('input', () => (area.value = area.value.replace(/[\r\n]+/g, ' ')))
  tagInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ',') return
    e.preventDefault()
    const v = tagInput.value.trim().replace(/,/g, '')
    if (v && !tagsBox.querySelector(`[data-tag="${CSS.escape(v)}"]`)) tagInput.insertAdjacentHTML('beforebegin', baTagChip(v))
    tagInput.value = ''
  })
  tagsBox.addEventListener('click', (e) => {
    const x = e.target.closest('.ba-tag-x')
    if (x) x.closest('.ba-tag').remove()
    else tagInput.focus()
  })
  body.querySelector('#ba-save').onclick = () => {
    const pending = tagInput.value.trim()
    if (pending) tagInput.insertAdjacentHTML('beforebegin', baTagChip(pending))
    onSave({ label: area.value.trim(), tags: [...tagsBox.querySelectorAll('[data-tag]')].map((el) => el.dataset.tag) })
  }
  body.querySelector('#ba-cancel').onclick = onCancel
}

// Replace the kit back button handler (bind runs after openKitScreen wires it).
function baBack(fn) {
  document.getElementById('kit-back').onclick = fn
}

// SSBubbleChart with dimUnselected: highlighted coins white, others dimmed. Tap opens the UTXO.
function baBubbles(selectedIds) {
  const bubbles = packCoins(coins, 340, 300)
  return `<div class="ba-map-wrap"><div class="ba-map">${bubbles
    .map((b) => {
      const on = selectedIds.includes(b.item.id)
      return `<button type="button" class="bubble${on ? ' is-selected' : ' ba-dim'}" data-ba-utxo="${b.item.id}" style="width:${b.d}px;height:${b.d}px;min-width:${b.d}px;min-height:${b.d}px;left:${b.x}px;top:${b.y}px"><strong style="font-size:${Math.max(7, Math.min(12, b.d * 0.16))}px">${
        b.d < 48 ? '' : b.item.value.toLocaleString('en-US')
      }</strong>${b.d >= 72 ? '<span>' + ss.esc(b.item.label) + '</span>' : ''}</button>`
    })
    .join('')}</div><div class="ba-map-fade"></div></div>`
}

function baBindBubbles(body) {
  body.querySelectorAll('[data-ba-utxo]').forEach((b) => b.addEventListener('click', () => baOpenUtxo(b.dataset.baUtxo)))
}

// SSTransactionCard (expanded), simplified: direction, amount, label, date, txid.
function baTxRow(tx) {
  const type = tx.type === 'send' ? 'send' : 'receive'
  return `<button type="button" class="ba-tx-row" data-ba-tx="${tx.txid}">${ss.vstack({ gap: 'xs' },
    ss.hstack({ justifyBetween: true },
      ss.hstack({ gap: 'sm' },
        ss.icon(type === 'send' ? 'outgoing' : 'incoming', { size: 12 }),
        ss.hstack({ gap: 'xs', style: 'align-items:baseline' },
          ss.styledSat({ amount: tx.amount, textSize: 'xl', type, noColor: false, showSign: false }),
          ss.text({ color: 'muted', as: 'span' }, t('bitcoin.sats')))),
      ss.text({ color: 'muted', size: 'xs' }, tx.ago || '')),
    ss.hstack({ justifyBetween: true },
      ss.text({ color: tx.label ? 'white' : 'muted' }, ss.esc(tx.label || t('transaction.noLabel'))),
      ss.text({ color: 'muted', size: 'xs', type: 'mono' }, compactTxid(tx.txid))))}</button>`
}

// SSScriptDecoded, simplified: opcodes green, pushes gray.
function baScript(addr) {
  const hash = demoTxid('script' + addr).slice(0, 40)
  return `<div class="ba-script"><span class="is-op">OP_0</span><span>${hash}</span></div>`
}

const baFormatGroups = (addr) => (addr.match(/.{1,4}/g) || []).join(' ')

// --- receive.tsx -------------------------------------------------------------------------

function baReceive() {
  const fp = baAccount().fingerprint
  if (!baState.receive || baState.receive.fp !== fp) {
    const unused = baBook().receive.find((r) => !r.txs) || baBook().receive.at(-1)
    baState.receive = {
      fp,
      index: unused.index,
      address: unused.address,
      amount: '',
      fiat: '',
      fiatMode: false,
      label: '',
      prefix: true,
      includeLabel: true,
      payjoin: !baAccount().watchOnly && baAccount().balance > 0,
      loading: false,
      nfc: false
    }
  }
  return baState.receive
}

function baReceiveUri(r) {
  const params = []
  const sats = Number(r.amount)
  if (sats > 0) params.push('amount=' + (sats / SATS_PER_BTC).toFixed(8).replace(/0+$/, '').replace(/\.$/, ''))
  if (r.includeLabel && r.label) params.push('label=' + encodeURIComponent(r.label))
  if (r.payjoin && (!sats || sats >= 1000)) params.push('pj=' + encodeURIComponent('https://payjo.in/' + r.address.slice(-8) + '#RK1Q' + r.address.slice(4, 20).toUpperCase()))
  return (r.prefix ? 'bitcoin:' : '') + r.address + (params.length ? '?' + params.join('&') : '')
}

registerScreen('account-receive', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/receive.tsx',
  title: () => baAccount().name.toUpperCase(),
  back: 'account',
  gear: false,
  render: () => {
    const r = baReceive()
    const acct = baAccount()
    const singlesig = !acct.multisig && !acct.watchOnly
    const canContribute = acct.balance > 0
    const sats = Number(r.amount)
    const uri = baReceiveUri(r)
    const fiatLine = r.fiatMode
      ? r.fiat && Number(r.fiat) > 0
        ? Math.round((Number(r.fiat) / USD_PER_BTC) * SATS_PER_BTC).toLocaleString('en-US') + ' ' + t('bitcoin.sats')
        : `${t('receive.enterIn')} ${t('bitcoin.sats')}`
      : sats > 0
        ? usd(sats) + ' USD'
        : `${t('receive.enterIn')} USD`
    const payjoinBlock = !singlesig
      ? ''
      : !canContribute
        ? ss.text({ color: 'muted', size: 'sm', center: true }, t('receive.payjoin.emptyWallet'))
        : ss.vstack({ gap: 'xxs', itemsCenter: true, widthFull: true },
            sats > 0 && sats < 1000 ? ss.text({ color: 'muted', size: 'sm', center: true }, t('receive.payjoin.belowMinReceive', { count: 1000 })) : '',
            r.payjoin
              ? ss.hstack({ gap: 'sm', style: 'justify-content:center' },
                  ss.orbitLoader({ size: 18 }),
                  ss.text({ color: 'muted', size: 'sm', center: true }, t('receive.payjoin.status.waiting')))
              : '',
            r.payjoin ? ss.text({ color: 'muted', size: 'xs', center: true }, t('receive.payjoin.status.waitingHint')) : '')
    return `<div class="ba-screen">${ss.vstack({ itemsCenter: true, gap: 'lg' },
      ss.vstack({ widthFull: true },
        ss.vstack({ gap: 'none', itemsCenter: true },
          ss.text({ color: 'muted', uppercase: true }, t('receive.address')),
          r.loading ? ss.text({ size: '3xl', color: 'muted' }, '...') : ss.text({ size: '4xl' }, String(r.index))),
        ss.vstack({ gap: 'none', itemsCenter: true },
          ss.hstack({ gap: 'sm' },
            ss.text({ color: 'muted', uppercase: true, as: 'span' }, t('receive.path')),
            ss.text({ as: 'span', color: r.loading ? 'muted' : 'white' }, r.loading ? '...' : baPath('receive', r.index))),
          ss.text({}, t('receive.neverUsed'))),
        r.loading
          ? ss.vstack({ itemsCenter: true, gap: 'md' },
              ss.text({ color: 'muted', className: 'ba-ellipsis' }, t('receive.findingFreshAddress')))
          : ss.vstack({ itemsCenter: true, gap: 'md' },
              ss.qr({ value: uri, size: 220 }),
              ss.hstack({}, ss.button({ label: r.nfc ? t('receive.stopNFC') : t('receive.exportViaNFC'), variant: 'outline', id: 'ba-nfc' }))),
        r.loading
          ? ''
          : ss.vstack({ gap: 'sm', itemsCenter: true, style: 'margin:10px 0', widthFull: true },
              ss.text({}, 'Bitcoin URI'),
              `<p class="ba-uri">${ss.esc(uri)}</p>`,
              ss.clipboardCopy({ text: uri }, ss.button({ label: t('common.copy'), variant: 'secondary' })),
              ss.button({ label: t('common.share'), variant: 'outline', data: { 'ss-copy': uri } }),
              ss.hstack({ gap: 'sm', className: 'ba-toggles' },
                ss.button({ label: r.prefix ? t('receive.bitcoinPrefix') : t('receive.noPrefix'), variant: 'outline', id: 'ba-prefix' }),
                ss.button({ label: r.includeLabel ? t('receive.excludeLabel') : t('receive.includeLabel'), variant: 'outline', id: 'ba-inc-label' }),
                singlesig
                  ? ss.button({ label: r.payjoin ? t('receive.payjoin.disable') : t('receive.payjoin.enable'), variant: 'outline', id: 'ba-payjoin' })
                  : ''),
              payjoinBlock)),
      ss.form({},
        ss.form.item({},
          ss.form.label({ label: `${t('receive.customAmount')} (${r.fiatMode ? 'USD' : t('bitcoin.sats')})` }),
          r.fiatMode
            ? ss.textInput({ value: r.fiat, placeholder: '0.00 USD', inputMode: 'decimal', className: 'ba-fiat-input', name: 'fiat' })
            : ss.textInput({ value: r.amount, placeholder: t('receive.placeholder.sats'), inputMode: 'numeric', className: 'ba-fiat-input', name: 'amount' }),
          ss.text({ color: 'muted', size: 'sm', center: true, className: 'ba-switch', id: 'ba-amount-mode' }, fiatLine),
          ss.button({ label: t('receive.pasteAmount'), variant: 'subtle', id: 'ba-paste-amount' })),
        ss.form.item({},
          ss.form.label({ label: t('receive.label') }),
          ss.textInput({ align: 'left', multiline: true, value: r.label, placeholder: t('receive.placeholder.label'), name: 'rlabel', className: 'ba-rlabel' }),
          ss.button({ label: t('receive.pasteLabel'), variant: 'subtle', id: 'ba-paste-label' }))),
      ss.vstack({ gap: 'xs', itemsCenter: true, style: 'margin:10px 0', widthFull: true },
        ss.text({}, t('receive.address')),
        r.loading
          ? ss.text({ color: 'muted' }, '...')
          : ss.vstack({ itemsCenter: true, gap: 'xs', widthFull: true },
              `<p class="ba-addr-box">${baFormatGroups(r.address)}</p>`,
              ss.hstack({}, ss.clipboardCopy({ text: r.address }, ss.button({ label: t('common.copy'), variant: 'subtle' }))))),
      ss.vstack({ widthFull: true, gap: 'sm' },
        ss.button({ label: t('receive.generateAnother'), variant: 'secondary', loading: r.loading, id: 'ba-generate' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'account' })))}</div>`
  },
  bind: (body) => {
    const r = baReceive()
    const rerender = () => {
      const y = body.scrollTop
      openKitScreen('account-receive')
      document.getElementById('kit-body').scrollTop = y
    }
    const on = (id, fn) => {
      const el = body.querySelector('#' + id)
      if (el) el.addEventListener('click', fn)
    }
    on('ba-prefix', () => ((r.prefix = !r.prefix), rerender()))
    on('ba-inc-label', () => ((r.includeLabel = !r.includeLabel), rerender()))
    on('ba-payjoin', () => ((r.payjoin = !r.payjoin), rerender()))
    on('ba-nfc', () => {
      r.nfc = !r.nfc
      if (r.nfc) ss.toast(t('receive.exportViaNFC'), document.getElementById('view-kit'))
      rerender()
    })
    on('ba-amount-mode', () => {
      if (r.fiatMode) {
        r.amount = r.fiat ? String(Math.round((Number(r.fiat) / USD_PER_BTC) * SATS_PER_BTC)) : r.amount
      } else {
        r.fiat = r.amount ? ((Number(r.amount) / SATS_PER_BTC) * USD_PER_BTC).toFixed(2) : ''
      }
      r.fiatMode = !r.fiatMode
      rerender()
    })
    on('ba-paste-amount', () => {
      if (r.fiatMode) r.fiat = '25.00'
      else r.amount = '25000'
      rerender()
    })
    on('ba-paste-label', () => ((r.label = 'Invoice #1042'), rerender()))
    on('ba-generate', () => {
      r.loading = true
      rerender()
      setTimeout(() => {
        r.index += 1
        r.address = ('tb1q' + demoTxid('recv' + r.fp + r.index)).slice(0, 42)
        r.loading = false
        if (kitCurrent === 'account-receive') rerender()
      }, 900)
    })
    // Amount and label update the URI/QR when the field is committed.
    body.querySelectorAll('input[name=amount], input[name=fiat]').forEach((input) =>
      input.addEventListener('change', () => {
        const v = input.value.replace(/[^\d.]/g, '')
        if (input.name === 'amount') r.amount = v.replace(/\..*/, '')
        else r.fiat = v
        rerender()
      })
    )
    const labelArea = body.querySelector('.ba-rlabel textarea')
    if (labelArea) labelArea.addEventListener('change', () => ((r.label = labelArea.value.trim()), rerender()))
  }
})

// --- address/[addr]/index.tsx -------------------------------------------------------------

registerScreen('account-address', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/address/[addr]/index.tsx',
  title: () => t('address.details.title'),
  back: 'account',
  render: () => {
    const addr = baCurrentAddr()
    const found = baAddressRow(addr)
    const row = found.row
    const tags = baState.tags.addr[addr] || []
    const acct = baAccount()
    const matching = baTxs().filter((tx) => tx.label && tx.label === row.label)
    const txs = row.txs ? matching.concat(baTxs().filter((tx) => !matching.includes(tx))).slice(0, row.txs) : []
    const addrCoins = coins.filter((c) => baCoinAddress(c) === addr)
    const revealed = baState.revealed === addr
    const keys = revealed
      ? {
          pub: '02' + demoTxid('pub' + addr),
          priv: demoTxid('priv' + addr),
          wif: 'cV' + demoTxid('wif' + addr).slice(0, 50)
        }
      : {}
    return `<div class="ba-screen">${ss.vstack({},
      ss.vstack({},
        ss.text({ weight: 'bold', uppercase: true, size: 'md' }, t('bitcoin.address')),
        ss.addressDisplay({ address: addr })),
      ss.separator(),
      baLabelDetails(t('common.label').toUpperCase(), row.label, tags, 'account-address-label'),
      ss.separator(),
      ss.vstack({ gap: 'sm' },
        ss.detailsList({
          columns: 2,
          items: [
            [t('address.details.balance.confirmed'), row.balance.toLocaleString('en-US')],
            [t('bitcoin.confirmations.unconfirmed'), row.mempool.toLocaleString('en-US')],
            [t('address.details.history.tx'), row.txs],
            [t('address.details.history.utxo'), row.utxos]
          ]
        })),
      ss.separator(),
      txs.length
        ? ss.vstack({},
            ss.text({ uppercase: true, size: 'md', weight: 'bold' }, t('bitcoin.transactions')),
            `<div>${txs.map(baTxRow).join('')}</div>`) + ss.separator()
        : '',
      addrCoins.length
        ? ss.vstack({}, ss.text({ uppercase: true, weight: 'bold', size: 'md' }, t('bitcoin.utxos')), baBubbles(addrCoins.map((c) => c.id))) + ss.separator()
        : '',
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, weight: 'bold', size: 'md' }, t('address.details.encoding.title')),
        ss.detailsList({
          columns: 2,
          items: [
            [t('address.details.encoding.scriptVersion'), 'v0_p2wpkh'],
            [t('address.details.encoding.network'), acct.network || 'signet']
          ]
        }),
        ss.vstack({ gap: 'xs' },
          ss.text({ uppercase: true, weight: 'bold' }, t('address.details.encoding.script')),
          ss.text({ type: 'mono', uppercase: true, color: 'muted', style: 'word-break:break-all' }, 'OP_0 OP_PUSHBYTES_20 ' + demoTxid('script' + addr).slice(0, 40)))),
      ss.separator(),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, weight: 'bold', size: 'md' }, t('address.details.derivation.title')),
        ss.detailsList({
          columns: 2,
          items: [
            [t('address.details.derivation.path'), baPath(found.keychain, row.index), { variant: 'mono' }],
            [t('address.details.derivation.index'), row.index],
            [t('address.details.derivation.fingerprint'), acct.fingerprint, { variant: 'mono' }],
            [t('address.details.derivation.keychain'), found.keychain === 'change' ? 'internal' : 'external']
          ]
        })),
      ss.separator(),
      ss.vstack({},
        ss.text({ uppercase: true, weight: 'bold', size: 'md' }, t('address.details.key.title')),
        ss.detailsList({
          columns: 1,
          items: [
            [t('address.details.key.public'), keys.pub, { copyToClipboard: true, variant: 'mono' }],
            [t('address.details.key.private'), keys.priv, { copyToClipboard: true, variant: 'mono' }],
            [t('address.details.key.privateWif'), keys.wif, { copyToClipboard: true, variant: 'mono' }]
          ]
        }),
        revealed || acct.watchOnly ? '' : ss.button({ label: t('address.details.key.reveal'), variant: 'outline', id: 'ba-reveal' }),
        acct.watchOnly ? ss.text({ color: 'muted', size: 'xs' }, t('address.details.key.unavailable')) : '',
        !acct.multisig && !acct.watchOnly ? ss.button({ label: t('address.details.signMessage'), variant: 'subtle', go: 'account-address-sign' }) : '',
        ss.button({ label: t('address.details.verifyMessage'), variant: 'subtle', go: 'account-address-verify' })))}</div>`
  },
  overlays: () =>
    ss.modal({ id: 'ba-pin-modal' },
      ss.vstack({ itemsCenter: true, gap: 'lg' },
        ss.text({ uppercase: true, center: true }, t('account.enter.pin')),
        `<p class="pin-dots" aria-label="PIN entry" id="ba-pin-dots"><i></i><i></i><i></i><i></i></p>`,
        ss.text({ color: 'muted', center: true, size: 'xs' }, 'Demo: tap to enter 4 digits'),
        ss.button({ label: '••••', variant: 'outline', id: 'ba-pin-enter' }))),
  bind: (body) => {
    baBindBubbles(body)
    body.querySelectorAll('[data-ba-tx]').forEach((b) =>
      b.addEventListener('click', () => {
        const tx = baTxs().find((x) => x.txid === b.dataset.baTx)
        if (tx) openTransaction(tx)
      })
    )
    const reveal = body.querySelector('#ba-reveal')
    if (reveal) reveal.onclick = () => ss.open('ba-pin-modal')
    const enter = document.getElementById('ba-pin-enter')
    if (enter)
      enter.onclick = () => {
        const dots = [...document.querySelectorAll('#ba-pin-dots i')]
        let i = 0
        const tick = () => {
          dots[i++].classList.add('is-on')
          if (i < dots.length) return setTimeout(tick, 120)
          setTimeout(() => {
            baState.revealed = baCurrentAddr()
            openKitScreen('account-address')
          }, 200)
        }
        tick()
      }
  }
})

// --- address/[addr]/label.tsx -------------------------------------------------------------

registerScreen('account-address-label', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/address/[addr]/label.tsx',
  title: () => t('address.label.title').toUpperCase(),
  back: 'account-address',
  render: () => {
    const addr = baCurrentAddr()
    const row = baAddressRow(addr).row
    return `<div class="ba-screen">${ss.vstack({ gap: 'none' },
      ss.vstack({}, ss.text({ uppercase: true, weight: 'bold' }, t('bitcoin.address')), ss.addressDisplay({ address: addr })),
      baLabelInput(row.label || '', baState.tags.addr[addr] || []))}</div>`
  },
  bind: (body) => {
    const addr = baCurrentAddr()
    baBindLabelInput(
      body,
      ({ label, tags }) => {
        baAddressRow(addr).row.label = label
        baState.tags.addr[addr] = tags
        go('account-address')
      },
      () => go('account-address')
    )
  }
})

// --- address/[addr]/signMessage.tsx -------------------------------------------------------

registerScreen('account-address-sign', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/address/[addr]/signMessage.tsx',
  title: () => t('address.signMessage.title').toUpperCase(),
  back: 'account-address',
  render: () => {
    const addr = baCurrentAddr()
    const s = baState.sign && baState.sign.addr === addr ? baState.sign : (baState.sign = { addr, message: '', signing: false, method: null, signature: '' })
    return `<div class="ba-screen">${ss.vstack({ gap: 'lg', className: 'ba-pad' },
      ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true, weight: 'bold' }, t('bitcoin.address')), ss.addressDisplay({ address: addr })),
      ss.separator(),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, weight: 'bold' }, t('address.signMessage.message')),
        ss.textInput({ align: 'left', multiline: true, value: s.message, placeholder: t('address.signMessage.messagePlaceholder'), className: 'ba-msg', readOnly: s.signing })),
      ss.vstack({ gap: 'sm' },
        ss.button({ label: t('address.signMessage.signBip137'), variant: 'outline', id: 'ba-sign-137', disabled: !s.message.trim(), loading: s.signing && s.method === 'bip137' }),
        ss.button({ label: t('address.signMessage.signBip322'), variant: 'outline', id: 'ba-sign-322', disabled: !s.message.trim(), loading: s.signing && s.method === 'bip322' })),
      s.signing ? ss.text({ center: true, color: 'muted' }, t('address.signMessage.signing')) : '',
      !s.signing && s.signature
        ? ss.vstack({ gap: 'sm' },
            ss.text({ uppercase: true, weight: 'bold' }, s.method === 'bip137' ? t('address.signMessage.signatureBip137') : t('address.signMessage.signatureBip322')),
            ss.clipboardCopy({ text: s.signature }, ss.text({ type: 'mono', size: 'sm', style: 'word-break:break-all' }, s.signature)),
            ss.clipboardCopy({ text: s.signature }, ss.button({ label: t('common.copyToClipboard'), variant: 'outline' })),
            ss.button({ label: t('common.share'), variant: 'outline', data: { 'ss-copy': s.signature } }))
        : '')}</div>`
  },
  bind: (body) => {
    const s = baState.sign
    const area = body.querySelector('.ba-msg textarea')
    const b137 = body.querySelector('#ba-sign-137')
    const b322 = body.querySelector('#ba-sign-322')
    area.addEventListener('input', () => {
      s.message = area.value
      b137.disabled = b322.disabled = !s.message.trim()
    })
    const sign = (method) => {
      s.method = method
      s.signing = true
      s.signature = ''
      openKitScreen('account-address-sign')
      setTimeout(() => {
        const raw = demoTxid(method + s.addr + s.message) + demoTxid(s.message + method)
        s.signature = method === 'bip137' ? btoa(raw.slice(0, 65)).slice(0, 88) : 'AkcwRAIg' + btoa(raw).slice(0, 140)
        s.signing = false
        if (kitCurrent === 'account-address-sign') openKitScreen('account-address-sign')
      }, 800)
    }
    b137.addEventListener('click', () => sign('bip137'))
    b322.addEventListener('click', () => sign('bip322'))
  }
})

// --- address/[addr]/verifyMessage.tsx (SSVerifyMessage) ------------------------------------

registerScreen('account-address-verify', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/address/[addr]/verifyMessage.tsx',
  title: () => t('address.verifyMessage.title').toUpperCase(),
  back: 'account-address',
  render: () => {
    const addr = baCurrentAddr()
    return `<div class="ba-screen">${ss.vstack({ gap: 'lg', className: 'ba-pad' },
      ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true, weight: 'bold' }, t('bitcoin.address')), ss.addressDisplay({ address: addr })),
      ss.separator(),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, weight: 'bold' }, t('address.verifyMessage.message')),
        ss.textInput({ align: 'left', multiline: true, placeholder: t('address.verifyMessage.messagePlaceholder'), className: 'ba-msg' })),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true, weight: 'bold' }, t('address.verifyMessage.signature')),
        ss.textInput({ align: 'left', multiline: true, placeholder: t('address.verifyMessage.signaturePlaceholder'), className: 'ba-sig' })),
      ss.button({ label: t('address.verifyMessage.verify'), variant: 'secondary', disabled: true, id: 'ba-verify' }),
      '<div id="ba-verify-result"></div>')}</div>`
  },
  bind: (body) => {
    const msg = body.querySelector('.ba-msg textarea')
    const sig = body.querySelector('.ba-sig textarea')
    const btn = body.querySelector('#ba-verify')
    const out = body.querySelector('#ba-verify-result')
    const reset = () => {
      btn.disabled = !sig.value.trim()
      out.innerHTML = ''
    }
    msg.addEventListener('input', reset)
    sig.addEventListener('input', reset)
    btn.addEventListener('click', () => {
      // Fixture rule: a signature produced on the sign screen for this message verifies.
      const s = baState.sign
      const valid = !!s && s.signature && sig.value.trim() === s.signature && msg.value === s.message
      out.innerHTML = valid
        ? ss.text({ center: true, className: 'ba-valid' }, t('address.verifyMessage.valid'))
        : ss.text({ center: true, className: 'ba-invalid' }, t('address.verifyMessage.invalid'))
    })
  }
})

// --- transaction/[txid]/label.tsx ----------------------------------------------------------

// SSTxDetailsHeader: direction icon, styled amount, fiat, confirmations, in/out counts.
function baTxHeader(tx) {
  const type = tx.type === 'send' ? 'send' : 'receive'
  const conf = tx.conf > 0 ? `${tx.conf.toLocaleString('en-US')} confirmations` : 'Unconfirmed'
  return ss.vstack({ gap: 'sm', itemsCenter: true },
    tx.ago ? ss.text({ color: 'muted' }, tx.ago) : '',
    ss.vstack({ gap: 'xxs', itemsCenter: true },
      ss.hstack({ gap: 'sm' },
        ss.icon(type === 'send' ? 'outgoing' : 'incoming', { size: 12 }),
        ss.hstack({ gap: 'xs', style: 'align-items:baseline' },
          ss.amountDisplay({ amount: tx.amount, textSize: ss.moneySize(tx.amount, '4xl', 'xl'), weight: 'ultralight', type, noColor: false, showSign: false, unitSize: 'xl', fitMax: 280 }))),
      tx.fiat
        ? ss.hstack({ gap: 'xs' },
            ss.text({ color: 'muted', size: 'sm', as: 'span' }, usd(tx.amount)),
            ss.text({ size: 'sm', style: 'color:var(--gray-500)', as: 'span' }, 'USD'),
            tx.historical ? ss.text({ color: 'muted', size: 'sm', as: 'span' }, `(${tx.historical})`) : '',
            tx.priceChange
              ? ss.text({ size: 'sm', as: 'span', style: `color:var(${tx.priceChange[0] === '+' ? '--soft-bar-green' : '--soft-bar-red'})` }, tx.priceChange)
              : '')
        : ''),
    ss.hstack({ gap: 'sm' },
      ss.text({ weight: 'light', style: `color:var(${tx.conf > 5 ? '--main-green' : '--warning'})` }, conf),
      ss.text({}, `<span class="ss-text is-muted">${t('common.from').toLowerCase()}</span> ${tx.inputs} ${(tx.inputs === 1 ? t('transaction.input.singular') : t('transaction.input.plural')).toLowerCase()}`),
      ss.text({}, `<span class="ss-text is-muted">${t('common.to').toLowerCase()}</span> ${tx.outputs} ${tx.outputs === 1 ? t('transaction.output.singular') : t('transaction.output.plural')}`)))
}

registerScreen('account-tx-label', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/transaction/[txid]/label.tsx',
  title: () => t('transaction.edit.label.transaction'),
  back: 'tx',
  render: () => {
    const tx = baCurrentTx()
    return `<div class="ba-screen">${ss.vstack({ className: 'ba-pad' }, baTxHeader(tx), baLabelInput(tx.label || '', tx.tags || []))}</div>`
  },
  bind: (body) => {
    const tx = baCurrentTx()
    const back = () => openTransaction(tx)
    baBack(back)
    baBindLabelInput(
      body,
      ({ label, tags }) => {
        tx.label = label
        tx.tags = tags
        back()
      },
      back
    )
  }
})

// --- transaction/[txid]/utxo/[vout]/index.tsx -----------------------------------------------

registerScreen('account-utxo', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/transaction/[txid]/utxo/[vout]/index.tsx',
  title: () => t('utxo.details.title'),
  back: 'account',
  render: () => {
    const coin = baCurrentCoin()
    const addr = baCoinAddress(coin)
    const found = baAddressRow(addr)
    const txid = baCoinTxid(coin)
    const vout = baCoinVout(coin)
    const tags = baState.tags.utxo[coin.id] || []
    const tx = {
      type: 'receive',
      txid,
      amount: coin.value,
      fee: 141,
      size: 222,
      vsize: 141,
      inputs: 1,
      outputs: 2,
      flowInputs: [{ value: coin.value + 25000 + 141, label: 'External', ours: false, from: demoTxid('in' + coin.id) }],
      flowOutputs: [
        { value: coin.value, label: coin.label || t('utxo.noLabel'), ours: true, to: addr },
        { value: 25000, label: 'External', ours: false, to: 'tb1qexternal000000000000000000000000' },
        { value: 141, label: 'Miner fee', fee: true }
      ]
    }
    return `<div class="ba-utxo">
      ${baBubbles([coin.id])}
      ${ss.separator()}
      <div class="ba-screen">${ss.vstack({ gap: 'lg', className: 'ba-pad' },
        baLabelDetails(t('utxo.label'), coin.label, tags, 'account-utxo-label'),
        ss.separator(),
        ss.vstack({},
          ss.vstack({ gap: 'sm' },
            ss.hstack({ gap: 'xs', style: 'align-items:baseline' },
              ss.text({ weight: 'bold', uppercase: true, as: 'span' }, t('utxo.address')),
              found ? ss.text({ color: 'muted', size: 'sm', as: 'span' }, `(${found.row.index})`) : ''),
            ss.addressDisplay({ address: addr }),
            ss.button({ variant: 'outline', label: t('utxo.viewAddress'), id: 'ba-view-address', disabled: !found })),
          ss.separator(),
          ss.vstack({ gap: 'sm' }, ss.text({ weight: 'bold', uppercase: true }, t('transaction.id')), ss.addressDisplay({ address: txid })),
          ss.separator(),
          ss.vstack({ gap: 'sm' },
            ss.text({ uppercase: true, weight: 'bold', size: 'md' }, t('transaction.details.chart')),
            '<div style="overflow:hidden">' + txDetailSankey(tx) + '</div>',
            ss.button({ variant: 'outline', label: t('utxo.viewTransaction'), id: 'ba-view-tx' })),
          ss.separator(),
          ss.detailsList({
            columns: 2,
            items: [
              [t('common.date'), shortDate(coin.timestamp)],
              [t('bitcoin.block'), (283270 - coins.indexOf(coin) * 412).toLocaleString('en-US')],
              [t('common.value'), coin.value.toLocaleString('en-US') + ' ' + t('bitcoin.sats')],
              [t('common.valueFiat'), usd(coin.value) + ' USD'],
              [t('utxo.outputIndex'), vout]
            ]
          }),
          ss.separator(),
          ss.vstack({}, ss.text({ weight: 'bold', uppercase: true }, t('utxo.unlockingScript')), baScript(addr)),
          ss.separator(),
          ss.button({ variant: 'secondary', label: t('utxo.spend'), id: 'ba-spend' })))}</div>
    </div>`
  },
  bind: (body) => {
    const coin = baCurrentCoin()
    baBindBubbles(body)
    const viewAddr = body.querySelector('#ba-view-address')
    if (viewAddr) viewAddr.onclick = () => baOpenAddress(baCoinAddress(coin))
    body.querySelector('#ba-view-tx').onclick = () => {
      const tx = baTxs().find((x) => x.label && x.label === coin.label) || baTxs()[0]
      if (tx) openTransaction(tx)
    }
    body.querySelector('#ba-spend').onclick = () => {
      coin.excluded = false
      coin.selected = true
      openSend('output')
    }
  }
})

// --- transaction/[txid]/utxo/[vout]/label.tsx -----------------------------------------------

registerScreen('account-utxo-label', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/transaction/[txid]/utxo/[vout]/label.tsx',
  title: () => t('transaction.edit.label.utxo'),
  back: 'account-utxo',
  render: () => {
    const coin = baCurrentCoin()
    return `<div class="ba-screen">${ss.vstack({ gap: 'none', className: 'ba-pad' },
      ss.vstack({ gap: 'sm' },
        ss.vstack({ gap: 'none' }, ss.text({ uppercase: true }, t('transaction.txid')), ss.text({ color: 'muted', style: 'word-break:break-all' }, baCoinTxid(coin))),
        ss.vstack({ gap: 'none' }, ss.text({ uppercase: true }, t('utxo.vout')), ss.text({ color: 'muted' }, String(baCoinVout(coin))))),
      baLabelInput(coin.label || '', baState.tags.utxo[coin.id] || []))}</div>`
  },
  bind: (body) => {
    const coin = baCurrentCoin()
    baBindLabelInput(
      body,
      ({ label, tags }) => {
        coin.label = label
        baState.tags.utxo[coin.id] = tags
        go('account-utxo')
      },
      () => go('account-utxo')
    )
  }
})

// --- signAndSend/importOutputs.tsx ----------------------------------------------------------

// utils/parse.ts parseTXOutputs: "address?amount=…&label=…, address?…"
function baParseOutputs(input) {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [address, query] = entry.split('?')
      const params = new URLSearchParams(query)
      const amount = params.get('amount')
      const label = params.get('label')
      return { amount: amount ? Number(amount) : 0, label: label ? label.replace(/(^["“]|["”]$)/g, '') : t('common.noLabel'), to: address }
    })
}

const baImport = { text: null, valid: false }
const BA_IMPORT_FIXTURE =
  'tb1qrent0demo000000000000000000000000000?amount=210000&label="Rent", tb1qgym00demo000000000000000000000000000?amount=45000&label="Gym", tb1qbook0demo000000000000000000000000000?amount=18000&label="Books"'

registerScreen('import-outputs', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/signAndSend/importOutputs.tsx',
  title: 'EXTRA SECURITY',
  back: 'send',
  render: () => {
    const tn = (k) => t('transaction.build.options.importOutputs.' + k)
    if (baImport.text === null) baImport.text = tn('emptyContent')
    return ss.vstack({ justifyBetween: true, style: 'padding-top:12px;padding-bottom:24px' },
      ss.vstack({},
        ss.text({ uppercase: true, center: true, size: 'lg' }, tn('title')),
        `<pre class="ba-import-box">${ss.esc(baImport.text)}</pre>`),
      ss.vstack({},
        ss.hstack({},
          ss.button({ label: 'PASTE', className: 'ba-half', id: 'ba-import-paste' }),
          ss.button({ label: 'SCAN QRCODE', className: 'ba-half', disabled: true })),
        ss.button({ label: tn('button'), variant: 'secondary', disabled: !baImport.valid, id: 'ba-import-go' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', id: 'ba-import-cancel' })))
  },
  bind: (body) => {
    const reset = () => {
      baImport.text = null
      baImport.valid = false
    }
    body.querySelector('#ba-import-paste').onclick = () => {
      baImport.text = BA_IMPORT_FIXTURE
      baImport.valid = true
      openKitScreen('import-outputs')
    }
    body.querySelector('#ba-import-go').onclick = () => {
      baParseOutputs(baImport.text).forEach((out, i) => draft.outputs.push({ id: Date.now() + i, ...out }))
      reset()
      go('send')
    }
    body.querySelector('#ba-import-cancel').onclick = () => {
      reset()
      go('send')
    }
  }
})
