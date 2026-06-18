import {
  BrantaServerBaseUrl,
  PrivacyMode,
  type BrantaServerBaseUrl as BrantaServerBaseUrlType
} from '@branta-ops/branta'
import { BrantaService } from '@branta-ops/branta/v2'

import { createSocksFetch } from '@/api/brantaFetch'
import { type BrantaVerificationResult } from '@/types/models/Branta'
import { type ProxyConfig } from '@/types/settings/blockchain'
import { resolveTorProxyForBranta } from '@/utils/torProxy'

function getBrantaBaseUrl(): BrantaServerBaseUrlType {
  return __DEV__ ? BrantaServerBaseUrl.Staging : BrantaServerBaseUrl.Production
}

const serviceCache = new Map<string, BrantaService>()

function getOrCreateBrantaService(proxy: ProxyConfig | null): BrantaService {
  const proxyKey = proxy ? `${proxy.host}:${proxy.port}` : 'direct'
  const cached = serviceCache.get(proxyKey)
  if (cached) {
    return cached
  }

  const fetchImpl = proxy ? createSocksFetch(proxy) : fetch
  const service = new BrantaService(
    {
      baseUrl: getBrantaBaseUrl(),
      privacy: PrivacyMode.Strict
    },
    { fetchImpl }
  )
  serviceCache.set(proxyKey, service)
  return service
}

type BrantaRoute = 'tor' | 'clearnet'

async function verifyBrantaContent(
  rawContent: string,
  isQrSource: boolean,
  route: BrantaRoute
): Promise<BrantaVerificationResult | null> {
  const trimmed = rawContent.trim()
  if (!trimmed) {
    return null
  }

  if (__DEV__) {
    console.log(
      '[BrantaAPI] verifyBrantaContent route:',
      route,
      'isQrSource:',
      isQrSource,
      'content:',
      trimmed.slice(0, 50)
    )
  }

  const proxy = route === 'tor' ? await resolveTorProxyForBranta() : null
  if (route === 'tor' && !proxy) {
    if (__DEV__) {
      console.log('[BrantaAPI] tor route but no proxy found — aborting')
    }
    return null
  }

  if (__DEV__) {
    console.log(
      '[BrantaAPI] proxy:',
      proxy ? `${proxy.host}:${proxy.port}` : 'direct clearnet'
    )
    console.log(
      '[BrantaAPI] lookup:',
      isQrSource ? 'getPaymentsByQrCode' : 'getPayments',
      trimmed.slice(0, 60)
    )
  }

  const service = getOrCreateBrantaService(proxy)
  // Let errors propagate — TanStack Query captures them so the UI can
  // distinguish a network failure from "address not registered with Branta".
  const result = isQrSource
    ? await service.getPaymentsByQrCode(trimmed)
    : await service.getPayments(trimmed)

  if (__DEV__) {
    console.log(
      '[BrantaAPI] payments:',
      result.payments.length,
      'verifyUrl:',
      result.verifyUrl
    )
  }

  // Return the result even when empty so the hook can show "not found"
  // rather than treating it the same as a network error.
  return {
    payments: result.payments,
    verifyUrl: result.verifyUrl
  }
}

export { getBrantaBaseUrl, verifyBrantaContent }
export type { BrantaRoute }
