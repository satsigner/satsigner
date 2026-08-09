import { randomIv, randomKey, randomUuid } from '@/utils/crypto'

// Sized to run in ~1s on-device while still catching weak-RNG classes:
// any collision among 50k UUIDs (122 random bits each) or 20k IVs (128 bits)
// indicates a broken CSPRNG — expected collisions are ~2^-98 and ~2^-103.
// diagnostics.checkEntropyCollisions runs one window; the soak loops them.
export const ENTROPY_UUID_SAMPLES = 50_000
export const ENTROPY_IV_SAMPLES = 20_000

// Small enough to keep several stat updates per second; every chunk yields
// to the JS thread so the app stays responsive during the soak.
const CHUNK_SIZE = 5_000

const UUID_FORMAT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const IV_FORMAT = /^[0-9a-f]{32}$/
const KEY_FORMAT = /^[0-9a-f]{64}$/

export type EntropySoakStats = {
  windows: number
  uuidSamples: number
  ivSamples: number
  elapsedMs: number
  samplesPerSecond: number
  lastWindowMs: number | null
  minWindowMs: number | null
  maxWindowMs: number | null
}

export type EntropySoakResult =
  | { kind: 'stopped'; stats: EntropySoakStats }
  | {
      kind: 'collision'
      source: 'uuid' | 'iv'
      window: number
      duplicates: number
      stats: EntropySoakStats
    }
  | { kind: 'malformed'; detail: string; stats: EntropySoakStats }

type SourceOutcome =
  | { outcome: 'ok' }
  | { outcome: 'stopped' }
  | { outcome: 'collision'; duplicates: number }
  | { outcome: 'malformed' }

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/**
 * Loops the entropy collision check (see diagnostics.checkEntropyCollisions)
 * in bounded windows until `signal` aborts. Memory stays bounded to a single
 * window of samples while cumulative counters and per-window timings keep
 * climbing — so this catches a catastrophically broken CSPRNG (constant,
 * counter-based, or badly seeded output — Trust-Wallet-2023 class) and RNG
 * throughput/liveness regressions, but not subtle bias: a healthy 122-bit
 * RNG needs ~2^61 samples for a birthday collision, which no phone reaches.
 * Deep statistical analysis belongs to the CI entropy audit
 * (tests/entropy-audit).
 */
export async function runEntropySoak({
  signal,
  onStats
}: {
  signal: AbortSignal
  onStats?: (stats: EntropySoakStats) => void
}): Promise<EntropySoakResult> {
  const startedAt = Date.now()
  let windows = 0
  let uuidSamples = 0
  let ivSamples = 0
  let lastWindowMs: number | null = null
  let minWindowMs: number | null = null
  let maxWindowMs: number | null = null

  function snapshot(): EntropySoakStats {
    const elapsedMs = Date.now() - startedAt
    const total = uuidSamples + ivSamples
    return {
      windows,
      uuidSamples,
      ivSamples,
      elapsedMs,
      samplesPerSecond: elapsedMs > 0 ? (total / elapsedMs) * 1000 : 0,
      lastWindowMs,
      minWindowMs,
      maxWindowMs
    }
  }

  async function sampleSource(
    target: number,
    produce: () => string,
    format: RegExp,
    onChunk: (count: number) => void
  ): Promise<SourceOutcome> {
    const seen = new Set<string>()
    let produced = 0
    while (produced < target) {
      if (signal.aborted) {
        return { outcome: 'stopped' }
      }
      const count = Math.min(CHUNK_SIZE, target - produced)
      let lastSample = ''
      for (let i = 0; i < count; i += 1) {
        lastSample = produce()
        seen.add(lastSample)
      }
      // Spot-check format once per chunk: a constant or truncated RNG often
      // still "looks random" until you validate the shape.
      if (!format.test(lastSample)) {
        return { outcome: 'malformed' }
      }
      produced += count
      onChunk(count)
      onStats?.(snapshot())
      await yieldToUi()
    }
    if (seen.size !== target) {
      return { outcome: 'collision', duplicates: target - seen.size }
    }
    return { outcome: 'ok' }
  }

  const sources = [
    {
      source: 'uuid' as const,
      fnName: 'randomUuid',
      target: ENTROPY_UUID_SAMPLES,
      produce: randomUuid,
      format: UUID_FORMAT,
      onChunk: (count: number) => {
        uuidSamples += count
      }
    },
    {
      source: 'iv' as const,
      fnName: 'randomIv',
      target: ENTROPY_IV_SAMPLES,
      produce: randomIv,
      format: IV_FORMAT,
      onChunk: (count: number) => {
        ivSamples += count
      }
    }
  ]

  while (!signal.aborted) {
    const windowStart = Date.now()

    for (const { source, fnName, target, produce, format, onChunk } of sources) {
      const outcome = await sampleSource(target, produce, format, onChunk)
      if (outcome.outcome === 'collision') {
        return {
          kind: 'collision',
          source,
          window: windows + 1,
          duplicates: outcome.duplicates,
          stats: snapshot()
        }
      }
      if (outcome.outcome === 'malformed') {
        return { kind: 'malformed', detail: fnName, stats: snapshot() }
      }
      if (outcome.outcome === 'stopped') {
        return { kind: 'stopped', stats: snapshot() }
      }
    }

    const key = await randomKey(32)
    if (!KEY_FORMAT.test(key)) {
      return { kind: 'malformed', detail: 'randomKey', stats: snapshot() }
    }

    windows += 1
    const windowMs = Date.now() - windowStart
    lastWindowMs = windowMs
    minWindowMs =
      minWindowMs === null ? windowMs : Math.min(minWindowMs, windowMs)
    maxWindowMs =
      maxWindowMs === null ? windowMs : Math.max(maxWindowMs, windowMs)
    onStats?.(snapshot())
  }

  return { kind: 'stopped', stats: snapshot() }
}
