/* Settings › Bitcoin network and Ark — app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/network/*, ark.tsx
   Ids: settings-network, settings-network-server, settings-network-detail (custom backend form),
   settings-network-explorer, settings-network-params, settings-network-comparison, settings-ark. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  .sn-pad { padding-top: 0; padding-bottom: 24px; }
  .sn-flush { margin: 0 calc(-1 * var(--pad-main-x)); }
  .sn-link { display: flex; justify-content: center; width: 100%; border: 0; padding: 0; background: none; font: inherit; cursor: pointer; }
  .sn-link .ss-icon { color: var(--gray-300); }
  .sn-server { display: flex; align-items: center; justify-content: space-between; min-height: 48px; overflow: hidden; }
  .sn-server-main { display: flex; align-items: flex-start; gap: var(--layout-h-stack-gap-sm); flex: 1; min-width: 0; }
  .sn-server-main .ss-checkbox { width: auto; }
  .sn-server-copy { flex: 1; min-width: 0; border: 0; padding: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .sn-server-copy:active { opacity: 0.7; }
  .sn-ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sn-cap { text-transform: capitalize; }
  .sn-remove { display: inline-flex; margin-left: 8px; padding: 6px; border: 1px solid var(--gray-600); border-radius: 400px; background: none; color: var(--gray-200); cursor: pointer; }
  .sn-option { display: flex; align-items: center; gap: var(--layout-h-stack-gap-md); }
  .sn-option .ss-checkbox { width: auto; }
  .sn-option-copy { border: 0; padding: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .sn-dot { display: inline-block; width: 8px; height: 8px; margin: 0 8px 1px; border-radius: 50%; background: var(--gray-450); }
  .sn-dot.is-connected { background: var(--main-green); }
  .sn-dot.is-private { background: var(--warning); }
  .sn-dot.is-checking { background: var(--gray-300); }
  .sn-dot.is-failed { background: var(--soft-red); }
  .sn-auto-height textarea { height: auto; min-height: 70px; }
  </style>`
)

// --- fixtures (constants/servers.ts, config/servers.ts, constants/ark.ts) ---------------

const SN_NETWORKS = ['bitcoin', 'testnet', 'signet']

const snServers = [
  { backend: 'esplora', name: 'Mempool', network: 'bitcoin', url: 'https://mempool.space/api' },
  { backend: 'electrum', name: 'Blockstream', network: 'bitcoin', url: 'ssl://electrum.blockstream.info:50002' },
  { backend: 'electrum', name: 'Luke BitcoinJS', network: 'bitcoin', url: 'ssl://bitcoin.lu.ke:50002' },
  { backend: 'electrum', name: 'DIY Nodes', network: 'bitcoin', url: 'ssl://electrum.diynodes.com:50022' },
  { backend: 'electrum', name: 'Seth For Privacy', network: 'bitcoin', url: 'ssl://fulcrum.sethforprivacy.com:50002' },
  { backend: 'electrum', name: 'Mempool', network: 'signet', url: 'ssl://mempool.space:60602' },
  { backend: 'esplora', name: 'Mempool', network: 'signet', url: 'https://mempool.space/signet/api' },
  { backend: 'esplora', name: 'Blockstream', network: 'signet', url: 'https://blockstream.info/signet/api' },
  { backend: 'electrum', name: 'Blockstream', network: 'signet', url: 'ssl://electrum.blockstream.info:60002' },
  { backend: 'esplora', name: 'Mempool Testnet4', network: 'testnet', url: 'https://mempool.space/testnet4/api' },
  { backend: 'esplora', name: 'Blockstream Testnet4', network: 'testnet', url: 'https://blockstream.info/testnet/api' },
  { backend: 'esplora', name: 'Mutinynet', network: 'signet', url: 'https://mutinynet.com/api' }
]
const snCustomServers = [
  { backend: 'electrum', name: 'Umbrel', network: 'bitcoin', url: 'tcp://umbrel.local:50001', custom: true }
]

const snDefaultConfig = () => ({ connectionMode: 'auto', connectionTestInterval: 60, retries: 5, stopGap: 20, timeDiffBeforeAutoSync: 30, timeout: 15 })

const snState = {
  selected: {
    bitcoin: snServers[0],
    testnet: snServers[9],
    signet: snServers[5]
  },
  configs: { bitcoin: snDefaultConfig(), testnet: snDefaultConfig(), signet: snDefaultConfig() },
  mempool: {
    bitcoin: 'https://mempool.space/api',
    signet: 'https://mempool.space/signet/api',
    testnet: 'https://mempool.space/testnet4/api'
  },
  detailNetwork: 'signet', // which network the custom backend form is for
  editing: null, // custom server being edited
  form: null,
  lastProbe: ''
}

const SN_ARK_SERVERS = {
  bitcoin: { arkUrl: 'https://ark.second.tech', esploraUrl: 'https://mempool.second.tech/api', name: 'Second' },
  signet: { arkUrl: 'https://ark.signet.2nd.dev', esploraUrl: 'https://esplora.signet.2nd.dev', name: 'Second' }
}

const snActiveNetwork = () => (typeof appSettings !== 'undefined' && appSettings.network) || 'signet'
const snTrimOnion = (url) => url.replace(/([a-z2-7]{6})[a-z2-7]{44,}([a-z2-7]{4}\.onion)/, '$1…$2')

// SSBitcoinNetworkExplanationLink
function snExplanationLink() {
  return `<button type="button" class="sn-link" data-go="settings-network-comparison">${ss.hstack(
    { gap: 'xs', style: 'justify-content:center' },
    ss.text({ color: 'muted', as: 'span' }, t('settings.network.networkComparisonLink')),
    ss.icon('info', { size: 16 })
  )}</button>`
}

// Footer: Save (secondary) + Cancel (ghost), like every settings form.
function snFooter(saveId, cancelTo, extra) {
  return ss.vstack({ gap: 'md' },
    extra || '',
    ss.button({ variant: 'secondary', label: t('common.save'), id: saveId }),
    ss.button({ variant: 'ghost', label: t('common.cancel'), go: cancelTo }))
}

// --- network/index.tsx ------------------------------------------------------------------

registerScreen('settings-network', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/network/index.tsx',
  title: () => t('settings.network.title'),
  back: 'settings',
  render: () =>
    `<div class="settings-root">${ss.vstack({ gap: 'none' },
      ss.settingsCard({ title: t('settings.network.server.title'), description: t('settings.network.server.descriptionLabel'), icon: ss.icon('server', { size: 24 }), go: 'settings-network-server' }),
      ss.settingsCard({ title: t('settings.network.explorer.title'), description: t('settings.network.explorer.description'), icon: ss.icon('mempool', { size: 24 }), go: 'settings-network-explorer' }),
      ss.settingsCard({ title: t('settings.network.config.title'), description: t('settings.network.config.description'), icon: ss.icon('serverOptions', { size: 24 }), go: 'settings-network-params' }))}</div>`
})

// --- network/server.tsx -----------------------------------------------------------------

function snServerRow(network, server, index) {
  const sel = snState.selected[network]
  const isSelected = sel.url === server.url && sel.name === server.name && sel.backend === server.backend
  const connected = isSelected && network === snActiveNetwork()
  return `<div class="sn-server">
    <div class="sn-server-main">
      ${ss.checkbox({ selected: isSelected, data: { pick: network + ':' + index } })}
      <button type="button" class="sn-server-copy" data-${server.custom ? 'edit' : 'pick'}="${network}:${index}">${ss.vstack({ gap: 'none' },
        ss.hstack({ gap: 'xs' },
          ss.text({ size: 'md', className: 'sn-cap', style: 'line-height:16px', as: 'span' }, ss.esc(server.name)),
          ss.text({ size: 'md', color: 'muted', className: server.backend === 'rpc' ? '' : 'sn-cap', style: 'line-height:16px', as: 'span' }, server.backend === 'rpc' ? 'RPC' : server.backend)),
        ss.hstack({ gap: 'xs', style: 'min-width:0' },
          connected ? ss.text({ as: 'span', style: 'color:var(--main-green);opacity:0.6;line-height:14px' }, t('common.connected')) : '',
          ss.text({ as: 'span', color: 'muted', className: 'sn-ellipsis', style: 'line-height:14px' }, ss.esc(snTrimOnion(server.url)))))}</button>
    </div>
    ${server.custom ? `<button type="button" class="sn-remove" data-remove="${index}" aria-label="Remove">${ss.icon('closeThin', { size: 10 })}</button>` : ''}
  </div>`
}

function snServersFor(network) {
  return snServers.concat(snCustomServers).filter((s) => s.network === network)
}

registerScreen('settings-network-server', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/network/server.tsx',
  title: () => t('settings.network.server.title'),
  back: 'settings-network',
  render: () =>
    ss.vstack({ gap: 'md', justifyBetween: true, className: 'sn-pad' },
      ss.vstack({ gap: 'md' },
        snExplanationLink(),
        ss.vstack({ gap: 'xl', style: 'margin-top:20px' },
          SN_NETWORKS.map((network) =>
            ss.vstack({ gap: 'md' },
              ss.vstack({ gap: 'none' },
                ss.text({ uppercase: true, weight: 'light', size: 'xl', style: 'letter-spacing:2.5px' }, t('bitcoin.network.' + network)),
                ss.text({ color: 'muted' }, t('settings.network.server.type.' + network))),
              ss.vstack({ gap: 'md' },
                ss.vstack({ gap: 'sm' }, snServersFor(network).map((server, i) => snServerRow(network, server, i))),
                ss.hstack({ gap: 'sm', style: 'margin:12px 0 8px' },
                  ss.button({ variant: 'subtle', label: t('settings.network.server.custom.add').toUpperCase(), style: 'flex:1', data: { add: network } }),
                  ss.button({ variant: 'subtle', label: t('settings.network.server.test').toUpperCase(), style: 'flex:1', data: { test: network } }))))))),
      ss.vstack({ gap: 'md', style: 'flex-shrink:0;padding-top:16px' },
        snState.lastProbe ? ss.text({ center: true, color: 'muted', size: 'xs', style: 'padding:0 8px' }, ss.esc(snState.lastProbe)) : '',
        ss.button({ variant: 'secondary', label: t('common.save'), go: 'settings-network' }),
        ss.button({ variant: 'ghost', label: t('common.cancel'), go: 'settings-network' }))),
  bind: (body) => {
    const parse = (v) => {
      const [network, i] = v.split(':')
      return [network, snServersFor(network)[+i]]
    }
    body.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-pick]')
      if (pick) {
        const [network, server] = parse(pick.dataset.pick)
        snState.selected[network] = server
        return openKitScreen('settings-network-server')
      }
      const edit = e.target.closest('[data-edit]')
      if (edit) {
        const [network, server] = parse(edit.dataset.edit)
        snState.detailNetwork = network
        snState.editing = server
        snState.form = null
        return go('settings-network-detail')
      }
      const remove = e.target.closest('[data-remove]')
      if (remove) {
        const row = remove.closest('.sn-server').querySelector('[data-edit]')
        const [network, server] = parse(row.dataset.edit)
        snCustomServers.splice(snCustomServers.indexOf(server), 1)
        if (snState.selected[network] === server) snState.selected[network] = snServersFor(network)[0]
        return openKitScreen('settings-network-server')
      }
      const add = e.target.closest('[data-add]')
      if (add) {
        snState.detailNetwork = add.dataset.add
        snState.editing = null
        snState.form = null
        return go('settings-network-detail')
      }
      const test = e.target.closest('[data-test]')
      if (test && !test.disabled) {
        const server = snState.selected[test.dataset.test]
        test.disabled = true
        test.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          snState.lastProbe = `${t('settings.network.server.tester.success')} — ${server.name} (${snTrimOnion(server.url)}) · 182 ms`
          openKitScreen('settings-network-server')
          ss.toast(t('settings.network.server.tester.success'), document.getElementById('view-kit'))
        }, 900)
      }
    })
  }
})

// --- network/[network].tsx — add / edit custom backend ----------------------------------

const SN_BACKENDS = ['electrum', 'esplora', 'rpc']
const SN_RPC_PORT = { bitcoin: 8332, testnet: 48332, signet: 38332 }
const SN_ELECTRUM_PORTS = { bitcoin: { ssl: 50002, tcp: 50001 }, testnet: { ssl: 60002, tcp: 60001 }, signet: { ssl: 60602, tcp: 60601 } }

function snForm() {
  if (snState.form) return snState.form
  const s = snState.editing
  const m = s && s.url.match(/^(ssl|tcp|https?):\/\/([^:/]+)(?::(\d+))?/)
  snState.form = {
    backend: s ? s.backend : 'electrum',
    name: s ? s.name : '',
    protocol: m && (m[1] === 'tcp' || m[1] === 'ssl') ? m[1] : 'ssl',
    host: m ? m[2] : '',
    port: m && m[3] ? m[3] : '',
    rpcUsername: '',
    rpcPassword: '',
    rpcWalletName: '',
    rpcScanFromHeight: '',
    proxy: { enabled: false, host: '', port: '' },
    status: 'idle'
  }
  return snState.form
}

function snUrlPreview(f) {
  if (!f.host) return ''
  if (f.backend === 'electrum') return `${f.protocol}://${f.host}${f.port ? ':' + f.port : ''}`
  if (f.backend === 'esplora') return `https://${f.host}${f.port ? ':' + f.port : ''}`
  return `http://${f.host}:${f.port || SN_RPC_PORT[snState.detailNetwork]}`
}

function snOption(selected, data, title, description, upper) {
  return `<div class="sn-option">${ss.checkbox({ selected, data })}<button type="button" class="sn-option-copy" data-${Object.keys(data)[0]}="${Object.values(data)[0]}">${ss.vstack(
    { gap: 'none' },
    ss.text({ size: 'md', className: upper ? '' : 'sn-cap', uppercase: upper, style: 'line-height:18px', as: 'span' }, title),
    description ? ss.text({ color: 'muted', style: 'line-height:14px', as: 'span' }, description) : ''
  )}</button></div>`
}

function snField(label, input, optional) {
  return ss.vstack({ gap: 'sm' },
    ss.text({ uppercase: true }, label + (optional ? ` <span style="font-weight:normal;text-transform:none">(${t('common.optional')})</span>` : '')),
    input)
}

registerScreen('settings-network-detail', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/network/[network].tsx',
  title: () => t('settings.network.custom.title'),
  back: 'settings-network-server',
  render: () => {
    const f = snForm()
    const net = snState.detailNetwork
    const preview = snUrlPreview(f)
    const server = { name: f.name || 'Custom', url: preview || '—' }
    const statusClass = f.status === 'connected' ? 'is-private' : f.status === 'checking' ? 'is-checking' : f.status === 'failed' ? 'is-failed' : ''
    const connectionString = `${net} - ${server.name} (${server.url})`
    const portPlaceholder =
      f.backend === 'rpc'
        ? String(SN_RPC_PORT[net])
        : f.backend === 'electrum'
          ? t('settings.network.server.port.placeholder.electrum', SN_ELECTRUM_PORTS[net])
          : t('settings.network.server.port.placeholder.esplora')
    return ss.vstack({ gap: 'lg', justifyBetween: true },
      ss.vstack({ gap: 'xl', style: 'margin-bottom:24px' },
        ss.vstack({ gap: 'md' },
          ss.text({ uppercase: true }, t('settings.network.server.backend')),
          SN_BACKENDS.map((be) => snOption(be === f.backend, { backend: be }, be === 'rpc' ? 'RPC' : be, t('settings.network.server.description.' + be)))),
        ss.vstack({ gap: 'md' },
          snField(t('common.name'), ss.textInput({ name: 'name', value: f.name })),
          f.backend === 'electrum'
            ? ss.vstack({ gap: 'sm' },
                ss.text({ uppercase: true }, t('settings.network.server.protocolLabel')),
                ss.hstack({ gap: 'lg' }, ['ssl', 'tcp'].map((p) => snOption(p === f.protocol, { protocol: p }, t('settings.network.server.protocol.' + p), '', true))))
            : '',
          ss.vstack({ gap: 'sm' },
            ss.text({ uppercase: true }, t('settings.network.server.hostLabel')),
            ss.textInput({ name: 'host', multiline: true, className: 'sn-auto-height', value: f.host, placeholder: t('settings.network.server.host.placeholder.' + f.backend) }),
            ss.hstack({ gap: 'md', style: 'width:100%' },
              ss.button({ variant: 'outline', label: t('common.paste'), style: 'flex:1', id: 'sn-paste' }),
              ss.button({ variant: 'outline', label: t('common.scanQR'), style: 'flex:1', id: 'sn-paste-qr' }))),
          snField(t('settings.network.server.portLabel'), ss.textInput({ name: 'port', value: f.port, placeholder: portPlaceholder, inputMode: 'numeric' }), f.backend !== 'electrum'),
          f.backend === 'rpc'
            ? [
                snField(t('settings.network.server.rpcUsernameLabel'), ss.textInput({ name: 'rpcUsername', value: f.rpcUsername, placeholder: t('settings.network.server.rpcUsername.placeholder') })),
                snField(t('settings.network.server.rpcPasswordLabel'), ss.textInput({ name: 'rpcPassword', value: f.rpcPassword, placeholder: t('settings.network.server.rpcPassword.placeholder') })),
                snField(t('settings.network.server.rpcWalletNameLabel'), ss.textInput({ name: 'rpcWalletName', value: f.rpcWalletName, placeholder: t('settings.network.server.rpcWalletName.placeholder') }), true),
                ss.vstack({ gap: 'sm' },
                  ss.text({ uppercase: true }, t('settings.network.server.rpcScanFromHeightLabel') + ` <span style="font-weight:normal;text-transform:none">(${t('common.optional')})</span>`),
                  ss.textInput({ name: 'rpcScanFromHeight', value: f.rpcScanFromHeight, placeholder: t('settings.network.server.rpcScanFromHeight.placeholder'), inputMode: 'numeric' }),
                  ss.text({ color: 'muted', size: 'xs' }, t('settings.network.server.rpcScanFromHeight.helper')))
              ].join('')
            : '',
          preview ? ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true }, t('settings.network.server.urlPreview')), ss.text({ color: 'muted', size: 'sm' }, ss.esc(preview))) : '',
          // SSProxyFormFields
          ss.vstack({ gap: 'md' },
            ss.checkbox({ selected: f.proxy.enabled, label: t('settings.network.server.proxy.enable'), id: 'sn-proxy' }),
            f.proxy.enabled
              ? ss.text({ color: 'muted', size: 'sm' }, t('settings.network.server.proxy.description')) +
                  snField(t('settings.network.server.proxy.hostLabel'), ss.textInput({ name: 'proxyHost', value: f.proxy.host, placeholder: t('settings.network.server.proxy.host.placeholder') })) +
                  snField(t('settings.network.server.proxy.portLabel'), ss.textInput({ name: 'proxyPort', value: f.proxy.port, placeholder: t('settings.network.server.proxy.port.placeholder'), inputMode: 'numeric' }))
              : ''),
          ss.vstack({ gap: 'none', style: 'margin-bottom:16px' },
            ss.hstack({ gap: 'none', style: 'justify-content:center;margin-bottom:8px' },
              `<span class="sn-dot ${statusClass}"></span>`,
              ss.text({ size: 'xxs', uppercase: true, style: `color:var(--gray-${f.status === 'connected' ? '200' : '450'})` }, ss.esc(connectionString))),
            f.status === 'connected' ? ss.text({ center: true, color: 'muted', size: 'xs' }, `${t('settings.network.server.tester.success')} — 214 ms`) : ''))),
      ss.vstack({ gap: 'md' },
        ss.button({ label: t('settings.network.server.test'), id: 'sn-test', loading: f.status === 'checking' }),
        ss.button({ variant: 'secondary', label: snState.editing ? t('common.save') : t('common.add'), id: 'sn-save' }),
        ss.button({ variant: 'ghost', label: t('common.cancel'), go: 'settings-network-server' })))
  },
  bind: (body) => {
    const f = snForm()
    const capture = () => {
      body.querySelectorAll('input[name], textarea[name]').forEach((el) => {
        if (el.name === 'proxyHost') f.proxy.host = el.value
        else if (el.name === 'proxyPort') f.proxy.port = el.value
        else f[el.name] = el.value
      })
    }
    const rerender = () => openKitScreen('settings-network-detail')
    body.addEventListener('input', (e) => {
      if (e.target.name === 'host' || e.target.name === 'port' || e.target.name === 'name') rerenderSoon()
    })
    let timer = 0
    function rerenderSoon() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const active = document.activeElement && document.activeElement.name
        capture()
        rerender()
        const el = active && document.querySelector(`#kit-body [name="${active}"]`)
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }
      }, 400)
    }
    body.addEventListener('click', (e) => {
      // Keep typed values before any state change re-renders the form.
      if (e.target.closest('button')) capture()
      const be = e.target.closest('[data-backend]')
      if (be) {
        e.stopPropagation()
        f.backend = be.dataset.backend
        return rerender()
      }
      const pr = e.target.closest('[data-protocol]')
      if (pr) {
        f.protocol = pr.dataset.protocol
        return rerender()
      }
      if (e.target.closest('#sn-proxy')) {
        f.proxy.enabled = !f.proxy.enabled
        return rerender()
      }
      if (e.target.closest('#sn-paste, #sn-paste-qr')) {
        f.host = f.backend === 'esplora' ? 'mempool.space/signet/api' : 'electrum.example.com'
        if (!f.name) f.name = 'My node'
        return rerender()
      }
      if (e.target.closest('#sn-test')) {
        f.status = 'checking'
        rerender()
        setTimeout(() => {
          f.status = f.host ? 'connected' : 'failed'
          openKitScreen('settings-network-detail')
        }, 900)
      }
      if (e.target.closest('#sn-save')) {
        const url = snUrlPreview(f)
        if (!url) return ss.toast(t('settings.network.server.hostLabel') + ' ?', document.getElementById('view-kit'))
        const entry = { backend: f.backend, name: f.name || 'Custom', network: snState.detailNetwork, url, custom: true }
        if (snState.editing) Object.assign(snState.editing, entry)
        else snCustomServers.push(entry)
        snState.form = null
        snState.editing = null
        go('settings-network-server')
      }
    })
  }
})

// --- network/explorer.tsx ---------------------------------------------------------------

registerScreen('settings-network-explorer', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/network/explorer.tsx',
  title: () => t('settings.network.explorer.title'),
  back: 'settings-network',
  render: () =>
    ss.vstack({ gap: 'lg', justifyBetween: true },
      ss.vstack({ gap: 'md' },
        ss.text({ size: 'lg' }, t('settings.network.explorer.fullDescription')),
        SN_NETWORKS.map((network) =>
          ss.vstack({ gap: 'xs' },
            ss.text({ uppercase: true, weight: 'bold' }, network),
            ss.textInput({ name: network, value: snState.mempool[network], className: 'sn-explorer-input', style: '' }))),
        snExplanationLink()),
      snFooter('sn-explorer-save', 'settings-network')),
  bind: (body) => {
    body.querySelectorAll('.sn-explorer-input input').forEach((i) => (i.style.fontSize = '16px'))
    body.querySelector('#sn-explorer-save').onclick = () => {
      body.querySelectorAll('.sn-explorer-input input').forEach((i) => (snState.mempool[i.name] = i.value))
      go('settings-network')
    }
  }
})

// --- network/params.tsx -----------------------------------------------------------------

registerScreen('settings-network-params', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/network/params.tsx',
  title: () => t('settings.network.config.title'),
  back: 'settings-network',
  render: () => {
    const tn = (k) => t('settings.network.config.' + k)
    const num = (network, key, min, max) =>
      ss.textInput({ name: network + '.' + key, value: String(snState.configs[network][key]), align: 'left', inputMode: 'numeric', data: { 'ss-number': '', min, max } })
    return ss.vstack({ gap: 'lg', justifyBetween: true, className: 'sn-pad' },
      ss.vstack({ gap: 'md' },
        snExplanationLink(),
        ss.vstack({ gap: 'xl', style: 'margin-top:20px' },
          SN_NETWORKS.map((network) => {
            const c = snState.configs[network]
            return ss.vstack({ gap: 'sm' },
              ss.vstack({ gap: 'none' },
                ss.text({ uppercase: true, weight: 'bold', size: 'xl' }, t('bitcoin.network.' + network)),
                ss.text({ color: 'muted' }, t('settings.network.server.type.' + network))),
              ss.vstack({ gap: 'sm' },
                ss.vstack({ gap: 'xs' },
                  ss.text({}, tn('connectionMode.label')),
                  ['manual', 'auto'].map((mode) =>
                    `<div class="sn-mode">${ss.checkbox({ selected: c.connectionMode === mode, label: tn('connectionMode.' + mode), data: { mode: network + ':' + mode } })}</div>`)),
                ss.vstack({ gap: 'xs' }, ss.text({}, tn('timeDiffBeforeAutoSync')),
                  ss.vstack({ gap: 'none' }, num(network, 'timeDiffBeforeAutoSync', 1, 1440), ss.text({ color: 'muted', size: 'xs' }, tn('connectionTestIntervalNotice')))),
                ss.vstack({ gap: 'xs' }, ss.text({}, tn('connectionTestInterval')),
                  ss.vstack({ gap: 'none' }, num(network, 'connectionTestInterval', 10, 3600), ss.text({ color: 'muted', size: 'xs' }, tn('connectionTestIntervalNotice')))),
                ss.vstack({ gap: 'xs' }, ss.text({}, tn('retries')), num(network, 'retries', 1, 10)),
                ss.vstack({ gap: 'xs' }, ss.text({}, tn('timeout')), num(network, 'timeout', 1, 20)),
                ss.vstack({ gap: 'xs' }, ss.text({}, tn('stopGap')), num(network, 'stopGap', 1, 200))))
          }))),
      snFooter('sn-params-save', 'settings-network'))
  },
  bind: (body) => {
    // SSCheckbox labelProps={{ size: 'sm', uppercase: true }}, containerStyle gap 10
    body.querySelectorAll('.sn-mode .ss-checkbox').forEach((b) => {
      b.style.gap = '10px'
      const label = b.querySelector('.ss-checkbox-copy .ss-text')
      if (label) {
        label.classList.remove('s-lg')
        label.classList.add('is-uppercase')
      }
    })
    body.addEventListener('click', (e) => {
      const m = e.target.closest('[data-mode]')
      if (!m) return
      e.stopPropagation() // keep the kit's generic checkbox toggle from flipping it back
      const [network, mode] = m.dataset.mode.split(':')
      body.querySelectorAll(`[data-mode^="${network}:"]`).forEach((x) => {
        const on = x === m
        x.classList.toggle('is-on', on)
        x.setAttribute('aria-checked', on)
      })
      snState.configs[network].connectionMode = mode
    })
    body.querySelector('#sn-params-save').onclick = () => {
      body.querySelectorAll('input[name]').forEach((i) => {
        const [network, key] = i.name.split('.')
        const root = i.closest('[data-ss-number]')
        if (i.value !== '' && +i.value >= +root.dataset.min && +i.value <= +root.dataset.max) snState.configs[network][key] = Number(i.value)
      })
      go('settings-network')
    }
  }
})

// --- network/comparison.tsx -------------------------------------------------------------

registerScreen('settings-network-comparison', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/network/comparison.tsx',
  title: () => t('settings.network.comparison.title'),
  back: () => (snComparisonReturn || 'settings-network-server'),
  render: () => {
    const tn = (k) => t('settings.network.comparison.' + k)
    return ss.vstack({ gap: 'md', style: 'padding-top:0;padding-bottom:24px' },
      ss.vstack({ gap: 'md' },
        ['mainnet', 'regtest', 'signet', 'simnet', 'testnet3', 'testnet4', 'mutinynet'].map((network) =>
          ss.vstack({ gap: 'none' },
            ss.text({ uppercase: true, weight: 'bold' }, tn(network + '.title')),
            ss.text({ color: 'muted' }, tn(network + '.description')),
            ss.text({ color: 'muted' }, `<span class="ss-text is-muted w-bold">${tn('usage')}</span> ${tn(network + '.useCase')}`)))),
      ss.hstack({ gap: 'sm' }, ss.icon('info', { size: 16 }), ss.text({ size: 'xs', style: 'flex-shrink:1' }, tn('testnetInfo'))),
      ss.button({ label: t('common.close').toUpperCase(), id: 'sn-comparison-close' }))
  },
  bind: (body) => {
    body.querySelector('#sn-comparison-close').onclick = () => go(snComparisonReturn || 'settings-network-server')
  }
})

// router.back() from comparison returns to whichever screen linked to it.
let snComparisonReturn = null
document.addEventListener(
  'click',
  (e) => {
    if (e.target.closest('[data-go="settings-network-comparison"]') && typeof kitCurrent !== 'undefined' && kitCurrent !== 'settings-network-comparison') snComparisonReturn = kitCurrent
  },
  true
)

// --- ark.tsx ----------------------------------------------------------------------------

registerScreen('settings-ark', {
  source: 'app/(authenticated)/(tabs)/(signer,explorer,converter)/settings/ark.tsx',
  title: () => t('settings.ark.title'),
  back: 'settings',
  render: () => {
    const tn = (k) => t('settings.ark.' + k)
    const row = (name, url) =>
      ss.hstack({ gap: 'sm', style: 'align-items:center' },
        `<span style="flex:none">${ss.checkbox({ selected: true, disabled: true })}</span>`,
        ss.vstack({ gap: 'none', style: 'flex:1' },
          ss.text({ size: 'md', style: 'line-height:18px' }, name),
          ss.text({ color: 'muted', size: 'sm', style: 'line-height:14px' }, url)))
    return ss.vstack({ gap: 'md', justifyBetween: true, style: 'padding-top:0' },
      ss.vstack({ gap: 'xl', style: 'margin-top:20px;padding-bottom:24px' },
        ['bitcoin', 'signet'].map((network) => {
          const server = SN_ARK_SERVERS[network]
          return ss.vstack({ gap: 'md' },
            ss.vstack({ gap: 'none' },
              ss.text({ uppercase: true, weight: 'light', size: 'xl', style: 'letter-spacing:2.5px' }, t('ark.network.' + network)),
              ss.text({ color: 'muted' }, tn('network.' + network))),
            ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true }, tn('serverAddress')), row(server.name, server.arkUrl)),
            ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true }, tn('esploraAddress')), row(server.name, server.esploraUrl)))
        })),
      ss.vstack({ gap: 'md', style: 'flex-shrink:0;padding-top:16px' },
        ss.button({ variant: 'secondary', label: t('common.close'), go: 'settings' })))
  }
})
