import { LAST_ROUTE_DENYLIST } from '@/constants/navigation'
import {
  isAuthenticatedRoute,
  isRestorableRoute,
  type LastRoute,
  parseHref,
  routeFromSegments,
  type RouteOwnership,
  serializeHref
} from '@/utils/lastRoute'

const ACCOUNT_ID = 'account-1'
const ARK_ACCOUNT_ID = 'ark-1'
const ECASH_ACCOUNT_ID = 'ecash-1'
const NPUB = 'npub1identity'
const TXID = 'a'.repeat(64)

const OWNERSHIP: RouteOwnership = {
  accountIds: [ACCOUNT_ID],
  arkAccountIds: [ARK_ACCOUNT_ID],
  ecashAccountIds: [ECASH_ACCOUNT_ID],
  identityNpubs: [NPUB]
}

const SAMPLE_PARAMS: Record<string, string> = {
  addr: 'bc1qaddress',
  id: ACCOUNT_ID,
  npub: NPUB,
  txid: TXID
}

function route(pathname: string, params: Record<string, string> = {}) {
  return { params, pathname }
}

function paramsFor(pathname: string) {
  const params: Record<string, string> = {}
  for (const [, name] of pathname.matchAll(/\[(\w+)\]/g)) {
    params[name] = SAMPLE_PARAMS[name]
  }
  return params
}

describe('routeFromSegments', () => {
  it('strips route groups and keeps string params only', () => {
    expect(
      routeFromSegments(
        [
          '(authenticated)',
          '(tabs)',
          '(signer,explorer,converter)',
          'signer',
          'bitcoin',
          'account',
          '[id]'
        ],
        { id: ACCOUNT_ID, list: ['a', 'b'], missing: undefined }
      )
    ).toStrictEqual(route('/signer/bitcoin/account/[id]', { id: ACCOUNT_ID }))
  })

  it('maps the home route to /', () => {
    expect(routeFromSegments(['(authenticated)', '(tabs)'], {}).pathname).toBe(
      '/'
    )
  })
})

describe('isAuthenticatedRoute', () => {
  it('accepts only routes inside the authenticated group', () => {
    expect(isAuthenticatedRoute(['(authenticated)', 'settings'])).toBe(true)
    expect(isAuthenticatedRoute(['unlock'])).toBe(false)
    expect(isAuthenticatedRoute([])).toBe(false)
  })
})

describe('serializeHref / parseHref', () => {
  it('round-trips a route', () => {
    const original: LastRoute = route(
      '/signer/bitcoin/account/[id]/transaction/[txid]',
      { id: ACCOUNT_ID, tab: 'details', txid: TXID }
    )
    expect(parseHref(serializeHref(original))).toStrictEqual(original)
  })

  it.each([
    ['null', null],
    ['empty', ''],
    ['not json', '{not json'],
    ['a json string', '"/settings"'],
    ['an array', '[]'],
    ['missing params', '{"pathname":"/settings"}'],
    ['non-string pathname', '{"pathname":1,"params":{}}'],
    ['non-string param', '{"pathname":"/settings","params":{"a":1}}'],
    [
      'an oversized param',
      serializeHref(route('/settings', { a: 'x'.repeat(5000) }))
    ],
    ['an oversized pathname', serializeHref(route(`/${'a'.repeat(1000)}`))]
  ])('returns null for %s', (_label, raw) => {
    expect(parseHref(raw)).toBeNull()
  })
})

describe('isRestorableRoute', () => {
  it.each([
    route('/settings/security'),
    route('/explorer/transaction/[txid]', { txid: TXID }),
    route('/signer/bitcoin/account/[id]', { id: ACCOUNT_ID }),
    route('/signer/bitcoin/account/[id]/transaction/[txid]', {
      id: ACCOUNT_ID,
      txid: TXID
    }),
    route('/signer/ark/account/[id]', { id: ARK_ACCOUNT_ID }),
    route('/signer/ecash/account/[id]', { id: ECASH_ACCOUNT_ID }),
    route('/signer/nostr/account/[npub]/chat/[peer]', {
      npub: NPUB,
      peer: 'npub1peer'
    })
  ])('restores $pathname', (candidate) => {
    expect(isRestorableRoute(candidate, OWNERSHIP)).toBe(true)
  })

  it('does not restore home, where unlock lands anyway', () => {
    expect(isRestorableRoute(route('/'), OWNERSHIP)).toBe(false)
  })

  it.each(LAST_ROUTE_DENYLIST)(
    'rejects %s and the routes below it',
    (denied) => {
      const params = paramsFor(denied)
      expect(isRestorableRoute(route(denied, params), OWNERSHIP)).toBe(false)
      expect(
        isRestorableRoute(route(`${denied}/nested`, params), OWNERSHIP)
      ).toBe(false)
    }
  )

  it('does not treat a shared prefix as a denylisted route', () => {
    expect(isRestorableRoute(route('/unlocked'), OWNERSHIP)).toBe(true)
  })

  it.each([
    ['bitcoin account', '/signer/bitcoin/account/[id]', { id: 'gone' }],
    ['ark account', '/signer/ark/account/[id]', { id: ACCOUNT_ID }],
    ['ecash account', '/signer/ecash/account/[id]', { id: ACCOUNT_ID }],
    ['nostr identity', '/signer/nostr/account/[npub]', { npub: 'npub1gone' }],
    [
      'account behind a nested screen',
      '/signer/bitcoin/account/[id]/receive',
      { id: 'gone' }
    ]
  ])('rejects a missing %s', (_label, pathname, params) => {
    expect(isRestorableRoute(route(pathname, params), OWNERSHIP)).toBe(false)
  })

  it('rejects a dynamic segment without its param', () => {
    expect(
      isRestorableRoute(route('/explorer/transaction/[txid]'), OWNERSHIP)
    ).toBe(false)
    expect(
      isRestorableRoute(
        route('/explorer/transaction/[txid]', { txid: '' }),
        OWNERSHIP
      )
    ).toBe(false)
  })

  it.each([
    'https://evil.example/settings',
    'satsigner://settings',
    'mailto:someone@example.com',
    '//evil.example/settings',
    '/settings//security',
    'settings',
    '',
    '/settings?x=1',
    '/settings#hash',
    '/../settings',
    '/settings\\evil'
  ])('rejects the non-internal path %s', (pathname) => {
    expect(isRestorableRoute(route(pathname), OWNERSHIP)).toBe(false)
  })
})
