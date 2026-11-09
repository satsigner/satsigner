import { z } from 'zod'

import {
  ARK_ACCOUNT_ROUTE,
  AUTHENTICATED_ROUTE_GROUP,
  BITCOIN_ACCOUNT_ROUTE,
  ECASH_ACCOUNT_ROUTE,
  HOME_ROUTE,
  LAST_ROUTE_DENYLIST,
  LAST_ROUTE_MAX_PARAM_COUNT,
  LAST_ROUTE_MAX_PARAM_LENGTH,
  LAST_ROUTE_MAX_PATHNAME_LENGTH,
  NOSTR_IDENTITY_ROUTE
} from '@/constants/navigation'

const INTERNAL_PATHNAME = /^\/[\w\-[\]/]*$/
const DYNAMIC_SEGMENT = /^\[(\w+)\]$/
const GROUP_SEGMENT = /^\(.*\)$/

const LastRouteSchema = z.object({
  params: z
    .record(z.string(), z.string().max(LAST_ROUTE_MAX_PARAM_LENGTH))
    .refine(
      (params) => Object.keys(params).length <= LAST_ROUTE_MAX_PARAM_COUNT
    ),
  pathname: z.string().max(LAST_ROUTE_MAX_PATHNAME_LENGTH)
})

type LastRoute = z.infer<typeof LastRouteSchema>

type RouteOwnership = {
  accountIds: string[]
  arkAccountIds: string[]
  ecashAccountIds: string[]
  identityNpubs: string[]
}

type SearchParams = Record<string, string | string[] | undefined>

const OWNERSHIP_RULES: {
  route: string
  param: string
  knownValues: (ownership: RouteOwnership) => string[]
}[] = [
  {
    knownValues: (ownership) => ownership.accountIds,
    param: 'id',
    route: BITCOIN_ACCOUNT_ROUTE
  },
  {
    knownValues: (ownership) => ownership.arkAccountIds,
    param: 'id',
    route: ARK_ACCOUNT_ROUTE
  },
  {
    knownValues: (ownership) => ownership.ecashAccountIds,
    param: 'id',
    route: ECASH_ACCOUNT_ROUTE
  },
  {
    knownValues: (ownership) => ownership.identityNpubs,
    param: 'npub',
    route: NOSTR_IDENTITY_ROUTE
  }
]

function isAuthenticatedRoute(segments: readonly string[]) {
  return segments[0] === AUTHENTICATED_ROUTE_GROUP
}

/** Route template (route groups stripped) plus the string search params. */
function routeFromSegments(
  segments: readonly string[],
  searchParams: SearchParams
): LastRoute {
  const pathname = `/${segments
    .filter((segment) => !GROUP_SEGMENT.test(segment))
    .join('/')}`
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') {
      params[key] = value
    }
  }
  return { params, pathname }
}

function serializeHref(route: LastRoute) {
  return JSON.stringify(route)
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function parseHref(raw: string | null): LastRoute | null {
  if (!raw) {
    return null
  }
  const result = LastRouteSchema.safeParse(parseJson(raw))
  return result.success ? result.data : null
}

function isUnderRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function isInternalPathname(pathname: string) {
  return INTERNAL_PATHNAME.test(pathname) && !pathname.includes('//')
}

function hasEveryDynamicParam(route: LastRoute) {
  return route.pathname.split('/').every((segment) => {
    const match = DYNAMIC_SEGMENT.exec(segment)
    return !match || Boolean(route.params[match[1]])
  })
}

function isOwnedRoute(route: LastRoute, ownership: RouteOwnership) {
  return OWNERSHIP_RULES.every(
    ({ route: ownedRoute, param, knownValues }) =>
      !isUnderRoute(route.pathname, ownedRoute) ||
      knownValues(ownership).includes(route.params[param])
  )
}

function isRestorableRoute(route: LastRoute, ownership: RouteOwnership) {
  if (!isInternalPathname(route.pathname) || route.pathname === HOME_ROUTE) {
    return false
  }
  if (
    LAST_ROUTE_DENYLIST.some((denied) => isUnderRoute(route.pathname, denied))
  ) {
    return false
  }
  return hasEveryDynamicParam(route) && isOwnedRoute(route, ownership)
}

export {
  isAuthenticatedRoute,
  isRestorableRoute,
  type LastRoute,
  parseHref,
  routeFromSegments,
  type RouteOwnership,
  serializeHref
}
