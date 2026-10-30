import { type LndRestFetchResult, lndRestFetch } from '@/api/lndRest'
import {
  closeLndChannel,
  fetchLndNodeInfo,
  pairLndRestNode,
  requestLndRestJson
} from '@/api/lndRestRequest'
import type { LNDConfig } from '@/types/models/Lightning'
import { HttpStatusError } from '@/utils/errors'
import { resolveLndConfigFromConnectionInput } from '@/utils/lndRestRemoteConfig'

jest.mock<typeof import('@/api/lndRest')>('@/api/lndRest', () => ({
  lndRestFetch: jest.fn()
}))
jest.mock<typeof import('@/utils/lndRestRemoteConfig')>(
  '@/utils/lndRestRemoteConfig',
  () => ({
    ...jest.requireActual<typeof import('@/utils/lndRestRemoteConfig')>(
      '@/utils/lndRestRemoteConfig'
    ),
    resolveLndConfigFromConnectionInput: jest.fn()
  })
)

const CONFIG: LNDConfig = {
  cert: 'cert',
  macaroon: 'macaroon',
  url: 'https://node.example:8080'
}
const NODE_INFO_BODY = JSON.stringify({ alias: 'node', identity_pubkey: 'pk' })

function fakeResponse(status: number, text: string): LndRestFetchResult {
  return {
    json: () => Promise.resolve<unknown>(JSON.parse(text)),
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text)
  }
}

const mockedFetch = jest.mocked(lndRestFetch)

