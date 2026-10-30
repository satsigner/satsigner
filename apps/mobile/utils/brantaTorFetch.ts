import {
  BRANTA_TOR_PROXY_HOST,
  BRANTA_TOR_PROXY_PORT
} from '@/constants/branta'
import {
  cancelBrantaSocks,
  requestBrantaSocks,
  type BrantaSocksRequest
} from '@/modules/branta-socks'

let nextRequestId = 0

function abortError(): Error {
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value)
  } catch {
    return undefined
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.toString()
  }
  return input.url
}

function isHeaderRecord(
  headers: HeadersInit
): headers is Record<string, string> {
  const isHeaders = typeof Headers !== 'undefined' && headers instanceof Headers
  return !Array.isArray(headers) && !isHeaders
}

function headerRecord(
  headers: HeadersInit | undefined
): Record<string, string> {
  if (!headers) {
    return {}
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  if (!isHeaderRecord(headers)) {
    const record: Record<string, string> = {}
    for (const [key, value] of headers.entries()) {
      record[key] = value
    }
    return record
  }
  return { ...headers }
}

function textBody(body: BodyInit | null | undefined): string {
  if (body === null || body === undefined || body === '') {
    return ''
  }
  if (typeof body === 'string') {
    return body
  }
  throw new Error('Branta Tor lookups only send text')
}

function responseFrom(result: BrantaSocksRequest): Response {
  if (result.status < 200 || result.status > 599) {
    throw new Error('Branta Tor lookup failed')
  }
  return new Response(result.body, { status: result.status })
}

function abortSignal(signal: AbortSignal, requestId: string): Promise<never> {
  if (signal.aborted) {
    cancelBrantaSocks(requestId)
    return Promise.reject(abortError())
  }

  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      'abort',
      () => {
        cancelBrantaSocks(requestId)
        reject(abortError())
      },
      { once: true }
    )
  })
}

/**
 * BrantaService accepts fetchImpl and has no agent option. This fetch dials
 * the SDK's https host through Orbot. A .onion host is reachable only this
 * way, and a proxy failure does not fall back to the clearnet.
 */
function createBrantaTorFetch(): typeof fetch {
  return (input, init) => torFetch(input, init)
}

async function torFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = requestUrl(input)
  const parsed = parseUrl(url)
  if (!parsed || parsed.protocol !== 'https:') {
    throw new Error('Branta Tor lookups require https')
  }

  const signal = init?.signal
  if (signal?.aborted) {
    throw abortError()
  }

  nextRequestId += 1
  const requestId = `branta-tor-${nextRequestId}`
  const pending = requestBrantaSocks(
    requestId,
    url,
    (init?.method ?? 'GET').toUpperCase(),
    headerRecord(init?.headers),
    textBody(init?.body),
    BRANTA_TOR_PROXY_HOST,
    BRANTA_TOR_PROXY_PORT
  )

  if (!signal) {
    return responseFrom(await pending)
  }
  return responseFrom(
    await Promise.race([pending, abortSignal(signal, requestId)])
  )
}

export { createBrantaTorFetch }
