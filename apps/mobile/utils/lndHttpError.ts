/** LND `makeRequest` errors embed `LND API error: <status>`. */
export function isLndPermissionError(error: unknown): boolean {
  return /\b403\b|\b401\b/.test(getLndErrorMessage(error))
}

export function getLndErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
