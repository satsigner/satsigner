/* Screens built only from the SS kit. Each entry ports one app route:

     registerScreen('route-id', {
       source: 'app/.../file.tsx',
       title: () => 'HEADER',        // stack header title
       back: 'send',                 // route id the back button opens
       render: (state) => html,      // body markup (ss.* + t())
       bind: (body, state) => {}     // optional: wire up clicks after render
     })

   go('route-id') opens it in the shared #view-kit section. Add the id to catalog.js and coverage.json. */

const kitScreens = {}
let kitCurrent = null

function registerScreen(id, def) {
  kitScreens[id] = def
}

function openKitScreen(id) {
  const def = kitScreens[id]
  kitCurrent = id
  if (!openAccountData) openAccountData = accounts[0]
  const state = { id }
  document.getElementById('kit-title').textContent = typeof def.title === 'function' ? def.title() : def.title || ''
  const back = document.getElementById('kit-back')
  back.hidden = def.back === null
  back.innerHTML = icon('back', 'back-mark')
  back.onclick = () => go(def.back || 'menu')
  // Fresh node each time so listeners from the previous screen don't pile up.
  const old = document.getElementById('kit-body')
  const body = old.cloneNode(false)
  old.replaceWith(body)
  body.innerHTML = def.render(state)
  document.getElementById('kit-overlays').innerHTML = def.overlays ? def.overlays(state) : ''
  if (def.bind) def.bind(body, state)
  show('kit', id)
}

// SSNumberInput: validates against min/max as you type (red border when out of range).
document.addEventListener('input', (e) => {
  const input = e.target.closest('[data-ss-number] input')
  if (!input) return
  const root = input.closest('[data-ss-number]')
  const v = input.value.trim()
  const ok = v !== '' && /^\d+$/.test(v) && +v >= +root.dataset.min && +v <= +root.dataset.max
  root.classList.toggle('is-invalid', v !== '' && !ok)
  root.dataset.valid = ok
  root.dispatchEvent(new CustomEvent('ss-validate', { bubbles: true }))
})

function numberInput(p) {
  return ss.textInput({ ...p, inputMode: 'numeric', data: { 'ss-number': '', min: p.min, max: p.max } })
}

// --- signAndSend: small option screens -------------------------------------------------

const sendOptions = { rbf: true, timelock: null }

// feeManagement.tsx
registerScreen('fee-management', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/signAndSend/feeManagement.tsx',
  title: 'Extra Options',
  back: 'send',
  render: () =>
    ss.vstack({ justifyBetween: true, style: 'padding-top:12px;padding-bottom:24px' },
      ss.vstack({ gap: 'lg' },
        ss.text({ center: true, uppercase: true, size: 'lg' }, t('transaction.build.options.feeManagement')),
        ss.vstack({}, ss.checkbox({ label: t('bitcoin.rbf').toUpperCase(), selected: sendOptions.rbf, id: 'rbf-box' }))),
      ss.vstack({},
        ss.button({ variant: 'secondary', label: t('common.save'), id: 'kit-save' }),
        ss.button({ variant: 'ghost', label: t('common.cancel'), go: 'send' }))),
  bind: (body) => {
    body.querySelector('#kit-save').onclick = () => {
      sendOptions.rbf = body.querySelector('#rbf-box').classList.contains('is-on')
      go('send')
    }
  }
})

// timeLock.tsx
const CURRENT_BLOCK_HEIGHT = 885000
const SAFE_TIMELOCK_LIMIT = CURRENT_BLOCK_HEIGHT + 52560 * 2

