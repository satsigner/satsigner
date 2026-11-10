const ELLIPSIS = '…'

function isNonEmptyString(value: string | null | undefined): value is string {
  return value !== undefined && value !== null && value !== ''
}

/** Collapses whitespace to one line and cuts it at `maxLength` with an ellipsis. */
function toSingleLinePreview(text: string, maxLength: number): string {
  const singleLine = text.replaceAll(/\s+/g, ' ').trim()
  if (singleLine.length <= maxLength) {
    return singleLine
  }
  return `${singleLine.slice(0, maxLength)}${ELLIPSIS}`
}

export { isNonEmptyString, toSingleLinePreview }
