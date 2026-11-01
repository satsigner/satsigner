import {
  BrantaEnvironment,
  BrantaPaymentException,
  BrantaPaymentExceptionReason,
  BrantaService,
  createNobleCryptoProvider,
  type VerifyResult
} from '@branta-ops/branta'
import { gcm } from '@noble/ciphers/aes.js'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'
import { randomBytes } from '@noble/hashes/utils'
import Constants from 'expo-constants'

import { BRANTA_LOOKUP_TIMEOUT_MS } from '@/constants/branta'
import { useSettingsStore } from '@/store/settings'
import {
  type BrantaLookupNotice,
  type BrantaPayee
} from '@/types/models/Branta'
import { toBrantaPayee } from '@/utils/brantaPayee'
import { createBrantaTorFetch } from '@/utils/brantaTorFetch'

type BrantaLookupClient = Pick<BrantaService, 'verify'>

type BrantaLookupResult = {
  notice: BrantaLookupNotice | null
  payee: BrantaPayee | null
}

let service: BrantaService | undefined
let serviceKey = ''
let lookupPermits = 0

function allowBrantaLookup() {
  lookupPermits += 1
}

function resetBrantaLookupPermits() {
  lookupPermits = 0
}

function takeBrantaLookupPermit() {
  if (lookupPermits === 0) {
    return false
  }
  lookupPermits -= 1
  return true
}

function skippedLookup(): BrantaLookupResult {
  return { notice: null, payee: null }
}

function isProductionBranta(extra: unknown): boolean {
  if (!extra || typeof extra !== 'object') {
    return false
  }
  if (!('brantaEnvironment' in extra)) {
    return false
  }
  return extra.brantaEnvironment === 'production'
}

function brantaEnvironment() {
  if (isProductionBranta(Constants.expoConfig?.extra)) {
    return BrantaEnvironment.Production
  }
  return BrantaEnvironment.Staging
}

/**
 * Wallets read Branta. React Native has no `crypto.subtle`, so lookups go
 * through the noble provider. Production builds use the production API;
 * every other build uses staging.
 */
function getBrantaService(): BrantaService {
  const torEnabled = useSettingsStore.getState().brantaTorEnabled
  const environment = brantaEnvironment()
  const key = `${environment}:${torEnabled}`
  if (!service || serviceKey !== key) {
    service = new BrantaService({
      crypto: createNobleCryptoProvider({ gcm, hmac, randomBytes, sha256 }),
      environment,
      ...(torEnabled ? { fetchImpl: createBrantaTorFetch() } : {})
    })
    serviceKey = key
  }
  return service
}

function payeeFromVerify(result: VerifyResult): BrantaLookupResult {
  if (result.status === 'match') {
    return { notice: null, payee: toBrantaPayee(result) }
  }
  if (result.status === 'tampered') {
    return { notice: 'tampered', payee: null }
  }
  if (result.status === 'incomplete') {
    return { notice: 'incomplete', payee: null }
  }
  return skippedLookup()
}

function noticeFromLookupError(error: unknown): BrantaLookupNotice {
  if (
    error instanceof BrantaPaymentException &&
    error.reason === BrantaPaymentExceptionReason.CryptoUnavailable
  ) {
    return 'unavailable'
  }
  return 'incomplete'
}

/**
 * Looks up a scanned or pasted destination. Pass the full QR or pasted text.
 * `verify` reads `branta_id` / `branta_secret` and derived-key payments.
 * Unknown is not shown. Tampered, incomplete, and missing crypto are.
 */
async function lookupBrantaPayee(
  input: string,
  client?: BrantaLookupClient
): Promise<BrantaLookupResult> {
  if (useSettingsStore.getState().brantaLookupMode === 'off') {
    return skippedLookup()
  }
  if (!takeBrantaLookupPermit()) {
    return skippedLookup()
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return skippedLookup()
  }

  const lookupClient = client ?? getBrantaService()

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, BRANTA_LOOKUP_TIMEOUT_MS)

  try {
    const result = await lookupClient.verify(
      trimmed,
      undefined,
      controller.signal
    )
    return payeeFromVerify(result)
  } catch (error) {
    return { notice: noticeFromLookupError(error), payee: null }
  } finally {
    clearTimeout(timer)
  }
}

export {
  allowBrantaLookup,
  getBrantaService,
  lookupBrantaPayee,
  resetBrantaLookupPermits
}
