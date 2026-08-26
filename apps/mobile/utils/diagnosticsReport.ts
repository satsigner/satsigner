import NetInfo from '@react-native-community/netinfo'
import Constants from 'expo-constants'
import { nip19 } from 'nostr-tools'
import { Platform } from 'react-native'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_SECURITY_REPORT_NPUB } from '@/constants/nostr'
import { randomKey } from '@/utils/crypto'
import {
  type CheckResults,
  resolveLiveRoundtripRelays
} from '@/utils/diagnostics'

export const DIAGNOSTICS_REPORT_VERSION = 1

export type DiagnosticsReportPayload = {
  v: number
  app: string
  platform: string
  osVersion: string
  deviceModel?: string
  network: string
  ts: number
  checks: Record<string, 'ok' | 'failed'>
}

/**
 * Builds the outbound diagnostics report. Pass/fail per executed check plus
 * coarse environment info (app version, platform, OS version, device model
 * where the OS exposes it) — enough to spot device- or release-correlated
 * failures across users. Never includes check log lines (they can contain
 * relay URLs and error details) and never any RNG samples.
 */
export function buildDiagnosticsReport(
  results: CheckResults,
  network: string
): DiagnosticsReportPayload {
  const checks: Record<string, 'ok' | 'failed'> = {}
  for (const [id, result] of Object.entries(results)) {
    if (result?.kind === 'ok' || result?.kind === 'failed') {
      checks[id] = result.kind
    }
  }

  // platform.ios.model is the hardware identifier ("iPhone15,2"), not the
  // user-set device name, so it carries no personal info. Null in simulator.
  const deviceModel =
    Platform.OS === 'ios'
      ? (Constants.platform?.ios?.model ?? undefined)
      : undefined

  return {
    app: Constants.expoConfig?.version ?? 'unknown',
    checks,
    ...(deviceModel ? { deviceModel } : {}),
    network,
    osVersion: String(Platform.Version),
    platform: Platform.OS,
    ts: Date.now(),
    v: DIAGNOSTICS_REPORT_VERSION
  }
}

/**
 * Gift-wraps the report to the project's security npub from a throwaway
 * keypair — the report is unlinkable to the user's nostr identity — and
 * publishes it over the configured relays, or well-known DM-capable defaults
 * when none are set. Throws when offline or when no relay accepts the wrap.
 */
export async function submitDiagnosticsReport(
  payload: DiagnosticsReportPayload,
  relayUrls: string[]
): Promise<void> {
  const netState = await NetInfo.fetch()
  if (netState.isConnected === false) {
    throw new Error('device is offline')
  }

  const relays = resolveLiveRoundtripRelays(relayUrls)
  const secretKey = new Uint8Array(Buffer.from(await randomKey(32), 'hex'))
  const nsec = nip19.nsecEncode(secretKey)

  const api = new NostrAPI(relays)
  try {
    const wrap = api.createKind1059(
      nsec,
      NOSTR_SECURITY_REPORT_NPUB,
      JSON.stringify(payload)
    )
    await api.publishEvent(wrap)
  } finally {
    api.closeAllSubscriptions()
  }
}
