const BLOCK_HEIGHT_DIGITS_REGEX = /^[0-9]+$/

export function parseBlockHeightInput(text: string, maxHeight: number) {
  if (!BLOCK_HEIGHT_DIGITS_REGEX.test(text)) {
    return null
  }
  const height = Number(text)
  if (!Number.isSafeInteger(height) || height > maxHeight) {
    return null
  }
  return height
}
