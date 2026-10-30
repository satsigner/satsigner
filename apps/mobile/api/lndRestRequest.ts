import { lndRestFetch } from '@/api/lndRest'
import type { LNDConfig, LNDNodeInfo } from '@/types/models/Lightning'
import { HttpStatusError } from '@/utils/errors'
import { parseLndNodeInfo } from '@/utils/lndNodeInfo'
import { resolveLndConfigFromConnectionInput } from '@/utils/lndRestRemoteConfig'
import { isRecord } from '@/utils/object'

const PAIRING_ERROR_BODY_MAX_LENGTH = 180

type LndRestJsonRequest = {
  body?: unknown
  headers: Record<string, string>
  method: string
}

type LndChannelPoint = {
  txid: string
  vout: string
}

export async function fetchLndNodeInfo(
  config: LNDConfig
): Promise<LNDNodeInfo> {
  const response = await lndRestFetch(config, '/v1/getinfo')

  if (!response.ok) {
    throw new Error(`Failed to fetch node info: ${response.status}`)
  }

  const info = parseLndNodeInfo(await response.json())
  if (!info) {
    throw new Error(`Failed to fetch node info: ${response.status}`)
  }
  return info
}

/** Resolves a pairing input and proves it works with a `getinfo` call. */
export async function pairLndRestNode(connectionInput: string) {
  const config = await resolveLndConfigFromConnectionInput(connectionInput)

  const baseUrl = config.url.replace(/\/+$/, '')
  const response = await lndRestFetch(
    { ...config, url: baseUrl },
    '/v1/getinfo'
  )

  if (!response.ok) {
    const responseText = await response.text()
    const errBody = responseText
      .replaceAll(/\s+/g, ' ')
      .trim()
      .slice(0, PAIRING_ERROR_BODY_MAX_LENGTH)
    throw new Error(
      errBody
        ? `getinfo failed (${response.status}): ${errBody}`
        : `getinfo failed (${response.status})`
    )
  }

  const nodeInfo = parseLndNodeInfo(await response.json())
  if (!nodeInfo) {
    throw new Error(`getinfo failed (${response.status})`)
  }

  return { config: { ...config, url: baseUrl }, nodeInfo }
}

/**
 * Calls LND REST and hands back the JSON body as the caller's `T` without
 * validating it: each caller owns the shape it asks for.
 */
export async function requestLndRestJson<T>(
  config: LNDConfig,
  endpoint: string,
  { body, headers, method }: LndRestJsonRequest,
  onErrorStatus: () => void
): Promise<T> {
  const response = await lndRestFetch(config, endpoint, {
    body: body ? JSON.stringify(body) : undefined,
    headers,
    method
  })

  if (!response.ok) {
    onErrorStatus()
    const errorText = await response.text()
    throw new HttpStatusError(
      response.status,
      `LND API error: ${response.status} ${errorText}`
    )
  }

  const data = await response.json()
  return data as T
}

export async function closeLndChannel(
  config: LNDConfig,
  channelPoint: LndChannelPoint,
  force: boolean
) {
  const qs = new URLSearchParams({
    force: String(force),
    no_wait: 'true'
  })
  const url = `${config.url}/v1/channels/${encodeURIComponent(channelPoint.txid)}/${encodeURIComponent(channelPoint.vout)}?${qs}`
  const response = await lndRestFetch(config, url, {
    method: 'DELETE'
  })
  const body = await response.text()
  if (!response.ok) {
    throw new HttpStatusError(
      response.status,
      `LND API error: ${response.status} ${body}`
    )
  }
  if (!body) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(body)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}
