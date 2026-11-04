import { requireNativeModule } from 'expo-modules-core'

type BrantaSocksRequest = {
  body: string
  status: number
}

type BrantaSocksNative = {
  cancel(requestId: string): void
  request(
    requestId: string,
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string,
    proxyHost: string,
    proxyPort: number
  ): Promise<BrantaSocksRequest>
}

function nativeModule(): BrantaSocksNative {
  return requireNativeModule<BrantaSocksNative>('BrantaSocks')
}

function requestBrantaSocks(
  requestId: string,
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
  proxyHost: string,
  proxyPort: number
): Promise<BrantaSocksRequest> {
  return nativeModule().request(
    requestId,
    url,
    method,
    headers,
    body,
    proxyHost,
    proxyPort
  )
}

function cancelBrantaSocks(requestId: string) {
  nativeModule().cancel(requestId)
}

export { cancelBrantaSocks, requestBrantaSocks }
export type { BrantaSocksRequest }
