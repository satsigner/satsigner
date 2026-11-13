import {
  EXTERNAL_LINK_BLOCKED_SCREENS,
  EXTERNAL_LINK_MAX_ENCODING_LAYERS,
  HOME_ROUTE
} from '@/constants/navigation'

type SystemPathEvent = {
  initial: boolean
  path: string
}

const BLOCKED_SCREEN_WORDS = new Set<string>(
  EXTERNAL_LINK_BLOCKED_SCREENS.map((screen) => screen.toLowerCase())
)
// URL parsing drops tabs and newlines anywhere, so they can split a word.
const URL_DROPPED_CHARACTERS = /[\t\n\r]/g
const PERCENT_ENCODED_BYTE = /%([\da-f]{2})/gi
const HEX_RADIX = 16
const NON_WORD_CHARACTERS = /[^\da-z]+/

function decodeByte(_match: string, hex: string) {
  return String.fromCharCode(Number.parseInt(hex, HEX_RADIX))
}

function decodeLayer(link: string): string {
  return link
    .replace(URL_DROPPED_CHARACTERS, '')
    .replace(PERCENT_ENCODED_BYTE, decodeByte)
}

/** The link as each decoding depth reads it, or null when it nests deeper. */
function getDecodedLayers(link: string, depth = 0): string[] | null {
  const decoded = decodeLayer(link)
  if (decoded === link) {
    return [link]
  }
  if (depth === EXTERNAL_LINK_MAX_ENCODING_LAYERS) {
    return null
  }
  const deeper = getDecodedLayers(decoded, depth + 1)
  return deeper ? [link, ...deeper] : null
}

function namesBlockedScreen(layer: string): boolean {
  return layer
    .toLowerCase()
    .split(NON_WORD_CHARACTERS)
    .some((word) => BLOCKED_SCREEN_WORDS.has(word))
}

/**
 * Matched by word across the whole link, query included: the router also
 * follows a link nested in a launcher parameter, and no casing, encoding or
 * route group may hide a blocked screen.
 */
function isBlockedExternalLink(link: string): boolean {
  const layers = getDecodedLayers(link)
  return layers === null || layers.some(namesBlockedScreen)
}

/** A blocked link opens home on launch and is ignored while the app runs. */
function redirectSystemPath({ initial, path }: SystemPathEvent) {
  if (!isBlockedExternalLink(path)) {
    return path
  }
  return initial ? HOME_ROUTE : null
}

export { isBlockedExternalLink, redirectSystemPath }