registerScreen('timelock', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/signAndSend/timeLock.tsx',
  title: 'EXTRA SECURITY',
  back: 'send',
  render: () => {
    const lock = sendOptions.timelock || { type: 'blockHeight' }
    const tab = (type, label) =>
      ss.button({ label, variant: 'outline', className: 'timelock-tab' + (lock.type === type ? ' is-on' : ''), style: 'flex-grow:1;width:45%', data: { tab: type } })
    const field = (key, min, max, size) => `<div style="flex-grow:1;width:${size || 'auto'}">${numberInput({ min, max, placeholder: t('date.' + key).toUpperCase(), value: lock[key] || '', name: key })}</div>`
    return ss.vstack({ justifyBetween: true, style: 'padding-top:12px;padding-bottom:24px' },
      ss.vstack({ style: 'min-height:300px' },
        ss.text({ center: true, uppercase: true, size: 'lg' }, t('transaction.build.options.timeLock')),
        ss.hstack({ style: 'margin-bottom:24px' }, tab('blockHeight', t('bitcoin.blockHeight')), tab('date', t('date.date'))),
        `<div class="timelock-pane" data-pane="blockHeight"${lock.type === 'blockHeight' ? '' : ' hidden'}>${numberInput({
          min: CURRENT_BLOCK_HEIGHT, max: SAFE_TIMELOCK_LIMIT, placeholder: t('bitcoin.blockHeight').toUpperCase(), value: lock.blockHeight || '', name: 'blockHeight'
        })}</div>`,
        `<div class="timelock-pane" data-pane="date"${lock.type === 'date' ? '' : ' hidden'}>${ss.vstack({ gap: 'lg' },
          ss.hstack({}, field('year', 2025, 2050), field('month', 1, 12), field('day', 1, 31)),
          ss.hstack({}, field('hour', 0, 23), field('minute', 0, 60)))}</div>`),
      ss.vstack({},
        ss.button({ label: t('common.remove'), id: 'kit-remove' }),
        ss.button({ variant: 'secondary', label: t('common.save'), id: 'kit-save', disabled: true }),
        ss.button({ variant: 'ghost', label: t('common.cancel'), go: 'send' })))
  },
  bind: (body) => {
    let type = (sendOptions.timelock || { type: 'blockHeight' }).type
    const save = body.querySelector('#kit-save')
    const pane = () => body.querySelector(`[data-pane="${type}"]`)
    const validate = () => {
      const fields = [...pane().querySelectorAll('[data-ss-number]')]
      save.disabled = !fields.every((f) => f.dataset.valid === 'true')
    }
    body.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        type = b.dataset.tab
        body.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('is-on', x === b))
        body.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== type))
        validate()
      })
    )
    body.addEventListener('ss-validate', validate)
    body.querySelector('#kit-remove').onclick = () => {
      sendOptions.timelock = null
      go('send')
    }
    save.onclick = () => {
      const lock = { type }
      pane().querySelectorAll('input').forEach((i) => (lock[i.name] = i.value))
      sendOptions.timelock = lock
      go('send')
    }
  }
})

// walletSyncedConfirmation.tsx (copy is hard-coded in the app too)
registerScreen('wallet-synced', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/signAndSend/walletSyncedConfirmation.tsx',
  title: () => openAccountData.name,
  back: 'account',
  render: () => {
    const block = (title, copy) => ss.vstack({ gap: 'none' }, ss.text({ size: 'lg', weight: 'bold' }, title), ss.text({}, copy))
    return ss.vstack({ justifyBetween: true },
      ss.vstack({},
        ss.text({ size: '3xl', uppercase: true, center: true, weight: 'bold' }, 'Ensure wallet data is updated'),
        block('Incorret information can lead to invalid transaction',
          'Funds which you spent elsewhere but are still flagged as UTXOs by this wallet could lead to a transaction with invalid inputs.'),
        block('Missing information can result in privacy leaks',
          'Missing transactions may lead to reuse of internal change address, which links two distinct transactions sending to the same address.'),
        ss.vstack({ gap: 'none' },
          ss.text({}, 'Wallet last synced at ' + new Date(Date.now() - 36e5 * 26).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) + '.'),
          ss.text({}, 'Update your wallet to avoid these issues.'))),
      ss.vstack({ gap: 'sm' },
        ss.button({ label: 'SYNC NOW', variant: 'secondary', id: 'kit-sync' }),
        ss.button({ label: 'IGNORE', variant: 'danger', go: 'send' }),
        ss.button({ label: 'PROCEED', go: 'send' })))
  },
  bind: (body) => {
    const sync = body.querySelector('#kit-sync')
    sync.onclick = () => {
      sync.disabled = true
      sync.innerHTML = '<span class="ss-spinner"></span>'
      setTimeout(() => go('send'), 1200)
    }
  }
})

// --- signAndSend: coin selection -----------------------------------------------------

// Fixture metadata the old coin list didn't need.
coins.forEach((coin, i) => {
  if (!coin.timestamp) coin.timestamp = Date.UTC(2026, 9, 18 - i * 3, 12)
  if (coin.excluded === undefined) coin.excluded = false
  if (coin.addressIndex === undefined) coin.addressIndex = i * 2
})
const coinSort = { field: 'amount', dir: 'desc' }
const usd = (sats) => ((sats / SATS_PER_BTC) * USD_PER_BTC).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const shortDate = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// SSUtxoSizeMeter: square-root scale, 1–82% width.
function sizeMeter(value, largest, selected) {
  const pct = Math.min(82, Math.max(1, 1 + (81 * Math.round((Math.sqrt(value) / Math.sqrt(largest)) * 100)) / 100))
  return `<div class="utxo-meter"><i></i><b class="${selected ? 'is-on' : ''}" style="width:${pct}%"></b></div>`
}

