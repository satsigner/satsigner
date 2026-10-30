/* Studio dashboard: the landing view. Explains what Studio is and tracks progress against the app.
   Reads only static globals: ssMeta, ssRoutes, ssCoverage (generated/), ssIcons, ss, screens (catalog.js).
   Rebuild the numbers with: node studio/tools/extract-all.mjs && node studio/tools/coverage.mjs */

const APP_REPO = 'https://github.com/satsigner/satsigner/blob/master/apps/mobile/'

// App component → kit function. Used for the "kit components" stat and list.
const KIT_PORTS = {
  SSText: 'text', SSButton: 'button', SSIconButton: 'iconButton', SSTextInput: 'textInput', SSCheckbox: 'checkbox',
  SSRadioButton: 'radio', SSSeparator: 'separator', SSModal: 'modal', SSClipboardCopy: 'clipboardCopy',
  SSStyledSatText: 'styledSat', SSAmountDisplay: 'amountDisplay', SSAddressDisplay: 'addressDisplay',
  SSDetailsList: 'detailsList', SSActionButton: 'actionButton', SSQRCode: 'qr', SSShareableQR: 'shareableQR',
  SSAmountInput: 'amountInput', SSNumberGhostInput: 'amountInput', SSLoader: 'orbitLoader',
  SSSuccessCheckAnimation: 'successCheck', SSTransactionIdFormatted: 'txid', SSBottomSheet: 'bottomSheet',
  SSFeeInput: 'feeInput', SSSettingsCard: 'settingsCard',
  SSVStack: 'vstack', SSHStack: 'hstack', SSMainLayout: 'mainLayout', SSFormLayout: 'form'
}

const AREA_NAMES = {
  home: 'Home', converter: 'Converter', explorer: 'Explorer', settings: 'Settings',
  'signer/bitcoin': 'Bitcoin accounts', 'signer/nostr': 'Nostr', 'signer/ecash': 'eCash',
  'signer/lightning': 'Lightning', 'signer/ark': 'Ark',
  setPin: 'PIN setup', setDuressPin: 'Duress PIN', unlock: 'Unlock', warning: 'Warning', upcoming: 'Upcoming', _session: 'Session'
}

function dashArea(path) {
  const parts = path.split('/')
  return parts[1] === 'signer' ? 'signer/' + (parts[2] || '') : parts[1] || 'home'
}

