import { fetchArkServerInfo } from '@/api/ark'
import { MempoolOracle } from '@/api/blockchain'
import { connectToMint } from '@/api/ecash'
import { lndRestFetch } from '@/api/lndRest'
import { probeOhttpKeys } from '@/api/payjoinNative'
import {
  DIAGNOSTIC_HTTP_TIMEOUT_MS,
  DIAGNOSTIC_SLOW_RESPONSE_MS
} from '@/constants/diagnostics'
import { NOSTR_BLOSSOM_DEFAULT_SERVER } from '@/constants/nostr'
import { useArkStore } from '@/store/ark'
import { useBlockchainStore } from '@/store/blockchain'
import { useEcashStore } from '@/store/ecash'
import { useLightningStore } from '@/store/lightning'
import {
  getFiatPriceApiUrl,
  getPayjoinSettings,
  useSettingsStore
} from '@/store/settings'
import { parseLndNodeInfo } from '@/utils/lndNodeInfo'
import { getShuffledOhttpRelays } from '@/utils/payjoinRelays'
import { withTimeout } from '@/utils/time'

import type {
  DiagnosticCheck,
  DiagnosticOutcome,
  DiagnosticStatus
} from '../types'

const OHTTP_RELAYS_PROBED = 2
const HTTP_SERVER_ERROR_MIN = 500

type Probe = { error?: string; label: string; latencyMs: number }

async function timedProbe(
  label: string,
  run: () => Promise<unknown>
): Promise<Probe> {
  const startedAt = Date.now()
  try {
    await withTimeout(run(), DIAGNOSTIC_HTTP_TIMEOUT_MS, 'timed out')
    return { label, latencyMs: Date.now() - startedAt }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      label,
      latencyMs: Date.now() - startedAt
    }
  }
}

function summarizeProbes(probes: Probe[]): DiagnosticOutcome {
  const lines = probes.map((probe) =>
    probe.error
      ? `${probe.label}: FAILED (${probe.error})`
      : `${probe.label}: ok in ${probe.latencyMs}ms`
  )
  return { lines, status: probesStatus(probes) }
}

function probesStatus(probes: Probe[]): DiagnosticStatus {
  const failed = probes.filter((probe) => probe.error).length
  if (failed === probes.length) {
    return 'fail'
  }
  const slow = probes.some(
    (probe) => !probe.error && probe.latencyMs > DIAGNOSTIC_SLOW_RESPONSE_MS
  )
  return failed > 0 || slow ? 'warn' : 'ok'
}

async function fetchReachable(url: string): Promise<void> {
  const response = await fetch(url, { method: 'GET' })
  if (response.status >= HTTP_SERVER_ERROR_MIN) {
    throw new Error(`HTTP ${response.status}`)
  }
}

const payjoinCheck: DiagnosticCheck = {
  category: 'services',
  id: 'payjoin',
  requiresNetwork: true,
  async run() {
    if (!useSettingsStore.getState().payjoinEnabled) {
      return {
        lines: [
          'Skipped because Payjoin is turned off.',
          'Turn it on in Settings if you want the directory checked.'
        ],
        status: 'skipped'
      }
    }
    const { directoryUrl } = getPayjoinSettings()
    const relays = getShuffledOhttpRelays().slice(0, OHTTP_RELAYS_PROBED)
    const probes = await Promise.all(
      relays.map((relay) =>
        timedProbe(`ohttp ${relay} → ${directoryUrl}`, () =>
          probeOhttpKeys(relay, directoryUrl)
        )
      )
    )
    return summarizeProbes(probes)
  }
}

const ecashMintsCheck: DiagnosticCheck = {
  category: 'services',
  id: 'ecashMints',
  requiresNetwork: true,
  async run() {
    const urls = [
      ...new Set(
        Object.values(useEcashStore.getState().mints)
          .flat()
          .map((mint) => mint.url)
      )
    ]
    if (urls.length === 0) {
      return {
        lines: [
          'Skipped because there is no ecash mint.',
          'Add an ecash account and a mint if you want mints checked.'
        ],
        status: 'skipped'
      }
    }
    const probes = await Promise.all(
      urls.map((url) => timedProbe(url, () => connectToMint(url)))
    )
    return summarizeProbes(probes)
  }
}