// SSUtxoItem
function utxoItem(coin, largest) {
  return `<div class="utxo-item${coin.excluded ? ' is-excluded' : ''}">
    <div class="utxo-row">
      <button type="button" class="utxo-body" data-coin="${coin.id}">${ss.vstack({ gap: 'xs' },
        ss.hstack({ justifyBetween: true, style: 'align-items:flex-start' },
          ss.hstack({},
            `<span class="utxo-select${coin.selected ? ' is-on' : ''}">${ss.icon(coin.selected ? 'x' : 'plus', { size: 8 })}</span>`,
            ss.vstack({ gap: 'xs' },
              ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.styledSat({ amount: coin.value, textSize: 'md' }), ss.text({ size: 'xs', color: 'muted' }, t('bitcoin.sats'))),
              ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({}, usd(coin.value)), ss.text({ color: 'muted' }, 'USD')))),
          ss.vstack({ gap: 'xs', style: 'align-items:flex-end' },
            ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({}, coin.address), ss.text({ color: 'muted' }, '(' + coin.addressIndex + ')')),
            ss.text({ style: 'color:var(--gray-100)' }, shortDate(coin.timestamp)))),
        ss.text({ color: coin.label ? 'white' : 'muted' }, coin.label || t('utxo.noLabel')))}</button>
      <button type="button" class="utxo-exclude${coin.excluded ? ' is-on' : ''}" data-exclude="${coin.id}" aria-label="Exclude">${ss.icon('exclude', { size: 16 })}</button>
    </div>
    ${sizeMeter(coin.value, largest, coin.selected)}
  </div>`
}

