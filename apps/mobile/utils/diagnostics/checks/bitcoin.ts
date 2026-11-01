import Esplora from '@/api/esplora'
import {
  DIAGNOSTIC_SLOW_RESPONSE_MS,
  DIAGNOSTIC_STALE_SYNC_MS
} from '@/constants/diagnostics'
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/constants/time'
import { probeConnection } from '@/services/connectionTest'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'

import type { DiagnosticCheck, DiagnosticOutcome } from '../types'

const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND

function latencyStatus(latencyMs: number): DiagnosticOutcome['status'] {
  return latencyMs > DIAGNOSTIC_SLOW_RESPONSE_MS ? 'warn' : 'ok'
}

const backendServerCheck: DiagnosticCheck = {
  category: 'bitcoin',
  id: 'backendServer',
  requiresNetwork: true,
  async run(ctx) {
    const { server } = useBlockchainStore.getState().configs[ctx.network]
    const lines = [`${server.backend} ${server.url}`]
    if (server.backend === 'rpc') {
      return {
        lines: [...lines, 'rpc credentials are locked; test it from settings'],
        status: 'skipped'
      }
    }
    if (server.proxy?.enabled) {
      lines.push('via proxy')
    }
    const startedAt = Date.now()
    const result = await probeConnection({
      backend: server.backend,
      network: ctx.network,
      url: server.url
    })
    const latencyMs = Date.now() - startedAt
    lines.push(`answered in ${latencyMs}ms`)
    if (result.blockHeight !== undefined) {
      lines.push(`tip height ${result.blockHeight}`)
    }
    if (result.blockFilterIndexMissing) {
      lines.push('block filter index missing: wallet sync will be slow')
      return { lines, status: 'warn' }
    }
    return { lines, status: latencyStatus(latencyMs) }
  }
}

const mempoolServerCheck: DiagnosticCheck = {
  category: 'bitcoin',
  id: 'mempoolServer',
  requiresNetwork: true,
  async run(ctx) {
    const url = useBlockchainStore.getState().configsMempool[ctx.network]
    const startedAt = Date.now()
    const height = await new Esplora(url).getLatestBlockHeight()
    const latencyMs = Date.now() - startedAt
    return {
      lines: [url, `tip height ${height}`, `answered in ${latencyMs}ms`],
      status: Number.isFinite(height) ? latencyStatus(latencyMs) : 'fail'
    }
  }
}

const accountSyncCheck: DiagnosticCheck = {
  category: 'bitcoin',
  id: 'accountSync',
  run(ctx) {
    const now = Date.now()
    const accounts = useAccountsStore
      .getState()
      .accounts.filter((account) => account.network === ctx.network)
    if (accounts.length === 0) {
      return Promise.resolve({
        lines: [
          `Skipped because there is no ${ctx.network} Bitcoin account.`,
          'Add one under Signer. This check compares each account’s last sync time.'
        ],
        status: 'skipped'
      })
    }
    const rows = accounts.map((account, index) => {
      const syncedAt = account.lastSyncedAt
        ? new Date(account.lastSyncedAt).getTime()
        : null
      const ageMs = syncedAt === null ? null : now - syncedAt
      const stale = ageMs === null || ageMs > DIAGNOSTIC_STALE_SYNC_MS
      const failed = account.syncStatus === 'error'
      const stuck = account.isSyncing === true && stale
      return {
        failed,
        line: `account ${index + 1} (${account.policyType}): ${account.syncStatus}, ${
          ageMs === null
            ? 'never synced'
            : `synced ${Math.round(ageMs / MS_PER_MINUTE)}min ago`
        }${stuck ? ' (stuck syncing?)' : ''}`,
        stale
      }
    })
    return Promise.resolve({
      lines: rows.map((row) => row.line),
      status: rows.some((row) => row.stale || row.failed) ? 'warn' : 'ok'
    })
  }
}

const BITCOIN_CHECKS = [
  backendServerCheck,
  mempoolServerCheck,
  accountSyncCheck
]

export { BITCOIN_CHECKS }
