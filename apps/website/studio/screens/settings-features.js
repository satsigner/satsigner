/* Settings › Features and Fiat — app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/features/*, fiat.tsx
   Registered with registerScreen() from screens.js. State lives in sfState so screens keep their values. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  #kit-body:has(.sf-cards) { padding: 0; }
  .sf-indent { padding-left: 8px; }
  .sf-mono { margin: 0; font-family: ui-monospace, "SF Mono", Menlo, monospace; white-space: pre-wrap; }
  /* SSCollapsible — 65px clipped with a fade, More / Less toggle */
  .sf-collapsible { display: block; width: 100%; border: 0; padding: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .sf-collapsible-body { position: relative; height: 65px; overflow: hidden; }
  .sf-collapsible.is-open .sf-collapsible-body { height: auto; overflow: visible; }
  .sf-collapsible-body::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 22px; background: linear-gradient(180deg, transparent, var(--gray-950)); }
  .sf-collapsible.is-open .sf-collapsible-body::after { display: none; }
  .sf-wordlist { margin: 20px 0; }
  </style>`
)

// Fixture settings (store/settings.ts, store/price.ts, store/chartSettings.ts)
const sfState = {
  autoSelect: 'privacy',
  wordList: 'english',
  zeroPadding: false,
  currencyUnit: 'sats',
  fetchCurrentPrices: true,
  fetchHistoricalPrices: true,
  fetchHistoricalFromNetwork: false,
  provider: 'mempool',
  customUrl: '',
  fiat: 'USD',
  payjoinEnabled: true,
  payjoinMode: 'directory',
  payjoinDirectory: '',
  payjoinTtl: 5 * 60 * 1000,
  charts: {
    showLabel: true,
    showAmount: true,
    showTransactionInfo: true,
    showOutputField: true,
    lockZoomToXAxis: false,
    showFiatOnChart: false,
    showHistoricalFiatLine: true,
    showFiatAtTxTime: false,
    showFiatPercentageChange: false,
    showTransactionFlowChart: true,
    showUtxoFlowChart: true
  }
}

const sfOn = (body, id) => body.querySelector('#' + id).classList.contains('is-on')

// Re-render after the body handler; the kit's own toggle then hits the detached node.
function sfOnClick(body, handlers) {
  body.addEventListener('click', (e) => {
    for (const [sel, fn] of Object.entries(handlers)) {
      const el = e.target.closest(sel)
      if (el && !el.disabled) return fn(el, e)
    }
  })
}

// features/index.tsx
registerScreen('settings-features', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/features/index.tsx',
  title: () => t('settings.features.title'),
  back: 'settings',
  render: () =>
    `<div class="sf-cards">${ss.vstack({ gap: 'none' },
      ss.settingsCard({ title: t('settings.features.charts.title'), description: t('settings.features.charts.description'), icon: ss.icon('historyChart', { size: 24 }), go: 'settings-features-charts' }),
      ss.settingsCard({ title: t('settings.features.currencyFormatting.title'), description: t('settings.features.currencyFormatting.description'), icon: ss.icon('zero', { size: 24 }), go: 'settings-features-currency-formatting' }),
      ss.settingsCard({ title: t('settings.features.fiatData.title'), description: t('settings.features.fiatData.description'), icon: ss.icon('fiat', { width: 24, height: 16 }), go: 'settings-features-fiat-data' }),
      ss.settingsCard({ title: t('settings.features.autoSelectUtxos.title'), description: t('settings.features.autoSelectUtxos.description'), icon: ss.icon('bubbles', { size: 24 }), go: 'settings-features-auto-select' }),
      ss.settingsCard({ title: t('settings.features.bip39.title'), description: t('settings.features.bip39.description'), icon: ss.icon('seed', { size: 24 }), go: 'settings-features-bip39' }),
      ss.settingsCard({ title: t('settings.payjoin.title'), description: t('settings.payjoin.description'), icon: ss.icon('bubbles', { size: 24 }), go: 'settings-features-payjoin' }))}</div>`
})

// features/autoSelectUtxos.tsx — saves immediately
registerScreen('settings-features-auto-select', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/features/autoSelectUtxos.tsx',
  title: () => t('settings.features.autoSelectUtxos.title'),
  back: 'settings-features',
  render: () => {
    const key = (a, k) => t('transaction.build.options.autoSelect.utxos.' + a + '.' + k)
    return ss.vstack({ gap: 'lg' },
      ss.text({}, t('settings.features.autoSelectUtxos.longDescription')),
      ss.vstack({ gap: 'xs' },
        ['privacy', 'efficiency', 'user'].map((a) => ss.radio({ variant: 'outline', label: key(a, 'title'), group: 'sf-auto', selected: sfState.autoSelect === a, data: { auto: a } }))),
      ss.text({ color: 'muted', id: 'sf-auto-desc' }, key(sfState.autoSelect, 'description')))
  },
  bind: (body) =>
    sfOnClick(body, {
      '[data-auto]': (el) => {
        sfState.autoSelect = el.dataset.auto
        body.querySelector('#sf-auto-desc').textContent = t('transaction.build.options.autoSelect.utxos.' + sfState.autoSelect + '.description')
      }
    })
})

// features/bip39.tsx — pick locally, Save commits
const SF_WORDLISTS = ['chinese_simplified', 'chinese_traditional', 'czech', 'english', 'french', 'italian', 'japanese', 'korean', 'portuguese', 'spanish']
let sfWordDraft = null
registerScreen('settings-features-bip39', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/features/bip39.tsx',
  title: () => t('settings.features.bip39.title'),
  back: 'settings-features',
  render: () => {
    const current = sfWordDraft || sfState.wordList
    return ss.vstack({ justifyBetween: true, style: 'padding-bottom:10px' },
      ss.vstack({ gap: 'none' },
        ss.text({ size: 'md' }, t('settings.features.bip39.longDescription')),
        `<div class="sf-wordlist">${ss.vstack({ gap: 'sm' }, SF_WORDLISTS.map((w) => ss.checkbox({ label: w, selected: current === w, data: { word: w } })))}</div>`),
      ss.vstack({ gap: 'sm' },
        ss.button({ variant: 'secondary', label: t('common.save'), id: 'sf-save' }),
        ss.button({ variant: 'outline', label: t('common.cancel'), id: 'sf-cancel' })))
  },
  bind: (body) =>
    sfOnClick(body, {
      '[data-word]': (el) => {
        sfWordDraft = el.dataset.word
        openKitScreen('settings-features-bip39')
      },
      '#sf-save': () => {
        sfState.wordList = sfWordDraft || sfState.wordList
        sfWordDraft = null
        go('settings-features')
      },
      '#sf-cancel': () => {
        sfWordDraft = null
        go('settings-features')
      }
    })
})

// features/currencyFormatting.tsx — saves immediately
registerScreen('settings-features-currency-formatting', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/features/currencyFormatting.tsx',
  title: () => t('settings.features.currencyFormatting.title'),
  back: 'settings-features',
  render: () => {
    const tl = (k) => t('settings.features.currencyFormatting.' + k)
    return ss.vstack({},
      ss.vstack({}, ss.text({}, tl('displayOptions')), ss.checkbox({ label: tl('showZeroPadding'), selected: sfState.zeroPadding, id: 'sf-padding' })),
      ss.vstack({},
        ss.text({}, tl('currencyUnit')),
        ss.vstack({},
          ss.checkbox({ label: 'SATS', selected: sfState.currencyUnit === 'sats', data: { unit: 'sats' } }),
          ss.checkbox({ label: 'BTC', selected: sfState.currencyUnit === 'btc', data: { unit: 'btc' } }))))
  },
  bind: (body) =>
    sfOnClick(body, {
      '#sf-padding': () => {
        sfState.zeroPadding = !sfState.zeroPadding
      },
      '[data-unit]': (el) => {
        sfState.currencyUnit = el.dataset.unit
        openKitScreen('settings-features-currency-formatting')
      }
    })
})

// features/fiatData.tsx — saves immediately
const SF_CURRENT_PRICES = `GET /v1/prices

