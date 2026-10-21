function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

export { toError }
