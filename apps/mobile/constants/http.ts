export const HTTP_STATUS = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  OK: 200,
  UNAUTHORIZED: 401
} as const

// First status code past the 2xx success range.
export const HTTP_SUCCESS_RANGE_END = 300
