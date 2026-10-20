/* Add account — app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/*
   Generate, confirm, import (mnemonic, descriptor, xpub, unified), multisig export / finish /
   import descriptor, and watch-only. Earlier steps (new-account, new-singlesig, entropy-*,
   multisig-setup, multisig-keys, multisig-key) are hand-ported in screen.js. All data is fixture. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  /* SSSeedLayout + SSWordInput: 3 columns, 44px inputs, position label top-left */
  .bd-seed { display: flex; flex-wrap: wrap; justify-content: space-between; row-gap: 4.25px; }
  .bd-word { position: relative; width: 32%; height: 44px; }
  .bd-word input { box-sizing: border-box; width: 100%; height: 44px; border: 0; border-radius: 3px; background: var(--gray-850); color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-lg); text-align: center; outline: none; }
  .bd-word input.is-invalid { border: 2px solid var(--error); }
  .bd-word span { position: absolute; left: 5px; top: 5px; color: var(--gray-200); font-size: var(--sizes-text-font-size-sm); line-height: 12px; pointer-events: none; }
  /* SSChecksumStatus */
  .bd-checksum { display: flex; align-items: center; gap: 4px; }
  .bd-checksum i { width: 11px; height: 11px; border-radius: 5.5px; background: var(--error); }
  .bd-checksum.is-valid i { background: var(--main-green); }
  .bd-checksum .ss-text { text-transform: lowercase; }
  /* SSKeyboardWordSelector: white strip pinned to the bottom of the screen */
  .bd-selector { position: absolute; left: 0; right: 0; bottom: 0; z-index: 1000; display: flex; overflow-x: auto; background: var(--white); box-shadow: 0 -20px 3.84px rgba(0, 0, 0, 0.25); }
  .bd-selector[hidden] { display: none; }
  .bd-selector button { flex: none; padding: 16px 20px; border: 0; border-right: 1px solid var(--gray-50); background: none; color: var(--black); font: inherit; font-size: 16px; cursor: pointer; }
  .bd-selector p { width: 100%; margin: 0; padding: 16px; color: var(--black); text-align: center; }
  /* SSGradientModal */
  .bd-gradient-modal { position: absolute; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 0 var(--layout-main-container-padding-horizontal); background: rgba(0, 0, 0, 0.65); }
  .bd-gradient-modal[hidden] { display: none; }
  .bd-gradient-modal > div { display: flex; flex-direction: column; align-items: center; width: 100%; border-radius: 3px; background: linear-gradient(315deg, var(--gray-950), var(--gray-800)); overflow: hidden; }
  .bd-gradient-modal .ss-button { border-top-left-radius: 0; border-top-right-radius: 0; }
  /* SSWarningModal: opaque black, scrolls, acknowledge at the end */
  .bd-warning { position: absolute; inset: 0; z-index: 1000; overflow: auto; padding: calc(var(--status-height) + var(--ui-drop) + var(--layout-main-container-padding-top)) var(--layout-main-container-padding-horizontal) 24px; background: var(--black); }
  .bd-warning[hidden] { display: none; }
  /* Export screens: white QR card, mono value box */
  .bd-qr-card { padding: 20px; border-radius: 10px; background: var(--white); }
  .bd-qr-card .ss-qr { border-radius: 0; }
  .bd-mono-box { padding: 10px; border-radius: 5px; background: var(--gray-950); word-break: break-all; }
  /* multiSig/export/seedWords.tsx grid */
  .bd-words-grid { display: flex; gap: 8px; justify-content: space-between; width: 100%; }
  .bd-words-col { flex: 1; max-width: 32%; }
  .bd-word-box { display: flex; align-items: center; gap: 8px; box-sizing: border-box; height: 48px; margin-bottom: 8px; padding: 3px; border: 1px solid var(--gray-800); border-radius: 8px; background: var(--gray-900); }
  .bd-word-box .bd-idx { min-width: 24px; text-align: center; }
  /* multiSig/finish.tsx spinner arc */
  .bd-arc { animation: bd-spin 1s linear infinite; transform-origin: 81.5px 81.5px; }
  @keyframes bd-spin { to { transform: rotate(360deg); } }
  /* Descriptor fields: auto height, status border */
  .bd-area textarea { height: auto; min-height: 96px; padding: 10px; font-size: var(--sizes-text-font-size-md); }
  .bd-area.is-tall textarea { min-height: 120px; }
  .bd-area.is-ok textarea { border: 1px solid var(--success); }
  .bd-area.is-bad textarea { border: 1px solid var(--error); }
  .ss-input.is-bad input { border: 1px solid var(--error); }
  .bd-error[hidden] { display: none; }
  .bd-error { margin: 4px 0 0; color: var(--error); font-size: 12px; text-align: center; }
  /* No-back screens (created, finish): keep the header grid's first column */
  #view-kit .stack-header #kit-title { grid-column: 2; }
  .bd-from .ss-checkbox { width: auto; }
  .bd-account-row { display: flex; align-items: center; gap: 16px; border: 0; padding: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .bd-trash { border: 0; padding: 0; background: none; color: var(--white); cursor: pointer; }
  /* SSSelectModal: full black page */
  .bd-select { position: absolute; inset: 0; z-index: 1000; display: flex; flex-direction: column; padding: calc(var(--status-height) + var(--ui-drop) + var(--layout-main-container-padding-top)) var(--layout-main-container-padding-horizontal) 20px; background: var(--black); }
  .bd-select[hidden] { display: none; }
  .bd-select > .bd-select-body { flex: 1; overflow: auto; }
  </style>`
)

// --- fixture key state (mirrors store/accountBuilder.ts) ---------------------------------

// BIP39 test vector (valid checksum) and the words the confirm step mixes in.
const BD_MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'.split(' ')
const BD_WORDS = ('abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid ' +
  'acoustic acquire across act action actor actress actual adapt add addict address adjust admit adult advance advice aerobic ' +
  'affair afford afraid again age agent agree ahead aim air airport aisle alarm album alcohol alert alien all alley allow almost ' +
  'alone alpha already also alter always amateur amazing among amount amused analyst anchor ancient anger angle angry animal ' +
  'ankle announce annual another answer antenna antique anxiety any apart apology appear apple approve april arch arctic area ' +
  'arena argue arm armed armor army around arrange arrest arrive arrow art artefact artist artwork ask aspect assault asset ' +
  'thank useful legal sausage wave winner worth year yellow wealth wedding weekend weird welcome west wet whale what wheat wheel ' +
  'when where whip whisper wide width wife wild will win window wine wing wink wise wish witness wolf woman wonder wood wool word ' +
  'work world worry wrap wreck wrestle wrist write wrong yard young youth zebra zero zone zoo').split(' ')
const BD_FINGERPRINT = 'a1b2c3d4'
const BD_XPUB = 'tpubDCwMhXsvGnVrkQyxxrZ7m8dzHCzWQHSnPjDhDYNnFkjM2XHtbbPQ2tVvW6ujLzNpmvJGyGdyMCbTq2Xg4n3w9HqGQpgKNUTdyRpSXXjzv4b'
const BD_DESCRIPTOR = `wpkh([${BD_FINGERPRINT}/84'/1'/0']${BD_XPUB}/0/*)#kp3z9d4w`
const BD_DESCRIPTOR_INTERNAL = `wpkh([${BD_FINGERPRINT}/84'/1'/0']${BD_XPUB}/1/*)#3x8hk2vy`
const BD_MULTI_DESCRIPTOR = `wsh(sortedmulti(2,[${BD_FINGERPRINT}/48'/1'/0'/2']${BD_XPUB}/0/*,[5e6f7a8b/48'/1'/0'/2']tpubDFH9dgzveyD8zTbPUFuLrGmCydNvxehyNdUXKJAQN8x4aZ4j6UZqGfnqFrD4NqyaTVGKbvEW54tsvPTK2UoSbCC1PJY8iCNiwTL3RWZEheQ/0/*,[9c0d1e2f/48'/1'/0'/2']tpubDEuP2s6KfXZqVgoEvjmhbmCUZcNq2zNP6HhcZ9q8NmS5uyaJmfDtSBSE4mhiC5kKYTVhjmhR4aRSu8n1kFwfbP4eoYbBk1DX9nPAr4iBP6d/0/*))#r9yhc4ah`

const bdState = {
  wordIndex: 0, // confirm step: which word is being checked
  choice: 0, // selected candidate (1-3)
  keyIndex: 0, // multisig key being edited
  passphrase: '',
  importWords: Array(12).fill(''),
  activeWord: null,
  unifiedType: 'extendedPub', // import/unified: 'extendedPub' | 'descriptor'
  publicKeyFormat: 'tpub',
  watchOption: 'importExtendedPub',
  watchPicked: false,
  watchScript: 'P2WPKH',
  watchAddresses: []
}

const bdName = () => (typeof newAccountName !== 'undefined' ? newAccountName : 'Spending')
const bdPolicy = () => (typeof newAccountPolicy !== 'undefined' ? newAccountPolicy : 'singlesig')
const bdIsMultisig = () => bdPolicy() === 'multisig'
const bdScriptName = { P2PKH: 'Legacy (P2PKH)', 'P2SH-P2WPKH': 'Nested SegWit (P2SH-P2WPKH)', P2WPKH: 'Native SegWit (P2WPKH)', P2TR: 'Taproot (P2TR)' }

function bdChecksum(valid) {
  return `<span class="bd-checksum${valid ? ' is-valid' : ''}"><i></i>${ss.text({ as: 'span' }, `${valid ? t('common.valid') : t('common.invalid')} ${t('bitcoin.checksum')}`)}</span>`
}

// SSFingerprint withLabel
function bdFingerprint(fp, withLabel) {
  return ss.hstack({ gap: 'sm' },
    withLabel ? ss.text({ style: 'color:var(--gray-500)' }, t('bitcoin.fingerprint')) : '',
    ss.text({ color: 'muted' }, fp || '-'))
}

function bdSeedGrid(words, editable) {
  return `<div class="bd-seed">${words
    .map((w, i) => `<label class="bd-word"><input data-word="${i}" value="${ss.esc(w)}"${editable ? '' : ' readonly'}${
      editable && w && !BD_WORDS.includes(w) ? ' class="is-invalid"' : ''
    } autocomplete="off" autocapitalize="none" spellcheck="false"><span>${i + 1}</span></label>`)
    .join('')}</div>`
}

function bdArea(p) {
  const v = (p.value || '').trim()
  const status = !v ? '' : p.valid(v) ? ' is-ok' : ' is-bad'
  return ss.textInput({ multiline: true, align: 'left', value: p.value || '', placeholder: p.placeholder || '', name: p.name, className: 'bd-area' + status + (p.tall ? ' is-tall' : '') })
}

// Live validation without re-rendering (a re-render on blur would eat the button click).
function bdBindLive(body, form, rules, update) {
  body.addEventListener('input', (e) => {
    const field = e.target.closest('textarea[name], input[name]')
    if (!field || !(field.name in form)) return
    form[field.name] = field.value.trim()
    const v = form[field.name]
    const rule = rules[field.name]
    const wrap = field.closest('.ss-input')
    if (rule && wrap) {
      wrap.classList.toggle('is-ok', !!v && rule(v))
      wrap.classList.toggle('is-bad', !!v && !rule(v))
    }
    const err = body.querySelector(`[data-err="${field.name}"]`)
    if (err) err.hidden = !v || !rule || rule(v)
    update()
  })
}
const bdErr = (name, show, msg) => `<p class="bd-error" data-err="${name}"${show ? '' : ' hidden'}>${msg}</p>`

const bdValidDescriptor = (v) => /^(wpkh|wsh|sh|tr|pkh)\(.+\)(#\w+)?$/.test(v.trim())
const bdValidXpub = (v) => /^[xyztuv]pub[1-9A-HJ-NP-Za-km-z]{100,}$/.test(v.trim())
const bdValidFingerprint = (v) => v === '' || /^[0-9a-fA-F]{8}$/.test(v)
const bdValidAddress = (v) => /^(bc1|tb1|[13mn2])[0-9a-zA-Z]{20,}$/.test(v.trim())

// --- generate/mnemonic/[index].tsx ---------------------------------------------------------

registerScreen('add-generate-mnemonic', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/(common)/generate/mnemonic/[index].tsx',
  title: () => bdName(),
  back: () => (bdIsMultisig() ? 'multisig-key' : 'new-singlesig'),
  render: () =>
    ss.vstack({ justifyBetween: true },
      ss.form({},
        ss.form.item({}, ss.form.label({ label: t('account.mnemonic.title') }), bdSeedGrid(BD_MNEMONIC, false)),
        ss.form.item({}, ss.form.label({ label: `${t('bitcoin.passphrase')} (${t('common.optional')})` }), ss.textInput({ value: bdState.passphrase, name: 'passphrase' })),
        ss.form.item({}, ss.hstack({ justifyBetween: true }, bdChecksum(true), bdFingerprint(BD_FINGERPRINT, true)))),
      ss.vstack({},
        ss.button({ label: t('account.confirmSeed.title'), variant: 'secondary', id: 'bd-confirm' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', id: 'bd-cancel' }))),
  bind: (body) => {
    body.querySelector('[name=passphrase]').addEventListener('input', (e) => (bdState.passphrase = e.target.value))
    body.querySelector('#bd-confirm').onclick = () => {
      bdState.wordIndex = 0
      bdState.choice = 0
      go('add-confirm-word')
    }
    body.querySelector('#bd-cancel').onclick = () => go(bdIsMultisig() ? 'multisig-keys' : 'accounts')
  }
})

// --- confirm/[keyIndex]/word/[index].tsx ---------------------------------------------------

function bdCandidates(index) {
  const right = BD_MNEMONIC[index]
  const pool = BD_WORDS.filter((w) => !BD_MNEMONIC.includes(w))
  const a = pool[(index * 7 + 3) % pool.length]
  const b = pool[(index * 13 + 11) % pool.length]
  const words = [right, a, b]
  // Deterministic shuffle so the right answer moves around.
  const shift = index % 3
  return words.slice(shift).concat(words.slice(0, shift))
}

registerScreen('add-confirm-word', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/(common)/confirm/[keyIndex]/word/[index].tsx',
  title: () => bdName(),
  back: 'add-generate-mnemonic',
  render: () => {
    const i = bdState.wordIndex
    const words = bdCandidates(i)
    const skip = typeof syState !== 'undefined' ? !!syState.skipSeedConfirmation : false
    return ss.vstack({ justifyBetween: true },
      ss.vstack({ gap: 'lg' },
        ss.text({ uppercase: true, center: true }, `${t('common.confirm')} ${t('bitcoin.word')} ${i + 1}`),
        ss.vstack({ gap: 'lg' }, words.map((w, k) => ss.checkbox({ label: w, selected: bdState.choice === k + 1, data: { choice: k + 1 } })))),
      ss.vstack({},
        ss.button({ label: t('common.next'), variant: 'secondary', disabled: !bdState.choice, id: 'bd-next' }),
        ss.button({ label: t('common.cancel'), variant: 'subtle', id: 'bd-cancel' }),
        skip ? ss.button({ label: t('common.skip'), variant: 'ghost', id: 'bd-skip' }) : ''))
  },
  overlays: () =>
    `<div class="bd-gradient-modal" id="bd-wrong" hidden><div>${ss.vstack({ itemsCenter: true, style: 'margin:32px 0' },
      ss.icon('circleX', { size: 88 }),
      ss.text({ size: '3xl', center: true, style: 'max-width:200px' }, t('account.confirmSeed.warning')))}${ss.button({ label: t('account.confirmSeed.tryAgain'), id: 'bd-wrong-close' })}</div></div>` +
    `<div class="bd-warning" id="bd-done" hidden>${ss.vstack({ itemsCenter: true, style: 'margin-bottom:20px' },
      ss.hstack({}, ss.icon('checkCircle', { size: 30 }), ss.text({ size: '3xl' }, `${BD_MNEMONIC.length} ${t('common.of').toLowerCase()} ${BD_MNEMONIC.length}`)),
      ss.text({ uppercase: true, center: true }, `${t('bitcoin.notYourKeys')}<br>${t('bitcoin.notYourCoins')}`),
      ss.text({ size: '6xl' }, t('common.warning')),
      ss.icon('hideWarning', { width: 210, height: 132 }),
      ss.text({ size: '2xl', center: true, style: 'max-width:260px' }, t('account.generate.warning')),
      ss.text({ size: 'xl', color: 'muted', center: true }, t('account.generate.disclaimer.1')),
      ss.text({ size: 'xl', color: 'muted', center: true }, t('account.generate.disclaimer.2')),
      ss.text({ size: 'xl', color: 'muted', center: true }, t('account.generate.disclaimer.3')))}${ss.button({ label: t('common.acknowledge'), variant: 'secondary', id: 'bd-ack' })}</div>` +
    ss.modal({ id: 'bd-skip-modal', showLabel: false },
      ss.vstack({ itemsCenter: true, style: 'height:100%;justify-content:center;width:100%' },
        ss.hstack({}, ss.icon('warning', { size: 22 }), ss.text({ uppercase: true, size: 'xl', weight: 'bold' }, t('common.warning')), ss.icon('warning', { size: 22 })),
        ss.text({}, t('account.confirmSeed.confirmSkip')),
        ss.button({ label: t('common.yes'), variant: 'danger', id: 'bd-skip-yes' }),
        ss.button({ label: t('common.no'), data: { 'ss-close': '' } }))),
  bind: (body) => {
    const finish = () => {
      if (bdIsMultisig()) return go('multisig-keys')
      ss.open('bd-done')
    }
    body.addEventListener('click', (e) => {
      const c = e.target.closest('[data-choice]')
      if (c) {
        bdState.choice = Number(c.dataset.choice)
        body.querySelectorAll('[data-choice]').forEach((x) => {
          const on = x === c
          x.classList.toggle('is-on', on)
          x.setAttribute('aria-checked', on)
        })
        body.querySelector('#bd-next').disabled = false
      }
      if (e.target.closest('#bd-next')) {
        const picked = bdCandidates(bdState.wordIndex)[bdState.choice - 1]
        if (picked !== BD_MNEMONIC[bdState.wordIndex]) return ss.open('bd-wrong')
        bdState.choice = 0
        if (bdState.wordIndex + 1 < BD_MNEMONIC.length) {
          bdState.wordIndex += 1
          openKitScreen('add-confirm-word')
        } else finish()
      }
      if (e.target.closest('#bd-cancel')) go(bdIsMultisig() ? 'multisig-keys' : 'signer')
      if (e.target.closest('#bd-skip')) ss.open('bd-skip-modal')
    })
    const overlays = document.getElementById('kit-overlays')
    overlays.querySelector('#bd-wrong-close').onclick = () => ss.close('bd-wrong')
    overlays.querySelector('#bd-ack').onclick = () => go('add-created')
    overlays.querySelector('#bd-skip-yes').onclick = () => {
      ss.close('bd-skip-modal')
      finish()
    }
  }
})

// --- created/[id].tsx ----------------------------------------------------------------------

registerScreen('add-created', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/(common)/created/[id].tsx',
  title: () => bdName(),
  back: null,
  render: () =>
    ss.vstack({},
      ss.vstack({ style: 'margin:32px 0;width:100%' },
        ss.vstack({ itemsCenter: true, gap: 'xs' },
          ss.text({ size: '2xl' }, ss.esc(bdName())),
          ss.text({ color: 'muted', size: 'lg' }, t('account.added'))),
        ss.separator(),
        ss.hstack({ justifyEvenly: true, style: 'align-items:flex-start' },
          ss.vstack({ itemsCenter: true }, ss.text({ style: 'color:var(--gray-500)' }, t('account.script')), ss.text({ size: 'md', color: 'muted', center: true }, bdScriptName.P2WPKH)),
          ss.vstack({ itemsCenter: true }, ss.text({ style: 'color:var(--gray-500)' }, t('account.fingerprint')), bdFingerprint(BD_FINGERPRINT))),
        ss.separator(),
        ss.vstack({ itemsCenter: true }, ss.text({ style: 'color:var(--gray-500)' }, t('account.derivationPath')), ss.text({ size: 'md', color: 'muted' }, "m/84'/1'/0'"))),
      ss.button({ label: t('account.multisig.gotoWallet'), variant: 'secondary', go: 'account' }))
})

// --- import/mnemonic/[keyIndex].tsx (SSSeedWordsInput + SSKeyboardWordSelector) ------------

function bdImportComplete() {
  return bdState.importWords.every((w) => BD_WORDS.includes(w))
}

function bdImportFooter() {
  const ok = bdImportComplete()
  return ss.hstack({ gap: 'sm', justifyBetween: true }, bdChecksum(ok), ok ? bdFingerprint(BD_FINGERPRINT, true) : '')
}

registerScreen('add-import-mnemonic', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/(common)/import/mnemonic/[keyIndex].tsx',
  title: () => bdName(),
  back: () => (bdIsMultisig() ? 'multisig-keys' : 'new-singlesig'),
  render: () =>
    ss.vstack({ gap: 'lg' },
      ss.form({},
        ss.form.item({}, ss.form.label({ label: `${t('account.mnemonic.title')} (ENGLISH)` }), bdSeedGrid(bdState.importWords, true)),
        ss.form.item({}, ss.form.label({ label: `${t('bitcoin.passphrase')} (${t('common.optional')})` }), ss.textInput({ value: bdState.passphrase, name: 'passphrase' })),
        ss.form.item({ id: 'bd-import-status' }, bdImportFooter())),
      ss.vstack({ gap: 'sm' },
        ss.hstack({ gap: 'sm', style: 'width:100%' },
          ss.button({ label: t('common.paste'), variant: 'outline', style: 'flex:1', id: 'bd-paste' }),
          ss.button({ label: t('account.import.scanSeedQR'), variant: 'outline', style: 'flex:1', id: 'bd-scan' })),
        ss.button({ label: t('account.import.title2'), variant: 'secondary', disabled: !bdImportComplete(), id: 'bd-import' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', id: 'bd-cancel' }))),
  overlays: () => '<div class="bd-selector" id="bd-selector" hidden></div>',
  bind: (body) => {
    const selector = document.getElementById('bd-selector')
    const refresh = () => {
      body.querySelector('#bd-import-status').innerHTML = bdImportFooter()
      body.querySelector('#bd-import').disabled = !bdImportComplete()
    }
    const showSelector = (input) => {
      const start = input.value.trim().toLowerCase()
      if (!start) return (selector.hidden = true)
      const matches = BD_WORDS.filter((w) => w.startsWith(start)).slice(0, 12)
      selector.hidden = false
      selector.innerHTML = matches.length
        ? matches.map((w) => `<button type="button" data-pick="${w}">${w}</button>`).join('')
        : `<p>${t('account.import.word.noMatch')}</p>`
    }
    body.querySelector('[name=passphrase]').addEventListener('input', (e) => (bdState.passphrase = e.target.value))
    body.addEventListener('input', (e) => {
      const input = e.target.closest('[data-word]')
      if (!input) return
      bdState.activeWord = Number(input.dataset.word)
      bdState.importWords[bdState.activeWord] = input.value.trim().toLowerCase()
      input.classList.remove('is-invalid')
      showSelector(input)
      refresh()
    })
    body.addEventListener('focusin', (e) => {
      const input = e.target.closest('[data-word]')
      if (input) {
        bdState.activeWord = Number(input.dataset.word)
        showSelector(input)
      }
    })
    body.addEventListener('focusout', (e) => {
      const input = e.target.closest('[data-word]')
      if (input && input.value && !BD_WORDS.includes(input.value.trim().toLowerCase())) input.classList.add('is-invalid')
    })
    selector.addEventListener('mousedown', (e) => e.preventDefault())
    selector.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-pick]')
      if (!pick || bdState.activeWord === null) return
      const i = bdState.activeWord
      bdState.importWords[i] = pick.dataset.pick
      const input = body.querySelector(`[data-word="${i}"]`)
      input.value = pick.dataset.pick
      input.classList.remove('is-invalid')
      selector.hidden = true
      const next = body.querySelector(`[data-word="${i + 1}"]`)
      if (next) next.focus()
      refresh()
    })
    const fill = () => {
      bdState.importWords = [...BD_MNEMONIC]
      openKitScreen('add-import-mnemonic')
    }
    body.querySelector('#bd-paste').onclick = fill
    body.querySelector('#bd-scan').onclick = fill
    body.querySelector('#bd-import').onclick = () => go(bdIsMultisig() ? 'multisig-keys' : 'add-created')
    body.querySelector('#bd-cancel').onclick = () => go(bdIsMultisig() ? 'multisig-keys' : 'new-singlesig')
  }
})

// --- import/descriptor/[keyIndex]/index.tsx -------------------------------------------------

const bdDescriptorForm = { external: '', internal: '' }

registerScreen('add-import-descriptor', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/(common)/import/descriptor/[keyIndex]/index.tsx',
  title: () => t('account.import.descriptor'),
  back: 'multisig-keys',
  render: () => {
    const f = bdDescriptorForm
    const extBad = f.external && !bdValidDescriptor(f.external)
    const intBad = f.internal && !bdValidDescriptor(f.internal)
    return ss.vstack({ justifyBetween: true, gap: 'lg', style: 'padding-bottom:20px' },
      ss.vstack({ gap: 'lg' },
        ss.vstack({ gap: 'sm' },
          ss.vstack({ gap: 'xxs' },
            ss.text({ center: true }, t('watchonly.importDescriptor.label')),
            bdArea({ value: f.external, name: 'external', valid: bdValidDescriptor }),
            bdErr('external', extBad, 'Invalid descriptor')),
          ss.vstack({ gap: 'xxs' },
            ss.text({ center: true }, t('watchonly.importDescriptor.internal')),
            bdArea({ value: f.internal, name: 'internal', valid: bdValidDescriptor }),
            bdErr('internal', intBad, 'Invalid descriptor'))),
        ss.hstack({ gap: 'sm' },
          ss.button({ label: t('common.paste'), style: 'flex:1', id: 'bd-paste' }),
          ss.button({ label: t('common.scanQR'), style: 'flex:1', id: 'bd-scan' }),
          ss.button({ label: t('watchonly.read.nfc'), style: 'flex:1', disabled: true }))),
      ss.vstack({ gap: 'sm' },
        ss.button({ label: t('common.confirm'), variant: 'secondary', disabled: !bdValidDescriptor(f.external) || intBad, id: 'bd-confirm' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'multisig-keys' })))
  },
  bind: (body) => {
    bdBindLive(body, bdDescriptorForm, { external: bdValidDescriptor, internal: bdValidDescriptor }, () => {
      const f = bdDescriptorForm
      body.querySelector('#bd-confirm').disabled = !bdValidDescriptor(f.external) || (f.internal && !bdValidDescriptor(f.internal))
    })
    const fill = () => {
      bdDescriptorForm.external = BD_DESCRIPTOR
      bdDescriptorForm.internal = BD_DESCRIPTOR_INTERNAL
      openKitScreen('add-import-descriptor')
    }
    body.querySelector('#bd-paste').onclick = fill
    body.querySelector('#bd-scan').onclick = fill
    body.querySelector('#bd-confirm').onclick = () => go('multisig-keys')
  }
})

// --- import/descriptor/[keyIndex]/fromAccount.tsx -------------------------------------------

let bdFromAccount = null

registerScreen('add-import-descriptor-from-account', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/(common)/import/descriptor/[keyIndex]/fromAccount.tsx',
  title: () => t('account.import.fromOtherWallet'),
  back: 'add-import-descriptor',
  render: () => {
    const singles = accounts.filter((a) => !a.watchOnly && !a.multisig)
    return ss.vstack({ justifyBetween: true },
      ss.vstack({ gap: 'lg' },
        ss.text({ center: true }, t('account.import.existingSingleWallet')),
        singles
          .map((a) =>
            ss.hstack({ className: 'bd-from' },
              ss.checkbox({ selected: bdFromAccount === a.fingerprint, data: { account: a.fingerprint } }),
              `<button type="button" class="bd-account-row" data-account="${a.fingerprint}">${ss.vstack({ gap: 'none' },
                ss.text({ size: 'xxs' }, a.fingerprint),
                ss.text({ size: '2xl', style: 'line-height:19px' }, ss.esc(a.name)))}</button>`))
          .join('')),
      ss.vstack({},
        ss.button({ variant: 'secondary', label: t('common.create'), disabled: !bdFromAccount, id: 'bd-create' }),
        ss.button({ variant: 'ghost', label: t('common.cancel'), go: 'add-import-descriptor' })))
  },
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const row = e.target.closest('[data-account]')
      if (row) {
        bdFromAccount = row.dataset.account
        openKitScreen('add-import-descriptor-from-account')
      }
      const create = e.target.closest('#bd-create')
      if (create) {
        create.disabled = true
        create.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => go('multisig-keys'), 700)
      }
    })
  }
})

