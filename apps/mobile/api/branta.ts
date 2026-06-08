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
  return __DEV__
    ? BrantaServerBaseUrl.Staging
    : BrantaServerBaseUrl.Production
}

let cachedService: BrantaService | null = null
let cachedProxyKey: string | null = null

async function createBrantaService(
  proxy: ProxyConfig | null
): Promise<BrantaService> {
  const proxyKey = proxy ? `${proxy.host}:${proxy.port}` : 'direct'
  if (cachedService && cachedProxyKey === proxyKey) {
    return cachedService
  }

  const fetchImpl = proxy ? createSocksFetch(proxy) : fetch
  cachedService = new BrantaService(
    {
      baseUrl: getBrantaBaseUrl(),
      privacy: PrivacyMode.Strict
    },
    { fetchImpl }
  )
  cachedProxyKey = proxyKey
  return cachedService
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

  try {
    let proxy: ProxyConfig | null = null
    if (route === 'tor') {
      proxy = await resolveTorProxyForBranta()
      if (!proxy) {
        return null
      }
    }

    const service = await createBrantaService(proxy)
    const result = isQrSource
      ? await service.getPaymentsByQrCode(trimmed)
      : await service.getPayments(trimmed)

    if (result.payments.length === 0) {
      return null
    }

    return {
      payments: result.payments,
      verifyUrl: result.verifyUrl
    }
  } catch {
    return null
  }
}

export { getBrantaBaseUrl, verifyBrantaContent }
export type { BrantaRoute }