{
  "USD": 90000,
  "EUR": 85000,
  "GBP": 72000,
  "CAD": 125000,
  "CHF": 82000,
  "JPY": 13500000,
  "AUD": 140000
}`
const SF_HISTORICAL_PRICE = `GET /v1/historical-price?currency=USD&timestamp=1609459200

{
  "prices": [
    {
      "USD": 29000,
      "EUR": 24000
    }
  ],
  "exchangeRates": {
    "USDEUR": 0.83,
    "USDGBP": 0.73,
    "USDCAD": 1.27,
    "USDCHF": 0.88,
    "USDJPY": 103.5,
    "USDAUD": 1.29
  }
}`
let sfApiOpen = false

registerScreen('settings-features-fiat-data', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/features/fiatData.tsx',
  title: () => t('settings.features.fiatData.title'),
  back: 'settings-features',
  render: () => {
    const tl = (k) => t('settings.features.fiatData.' + k)
    const s = sfState
    return ss.vstack({ gap: 'lg' },
      ss.vstack({ gap: 'sm' },
        ss.text({}, tl('fetching.title')),
        ss.checkbox({ label: tl('fetchCurrentPrices'), selected: s.fetchCurrentPrices, data: { flag: 'fetchCurrentPrices' } }),
        ss.checkbox({ label: tl('fetchHistoricalPrices'), selected: s.fetchHistoricalPrices, data: { flag: 'fetchHistoricalPrices' } }),
        s.fetchHistoricalPrices
          ? ss.vstack({ gap: 'xs', className: 'sf-indent' },
              ss.checkbox({ label: tl('fetchHistoricalPricesFromNetwork'), selected: s.fetchHistoricalFromNetwork, data: { flag: 'fetchHistoricalFromNetwork' } }),
              ss.text({ color: 'muted', size: 'xs' }, tl('fetchHistoricalPricesFromNetworkWarning')))
          : '',
        ss.text({ color: 'muted' }, tl('disclaimer'))),
      ss.form({},
        ss.form.item({},
          ss.form.label({ label: tl('priceProvider') }),
          ss.vstack({ gap: 'sm' },
            ss.checkbox({ label: tl('provider.mempool'), selected: s.provider === 'mempool', data: { provider: 'mempool' } }),
            s.provider === 'mempool' ? ss.text({ color: 'muted', size: 'xs', className: 'sf-indent' }, 'https://mempool.space/api') : '',
            ss.checkbox({ label: tl('provider.custom'), selected: s.provider === 'custom', data: { provider: 'custom' } }),
            s.provider === 'custom'
              ? ss.vstack({ gap: 'sm', className: 'sf-indent', style: 'width:100%' },
                  ss.textInput({ placeholder: tl('provider.customPlaceholder'), value: s.customUrl, id: 'sf-custom-url' }),
                  ss.text({ color: 'muted', size: 'xs' }, tl('apiUrlHint')),
                  `<button type="button" class="sf-collapsible${sfApiOpen ? ' is-open' : ''}" id="sf-api">${ss.vstack({},
                    `<div class="sf-collapsible-body">${ss.vstack({ gap: 'md', style: 'padding-top:8px;width:100%' },
                      ss.vstack({ gap: 'xs' }, ss.text({ size: 'sm' }, tl('apiFormat.currentPrices')), `<pre class="ss-text is-muted s-xs sf-mono">${ss.esc(SF_CURRENT_PRICES)}</pre>`),
                      ss.vstack({ gap: 'xs' }, ss.text({ size: 'sm' }, tl('apiFormat.historicalPrices')), `<pre class="ss-text is-muted s-xs sf-mono">${ss.esc(SF_HISTORICAL_PRICE)}</pre>`))}</div>`,
                    ss.text({ uppercase: true, style: 'color:var(--gray-100)' }, sfApiOpen ? t('common.less') : t('common.more')))}</button>`)
              : ''))),
      ss.vstack({ gap: 'sm' },
        ss.text({}, tl('dataAvailable.title')),
        ['currentSpotPrices', 'crossCurrencyRates', 'historicalPriceAtTimestamp'].map((k) => ss.text({ color: 'muted' }, '• ' + tl('dataAvailable.' + k)))))
  },
  bind: (body) => {
    const url = body.querySelector('#sf-custom-url input')
    if (url) url.addEventListener('input', () => (sfState.customUrl = url.value))
    sfOnClick(body, {
      '[data-flag]': (el) => {
        const f = el.dataset.flag
        sfState[f] = !sfState[f]
        if (f === 'fetchHistoricalPrices' && !sfState[f]) sfState.fetchHistoricalFromNetwork = false
        openKitScreen('settings-features-fiat-data')
      },
      '[data-provider]': (el) => {
        sfState.provider = el.dataset.provider
        openKitScreen('settings-features-fiat-data')
      },
      '#sf-api': (el) => {
        sfApiOpen = !sfApiOpen
        el.classList.toggle('is-open', sfApiOpen)
        el.querySelector('.ss-text.is-uppercase:last-child').textContent = sfApiOpen ? t('common.less') : t('common.more')
      }
    })
  }
})

// features/charts.tsx — local edits, Save commits, Cancel discards
let sfChartDraft = null
// Set in openKitScreen: 'chart' when the chart gear opened this page, otherwise Features.
let sfChartReturn = 'settings-features'
registerScreen('settings-features-charts', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/features/charts.tsx',
  title: () => t('settings.features.charts.pageTitle'),
  back: () => sfChartReturn,
  render: () => {
    if (!sfChartDraft) sfChartDraft = { ...sfState.charts }
    const c = sfChartDraft
    const k = (p) => t('settings.features.charts.' + p)
    const showCurrent = sfState.fetchCurrentPrices
    const showHistorical = sfState.fetchHistoricalPrices
    const box = (key, label, disabled) => ss.checkbox({ label: k(label), selected: c[key], disabled: !!disabled, data: { chart: key } })
    return ss.vstack({ justifyBetween: true },
      ss.vstack({ gap: 'lg' },
        ss.separator(),
        ss.vstack({ gap: 'md' },
          ss.text({ weight: 'bold', uppercase: true }, k('historyChart.title')),
          ss.vstack({},
            ss.text({}, k('historyChart.layers.title')),
            box('showLabel', 'historyChart.layers.showLabels'),
            box('showAmount', 'historyChart.layers.showAmounts'),
            box('showTransactionInfo', 'historyChart.layers.showTransactionInfo'),
            box('showOutputField', 'historyChart.layers.showOutputFields'),
            box('showFiatOnChart', 'historyChart.layers.showFiatOnChart', !showCurrent),
            box('showFiatAtTxTime', 'historyChart.layers.showFiatAtTxTime', !showCurrent || !showHistorical || !c.showFiatOnChart),
            box('showFiatPercentageChange', 'historyChart.layers.showFiatPercentageChange', !showCurrent || !showHistorical)),
          ss.vstack({}, ss.text({}, k('historyChart.navigation.title')), box('lockZoomToXAxis', 'historyChart.navigation.lockZoomXAxis'))),
        ss.separator(),
        ss.vstack({ gap: 'md' }, ss.text({ weight: 'bold', uppercase: true }, k('transactionFlowChart.title')), box('showTransactionFlowChart', 'transactionFlowChart.show')),
        ss.separator(),
        ss.vstack({ gap: 'md' }, ss.text({ weight: 'bold', uppercase: true }, k('utxoBubbles.title')), box('showUtxoFlowChart', 'utxoBubbles.show'))),
      ss.vstack({},
        ss.button({ label: t('common.save'), variant: 'secondary', id: 'sf-save' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', id: 'sf-cancel' })))
  },
  bind: (body) => {
    document.getElementById('kit-back').onclick = () => {
      sfChartDraft = null
      go(sfChartReturn)
    }
    sfOnClick(body, {
      '[data-chart]': (el) => {
        const key = el.dataset.chart
        sfChartDraft[key] = !sfChartDraft[key]
        if (key === 'showFiatOnChart' && !sfChartDraft[key]) sfChartDraft.showFiatAtTxTime = false
        openKitScreen('settings-features-charts')
      },
      '#sf-save': () => {
        sfState.charts = { ...sfChartDraft }
        sfChartDraft = null
        go(sfChartReturn)
      },
      '#sf-cancel': () => {
        sfChartDraft = null
        go(sfChartReturn)
      }
    })
  }
})

// features/payjoin.tsx — saves immediately
registerScreen('settings-features-payjoin', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/features/payjoin.tsx',
  title: () => t('settings.payjoin.title'),
  back: 'settings-features',
  render: () => {
    const p = (k) => t('settings.payjoin.' + k)
    const s = sfState
    const directory = s.payjoinMode === 'directory'
    const ttls = [
      [60000, 'oneMinute'],
      [300000, 'fiveMinutes'],
      [600000, 'tenMinutes']
    ]
    return ss.vstack({ gap: 'lg' },
      ss.text({ color: 'muted' }, p('description')),
      ss.checkbox({ label: p('enabled'), selected: s.payjoinEnabled, id: 'sf-pj' }),
      s.payjoinEnabled
        ? ss.vstack({ gap: 'lg' },
            ss.vstack({ gap: 'sm' },
              ss.text({ uppercase: true }, p('mode.title')),
              ss.text({ color: 'muted', size: 'sm' }, p('mode.description')),
              ss.vstack({ gap: 'sm' },
                ['directory', 'manual'].map((m) =>
                  ss.vstack({ gap: 'xs' },
                    ss.radio({ variant: 'outline', label: p('mode.' + m), selected: s.payjoinMode === m, data: { mode: m } }),
                    ss.text({ color: 'muted', size: 'sm' }, p('mode.' + m + 'Description')))))),
            directory
              ? ss.vstack({ gap: 'sm' },
                  ss.text({ uppercase: true }, p('directoryUrl.title')),
                  ss.text({ color: 'muted', size: 'sm' }, p('directoryUrl.description')),
                  ss.textInput({ align: 'left', placeholder: 'https://payjo.in', value: s.payjoinDirectory, id: 'sf-pj-dir' }))
              : '',
            directory
              ? ss.vstack({ gap: 'sm' },
                  ss.text({ uppercase: true }, p('sessionTtl.title')),
                  ss.text({ color: 'muted', size: 'sm' }, p('sessionTtl.description')),
                  ss.vstack({ gap: 'xs' }, ttls.map(([ms, key]) => ss.radio({ variant: 'outline', label: p('sessionTtl.' + key), group: 'sf-ttl', selected: s.payjoinTtl === ms, data: { ttl: ms } }))))
              : '')
        : '')
  },
  bind: (body) => {
    const dir = body.querySelector('#sf-pj-dir input')
    if (dir) dir.addEventListener('input', () => (sfState.payjoinDirectory = dir.value))
    sfOnClick(body, {
      '#sf-pj': () => {
        sfState.payjoinEnabled = !sfState.payjoinEnabled
        openKitScreen('settings-features-payjoin')
      },
      '[data-mode]': (el) => {
        sfState.payjoinMode = el.dataset.mode
        openKitScreen('settings-features-payjoin')
      },
      '[data-ttl]': (el) => {
        sfState.payjoinTtl = Number(el.dataset.ttl)
      }
    })
  }
})

// fiat.tsx — saves immediately; disabled state points to Fiat Data
const SF_CURRENCIES = [
  ['USD', 'USD – US Dollar'],
  ['EUR', 'EUR – Euro'],
  ['GBP', 'GBP – British Pound'],
  ['CAD', 'CAD – Canadian Dollar'],
  ['CHF', 'CHF – Swiss Franc'],
  ['AUD', 'AUD – Australian Dollar'],
  ['JPY', 'JPY – Japanese Yen']
]
registerScreen('settings-fiat', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/fiat.tsx',
  title: () => t('settings.fiat.title'),
  back: 'settings',
  render: () =>
    sfState.fetchCurrentPrices
      ? ss.vstack({},
          ss.text({}, t('settings.fiat.select')),
          ss.vstack({}, SF_CURRENCIES.map(([value, label]) => ss.checkbox({ label, selected: sfState.fiat === value, data: { fiat: value } }))))
      : ss.vstack({ gap: 'md' },
          ss.text({ color: 'muted' }, t('settings.fiat.disabled')),
          ss.button({ label: t('settings.fiat.openFiatDataSettings'), variant: 'outline', go: 'settings-features-fiat-data' })),
  bind: (body) =>
    sfOnClick(body, {
      '[data-fiat]': (el) => {
        sfState.fiat = el.dataset.fiat
        if (typeof appSettings !== 'undefined') appSettings.fiat = el.dataset.fiat
        openKitScreen('settings-fiat')
        if (typeof renderAccounts === 'function') renderAccounts()
        const accountView = document.getElementById('view-account')
        if (accountView && typeof renderAccount === 'function') renderAccount()
        const txView = document.getElementById('view-tx')
        if (txView && !txView.hidden && typeof renderTransaction === 'function') renderTransaction()
      }
    })
})