// --- import/extendedPub/[keyIndex]/index.tsx ------------------------------------------------

const bdXpubForm = { xpub: '', fingerprint: '' }

registerScreen('add-import-xpub', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/(common)/import/extendedPub/[keyIndex]/index.tsx',
  title: () => t('account.import.extendedPub'),
  back: 'multisig-keys',
  render: () => {
    const f = bdXpubForm
    const xpubBad = f.xpub && !bdValidXpub(f.xpub)
    return ss.vstack({ justifyBetween: true, gap: 'lg', style: 'padding-bottom:20px' },
      ss.vstack({ gap: 'lg' },
        ss.vstack({ gap: 'sm' },
          ss.vstack({ gap: 'xxs' },
            ss.text({ center: true }, t('common.extendedPublicKey')),
            ss.text({ center: true, color: 'muted' }, t('account.import.xpubSteps')),
            bdArea({ value: f.xpub, name: 'xpub', valid: bdValidXpub }),
            bdErr('xpub', xpubBad, 'Invalid extended public key')),
          ss.vstack({ gap: 'sm' },
            ss.hstack({ gap: 'sm' },
              ss.button({ label: 'Paste', variant: 'subtle', style: 'flex:1', id: 'bd-paste' }),
              ss.button({ label: 'Scan QR', variant: 'subtle', style: 'flex:1', id: 'bd-scan' })),
            ss.button({ label: t('watchonly.read.nfc'), variant: 'subtle', disabled: true })))),
      ss.vstack({ gap: 'lg' },
        ss.vstack({ gap: 'sm' },
          ss.text({ center: true }, t('common.fingerprint')),
          ss.text({ center: true, color: 'muted' }, t('account.import.xpubFingerprintHelper')),
          ss.textInput({ value: f.fingerprint, name: 'fingerprint', status: f.fingerprint && !bdValidFingerprint(f.fingerprint) ? 'invalid' : undefined }),
          ss.hstack({ gap: 'sm' },
            ss.button({ label: 'Paste', variant: 'subtle', style: 'flex:1', id: 'bd-paste-fp' }),
            ss.button({ label: 'Scan QR', variant: 'subtle', style: 'flex:1', id: 'bd-paste-fp' }))),
        ss.button({ label: t('common.confirm'), variant: 'secondary', disabled: !bdValidXpub(f.xpub) || !bdValidFingerprint(f.fingerprint), id: 'bd-confirm' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'multisig-keys' })))
  },
  bind: (body) => {
    bdBindLive(body, bdXpubForm, { xpub: bdValidXpub, fingerprint: bdValidFingerprint }, () => {
      body.querySelector('#bd-confirm').disabled = !bdValidXpub(bdXpubForm.xpub) || !bdValidFingerprint(bdXpubForm.fingerprint)
    })
    body.addEventListener('click', (e) => {
      if (e.target.closest('#bd-paste, #bd-scan')) {
        bdXpubForm.xpub = BD_XPUB
        openKitScreen('add-import-xpub')
      }
      if (e.target.closest('#bd-paste-fp')) {
        bdXpubForm.fingerprint = BD_FINGERPRINT
        openKitScreen('add-import-xpub')
      }
      if (e.target.closest('#bd-confirm')) go('multisig-keys')
    })
  }
})