function renderDashboard() {
  const root = document.getElementById('dashboard-view')
  if (!root || typeof ssCoverage === 'undefined') return
  const routes = ssRoutes.filter((r) => !r.layout)
  const coveredPaths = new Set(Object.values(ssCoverage.screens).flat())
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
  const kitPorted = Object.entries(KIT_PORTS).filter(([, fn]) => typeof ss[fn] === 'function')
  const appComponents = ssMeta.appComponents.filter((c) => !c.startsWith('SSIcon'))
  const portedSet = new Set(kitPorted.map(([c]) => c))
  const kitCovered = appComponents.filter((c) => portedSet.has(c)).length
  const extracted = new Date(ssMeta.extractedAt)

  const areas = {}
  routes.forEach((r) => {
    const a = dashArea(r.path)
    ;(areas[a] = areas[a] || { total: 0, covered: 0, missing: [] }).total++
    if (coveredPaths.has(r.path)) areas[a].covered++
    else areas[a].missing.push(r)
  })
  const areaList = Object.entries(areas).sort((a, b) => b[1].total - a[1].total)
  const missingCount = routes.length - ssCoverage.covered

  const stat = (value, label, sub) =>
    `<div class="dash-stat"><strong>${value}</strong><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`
  const bar = (a, b) => `<span class="dash-bar"><i style="width:${pct(a, b)}%"></i></span>`

  root.innerHTML = `
    <section class="dash-hero">
      <p class="dash-eyebrow">SatSigner Studio</p>
      <h1>The SatSigner app, in the browser.</h1>
      <p class="dash-lede">Studio is the working copy of the app for design, prototyping, and review. Screens, flows, and the component kit are rebuilt from the React Native source so they can be walked through, compared, and shown without a device.
        The clickable prototype uses fixtures only: no keys, no network, no real money. Colours, icons, copy, and spacing are extracted from the app; behaviour is ported by hand.</p>
      <div class="dash-actions">
        <button type="button" class="dash-cta" data-dash-view="prototype">Open the prototype</button>
        <button type="button" data-dash-view="screens">Browse screens</button>
        <button type="button" data-dash-view="map">Flow map</button>
        <button type="button" data-dash-view="components">Components</button>
      </div>
    </section>

    <section class="dash-stats" aria-label="Progress">
      ${stat(`${pct(ssCoverage.covered, routes.length)}%`, 'App routes covered', `${ssCoverage.covered} of ${routes.length} routes`)}
      ${stat(screens.length, 'Studio screens', 'in the catalog')}
      ${stat(missingCount, 'Screens missing', 'tracked below')}
      ${stat(`${kitCovered}/${appComponents.length}`, 'Kit components', 'ported from SS* components')}
      ${stat(ssMeta.icons, 'Icons', 'from components/icons')}
      ${stat(ssMeta.strings.toLocaleString('en-US'), 'Strings', 'from locales/en.json')}
      ${stat(ssMeta.styleRules.toLocaleString('en-US'), 'Style rules', 'from StyleSheet.create')}
      ${stat(extracted.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 'Last extraction', extracted.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))}
    </section>

    <section class="dash-areas">
      <h2>Coverage by area</h2>
      <div class="dash-area-grid">
        ${areaList
          .map(([a, v]) => `<button type="button" class="dash-area${v.covered === v.total ? ' is-done' : ''}" data-dash-area="${a}">
            <span class="dash-area-name">${AREA_NAMES[a] || a}</span>
            <span class="dash-area-count">${v.covered}/${v.total}</span>
            ${bar(v.covered, v.total)}</button>`)
          .join('')}
      </div>
    </section>

    <section class="dash-tracker">
      <div class="dash-tracker-head">
        <h2>Missing screens <span>${missingCount}</span></h2>
        <div class="dash-filters">
          <input type="search" id="dash-search" placeholder="Filter routes" aria-label="Filter routes">
          <select id="dash-area-filter" aria-label="Area">
            <option value="">All areas</option>
            ${areaList.filter(([, v]) => v.missing.length).map(([a, v]) => `<option value="${a}">${AREA_NAMES[a] || a} (${v.missing.length})</option>`).join('')}
          </select>
        </div>
      </div>
      <table class="dash-table">
        <thead><tr><th>Route</th><th>Area</th><th>Uses</th><th>Source</th></tr></thead>
        <tbody>
          ${areaList
            .flatMap(([a, v]) => v.missing.map((r) => ({ a, r })))
            .map(({ a, r }) => `<tr data-area="${a}" data-text="${(r.path + ' ' + r.file).toLowerCase()}">
              <td><code>${r.path}</code></td>
              <td>${AREA_NAMES[a] || a}</td>
              <td class="dash-uses">${r.components.filter((c) => !c.startsWith('SSIcon')).slice(0, 6).map((c) => `<span class="${portedSet.has(c) ? 'is-kit' : ''}">${c.replace(/^SS/, '')}</span>`).join('')}</td>
              <td><a href="${APP_REPO}${encodeURI(r.file)}" target="_blank" rel="noopener">${r.file.split('/').slice(-2).join('/')}</a></td>
            </tr>`)
            .join('')}
        </tbody>
      </table>
      <p class="dash-note">Highlighted components already exist in the kit. A route counts as covered once a Studio screen lists it in <code>coverage.json</code>.</p>
    </section>

    ${
      ssCoverage.problems.length
        ? `<section class="dash-problems"><h2>Drift</h2><ul>${ssCoverage.problems.map((p) => `<li>${p}</li>`).join('')}</ul></section>`
        : ''
    }

    <section class="dash-kit">
      <h2>Kit components <span>${kitPorted.length}</span></h2>
      <p>${kitPorted.map(([c, fn]) => `<code title="ss.${fn}">${c}</code>`).join(' ')}</p>
    </section>`

  const search = root.querySelector('#dash-search')
  const areaFilter = root.querySelector('#dash-area-filter')
  const filter = () => {
    const q = search.value.trim().toLowerCase()
    root.querySelectorAll('.dash-table tbody tr').forEach((tr) => {
      tr.hidden = (areaFilter.value && tr.dataset.area !== areaFilter.value) || (q && !tr.dataset.text.includes(q))
    })
  }
  search.addEventListener('input', filter)
  areaFilter.addEventListener('change', filter)
  root.addEventListener('click', (e) => {
    const view = e.target.closest('[data-dash-view]')
    if (view) setView(view.dataset.dashView, true)
    const area = e.target.closest('[data-dash-area]')
    if (area) {
      areaFilter.value = areas[area.dataset.dashArea].missing.length ? area.dataset.dashArea : ''
      filter()
      root.querySelector('.dash-tracker').scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}

renderDashboard()
