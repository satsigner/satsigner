type ScanSample = {
  at: number
  height: number
}

type ScanThroughput = {
  blocksPerSec: number | null
  etaSeconds: number | null
  pct: number
}

const SAMPLE_WINDOW_MS = 20_000
const MIN_SAMPLE_SPAN_MS = 1_000

/**
 * Derive scan throughput from successive block-height progress samples.
 * Call whenever a new height is observed while a scan is active; pass
 * `active: false` to clear accumulated samples.
 */
function createScanThroughputTracker() {
  let samples: ScanSample[] = []

  function reset() {
    samples = []
  }

  function update(
    currentHeight: number | undefined,
    tipHeight: number | undefined,
    active: boolean
  ): ScanThroughput {
    if (
      !active ||
      currentHeight === undefined ||
      tipHeight === undefined ||
      tipHeight <= 0
    ) {
      reset()
      return { blocksPerSec: null, etaSeconds: null, pct: 0 }
    }

    const pct = Math.min(100, Math.round((currentHeight / tipHeight) * 100))
    const now = Date.now()
    const last = samples.at(-1)
    if (!last || last.height !== currentHeight) {
      samples.push({ at: now, height: currentHeight })
    }

    samples = samples.filter((sample) => now - sample.at <= SAMPLE_WINDOW_MS)

    let blocksPerSec: number | null = null
    if (samples.length >= 2) {
      const [first] = samples
      const latest = samples.at(-1)!
      const elapsedSec = (latest.at - first.at) / 1000
      const deltaBlocks = latest.height - first.height
      if (elapsedSec * 1000 >= MIN_SAMPLE_SPAN_MS && deltaBlocks >= 0) {
        blocksPerSec = deltaBlocks / elapsedSec
      }
    }

    const remaining = Math.max(0, tipHeight - currentHeight)
    const etaSeconds =
      blocksPerSec !== null && blocksPerSec > 0
        ? remaining / blocksPerSec
        : null

    return { blocksPerSec, etaSeconds, pct }
  }

  return { reset, update }
}

function formatScanDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) {
    return `${total}s`
  }
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
}

function formatBlocksPerSec(rate: number): string {
  if (rate >= 100) {
    return rate.toFixed(0)
  }
  if (rate >= 10) {
    return rate.toFixed(1)
  }
  return rate.toFixed(2)
}

export {
  createScanThroughputTracker,
  formatBlocksPerSec,
  formatScanDuration,
  type ScanThroughput
}