// --- import/unified/[index].tsx -------------------------------------------------------------

const bdUnifiedForm = { xpub: '', fingerprint: '', external: '', internal: '' }

registerScreen('add-import-unified', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/(common)/import/unified/[index].tsx',
  title: () => bdName(),
  back: () => (bdIsMultisig() ? 'multisig-keys' : 'new-singlesig'),
  render: () => {
    const f = bdUnifiedForm
    const desc = bdState.unifiedType === 'descriptor'
    const label = desc ? t('watchonly.importDescriptor.title') : t('account.import.vpub')
    const ready = desc ? bdValidDescriptor(f.external) : bdValidXpub(f.xpub) && bdValidFingerprint(f.fingerprint)
    return ss.vstack({ justifyBetween: true, style: 'flex:1' },
      ss.form({},
        ss.form.item({}, ss.form.label({ label }), ss.text({ color: 'muted', size: 'md' }, desc ? t('watchonly.importDescriptor.text') : t('watchonly.importExtendedPub.text'))),
        desc
          ? ss.form.item({},
              ss.form.label({ label: t('watchonly.importDescriptor.external') }),
              bdArea({ value: f.external, name: 'external', placeholder: t('watchonly.importDescriptor.external'), valid: bdValidDescriptor }),
              bdErr('external', f.external && !bdValidDescriptor(f.external), 'Invalid descriptor')) +
            ss.form.item({},
              ss.form.label({ label: t('watchonly.importDescriptor.internal') }),
              bdArea({ value: f.internal, name: 'internal', placeholder: t('watchonly.importDescriptor.internal'), valid: bdValidDescriptor }))
          : ss.form.item({},
              ss.form.label({ label: t('watchonly.importExtendedPub.label') }),
              ss.textInput({ value: f.xpub, name: 'xpub', placeholder: t('watchonly.importExtendedPub.label'), status: f.xpub && !bdValidXpub(f.xpub) ? 'invalid' : undefined })) +
            ss.form.item({},
              ss.form.label({ label: t('watchonly.fingerprint.label') }),
              ss.textInput({ value: f.fingerprint, name: 'fingerprint', placeholder: t('watchonly.fingerprint.text') }),
              ss.hstack({ gap: 'sm', style: 'margin-top:8px' },
                ss.button({ label: t('common.paste'), variant: 'subtle', style: 'flex:1', id: 'bd-paste-fp' }),
                ss.button({ label: t('common.scanQR'), variant: 'subtle', style: 'flex:1', id: 'bd-paste-fp' })))),
      ss.vstack({},
        ss.hstack({ gap: 'sm' },
          ss.button({ label: t('common.paste'), variant: 'subtle', style: 'flex:1', id: 'bd-paste' }),
          ss.button({ label: t('common.scanQR'), variant: 'subtle', style: 'flex:1', id: 'bd-paste' }),
          ss.button({ label: t('watchonly.read.nfc'), variant: 'subtle', style: 'flex:1', disabled: true })),
        ss.button({ label: t('common.confirm'), variant: 'secondary', disabled: !ready, id: 'bd-confirm' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', id: 'bd-cancel' })))
  },
  bind: (body) => {
    const back = () => go(bdIsMultisig() ? 'multisig-keys' : 'new-singlesig')
    bdBindLive(body, bdUnifiedForm, { xpub: bdValidXpub, fingerprint: bdValidFingerprint, external: bdValidDescriptor, internal: bdValidDescriptor }, () => {
      const f = bdUnifiedForm
      body.querySelector('#bd-confirm').disabled =
        bdState.unifiedType === 'descriptor' ? !bdValidDescriptor(f.external) : !bdValidXpub(f.xpub) || !bdValidFingerprint(f.fingerprint)
    })
    body.addEventListener('click', (e) => {
      if (e.target.closest('#bd-paste')) {
        if (bdState.unifiedType === 'descriptor') {
          bdUnifiedForm.external = BD_DESCRIPTOR
          bdUnifiedForm.internal = BD_DESCRIPTOR_INTERNAL
        } else bdUnifiedForm.xpub = BD_XPUB
        openKitScreen('add-import-unified')
      }
      if (e.target.closest('#bd-paste-fp')) {
        bdUnifiedForm.fingerprint = BD_FINGERPRINT
        openKitScreen('add-import-unified')
      }
      const confirm = e.target.closest('#bd-confirm')
      if (confirm) {
        confirm.disabled = true
        confirm.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => (bdIsMultisig() ? go('multisig-keys') : go('add-created')), 700)
      }
      if (e.target.closest('#bd-cancel')) back()
    })
  }
})

// --- multiSig/export/descriptor.tsx + publicKey.tsx -----------------------------------------

function bdExport(title, info, value, formats) {
  return `<div style="padding:20px 0">${ss.vstack({},
    ss.text({ center: true, uppercase: true, color: 'muted' }, title),
    formats || '',
    info,
    `<div style="display:flex;justify-content:center;margin:20px 0"><div class="bd-qr-card">${ss.qr({ value, size: 210 })}</div></div>`,
    `<div class="bd-mono-box">${ss.text({ size: 'lg', type: 'mono' }, ss.esc(value))}</div>`,
    ss.clipboardCopy({ text: value }, ss.button({ label: t('common.copyToClipboard') })),
    ss.button({ label: t('common.downloadFile'), variant: 'secondary', id: 'bd-download' }),
    ss.button({ label: t('common.share'), variant: 'outline', data: { 'ss-copy': value } }),
    ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'multisig-keys' }))}</div>`
}

const bdToastDownload = (body) => {
  const b = body.querySelector('#bd-download')
  if (b) b.onclick = () => ss.toast(t('common.downloadFile'), document.getElementById('view-kit'))
}

registerScreen('add-multisig-export-descriptor', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/multiSig/export/descriptor.tsx',
  title: () => bdName(),
  back: 'multisig-keys',
  render: () =>
    bdExport(t('account.descriptor.title'),
      ss.vstack({ gap: 'sm', style: 'margin-bottom:20px' },
        ss.text({ center: true, color: 'muted' }, `Key ${bdState.keyIndex + 1}`),
        ss.text({ center: true, color: 'muted' }, t('account.descriptor.creationType', { type: 'generateMnemonic' })),
        ss.text({ center: true, color: 'muted' }, t('account.descriptor.scriptVersion', { version: 'P2WSH' }))),
      `wsh([${BD_FINGERPRINT}/48'/1'/0'/2']${BD_XPUB}/0/*)#7h3kq0x2`),
  bind: bdToastDownload
})

const BD_PUBKEYS = {
  tpub: BD_XPUB,
  vpub: 'vpub5Y6cjg78GGuNLsaPhmYsiw4gYX3HoQiRBiSwDaBXKUafCt9bNwWQiitDk5VZ5BVxYnQdwoTyXSs2JHRPAgjAvtbBrf8ZhDYe2jWAqvZVnsc'
}

registerScreen('add-multisig-export-public-key', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/multiSig/export/publicKey.tsx',
  title: () => bdName(),
  back: 'multisig-keys',
  render: () =>
    bdExport(t('common.publicKeys'), '', BD_PUBKEYS[bdState.publicKeyFormat],
      ss.hstack({ gap: 'sm', style: 'justify-content:center' },
        ['tpub', 'vpub'].map((f) =>
          ss.button({ label: t('account.seed.formatButtons.' + f), variant: bdState.publicKeyFormat === f ? 'gradient' : 'secondary', style: 'flex:1', data: { format: f } })))),
  bind: (body) => {
    body.addEventListener('click', (e) => {
      const f = e.target.closest('[data-format]')
      if (!f) return
      bdState.publicKeyFormat = f.dataset.format
      openKitScreen('add-multisig-export-public-key')
    })
    bdToastDownload(body)
  }
})