const lightningCheck: DiagnosticCheck = {
  category: 'services',
  id: 'lightning',
  requiresNetwork: true,
  async run() {
    const { config } = useLightningStore.getState()
    if (!config) {
      return {
        lines: [
          'Skipped because no Lightning node is saved.',
          'Add an LND node under Lightning settings if you want it checked.'
        ],
        status: 'skipped'
      }
    }
    if (!config.macaroon) {
      return {
        lines: ['node credentials are locked until the node is opened'],
        status: 'skipped'
      }
    }
    const startedAt = Date.now()
    const response = await lndRestFetch(config, '/v1/getinfo')
    const latencyMs = Date.now() - startedAt
    if (!response.ok) {
      return { lines: [`getinfo HTTP ${response.status}`], status: 'fail' }
    }
    const info = parseLndNodeInfo(await response.json())
    if (!info) {
      return { lines: ['getinfo response is invalid'], status: 'fail' }
    }
    const lines = [
      `getinfo ok in ${latencyMs}ms`,
      `synced to chain ${String(info?.synced_to_chain ?? 'unknown')}`,
      `active channels ${info?.num_active_channels ?? 'unknown'}`
    ]
    return {
      lines,
      status: info?.synced_to_chain === false ? 'warn' : 'ok'
    }
  }
}

const arkServerCheck: DiagnosticCheck = {
  category: 'services',
  id: 'arkServer',
  requiresNetwork: true,
  async run() {
    const { accounts } = useArkStore.getState()
    if (accounts.length === 0) {
      return {
        lines: [
          'Skipped because there is no Ark account.',
          'Add one under Signer if you want its server checked.'
        ],
        status: 'skipped'
      }
    }
    const probes = await Promise.all(
      accounts.map((account, index) =>
        timedProbe(`account ${index + 1} (${account.serverId})`, () =>
          fetchArkServerInfo(account.serverId, account.id)
        )
      )
    )
    const opened = probes.filter(
      (probe) => !probe.error?.includes('not opened')
    )
    if (opened.length === 0) {
      return {
        lines: ['open an ark account first to check its server'],
        status: 'skipped'
      }
    }
    return summarizeProbes(opened)
  }
}

const blossomCheck: DiagnosticCheck = {
  category: 'services',
  id: 'blossom',
  requiresNetwork: true,
  async run() {
    const probe = await timedProbe(NOSTR_BLOSSOM_DEFAULT_SERVER, () =>
      fetchReachable(NOSTR_BLOSSOM_DEFAULT_SERVER)
    )
    return summarizeProbes([probe])
  }
}

const pricesCheck: DiagnosticCheck = {
  category: 'services',
  id: 'prices',
  requiresNetwork: true,
  async run(ctx) {
    if (!useSettingsStore.getState().fetchCurrentPrices) {
      return {
        lines: [
          'Skipped because price fetching is turned off.',
          'Turn on current prices in Settings if you want the price sources checked.'
        ],
        status: 'skipped'
      }
    }
    const mempoolUrl = useBlockchainStore.getState().configsMempool[ctx.network]
    const fiatUrl = getFiatPriceApiUrl()
    const probes = await Promise.all([
      timedProbe(`mempool prices ${mempoolUrl}`, () =>
        new MempoolOracle(mempoolUrl).getPrices()
      ),
      timedProbe(`fiat api ${fiatUrl}`, () =>
        new MempoolOracle(fiatUrl).getPrices()
      )
    ])
    return summarizeProbes(probes)
  }
}

const SERVICES_CHECKS = [
  payjoinCheck,
  ecashMintsCheck,
  lightningCheck,
  arkServerCheck,
  blossomCheck,
  pricesCheck
]

export { SERVICES_CHECKS }