// selectUtxoList.tsx
registerScreen('coin-list', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/signAndSend/selectUtxoList.tsx',
  title: () => openAccountData.name,
  back: 'account',
  render: () => {
    const usable = coins.filter((c) => !c.excluded)
    const selected = coins.filter((c) => c.selected)
    const total = usable.reduce((s, c) => s + c.value, 0)
    const picked = selected.reduce((s, c) => s + c.value, 0)
    const all = usable.length > 0 && usable.every((c) => c.selected)
    const excluded = coins.filter((c) => c.excluded).length
    const largest = Math.max(...coins.map((c) => c.value))
    const key = { date: (c) => c.timestamp, amount: (c) => c.value, label: (c) => (c.label || '').toLowerCase() }[coinSort.field]
    const sorted = [...coins].sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * (coinSort.dir === 'asc' ? 1 : -1))
    const label = !selected.length
      ? t('transaction.build.add.inputs.button.noSelection')
      : all
        ? t('transaction.build.add.inputs.button.allSelected')
        : selected.length === 1
          ? t('transaction.build.add.inputs.button.oneSelected')
          : t('transaction.build.add.inputs.button.multipleSelected', { count: selected.length })
    const sortToggle = (field) =>
      `<button type="button" class="sort-toggle${coinSort.field === field ? ' is-on' : ''}" data-sort="${field}"><span>${
        coinSort.field === field && coinSort.dir === 'asc' ? '↑' : '↓'
      }</span>${ss.text({ as: 'span', color: coinSort.field === field ? 'white' : 'muted' }, t('utxo.sort.' + field))}</button>`
    return `<div class="coin-list">
      <div class="coin-head">${ss.vstack({},
        ss.hstack({ justifyBetween: true },
          `<button type="button" class="badge-button" data-go="exclude-utxos" aria-label="${t('utxo.exclude.title')}">${ss.icon('exclude', { size: 16 })}${
            excluded ? `<span class="exclude-badge">${excluded}</span>` : ''
          }</button>`,
          ss.text({ size: 'md' }, t('transaction.build.select.spendableOutputs')),
          ss.hstack({ gap: 'sm' },
            ss.iconButton({ label: 'Filter', className: 'badge-button' }, ss.icon('filter', { size: 16 })),
            ss.iconButton({ label: 'Bubbles', id: 'coin-bubbles' }, ss.icon('bubbles', { size: 15 })))),
        ss.vstack({ itemsCenter: true, gap: 'sm' },
          ss.vstack({ itemsCenter: true, gap: 'xs' },
            ss.text({}, `${selected.length} ${t('common.of').toLowerCase()} ${usable.length} ${t('common.selected').toLowerCase()}`),
            ss.hstack({ gap: 'xs' },
              ss.text({ size: 'xxs', style: 'color:var(--gray-400)' }, t('common.total')),
              ss.text({ size: 'xxs', style: 'color:var(--gray-75)' }, total.toLocaleString('en-US')),
              ss.text({ size: 'xxs', style: 'color:var(--gray-400)' }, t('bitcoin.sats')),
              ss.text({ size: 'xxs', style: 'color:var(--gray-75)' }, usd(total)),
              ss.text({ size: 'xxs', style: 'color:var(--gray-400)' }, 'USD'))),
          ss.vstack({ itemsCenter: true, gap: 'none' },
            ss.hstack({ gap: 'xs', style: 'align-items:baseline' },
              ss.styledSat({ amount: picked, textSize: '7xl', weight: 'ultralight', letterSpacing: -1 }),
              ss.text({ size: 'xl', color: 'muted' }, t('bitcoin.sats'))),
            ss.hstack({ gap: 'xs', style: 'align-items:baseline' },
              ss.text({ size: 'md', color: 'muted' }, usd(picked)),
              ss.text({ size: 'xs', style: 'color:var(--gray-500)' }, 'USD')))))}</div>
      ${ss.separator({ color: 'grayDark', style: 'margin-top:12px' })}
      <div class="coin-tools">
        <button type="button" class="select-all" id="coin-all">${(all ? t('common.deselectAll') : t('common.selectAll')).toUpperCase()} ${total.toLocaleString('en-US')} ${t('bitcoin.sats')}</button>
        ${ss.hstack({ gap: 'sm' }, ['date', 'amount', 'label'].map(sortToggle))}
      </div>
      <div class="coin-rows">${sorted.map((c) => utxoItem(c, largest)).join('')}</div>
      <div class="coin-submit">${ss.button({ label, variant: 'secondary', disabled: !selected.length, id: 'coin-use', style: 'width:92%' })}</div>
    </div>`
  },
  bind: (body) => {
    const rerender = () => openKitScreen('coin-list')
    body.addEventListener('click', (e) => {
      const coinBtn = e.target.closest('[data-coin]')
      if (coinBtn) {
        const coin = coins.find((c) => c.id === coinBtn.dataset.coin)
        if (!(coin.excluded && !coin.selected)) coin.selected = !coin.selected
        return rerender()
      }
      const ex = e.target.closest('[data-exclude]')
      if (ex) {
        const coin = coins.find((c) => c.id === ex.dataset.exclude)
        coin.excluded = !coin.excluded
        if (coin.excluded) coin.selected = false
        return rerender()
      }
      const sort = e.target.closest('[data-sort]')
      if (sort) {
        const field = sort.dataset.sort
        coinSort.dir = coinSort.field === field && coinSort.dir === 'desc' ? 'asc' : 'desc'
        coinSort.field = field
        return rerender()
      }
      if (e.target.closest('#coin-all')) {
        const usable = coins.filter((c) => !c.excluded)
        const all = usable.every((c) => c.selected)
        usable.forEach((c) => (c.selected = !all))
        return rerender()
      }
      if (e.target.closest('#coin-use')) openSend('output')
      if (e.target.closest('#coin-bubbles')) {
        coinView = 'bubbles'
        openSend('coins')
        coinView = 'bubbles'
        renderCoins()
      }
    })
  }
})

// excludeUtxos.tsx
registerScreen('exclude-utxos', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/[id]/signAndSend/excludeUtxos.tsx',
  title: () => t('utxo.exclude.title').toUpperCase(),
  back: 'coin-list',
  render: () => {
    const list = coins.filter((c) => c.excluded)
    return ss.vstack({ gap: 'sm' },
      ss.text({ color: 'muted' }, list.length ? t('utxo.exclude.count', { count: list.length }) : t('utxo.exclude.empty')),
      list
        .map((c) =>
          ss.vstack({ gap: 'sm', className: 'excluded-row' },
            ss.hstack({ justifyBetween: true },
              ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.styledSat({ amount: c.value, textSize: 'md' }), ss.text({ size: 'xs', color: 'muted' }, t('bitcoin.sats'))),
              ss.text({ color: 'muted', type: 'mono' }, c.address)),
            ss.hstack({ justifyBetween: true },
              ss.hstack({ gap: 'xs', style: 'align-items:baseline' }, ss.text({}, usd(c.value)), ss.text({ color: 'muted' }, 'USD')),
              ss.text({ color: 'muted' }, shortDate(c.timestamp))),
            c.label ? ss.text({}, c.label) : '',
            ss.button({ variant: 'outline', label: t('utxo.exclude.include'), data: { include: c.id } })))
        .join(ss.separator({ color: 'grayDark' })))
  },
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-include]')
      if (!b) return
      coins.find((c) => c.id === b.dataset.include).excluded = false
      openKitScreen('exclude-utxos')
    })
  }
})