// --- multiSig/export/seedWords.tsx ----------------------------------------------------------

registerScreen('add-multisig-export-seed-words', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/multiSig/export/seedWords.tsx',
  title: () => `${t('account.seed.viewSeedWords')} - Key ${bdState.keyIndex + 1}`,
  back: 'multisig-keys',
  render: () => {
    const per = Math.ceil(BD_MNEMONIC.length / 3)
    const cols = [0, 1, 2]
      .map((c) => `<div class="bd-words-col">${BD_MNEMONIC.slice(c * per, c * per + per)
        .map((w, r) => `<div class="bd-word-box">${ss.text({ color: 'muted', className: 'bd-idx', as: 'span' }, String(c * per + r + 1).padStart(2, '0'))}${ss.text({ size: 'md', as: 'span' }, w)}</div>`)
        .join('')}</div>`)
      .join('')
    return ss.vstack({ gap: 'lg', style: 'padding:16px 0' },
      ss.vstack({ gap: 'md' },
        ss.text({ center: true, uppercase: true }, `${BD_MNEMONIC.length} ${t('account.mnemonic.title')} (english)`),
        ss.hstack({ style: 'justify-content:center' }, ss.text({ uppercase: true, color: 'muted' }, t('account.seed.keepItSecret')))),
      `<div class="bd-words-grid">${cols}</div>`,
      ss.vstack({ gap: 'sm', style: 'padding-top:32px' },
        ss.hstack({ gap: 'sm' },
          `<div style="flex:0.5">${ss.clipboardCopy({ text: BD_MNEMONIC.join(' ') }, ss.button({ label: t('common.copy'), variant: 'outline' }))}</div>`,
          ss.button({ label: t('account.seed.seedqr.title'), variant: 'outline', style: 'flex:0.5', id: 'bd-seedqr' })),
        ss.button({ label: t('common.back'), variant: 'ghost', go: 'multisig-keys' })))
  },
  overlays: () =>
    ss.modal({ id: 'bd-seedqr-modal', label: t('common.close') },
      ss.vstack({ itemsCenter: true, gap: 'lg' },
        ss.text({ uppercase: true }, t('account.seed.seedqr.title')),
        `<div class="bd-qr-card">${ss.qr({ value: BD_MNEMONIC.join(' '), size: 240 })}</div>`)),
  bind: (body) => {
    body.querySelector('#bd-seedqr').onclick = () => ss.open('bd-seedqr-modal')
  }
})

