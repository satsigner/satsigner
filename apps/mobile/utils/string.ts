function isNonEmptyString(value: string | null | undefined): value is string {
  return value !== undefined && value !== null && value !== ''
}

export { isNonEmptyString }
