export function shuffle<T>(array: T[]): T[] {
  const result = [...array]

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

export function range(end: number, start = 0) {
  const result = []
  for (let i = start; i < end; i += 1) {
    result.push(i)
  }
  return result
}