// --- multiSig/finish.tsx --------------------------------------------------------------------

let bdFinishTimer = 0

registerScreen('add-multisig-finish', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/multiSig/finish.tsx',
  title: () => t('account.multisig.create'),
  back: null,
  render: () =>
    `<div class="bd-finish" style="display:flex;flex-direction:column;justify-content:space-between;min-height:100%;padding:80px 0 30px;box-sizing:border-box">${ss.vstack({},
      ss.text({ center: true, size: 'lg', id: 'bd-finish-title' }, t('account.multisig.creating')),
      `<div style="align-self:center;margin-top:40px;width:163px;height:163px" id="bd-finish-mark"><svg width="163" height="163" viewBox="0 0 163 163" fill="none"><circle cx="81.5" cy="81.5" r="79.5" stroke="#343434" stroke-width="3"/><path class="bd-arc" d="M161 81.5C161 125.407 125.407 161 81.5 161" stroke="white" stroke-width="3"/></svg></div>`)}
      <div id="bd-finish-actions" hidden>${ss.vstack({},
        ss.button({ label: t('account.multisig.viewAllWallets'), variant: 'outline', go: 'accounts' }),
        ss.button({ label: t('account.multisig.gotoWallet'), variant: 'secondary', go: 'account' }))}</div></div>`,
  bind: (body) => {
    clearTimeout(bdFinishTimer)
    bdFinishTimer = setTimeout(() => {
      if (!body.isConnected) return
      body.querySelector('#bd-finish-title').textContent = t('account.multisig.created')
      body.querySelector('#bd-finish-mark').innerHTML = ss.successCheck({ size: 159 })
      body.querySelector('#bd-finish-actions').hidden = false
    }, 1600)
  }
})

