function parseHexToBytes(hex: string): number[] {
  const bytes = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16))
  }
  return bytes
}

function parseLabel(rawLabel: string) {
  const matches = rawLabel.match(/#\w[\w\d]+/g)
  if (!matches) return { label: rawLabel, tags: [] }

  const tags = matches.map((match) => match.replace('#', ''))
  const label = rawLabel.replace(/#.*/, '').trim()
  return { label, tags }
}

function parseLabelTags(label: string, tags: string[]) {
  const trimmedLabel = label.trim()
  if (tags.length === 0) return trimmedLabel
  const labelTagSeparator = label.length === 0 ? '' : ' '
  return trimmedLabel + labelTagSeparator + tags.map((t) => '#' + t).join(' ')
}

export { parseHexToBytes, parseLabel, parseLabelTags }
