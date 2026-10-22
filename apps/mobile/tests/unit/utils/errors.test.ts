import {
  AppError,
  HttpStatusError,
  NostrNoRelaysError,
  RpcError,
  RequestTimeoutError
} from '@/utils/errors'

describe('error hierarchy', () => {
  it('keeps subclasses distinguishable with instanceof', () => {
    const error = new HttpStatusError(404, 'not found')
    expect(error).toBeInstanceOf(HttpStatusError)
    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(RequestTimeoutError)
    expect(error.status).toBe(404)
    expect(error.name).toBe('HttpStatusError')
  })

  it('carries the JSON-RPC error code', () => {
    const error = new RpcError(-4, 'Wallet is currently rescanning')
    expect(error.code).toBe(-4)
    expect(error.message).toBe('RPC error -4: Wallet is currently rescanning')
  })

  it('names nostr relay failures', () => {
    expect(new NostrNoRelaysError('no relays').name).toBe('NostrNoRelaysError')
  })
})