// --- multiSig/importDescriptor.tsx ----------------------------------------------------------

let bdMultiDescriptor = ''
const bdValidMulti = (v) => /^(wsh|sh)\((sorted)?multi\(\d+,.+\)\)(#\w+)?$/.test(v.trim())

registerScreen('add-multisig-import-descriptor', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/multiSig/importDescriptor.tsx',
  title: () => t('account.import.descriptor'),
  back: 'multisig-setup',
  render: () => {
    const v = bdMultiDescriptor.trim()
    const ok = bdValidMulti(v)
    return ss.vstack({ justifyBetween: true, gap: 'lg', style: 'padding-bottom:20px' },
      ss.vstack({ gap: 'xs' },
        ss.vstack({ gap: 'md' },
          ss.text({ center: true }, t('watchonly.importDescriptor.label')),
          bdArea({ value: bdMultiDescriptor, name: 'descriptor', placeholder: t('watchonly.importDescriptor.external'), valid: bdValidMulti, tall: true })),
        ss.hstack({ gap: 'sm' },
          ss.button({ label: t('common.paste'), variant: 'subtle', style: 'flex:1', id: 'bd-paste' }),
          ss.button({ label: t('common.QR'), variant: 'subtle', style: 'flex:1', id: 'bd-qr' }),
          ss.button({ label: 'NFC', variant: 'subtle', style: 'flex:1', disabled: true }))),
      ss.vstack({},
        bdErr('descriptor', v && !ok, 'Invalid multisig descriptor'),
        ss.button({ label: t('account.import.descriptor'), variant: 'secondary', disabled: !ok, go: 'add-multisig-finish', id: 'bd-import' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'multisig-setup' })))
  },
  overlays: () =>
    ss.modal({ id: 'bd-camera', showLabel: false },
      ss.vstack({ gap: 'lg', style: 'flex:1;width:100%' },
        ss.text({ center: true, size: 'lg', weight: 'bold' }, t('transaction.build.options.importOutputs.qrcode')),
        ss.text({ center: true, color: 'muted' }, t('camera.scanText')),
        ss.vstack({ gap: 'md', style: 'flex:1;justify-content:center' },
          ss.text({ center: true, color: 'muted' }, t('camera.permissions')),
          ss.button({ label: t('camera.enableCameraAccess'), id: 'bd-camera-ok' })),
        ss.button({ label: t('common.cancel'), variant: 'ghost', data: { 'ss-close': '' } }))),
  bind: (body) => {
    const form = { descriptor: bdMultiDescriptor }
    bdBindLive(body, form, { descriptor: bdValidMulti }, () => {
      bdMultiDescriptor = form.descriptor
      body.querySelector('#bd-import').disabled = !bdValidMulti(form.descriptor)
    })
    const fill = () => {
      bdMultiDescriptor = BD_MULTI_DESCRIPTOR
      openKitScreen('add-multisig-import-descriptor')
    }
    body.querySelector('#bd-paste').onclick = fill
    body.querySelector('#bd-qr').onclick = () => ss.open('bd-camera')
    document.getElementById('bd-camera-ok').onclick = fill
  }
})

