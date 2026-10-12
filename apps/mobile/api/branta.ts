import {
  BrantaServerBaseUrl,
  PrivacyMode,
  createNobleCryptoProvider
} from '@branta-ops/branta'
import { BrantaService } from '@branta-ops/branta/v2'
import { gcm } from '@noble/ciphers/aes.js'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'
import { randomBytes } from '@noble/hashes/utils'
import Constants from 'expo-constants'

import {
  type BrantaLookupSource,
  type BrantaPayee
} from '@/types/models/Branta'
import { toBrantaPayee } from '@/utils/brantaPayee'

const BRANTA_LOOKUP_TIMEOUT_MS = 8000
const QR_URI_PATTERN = /^(bitcoin|lightning):/i

type BrantaLookupClient = Pick<
  BrantaService,
  'getPayments' | 'getPaymentsByQrCode'
>

let service: BrantaService | undefined

function isProductionBranta(extra: unknown): boolean {
  if (!extra || typeof extra !== 'object') {
    return false
  }
  if (!('brantaEnvironment' in extra)) {
    return false
  }
  return extra.brantaEnvironment === 'production'
}

function brantaServerBaseUrl() {
  if (isProductionBranta(Constants.expoConfig?.extra)) {
    return BrantaServerBaseUrl.Production
  }
  return BrantaServerBaseUrl.Staging
}

/**
 * Wallets read Branta. React Native has no `crypto.subtle`, so lookups go
 * through the noble provider. Production builds use the production API;
 * every other build uses staging.
 */
function getBrantaService(): BrantaService {
  if (!service) {
    service = new BrantaService(
      {
        baseUrl: brantaServerBaseUrl(),
        privacy: PrivacyMode.Strict
      },
      {
        crypto: createNobleCryptoProvider({ gcm, hmac, randomBytes, sha256 })
      }
    )
  }
  return service
}

/**
 * A pasted `bitcoin:` or `lightning:` string is the QR payload. Only
 * getPaymentsByQrCode reads `branta_id` and `branta_secret`. Plain text
 * such as a bolt11 invoice still uses getPayments.
 */
function usesQrLookup(input: string, source: BrantaLookupSource): boolean {
  return source === 'qr' || QR_URI_PATTERN.test(input)
}

/**
 * Looks up a scanned or pasted destination. A miss or a failure is not shown
 * to the user — the destination simply has no Branta record.
 * Pass the full QR or pasted text. Do not split a unified URI first.
 */
async function lookupBrantaPayee(
  input: string,
  source: BrantaLookupSource,
  client: BrantaLookupClient = getBrantaService()
): Promise<BrantaPayee | null> {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, BRANTA_LOOKUP_TIMEOUT_MS)

  try {
    const result = usesQrLookup(trimmed, source)
      ? await client.getPaymentsByQrCode(trimmed, undefined, controller.signal)
      : await client.getPayments(
          trimmed,
          undefined,
          undefined,
          controller.signal
        )

    if (result.payments.length === 0) {
      return null
    }
    return toBrantaPayee(result)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export { getBrantaService, lookupBrantaPayee }
