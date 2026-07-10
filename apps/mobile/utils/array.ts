export function shuffle<T>(
  array: T[],
  random: () => number = Math.random
): T[] {
  const result = [...array]

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

/** Mirrors java.util.Collections.shuffle(list, random). */
export function shuffleWithJavaRandom<T>(
  array: T[],
  random: { nextInt(bound: number): number }
): T[] {
  const result = [...array]

  for (let i = result.length; i > 1; i -= 1) {
    const j = random.nextInt(i)
    ;[result[i - 1], result[j]] = [result[j], result[i - 1]]
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
