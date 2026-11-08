import {
  requireNativeModule,
  requireOptionalNativeModule
} from 'expo-modules-core'

const BRANTA_SOCKS_MODULE_NAME = 'BrantaSocks'

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
  return requireNativeModule<BrantaSocksNative>(BRANTA_SOCKS_MODULE_NAME)
}

function isBrantaSocksAvailable(): boolean {
  return requireOptionalNativeModule(BRANTA_SOCKS_MODULE_NAME) !== null
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

export { cancelBrantaSocks, isBrantaSocksAvailable, requestBrantaSocks }
export type { BrantaSocksRequest }
