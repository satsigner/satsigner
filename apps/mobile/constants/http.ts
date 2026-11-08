export const HTTP_STATUS = {
  BAD_GATEWAY: 502,
  FORBIDDEN: 403,
  GATEWAY_TIMEOUT: 504,
  NOT_FOUND: 404,
  OK: 200,
  SERVICE_UNAVAILABLE: 503,
  UNAUTHORIZED: 401
} as const

// First status code past the 2xx success range.
export const HTTP_SUCCESS_RANGE_END = 300
