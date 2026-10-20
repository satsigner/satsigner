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
