/* Settings — security, about, developer, design, icons.
   app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/{security,securityReport,about/*,developer*,design,icons}.tsx
   Fixture data only: nothing is sent, deleted or decrypted. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  .sy-slider-row { display: flex; justify-content: space-between; }
  .sy-slider { --fill: 0%; width: 100%; height: 22px; margin: 0; background: none; -webkit-appearance: none; appearance: none; }
  .sy-slider::-webkit-slider-runnable-track { height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--white) var(--fill), var(--gray-800) var(--fill)); }
  .sy-slider::-webkit-slider-thumb { width: 22px; height: 22px; margin-top: -5px; border-radius: 11px; background: var(--white); -webkit-appearance: none; }
  .sy-slider::-moz-range-track { height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--white) var(--fill), var(--gray-800) var(--fill)); }
  .sy-slider::-moz-range-thumb { width: 22px; height: 22px; border: 0; border-radius: 11px; background: var(--white); }
  .sy-box { padding: 12px; border-radius: 8px; background: var(--gray-900); }
  .sy-sent-box { max-height: 320px; overflow: auto; }
  .sy-link-row { display: flex; align-items: center; justify-content: space-between; width: 100%; border: 0; padding: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .sy-link-row:active, .sy-follow:active { opacity: 0.5; }
  .sy-follow { display: inline-flex; align-items: center; gap: var(--layout-h-stack-gap-sm); border: 0; padding: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
  .sy-chapter-button { width: 72px; height: 30px; }
  .sy-link { color: var(--gray-75); text-decoration: underline; cursor: pointer; }
  .sy-release-body { margin: 0; padding-left: 18px; color: var(--gray-300); font-size: var(--sizes-text-font-size-sm); line-height: 1.5; }
  .sy-release-body li + li { margin-top: 4px; }
  .sy-plain-input { box-sizing: border-box; width: 100%; height: 48px; border: 1px solid var(--gray-700); border-radius: 3px; padding: 0 12px; background: var(--gray-900); color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-md); outline: none; }
  .sy-plain-input::placeholder { color: var(--gray-400); }
  textarea.sy-plain-input { height: 140px; padding: 12px; resize: none; font-family: ui-monospace, Menlo, monospace; font-size: var(--sizes-text-font-size-xs); }
  .sy-row-buttons > * { flex: 1; }
  .sy-icon-grid { display: flex; flex-wrap: wrap; }
  .sy-icon-cell { width: 20%; padding: 8px 0; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .sy-icon-cell .ss-icon { color: var(--white); }
  .sy-icon-cell .ss-text { overflow: hidden; max-width: 100%; text-overflow: ellipsis; white-space: nowrap; }
  .sy-tabs { display: flex; gap: 2px; padding: 2px; border-radius: 3px; background: var(--gray-850); }
  .sy-tabs button { flex: 1; height: 40px; border: 0; border-radius: 3px; background: none; color: var(--gray-300); font: inherit; font-size: var(--sizes-text-font-size-sm); text-transform: uppercase; letter-spacing: 1px; cursor: pointer; }
  .sy-tabs button.is-on { background: var(--gray-600); color: var(--white); }
  .sy-status { position: relative; width: 12px; height: 12px; border-radius: 50%; }
  .sy-status.is-checking { background: var(--gray-500); animation: sy-blink 1s ease-in-out infinite; }
  .sy-status.is-connected { background: var(--main-green); }
  .sy-status.is-private::after { content: ""; position: absolute; inset: -4px; border: 1px solid var(--main-green); border-radius: 50%; }
  .sy-status.is-failed { background: var(--main-red); }
  @keyframes sy-blink { 50% { opacity: 0.3; } }
  .sy-collapsible { display: flex; flex-wrap: wrap; overflow: hidden; max-height: 22px; transition: max-height 200ms; }
  .sy-collapsible.is-open { max-height: 200px; }
  .sy-collapsible + .sy-collapse-toggle { align-self: flex-start; border: 0; padding: 0; background: none; color: var(--gray-300); font: inherit; font-size: var(--sizes-text-font-size-xs); text-transform: uppercase; cursor: pointer; }
  .sy-orbit-green svg { fill: var(--main-green); }
  .sy-orbit-red svg { fill: var(--main-red); }
  .sy-pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
  .sy-padded { padding-bottom: 64px; }
  </style>`
)

// t() handles %{x}; a few diagnostics strings use {{x}}.
function syT(key, vars = {}) {
  return t(key, vars).replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''))
}

// SSSlider: min / value / max row above a 12px track.
function sySlider(p) {
  const fill = ((p.value - p.min) / (p.max - p.min)) * 100
  const unit = (v) => ss.hstack({ gap: 'xs' }, ss.text({ className: p.valueClass && v === p.value ? p.valueClass : '' }, String(v)), p.suffix ? ss.text({ color: 'muted' }, p.suffix) : '')
  return ss.vstack({ gap: 'sm' },
    `<div class="sy-slider-row">${unit(p.min)}${unit(p.value)}${unit(p.max)}</div>`,
    `<input type="range" class="sy-slider" id="${p.id}" min="${p.min}" max="${p.max}" step="${p.step || 1}" value="${p.value}" style="--fill:${fill}%">`)
}

function syBindSlider(body, id, onChange) {
  const input = body.querySelector('#' + id)
  input.addEventListener('input', () => {
    const v = +input.value
    input.style.setProperty('--fill', ((v - +input.min) / (+input.max - +input.min)) * 100 + '%')
    const row = input.parentElement.querySelector('.sy-slider-row')
    row.children[1].querySelector('.ss-text').textContent = v
    if (onChange) onChange(v)
  })
}

function sySection(title, ...children) {
  return ss.vstack({ gap: 'sm' }, ss.text({ size: 'xs', color: 'muted', uppercase: true, weight: 'medium' }, title), ...children)
}

const syState = {
  pinMaxTries: 5,
  duressEnabled: false,
  skipSeedConfirmation: false,
  reportSent: null,
  reportAnonymous: true,
  backupRevealed: false,
  checks: {},
  roundtrip: { kind: 'idle' },
  roundtripLog: [],
  recovered: false,
  confirmOverwrite: false
}

// --- security.tsx ---------------------------------------------------------------

registerScreen('settings-security', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/security.tsx',
  title: () => t('settings.security.title'),
  back: 'settings',
  render: () => {
    const tn = (k) => t('settings.security.' + k)
    return ss.vstack({ gap: 'md', justifyBetween: true },
      ss.vstack({ gap: 'md', style: 'margin-top:40px' },
        ss.vstack({ gap: 'xs' },
          ss.text({ uppercase: true }, tn('appPin')),
          ss.vstack({ gap: 'xs' }, ss.text({}, tn('maxPinTries')), sySlider({ id: 'sy-pin-tries', min: 3, max: 10, value: syState.pinMaxTries })),
          ss.button({ label: tn('changePin'), id: 'sy-change-pin' })),
        ss.separator(),
        ss.vstack({ gap: 'md' },
          ss.text({ uppercase: true }, tn('duressPin')),
          ss.checkbox({ label: tn('duressPinEnabled'), selected: syState.duressEnabled, id: 'sy-duress' }),
          ss.button({ label: tn('duressPinSet'), id: 'sy-duress-set' })),
        ss.separator(),
        ss.vstack({ gap: 'md' },
          ss.text({ uppercase: true }, tn('seed')),
          ss.checkbox({ label: tn('skipSeedConfirmation'), selected: syState.skipSeedConfirmation, id: 'sy-skip-seed' }))),
      ss.vstack({},
        ss.button({ label: t('common.save'), variant: 'secondary', id: 'sy-save' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', go: 'settings' })))
  },
  overlays: () => {
    const tn = (k) => t('settings.security.' + k)
    return ss.modal({ id: 'sy-duress-modal' },
      ss.vstack({ justifyBetween: true, itemsCenter: true, style: 'flex:1;width:100%' },
        ss.hstack({}, ss.icon('warning', { size: 30 }), ss.text({ uppercase: true, weight: 'bold', size: '4xl' }, t('common.warning')), ss.icon('warning', { size: 30 })),
        ss.vstack({},
          ss.text({ size: 'lg' }, tn('duressPinText1')),
          ss.text({ size: 'lg', weight: 'bold' }, tn('duressPinText2')),
          ss.text({ size: 'lg', weight: 'bold' }, tn('duressPinText3')),
          ss.text({ size: 'lg', weight: 'bold' }, tn('duressPinText4'))),
        ss.button({ label: tn('duressPin'), variant: 'secondary', go: 'duress' })))
  },
  bind: (body) => {
    syBindSlider(body, 'sy-pin-tries')
    body.querySelector('#sy-duress-set').onclick = () => ss.open('sy-duress-modal')
    body.querySelector('#sy-change-pin').onclick = () => ss.toast(t('settings.security.changePin'), document.getElementById('view-kit'))
    body.querySelector('#sy-save').onclick = () => {
      syState.pinMaxTries = +body.querySelector('#sy-pin-tries').value
      syState.duressEnabled = body.querySelector('#sy-duress').classList.contains('is-on')
      syState.skipSeedConfirmation = body.querySelector('#sy-skip-seed').classList.contains('is-on')
      go('settings')
    }
  }
})

// --- securityReport.tsx -----------------------------------------------------------

const SY_THROWAWAY = {
  mnemonic: 'canyon orbit velvet pledge drastic lemon window ozone theory cradle humble rhythm',
  nsec: 'nsec1demo0throwaway0key000000000000000000000000000000000000'
}
const SY_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net']

function syBackupSection() {
  if (!syState.reportAnonymous) return ''
  const k = (x) => t('settings.about.securityReport.' + x)
  return `<div class="sy-box">${ss.vstack({ gap: 'sm' },
    ss.text({ uppercase: true, size: 'xs', color: 'muted' }, k('throwawayTitle')),
    ss.text({ size: 'xs', color: 'muted' }, k('throwawayDescription')),
    ss.button({ label: syState.backupRevealed ? k('hideBackup') : k('showBackup'), variant: 'outline', id: 'sy-backup-toggle' }),
    syState.backupRevealed
      ? ss.vstack({ gap: 'sm' },
          ss.text({ uppercase: true, size: 'xs', color: 'muted' }, k('seedWords')),
          ss.clipboardCopy({ text: SY_THROWAWAY.mnemonic }, ss.text({ type: 'mono' }, SY_THROWAWAY.mnemonic)),
          ss.text({ uppercase: true, size: 'xs', color: 'muted' }, k('nsecKey')),
          ss.clipboardCopy({ text: SY_THROWAWAY.nsec }, ss.text({ type: 'mono', style: 'word-break:break-all' }, SY_THROWAWAY.nsec)),
          ss.text({ size: 'xs', color: 'muted' }, k('tapToCopy')))
      : '')}</div>`
}

registerScreen('settings-security-report', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/securityReport.tsx',
  title: () => t('settings.about.securityReport.title'),
  back: 'settings-about',
  render: () => {
    const k = (x) => t('settings.about.securityReport.' + x)
    if (syState.reportSent !== null)
      return ss.vstack({ gap: 'lg', style: 'padding-top:32px' },
        ss.vstack({ gap: 'md', itemsCenter: true },
          ss.icon('checkCircleThin', { size: 48 }),
          ss.text({ size: 'lg', weight: 'medium', center: true }, k('sentTitle')),
          ss.text({ color: 'muted', center: true }, k('sentDescription'))),
        `<div class="sy-box sy-sent-box">${ss.text({}, ss.esc(syState.reportSent))}</div>`,
        syBackupSection(),
        syState.reportAnonymous ? ss.button({ label: k('viewConversation'), variant: 'outline', go: 'nostr' }) : '',
        ss.button({ label: t('common.close'), variant: 'secondary', id: 'sy-report-close' }))
    return ss.vstack({ gap: 'lg', className: 'sy-padded' },
      ss.hstack({ gap: 'sm' }, ss.icon('warning', { size: 20 }), ss.text({ style: 'color:var(--warning);flex:1' }, k('warning'))),
      ss.text({ color: 'muted' }, k('description')),
      `<label class="ss-input is-left"><textarea class="sy-report-input" placeholder="${ss.esc(k('placeholder'))}" style="min-height:140px;height:140px;font-size:var(--sizes-text-font-size-md)"></textarea></label>`,
      ss.hstack({ gap: 'sm', style: 'align-items:center' },
        ss.checkbox({ selected: syState.reportAnonymous, id: 'sy-anon', style: 'width:auto;flex:none' }),
        ss.vstack({ gap: 'xxs', style: 'flex:1' }, ss.text({}, k('anonymous')), ss.text({ size: 'xs', color: 'muted' }, k('anonymousHint')))),
      syBackupSection(),
      !syState.reportAnonymous ? ss.text({ size: 'xs', color: 'muted' }, k('sendingAs').replace('%{name}', 'satoshi')) : '',
      ss.vstack({ gap: 'xs' },
        ss.text({ uppercase: true, size: 'xs', color: 'muted' }, k('relaysTitle')),
        SY_RELAYS.map((r) => ss.text({ size: 'xs', color: 'muted', type: 'mono' }, r))),
      ss.button({ label: k('send'), variant: 'secondary', disabled: true, id: 'sy-report-send' }),
      ss.button({ label: t('common.back'), variant: 'ghost', go: 'settings-about' }))
  },
  bind: (body) => {
    const input = body.querySelector('.sy-report-input')
    const send = body.querySelector('#sy-report-send')
    if (input) input.addEventListener('input', () => (send.disabled = !input.value.trim()))
    body.addEventListener('click', (e) => {
      if (e.target.closest('#sy-backup-toggle')) {
        syState.backupRevealed = !syState.backupRevealed
        openKitScreen('settings-security-report')
      }
      if (e.target.closest('#sy-anon')) {
        syState.reportAnonymous = !syState.reportAnonymous
        const draft = input ? input.value : ''
        openKitScreen('settings-security-report')
        const next = document.querySelector('.sy-report-input')
        if (next) {
          next.value = draft
          document.getElementById('sy-report-send').disabled = !draft.trim()
        }
      }
      if (e.target.closest('#sy-report-send') && input && input.value.trim()) {
        const button = e.target.closest('#sy-report-send')
        button.disabled = true
        button.innerHTML = '<span class="ss-spinner"></span>'
        const text = input.value.trim()
        setTimeout(() => {
          syState.reportSent = text
          openKitScreen('settings-security-report')
        }, 900)
      }
      if (e.target.closest('#sy-report-close')) {
        syState.reportSent = null
        syState.backupRevealed = false
        go('settings-about')
      }
    })
  }
})

// --- about/index.tsx --------------------------------------------------------------

registerScreen('settings-about', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/about/index.tsx',
  title: () => t('settings.about.title'),
  back: 'settings',
  render: () =>
    ss.vstack({ gap: 'md', justifyBetween: true, style: 'padding-bottom:40px' },
      ss.vstack({ gap: 'md' },
        ss.hstack({ justifyBetween: true }, ss.text({ uppercase: true }, t('common.version')), ss.text({}, '0.3.6 (142)')),
        ss.hstack({ justifyBetween: true }, ss.text({ uppercase: true }, t('settings.about.license')), ss.text({}, 'MIT')),
        `<button type="button" class="sy-link-row" data-go="settings-about-changelog">${ss.text({ uppercase: true, as: 'span' }, t('settings.about.changelog.title'))}${ss.icon('chevronRight', { width: 6, height: 11.6 })}</button>`,
        `<button type="button" class="sy-link-row" data-go="settings-security-report">${ss.text({ uppercase: true, as: 'span' }, t('settings.about.securityReport.title'))}${ss.icon('chevronRight', { width: 6, height: 11.6 })}</button>`,
        ss.separator(),
        ss.text({ size: 'xs', color: 'muted', uppercase: true, style: 'letter-spacing:1px;margin:8px 0 4px' }, t('intro.sectionTitle')),
        ss.hstack({ justifyBetween: true, style: 'align-items:center;padding:4px 0' },
          ss.text({}, t('intro.replay')),
          ss.button({ variant: 'secondary', label: t('intro.start'), className: 'sy-chapter-button', go: 'intro' }))),
      ss.vstack({ gap: 'sm', itemsCenter: true },
        ss.text({ size: 'md', uppercase: true }, t('settings.about.followProject')),
        ss.hstack({ gap: 'lg' },
          `<button type="button" class="sy-follow sy-external">${ss.icon('nostr', { size: 16 })}${ss.text({ as: 'span' }, t('settings.about.nostr'))}</button>`,
          `<button type="button" class="sy-follow sy-external">${ss.icon('x', { size: 16 })}${ss.text({ as: 'span' }, t('settings.about.x'))}</button>`))),
  bind: (body) => {
    body.querySelectorAll('.sy-external').forEach((b) => (b.onclick = () => ss.toast('Opens external link (demo)', document.getElementById('view-kit'))))
  }
})

// --- about/changelog.tsx (fixture releases instead of the GitHub API) ---------------

const SY_RELEASES = [
  { version: 'v0.3.6', date: '2026-10-02', notes: ['Payjoin (BIP77) send and receive', 'Ark board and offboard flows', 'Faster UTXO bubble chart'], apk: true },
  { version: 'v0.3.5', date: '2026-08-21', notes: ['Nostr label sync across devices', 'ECash mint recovery', 'Fixes for multisig PSBT import'], apk: true },
  { version: 'v0.3.4', date: '2026-07-03', notes: ['Lightning LND REST connection', 'Fee rate chart in the transaction builder'], apk: false }
]

registerScreen('settings-about-changelog', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/about/changelog.tsx',
  title: () => t('settings.about.changelog.title'),
  back: 'settings-about',
  render: () =>
    ss.vstack({ gap: 'lg', className: 'sy-padded' },
      SY_RELEASES.map((r) =>
        ss.vstack({ gap: 'lg' },
          ss.vstack({ gap: 'md' },
            ss.text({ weight: 'bold' }, `${r.version} (${r.date})`),
            `<ul class="sy-release-body">${r.notes.map((n) => `<li>${ss.esc(n)}</li>`).join('')}</ul>`,
            ss.hstack({ gap: 'sm' },
              ss.text({ size: 'xs', className: 'sy-link sy-external', as: 'span' }, t('settings.about.changelog.sourcecode')),
              r.apk ? ss.text({ size: 'xs', className: 'sy-link sy-external', as: 'span' }, t('settings.about.changelog.apk')) : '')),
          ss.separator()))),
  bind: (body) => {
    body.querySelectorAll('.sy-external').forEach((b) => (b.onclick = () => ss.toast('Opens external link (demo)', document.getElementById('view-kit'))))
  }
})

// --- developer.tsx ------------------------------------------------------------------

function syBackupSummary() {
  const row = (label, value, sep = true) =>
    ss.vstack({ gap: 'xs', widthFull: true },
      ss.hstack({ justifyBetween: true, style: 'width:100%' }, ss.text({ color: 'muted' }, label), ss.text({ color: 'muted', size: 'xs', type: 'mono', style: 'text-align:right' }, value)),
      sep ? ss.separator({ color: 'grayDark' }) : '')
  const d = (k, n) => t('settings.developer.backupSummaryDetail' + k, { count: n })
  return ss.vstack({ gap: 'xs', widthFull: true },
    row(t('settings.developer.backupSummarySize'), '18.4 KB'),
    row(t('settings.developer.backupSummaryBitcoin'), `3 · ${d('Labels', 41)} · ${d('Transactions', 128)}`),
    row(t('settings.developer.backupSummaryLightning'), `1 · ${d('Channels', 4)}`),
    row(t('settings.developer.backupSummaryArk'), `1 · ${d('Datadirs', 1)}`),
    row(t('settings.developer.backupSummaryEcash'), `2 · ${d('Mints', 2)} · ${d('Proofs', 17)}`),
    row(t('settings.developer.backupSummaryNostr'), `2 · ${d('Relays', 5)} · ${d('Secrets', 2)}`, false))
}

function syConfirmModal(id, warningKey, confirmKey) {
  return ss.modal({ id, fullOpacity: true, label: t('common.cancel'), closeButtonVariant: 'ghost' },
    ss.vstack({ gap: 'lg', style: 'padding:8px 0;width:100%' },
      ss.vstack({ gap: 'xs', itemsCenter: true },
        `<span style="color:var(--gray-400)">${ss.icon('warning', { size: 20 })}</span>`,
        ss.text({ center: true, color: 'muted', style: 'white-space:pre-line' }, t(warningKey))),
      ss.vstack({ gap: 'sm' },
        ss.button({ label: t('settings.developer.backupData'), variant: 'secondary', className: 'sy-open-backup' }),
        ss.button({ label: t(confirmKey), variant: 'danger', className: 'sy-fake-destroy' }))))
}

registerScreen('settings-developer', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/developer.tsx',
  title: () => t('settings.developer.title'),
  back: 'settings',
  render: () =>
    ss.vstack({ gap: 'lg' },
      ss.vstack({},
        ss.button({ label: t('settings.developer.backupData'), variant: 'secondary', className: 'sy-open-backup' }),
        ss.button({ label: t('settings.developer.recoverData'), variant: 'secondary', go: 'settings-developer-recover' })),
      ss.separator({ color: 'gradient' }),
      ss.vstack({},
        ss.button({ label: t('settings.developer.deleteAccounts'), id: 'sy-delete-accounts' }),
        ss.button({ label: t('settings.developer.clearStorage'), id: 'sy-clear-storage' })),
      ss.separator({ color: 'gradient' }),
      ss.vstack({}, ss.checkbox({ label: t('settings.developer.skipPin'), selected: false })),
      ss.separator({ color: 'gradient' }),
      ss.vstack({},
        ss.button({ label: t('settings.developer.diagnosis.title'), variant: 'outline', go: 'settings-developer-diagnosis' }),
        ss.button({ label: t('settings.developer.design'), variant: 'outline', go: 'settings-design' }))),
  overlays: () =>
    syConfirmModal('sy-delete-modal', 'settings.developer.deleteAccountsWarning', 'settings.developer.deleteAccountsConfirm') +
    syConfirmModal('sy-clear-modal', 'settings.developer.clearStorageWarning', 'settings.developer.clearStorageConfirm') +
    ss.modal({ id: 'sy-backup-modal', fullOpacity: true, label: t('common.cancel'), closeButtonVariant: 'ghost' },
      ss.vstack({ gap: 'md', widthFull: true, style: 'overflow:auto' },
        ss.text({ center: true, size: 'lg', uppercase: true }, t('settings.developer.backupModalTitle')),
        ss.text({ center: true, color: 'muted' }, t('settings.developer.backupPreviewWarning')),
        syBackupSummary(),
        ss.vstack({ gap: 'xs', widthFull: true },
          ss.text({ color: 'muted' }, t('settings.developer.backupPassphraseLabel')),
          `<input type="password" class="sy-plain-input" placeholder="${ss.esc(t('settings.developer.backupPassphrasePlaceholder'))}">`,
          ss.text({ color: 'muted', size: 'xs' }, t('settings.developer.backupPassphraseAllowed'))),
        ss.text({ color: 'muted', size: 'xs' }, t('settings.developer.backupEncryptionNote')),
        ss.vstack({ gap: 'sm', widthFull: true },
          ss.button({ label: t('settings.developer.backupEncryptShare'), className: 'sy-fake-backup' }),
          ss.button({ label: t('settings.developer.backupEncryptSaveFile'), variant: 'secondary', className: 'sy-fake-backup' })))),
  bind: (body) => {
    const screen = document.getElementById('view-kit')
    body.querySelector('#sy-delete-accounts').onclick = () => ss.open('sy-delete-modal')
    body.querySelector('#sy-clear-storage').onclick = () => ss.open('sy-clear-modal')
    screen.querySelectorAll('.sy-open-backup').forEach((b) =>
      (b.onclick = () => {
        ss.close('sy-delete-modal')
        ss.close('sy-clear-modal')
        ss.open('sy-backup-modal')
      }))
    screen.querySelectorAll('.sy-fake-destroy').forEach((b) =>
      (b.onclick = () => {
        b.closest('.ss-modal').setAttribute('hidden', '')
        ss.toast('Demo only — nothing was deleted', screen)
      }))
    screen.querySelectorAll('.sy-fake-backup').forEach((b) =>
      (b.onclick = () => {
        ss.close('sy-backup-modal')
        ss.toast(t('settings.developer.backupSuccess'), screen)
      }))
  }
})

// --- developerDiagnosis.tsx ------------------------------------------------------------

const SY_CHECKS = [
  { id: 'crypto' },
  { id: 'entropy' },
  { id: 'pinKdf' },
  { id: 'secureStore' },
  { id: 'sqlite' },
  { id: 'nip17' },
  { id: 'nip17Live', requiresNetwork: true },
  { id: 'relayPersistence', requiresNetwork: true }
]
const SY_CHECK_LINES = {
  crypto: ['aes-256-gcm encrypt/decrypt ok', 'pbkdf2 100k iterations 212ms'],
  entropy: ['10,000 samples, 0 collisions'],
  pinKdf: ['derived key matches stored hash'],
  secureStore: ['write/read/delete ok'],
  sqlite: ['PRAGMA integrity_check: ok'],
  nip17: ['seal → wrap → unwrap ok'],
  nip17Live: ['published to 3 relays', 'retrieved and decrypted in 1.8s'],
  relayPersistence: ['3/3 relays alive after 30s']
}

function syRoundtripLabel() {
  const r = syState.roundtrip
  if (r.kind === 'idle') return syT('settings.developer.diagnosis.status.idle')
  if (r.kind === 'running') return syT('settings.developer.diagnosis.status.running', { step: r.step })
  return syT('settings.developer.diagnosis.status.success', { txid: r.txid })
}

registerScreen('settings-developer-diagnosis', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/developerDiagnosis.tsx',
  title: () => t('settings.developer.diagnosis.title'),
  back: 'settings-developer',
  render: () => {
    const k = (x) => 'settings.developer.diagnosis.' + x
    const anyRunning = Object.values(syState.checks).some((r) => r.kind === 'running')
    const anyDone = Object.values(syState.checks).some((r) => r.kind === 'ok')
    const running = syState.roundtrip.kind === 'running'
    return ss.vstack({ gap: 'lg', className: 'sy-padded' },
      ss.text({ color: 'muted' }, t(k('description'))),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t(k('quickChecks.title'))),
        ss.text({ color: 'muted' }, t(k('quickChecks.description'))),
        SY_CHECKS.map(({ id, requiresNetwork }) => {
          const r = syState.checks[id]
          return ss.vstack({ gap: 'xs' },
            ss.button({ label: t(k(`checks.${id}.title`)), variant: 'outline', loading: r && r.kind === 'running', data: { check: id } }),
            requiresNetwork ? ss.text({ color: 'muted', size: 'xs' }, t(k(`checks.${id}.hint`))) : '',
            r && r.kind === 'ok'
              ? ss.text({ style: 'color:var(--success)' }, t(k('checks.statusOk'))) +
                  SY_CHECK_LINES[id].map((line) => ss.text({ color: 'muted', size: 'xs', type: 'mono' }, line)).join('')
              : '')
        }),
        ss.button({ label: t(k('checks.runAll')), variant: 'outline', disabled: anyRunning, id: 'sy-run-all' }),
        ss.button({ label: t(k('report.submit')), variant: 'outline', disabled: !anyDone || anyRunning, id: 'sy-report' })),
      ss.separator({ color: 'gradient' }),
      ss.vstack({ gap: 'sm' },
        ss.text({ uppercase: true }, t(k('payjoinRoundtrip.title'))),
        ss.text({ color: 'muted' }, t(k('payjoinRoundtrip.description'))),
        ss.text({}, syRoundtripLabel()),
        syState.roundtripLog.length ? ss.vstack({ gap: 'xs' }, syState.roundtripLog.map((l) => ss.text({ color: 'muted', size: 'xs', type: 'mono' }, l))) : '',
        ss.button({ label: t(k('payjoinRoundtrip.run')), variant: 'outline', disabled: running, id: 'sy-roundtrip' }),
        running ? ss.button({ label: t(k('cancel')), variant: 'outline', id: 'sy-roundtrip-cancel' }) : '',
        syState.roundtripLog.length ? ss.clipboardCopy({ text: syState.roundtripLog.join('\n') }, ss.button({ label: t(k('copyLog')), variant: 'outline' })) : ''),
      ss.separator({ color: 'gradient' }),
      ss.button({ label: t('common.back'), variant: 'outline', go: 'settings-developer' }))
  },
  overlays: () => {
    const k = (x) => t('settings.developer.diagnosis.' + x)
    const payload = {
      app: '0.3.6 (142)',
      platform: 'ios 19.1',
      checks: Object.fromEntries(Object.entries(syState.checks).map(([id, r]) => [id, r.kind]))
    }
    return ss.modal({ id: 'sy-confirm-modal', label: t('common.cancel') },
        ss.vstack({ gap: 'lg' },
          ss.text({ size: 'lg', weight: 'medium', center: true }, k('confirm.title')),
          ss.text({ color: 'muted', center: true }, k('confirm.message')),
          ss.button({ label: k('confirm.run'), variant: 'danger', id: 'sy-roundtrip-go' }))) +
      ss.modal({ id: 'sy-report-modal', label: t('common.cancel') },
        ss.vstack({ gap: 'lg', style: 'overflow:auto' },
          ss.text({ size: 'lg', weight: 'medium', center: true }, k('report.title')),
          ss.text({ color: 'muted', center: true }, k('report.message')),
          `<pre class="sy-pre">${ss.text({ type: 'mono', size: 'xs', as: 'span' }, ss.esc(JSON.stringify(payload, null, 2)))}</pre>`,
          ss.button({ label: k('report.send'), variant: 'outline', id: 'sy-report-send' })))
  },
  bind: () => {
    const screen = document.getElementById('view-kit')
    const rerender = () => openKitScreen('settings-developer-diagnosis')
    const run = (ids) => {
      ids.forEach((id) => (syState.checks[id] = { kind: 'running' }))
      rerender()
      ids.forEach((id, i) =>
        setTimeout(() => {
          syState.checks[id] = { kind: 'ok' }
          if (routeId === 'settings-developer-diagnosis') rerender()
        }, 500 + i * 250))
    }
    screen.onclick = (e) => {
      if (routeId !== 'settings-developer-diagnosis') return
      const check = e.target.closest('[data-check]')
      if (check) run([check.dataset.check])
      if (e.target.closest('#sy-run-all')) run(SY_CHECKS.map((c) => c.id))
      if (e.target.closest('#sy-report')) ss.open('sy-report-modal')
      if (e.target.closest('#sy-report-send')) {
        ss.close('sy-report-modal')
        ss.toast(t('settings.developer.diagnosis.report.success'), screen)
      }
      if (e.target.closest('#sy-roundtrip')) ss.open('sy-confirm-modal')
      if (e.target.closest('#sy-roundtrip-cancel')) {
        clearTimeout(syState.roundtripTimer)
        syState.roundtrip = { kind: 'idle' }
        rerender()
      }
      if (e.target.closest('#sy-roundtrip-go')) {
        ss.close('sy-confirm-modal')
        const steps = ['syncing Sample wallet', 'creating BIP77 session', 'posting original PSBT', 'waiting for Clown proposal', 'broadcasting']
        syState.roundtripLog = []
        let i = 0
        const next = () => {
          if (i < steps.length) {
            syState.roundtrip = { kind: 'running', step: steps[i] }
            syState.roundtripLog.push(`[${new Date().toISOString().slice(11, 19)}] ${steps[i]}`)
            i += 1
            syState.roundtripTimer = setTimeout(next, 700)
          } else {
            syState.roundtrip = { kind: 'success', txid: 'f4e2…9a1c' }
          }
          if (routeId === 'settings-developer-diagnosis') rerender()
        }
        next()
      }
    }
  }
})

// --- developerRecover.tsx --------------------------------------------------------------

registerScreen('settings-developer-recover', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/developerRecover.tsx',
  title: () => t('settings.developer.recoverTitle'),
  back: 'settings-developer',
  render: () => {
    const k = (x) => t('settings.developer.' + x)
    if (!syState.recovered)
      return ss.vstack({ gap: 'lg', className: 'sy-padded' },
        ss.vstack({ gap: 'xs', widthFull: true },
          ss.text({ color: 'muted' }, k('recoverEncryptedLabel')),
          `<textarea class="sy-plain-input" id="sy-recover-data" placeholder="${ss.esc(k('recoverEncryptedPlaceholder'))}"></textarea>`,
          ss.hstack({ gap: 'xs', className: 'sy-row-buttons' },
            ss.button({ label: t('common.paste'), id: 'sy-recover-paste' }),
            ss.button({ label: k('recoverUploadFile'), id: 'sy-recover-paste' }),
            ss.button({ label: k('recoverScanQr'), id: 'sy-recover-paste' }))),
        ss.vstack({ gap: 'xs', widthFull: true },
          ss.text({ color: 'muted' }, k('backupPassphraseLabel')),
          `<input type="password" class="sy-plain-input" id="sy-recover-pass" placeholder="${ss.esc(k('recoverPassphrasePlaceholder'))}">`),
        ss.vstack({ widthFull: true }, ss.button({ label: k('recoverDecrypt'), variant: 'secondary', id: 'sy-recover-decrypt' })))
    return ss.vstack({ gap: 'lg', className: 'sy-padded' },
      ss.vstack({ gap: 'xs', widthFull: true }, ss.text({ color: 'muted' }, k('recoverDecryptedLabel')), syBackupSummary()),
      ss.vstack({ widthFull: true }, ss.button({ label: k('recoverOverwrite'), variant: 'secondary', id: 'sy-recover-overwrite' })),
      syState.confirmOverwrite ? ss.vstack({ widthFull: true }, ss.button({ label: k('recoverImSure'), variant: 'danger', id: 'sy-recover-sure' })) : '')
  },
  bind: (body) => {
    const screen = document.getElementById('view-kit')
    body.addEventListener('click', (e) => {
      if (e.target.closest('#sy-recover-paste')) document.getElementById('sy-recover-data').value = 'U2FsdGVkX1+demo0encrypted0backup0payload0Zm9vYmFyYmF6cXV4…'
      if (e.target.closest('#sy-recover-decrypt')) {
        if (!document.getElementById('sy-recover-data').value.trim()) return ss.toast(t('settings.developer.recoverEncryptedLabel'), screen)
        syState.recovered = true
        syState.confirmOverwrite = false
        openKitScreen('settings-developer-recover')
      }
      if (e.target.closest('#sy-recover-overwrite')) {
        syState.confirmOverwrite = true
        openKitScreen('settings-developer-recover')
      }
      if (e.target.closest('#sy-recover-sure')) {
        syState.recovered = false
        syState.confirmOverwrite = false
        go('settings-developer')
        ss.toast('Demo only — nothing was overwritten', document.getElementById('view-kit'))
      }
    })
  }
})

// --- design.tsx ------------------------------------------------------------------------

const SY_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
const SY_SEED = ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident']
const SY_PREVIEW_ICONS = [['bitcoin', 'Bitcoin'], ['lightning', 'Lightning'], ['keys', 'Keys'], ['seed', 'Seed'], ['qR', 'QR'], ['scan', 'Scan'], ['network', 'Network'], ['lock', 'Lock'], ['settings', 'Settings'], ['warning', 'Warning']]
let syTab = 'send'

function syIconGrid(list) {
  return `<div class="sy-icon-grid">${list
    .map(([key, name]) => `<div class="sy-icon-cell">${ss.icon(key, { size: 24 })}${ss.text({ size: '2xxs', color: 'muted', center: true }, ss.esc(name))}</div>`)
    .join('')}</div>`
}

registerScreen('settings-design', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/design.tsx',
  title: () => t('settings.developer.design'),
  back: 'settings-developer',
  render: () =>
    ss.vstack({ gap: 'xl', className: 'sy-padded' },
      sySection('Icons', `<div style="margin-bottom:12px">${syIconGrid(SY_PREVIEW_ICONS)}</div>`, ss.button({ label: t('settings.developer.icons'), variant: 'outline', go: 'settings-icons' })),
      ss.separator(),
      sySection('Typography', ss.vstack({ gap: 'xs' },
        ss.text({ size: '5xl', weight: 'ultralight' }, '5xl ultralight'),
        ss.text({ size: '3xl', weight: 'light' }, '3xl light'),
        ss.text({ size: '2xl' }, '2xl regular'),
        ss.text({ size: 'xl', weight: 'medium' }, 'xl medium'),
        ss.text({ size: 'lg', weight: 'bold' }, 'lg bold'),
        ss.text({ size: 'md', color: 'muted' }, 'md muted'),
        ss.text({ color: 'muted' }, 'sm muted'),
        ss.text({ size: 'xs', color: 'muted', uppercase: true }, 'xs uppercase muted'),
        ss.text({ size: 'md', type: 'mono' }, `mono — ${SY_ADDRESS.slice(0, 20)}…`))),
      ss.separator(),
      sySection('Amounts', ss.vstack({ gap: 'xs', itemsCenter: true },
        ss.styledSat({ amount: 1234567 }),
        ss.styledSat({ amount: 1234567, type: 'send', noColor: false }),
        ss.styledSat({ amount: 1234567, type: 'receive', noColor: false }),
        ss.styledSat({ amount: 0 }),
        ss.styledSat({ amount: 0.01234567, currency: 'btc', textSize: 'xl' }))),
      ss.separator(),
      sySection('Buttons', ss.vstack({ gap: 'xs' },
        ss.button({ label: 'Default' }),
        ss.button({ label: 'Secondary', variant: 'secondary' }),
        ss.button({ label: 'Outline', variant: 'outline' }),
        ss.button({ label: 'Ghost', variant: 'ghost' }),
        ss.button({ label: 'Subtle', variant: 'subtle' }),
        ss.button({ label: 'Gradient', variant: 'gradient' }),
        ss.button({ label: 'Elevated', variant: 'elevated' }),
        ss.button({ label: 'Danger', variant: 'danger' }),
        ss.button({ label: 'Loading', loading: true }),
        ss.button({ label: 'Disabled', disabled: true }),
        ss.button({ label: 'With select', withSelect: true }))),
      ss.separator(),
      sySection('Text Input', ss.vstack({ gap: 'xs' },
        ss.textInput({ placeholder: 'Default' }),
        ss.textInput({ variant: 'outline', placeholder: 'Outline' }),
        ss.textInput({ size: 'small', placeholder: 'Small', align: 'left' }),
        ss.textInput({ placeholder: 'Valid', status: 'valid', value: 'Valid value' }),
        ss.textInput({ placeholder: 'Invalid', status: 'invalid', error: 'This field is required' }))),
      ss.separator(),
      sySection('Number Input', ss.vstack({ gap: 'xs' },
        typeof numberInput === 'function' ? numberInput({ min: 0, max: 100, placeholder: '0–100', align: 'left' }) : ss.textInput({ placeholder: '0–100', align: 'left' }),
        typeof numberInput === 'function'
          ? numberInput({ min: 1, max: 21000000, placeholder: 'Sats (decimal)', variant: 'outline', align: 'left' })
          : ss.textInput({ placeholder: 'Sats (decimal)', variant: 'outline', align: 'left' }))),
      ss.separator(),
      sySection('Slider', sySlider({ id: 'sy-design-slider', min: 1, max: 10, value: 3, suffix: 'blocks' })),
      ss.separator(),
      sySection('Checkbox', ss.vstack({ gap: 'xs' }, ss.checkbox({ label: 'Interactive' }))),
      ss.separator(),
      sySection('Radio Button', ss.vstack({ gap: 'xs' },
        ss.hstack({ gap: 'sm' }, ss.radio({ label: 'Option A', group: 'sy-ab', selected: true }), ss.radio({ label: 'Option B', group: 'sy-ab' })),
        ss.hstack({ gap: 'sm' }, ss.radio({ label: 'Outline A', variant: 'outline', group: 'sy-ab2', selected: true }), ss.radio({ label: 'Outline B', variant: 'outline', group: 'sy-ab2' })))),
      ss.separator(),
      sySection('Paired Tabs',
        `<div class="sy-tabs"><button type="button" data-sy-tab="send" class="${syTab === 'send' ? 'is-on' : ''}">Send</button><button type="button" data-sy-tab="receive" class="${syTab === 'receive' ? 'is-on' : ''}">Receive</button></div>`,
        ss.text({ size: 'xs', color: 'muted', id: 'sy-tab-label' }, 'Active: ' + syTab)),
      ss.separator(),
      sySection('Modal', ss.button({ label: 'Open modal', variant: 'outline', id: 'sy-open-modal' })),
      ss.separator(),
      sySection('Address Display', ss.vstack({ gap: 'sm' },
        ss.addressDisplay({ address: SY_ADDRESS }),
        ss.addressDisplay({ address: SY_ADDRESS, variant: 'outline' }),
        ss.addressDisplay({ address: SY_ADDRESS, variant: 'bare' }))),
      ss.separator(),
      sySection('Clipboard Copy', ss.clipboardCopy({ text: SY_ADDRESS }, ss.text({ type: 'mono', color: 'muted' }, 'Tap to copy address'))),
      ss.separator(),
      sySection('Details List', ss.detailsList({
        columns: 2,
        items: [['Block height', '893 412'], ['Confirmations', '6'], ['Fee rate', '12 sat/vB'], ['Size', '141 vB'], ['Txid', SY_ADDRESS.slice(0, 16) + '…', { variant: 'mono' }], ['Network', 'mainnet']]
      })),
      ss.separator(),
      sySection('Settings Card',
        ss.settingsCard({ title: 'Network', description: 'Configure Electrum and Esplora servers', icon: ss.icon('network', { size: 28 }) }),
        ss.settingsCard({ title: 'Security', description: 'PIN, biometrics, and lock settings', icon: ss.icon('lock', { size: 28 }) })),
      ss.separator(),
      sySection('Connection Status Indicator', ss.hstack({ gap: 'lg' },
        [['is-checking', 'checking'], ['is-connected', 'public'], ['is-connected is-private', 'private'], ['is-failed', 'failed']].map(([c, l]) =>
          ss.vstack({ gap: 'xxs', itemsCenter: true }, `<span class="sy-status ${c}"></span>`, ss.text({ size: 'xs', color: 'muted' }, l))))),
      ss.separator(),
      sySection('Collapsible',
        `<div class="sy-collapsible" id="sy-collapsible">${SY_SEED.map((w) => ss.text({ as: 'span', style: 'margin-right:8px' }, w)).join('')}</div>`,
        '<button type="button" class="sy-collapse-toggle" id="sy-collapse-toggle">More</button>'),
      ss.separator(),
      sySection('Separator', ss.vstack({ gap: 'md' }, ss.separator({ color: 'gradient' }), ss.separator({ color: 'grayDark' }))),
      ss.separator(),
      sySection('Loader', ss.hstack({ gap: 'lg' },
        ss.orbitLoader({ size: 40 }),
        ss.orbitLoader({ size: 60 }),
        ss.orbitLoader({ size: 80 }),
        `<span class="sy-orbit-green">${ss.orbitLoader({ size: 40 })}</span>`,
        `<span class="sy-orbit-red">${ss.orbitLoader({ size: 40 })}</span>`))),
  overlays: () =>
    ss.modal({ id: 'sy-design-modal', fullOpacity: true, showLabel: false },
      ss.vstack({ gap: 'lg', itemsCenter: true },
        ss.text({ size: 'xl', weight: 'medium', uppercase: true }, 'Modal title'),
        ss.text({ color: 'muted', center: true }, 'This is modal body content. Use SSModal for confirmations, warnings, and focused interactions.'),
        ss.button({ label: 'Confirm', variant: 'gradient', data: { 'ss-close': '' } }))),
  bind: (body) => {
    syBindSlider(body, 'sy-design-slider')
    body.addEventListener('click', (e) => {
      if (e.target.closest('#sy-open-modal')) ss.open('sy-design-modal')
      const tab = e.target.closest('[data-sy-tab]')
      if (tab) {
        syTab = tab.dataset.syTab
        body.querySelectorAll('[data-sy-tab]').forEach((b) => b.classList.toggle('is-on', b === tab))
        body.querySelector('#sy-tab-label').textContent = 'Active: ' + syTab
      }
      if (e.target.closest('#sy-collapse-toggle')) {
        const open = body.querySelector('#sy-collapsible').classList.toggle('is-open')
        e.target.closest('#sy-collapse-toggle').textContent = open ? 'Less' : 'More'
      }
    })
  }
})

// --- icons.tsx: every icon in generated/icons.js ------------------------------------------

registerScreen('settings-icons', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/icons.tsx',
  title: () => t('settings.developer.icons'),
  back: 'settings-design',
  render: () => {
    const names = Object.keys(ssIcons).sort()
    return ss.vstack({ gap: 'none', className: 'sy-padded' },
      ss.text({ size: 'xs', color: 'muted', uppercase: true, weight: 'medium', style: 'margin-bottom:12px' }, `Icons (${names.length})`),
      syIconGrid(names.map((n) => [n, 'SSIcon' + n.charAt(0).toUpperCase() + n.slice(1)])))
  }
})