describe('lndRestRequest', () => {
  beforeEach(() => {
    mockedFetch.mockReset()
  })

  describe('fetchLndNodeInfo', () => {
    it('returns the parsed getinfo body', async () => {
      mockedFetch.mockResolvedValue(fakeResponse(200, NODE_INFO_BODY))

      const info = await fetchLndNodeInfo(CONFIG)

      expect(mockedFetch).toHaveBeenCalledWith(CONFIG, '/v1/getinfo')
      expect(info.alias).toBe('node')
      expect(info.identity_pubkey).toBe('pk')
    })

    it('throws with the status when the request fails', async () => {
      mockedFetch.mockResolvedValue(fakeResponse(500, 'boom'))

      await expect(fetchLndNodeInfo(CONFIG)).rejects.toThrow(
        'Failed to fetch node info: 500'
      )
    })

    it('throws with the status when the body is not node info', async () => {
      mockedFetch.mockResolvedValue(fakeResponse(200, '{}'))

      await expect(fetchLndNodeInfo(CONFIG)).rejects.toThrow(
        'Failed to fetch node info: 200'
      )
    })
  })

  describe('requestLndRestJson', () => {
    it('sends a JSON body and returns the JSON response', async () => {
      mockedFetch.mockResolvedValue(fakeResponse(200, '{"ok":true}'))
      const onErrorStatus = jest.fn()

      const data = await requestLndRestJson<{ ok: boolean }>(
        CONFIG,
        '/v1/invoices',
        { body: { value: 1 }, headers: { a: 'b' }, method: 'POST' },
        onErrorStatus
      )

      expect(data).toStrictEqual({ ok: true })
      expect(mockedFetch).toHaveBeenCalledWith(CONFIG, '/v1/invoices', {
        body: '{"value":1}',
        headers: { a: 'b' },
        method: 'POST'
      })
      expect(onErrorStatus).not.toHaveBeenCalled()
    })

    it('omits the body when there is none', async () => {
      mockedFetch.mockResolvedValue(fakeResponse(200, '{}'))

      await requestLndRestJson(
        CONFIG,
        '/v1/balance/blockchain',
        { headers: {}, method: 'GET' },
        jest.fn()
      )

      expect(mockedFetch).toHaveBeenCalledWith(
        CONFIG,
        '/v1/balance/blockchain',
        {
          body: undefined,
          headers: {},
          method: 'GET'
        }
      )
    })

    it('reports the error status and throws an HttpStatusError', async () => {
      mockedFetch.mockResolvedValue(fakeResponse(403, 'denied'))
      const onErrorStatus = jest.fn()

      const request = requestLndRestJson(
        CONFIG,
        '/v1/channels',
        { headers: {}, method: 'GET' },
        onErrorStatus
      )

      await expect(request).rejects.toThrow(HttpStatusError)
      await expect(request).rejects.toMatchObject({
        message: 'LND API error: 403 denied',
        status: 403
      })
      expect(onErrorStatus).toHaveBeenCalledTimes(1)
    })
  })

  describe('closeLndChannel', () => {
    const channelPoint = { txid: 'ab/cd', vout: '1' }

    it('sends a DELETE with the force flag and parses the JSON body', async () => {
      mockedFetch.mockResolvedValue(fakeResponse(200, '{"closing_txid":"x"}'))

      const result = await closeLndChannel(CONFIG, channelPoint, true)

      expect(result).toStrictEqual({ closing_txid: 'x' })
      expect(mockedFetch).toHaveBeenCalledWith(
        CONFIG,
        'https://node.example:8080/v1/channels/ab%2Fcd/1?force=true&no_wait=true',
        { method: 'DELETE' }
      )
    })

    it('returns an empty object for an empty or non-object body', async () => {
      mockedFetch.mockResolvedValueOnce(fakeResponse(200, ''))
      mockedFetch.mockResolvedValueOnce(fakeResponse(200, 'not json'))
      mockedFetch.mockResolvedValueOnce(fakeResponse(200, '[1]'))

      await expect(
        closeLndChannel(CONFIG, channelPoint, false)
      ).resolves.toStrictEqual({})
      await expect(
        closeLndChannel(CONFIG, channelPoint, false)
      ).resolves.toStrictEqual({})
      await expect(
        closeLndChannel(CONFIG, channelPoint, false)
      ).resolves.toStrictEqual({})
    })

    it('throws an HttpStatusError with the response body', async () => {
      mockedFetch.mockResolvedValue(fakeResponse(500, 'cannot close'))

      await expect(
        closeLndChannel(CONFIG, channelPoint, false)
      ).rejects.toMatchObject({
        message: 'LND API error: 500 cannot close',
        status: 500
      })
    })
  })

  describe('pairLndRestNode', () => {
    const mockedResolve = jest.mocked(resolveLndConfigFromConnectionInput)

    beforeEach(() => {
      mockedResolve.mockResolvedValue({
        ...CONFIG,
        url: 'https://node.example:8080//'
      })
    })

    it('strips trailing slashes and returns the config with node info', async () => {
      mockedFetch.mockResolvedValue(fakeResponse(200, NODE_INFO_BODY))

      const { config, nodeInfo } = await pairLndRestNode('lndconnect://x')

      expect(mockedResolve).toHaveBeenCalledWith('lndconnect://x')
      expect(mockedFetch).toHaveBeenCalledWith(CONFIG, '/v1/getinfo')
      expect(config).toStrictEqual(CONFIG)
      expect(nodeInfo.identity_pubkey).toBe('pk')
    })

    it('includes the collapsed, truncated error body', async () => {
      const longBody = `bad\n\n  macaroon ${'x'.repeat(300)}`
      mockedFetch.mockResolvedValue(fakeResponse(401, longBody))

      const error = await pairLndRestNode('lndconnect://x').catch(
        (error: unknown) => error
      )

      const expectedBody = longBody.replaceAll(/\s+/g, ' ').trim().slice(0, 180)
      expect(error).toBeInstanceOf(Error)
      expect(error).toMatchObject({
        message: `getinfo failed (401): ${expectedBody}`
      })
    })

    it('reports only the status when the error body is blank', async () => {
      mockedFetch.mockResolvedValue(fakeResponse(502, '   '))

      await expect(pairLndRestNode('lndconnect://x')).rejects.toThrow(
        /^getinfo failed \(502\)$/
      )
    })

    it('rejects a getinfo body without node info', async () => {
      mockedFetch.mockResolvedValue(fakeResponse(200, '{}'))

      await expect(pairLndRestNode('lndconnect://x')).rejects.toThrow(
        /^getinfo failed \(200\)$/
      )
    })
  })
})