// --- watchOnly/index.tsx --------------------------------------------------------------------

const bdWatchForm = { xpub: '', external: '', internal: '', fingerprint: '', address: '' }

registerScreen('add-watch-only', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/bitcoin/account/add/watchOnly/index.tsx',
  title: () => bdName(),
  back: 'new-account',
  render: () => {
    const opt = bdState.watchOption
    const f = bdWatchForm
    const ready =
      opt === 'importExtendedPub'
        ? bdValidXpub(f.xpub) && bdValidFingerprint(f.fingerprint)
        : opt === 'importDescriptor'
          ? bdValidDescriptor(f.external)
          : bdState.watchAddresses.length > 0
    const paste = (id) =>
      ss.hstack({ gap: 'sm' },
        ss.button({ label: t('common.paste'), variant: 'gradient', style: 'flex:1', id }),
        ss.button({ label: t('common.scanQR'), variant: 'gradient', style: 'flex:1', id }),
        id === 'bd-paste' ? ss.button({ label: t('watchonly.read.nfc'), variant: 'gradient', style: 'flex:1', disabled: true }) : '')
    return ss.vstack({ justifyBetween: true, gap: 'lg' },
      ss.vstack({ gap: 'lg' },
        ss.vstack({ gap: 'sm' },
          ss.text({ size: 'md', center: true, uppercase: true }, t(`watchonly.${opt}.label`)),
          opt === 'importExtendedPub' ? bdArea({ value: f.xpub, name: 'xpub', valid: bdValidXpub }) : '',
          opt === 'importDescriptor' ? bdArea({ value: f.external, name: 'external', valid: bdValidDescriptor }) : '',
          opt === 'importAddress'
            ? bdState.watchAddresses
                .map((a, i) =>
                  ss.vstack({ gap: 'xs', style: 'margin:16px 0' },
                    ss.hstack({ justifyBetween: true },
                      ss.text({ uppercase: true, weight: 'bold' }, `${t('bitcoin.address')} #${i + 1}`),
                      `<button type="button" class="bd-trash" data-remove="${i}" aria-label="Remove">${ss.icon('trash', { size: 12 })}</button>`),
                    ss.addressDisplay({ address: a, variant: 'bare', size: 'xs' })))
                .join('') + bdArea({ value: f.address, name: 'address', valid: bdValidAddress })
            : ''),
        ss.vstack({ gap: 'sm' },
          paste('bd-paste'),
          opt === 'importAddress' ? ss.button({ label: t('common.add'), disabled: !bdValidAddress(f.address), id: 'bd-add' }) : ''),
        opt === 'importExtendedPub'
          ? ss.vstack({ gap: 'xxs' },
              ss.form.label({ label: t('account.script').toUpperCase() }),
              ss.button({ label: bdScriptName[bdState.watchScript], withSelect: true, id: 'bd-script' }))
          : '',
        opt === 'importDescriptor'
          ? ss.vstack({ gap: 'xxs' }, ss.text({ center: true }, t('watchonly.importDescriptor.internal')), bdArea({ value: f.internal, name: 'internal', valid: bdValidDescriptor }))
          : ''),
      ss.vstack({ gap: 'lg' },
        opt === 'importExtendedPub'
          ? ss.vstack({ gap: 'sm' },
              ss.text({ center: true }, t('watchonly.fingerprint.label')),
              ss.text({ center: true, color: 'muted' }, t('watchonly.fingerprint.optionalHelper')),
              ss.textInput({ value: f.fingerprint, name: 'fingerprint', status: f.fingerprint && !bdValidFingerprint(f.fingerprint) ? 'invalid' : undefined }),
              paste('bd-paste-fp'))
          : '',
        ss.vstack({ gap: 'sm' },
          ss.button({ label: t('common.confirm'), variant: 'secondary', disabled: !ready, id: 'bd-confirm' }),
          ss.button({ label: t('common.cancel'), variant: 'ghost', id: 'bd-options' }))))
  },
  overlays: () => {
    const opt = bdState.watchOption
    return `<div class="bd-select" id="bd-watch-options"${bdState.watchPicked ? ' hidden' : ''}><div class="bd-select-body">${ss.vstack({ gap: 'lg' },
        ss.text({ center: true, color: 'muted', uppercase: true, style: 'min-height:40px' }, t('watchonly.titleModal').toUpperCase()),
        ss.vstack({ style: 'padding-bottom:16px' },
          ['importExtendedPub', 'importDescriptor', 'importAddress'].map((o) =>
            ss.radio({ label: t(`watchonly.${o}.label`), selected: opt === o, data: { watch: o } }))),
        ss.vstack({ gap: 'sm', style: 'padding-top:16px' }, ss.text({ color: 'muted', size: 'md', id: 'bd-watch-desc' }, t(`watchonly.${opt}.text`))))}</div>${ss.vstack({ gap: 'sm' },
        ss.button({ label: t('common.select'), variant: 'secondary', id: 'bd-watch-select' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'new-account' }))}</div>` +
      `<div class="bd-select" id="bd-script-modal" hidden><div class="bd-select-body">${ss.vstack({ gap: 'lg' },
        ss.text({ center: true, color: 'muted', uppercase: true, style: 'min-height:40px' }, t('account.script').toUpperCase()),
        ss.vstack({}, Object.entries(bdScriptName).map(([k, v]) => ss.radio({ label: v, selected: bdState.watchScript === k, data: { script: k } }))))}</div>${ss.vstack({ gap: 'sm' },
        ss.button({ label: t('common.select'), variant: 'secondary', id: 'bd-script-select' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', id: 'bd-script-cancel' }))}</div>`
  },
  bind: (body) => {
    const reopen = () => openKitScreen('add-watch-only')
    const overlays = document.getElementById('kit-overlays')
    let pendingScript = bdState.watchScript
    const onOverlay = (e) => {
      const w = e.target.closest('[data-watch]')
      if (w) {
        bdState.watchOption = w.dataset.watch
        overlays.querySelectorAll('[data-watch]').forEach((x) => x.classList.toggle('is-on', x === w))
        overlays.querySelector('#bd-watch-desc').textContent = t(`watchonly.${bdState.watchOption}.text`)
      }
      if (e.target.closest('#bd-watch-select')) {
        bdState.watchPicked = true
        reopen()
      }
      const s = e.target.closest('[data-script]')
      if (s) {
        pendingScript = s.dataset.script
        overlays.querySelectorAll('[data-script]').forEach((x) => x.classList.toggle('is-on', x === s))
      }
      if (e.target.closest('#bd-script-select')) {
        bdState.watchScript = pendingScript
        reopen()
      }
      if (e.target.closest('#bd-script-cancel')) overlays.querySelector('#bd-script-modal').hidden = true
    }
    overlays.querySelectorAll('.bd-select').forEach((el) => el.addEventListener('click', onOverlay))
    bdBindLive(body, bdWatchForm, { xpub: bdValidXpub, external: bdValidDescriptor, internal: bdValidDescriptor, fingerprint: bdValidFingerprint, address: bdValidAddress }, () => {
      const f = bdWatchForm
      const o = bdState.watchOption
      const add = body.querySelector('#bd-add')
      if (add) add.disabled = !bdValidAddress(f.address)
      body.querySelector('#bd-confirm').disabled = !(o === 'importExtendedPub'
        ? bdValidXpub(f.xpub) && bdValidFingerprint(f.fingerprint)
        : o === 'importDescriptor'
          ? bdValidDescriptor(f.external)
          : bdState.watchAddresses.length > 0)
    })
    body.addEventListener('click', (e) => {
      if (e.target.closest('#bd-paste')) {
        const o = bdState.watchOption
        if (o === 'importExtendedPub') bdWatchForm.xpub = BD_XPUB
        else if (o === 'importDescriptor') {
          bdWatchForm.external = BD_DESCRIPTOR
          bdWatchForm.internal = BD_DESCRIPTOR_INTERNAL
        } else bdWatchForm.address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
        reopen()
      }
      if (e.target.closest('#bd-paste-fp')) {
        bdWatchForm.fingerprint = BD_FINGERPRINT
        reopen()
      }
      if (e.target.closest('#bd-add')) {
        bdState.watchAddresses.push(bdWatchForm.address)
        bdWatchForm.address = ''
        reopen()
      }
      const rm = e.target.closest('[data-remove]')
      if (rm) {
        bdState.watchAddresses.splice(Number(rm.dataset.remove), 1)
        reopen()
      }
      if (e.target.closest('#bd-script')) document.getElementById('bd-script-modal').hidden = false
      if (e.target.closest('#bd-options')) {
        bdState.watchPicked = false
        reopen()
      }
      const confirm = e.target.closest('#bd-confirm')
      if (confirm) {
        confirm.disabled = true
        confirm.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          bdState.watchPicked = false
          go('account')
          ss.toast(t('watchonly.success.accountCreated'), document.getElementById('view-account'))
        }, 900)
      }
    })
  }
})
