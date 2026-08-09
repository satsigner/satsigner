// The soak runner is exercised against a fully mocked crypto module so each
// failure class (collision, malformed output) can be triggered on demand
// without relying on the real native RNG.
jest.mock('@/utils/crypto', () => ({
  randomIv: jest.fn(),
  randomKey: jest.fn(),
  randomUuid: jest.fn()
}))

import { randomIv, randomKey, randomUuid } from '@/utils/crypto'
import {
  ENTROPY_IV_SAMPLES,
  ENTROPY_UUID_SAMPLES,
  runEntropySoak
} from '@/utils/entropySoak'

const mockRandomUuid = randomUuid as jest.Mock
const mockRandomIv = randomIv as jest.Mock
const mockRandomKey = randomKey as jest.Mock

const VALID_UUID = '00000000-0000-4000-8000-000000000000'

let counter: number

beforeEach(() => {
  jest.clearAllMocks()
  counter = 0
  // Healthy defaults: unique, correctly-formatted values on every call.
  mockRandomUuid.mockImplementation(() => {
    counter += 1
    return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
  })
  mockRandomIv.mockImplementation(() => {
    counter += 1
    return counter.toString(16).padStart(32, '0')
  })
  mockRandomKey.mockResolvedValue('ab'.repeat(32))
})

describe('runEntropySoak', () => {
  it('runs windows and stops cleanly when aborted', async () => {
    const controller = new AbortController()
    let statsCalls = 0
    const result = await runEntropySoak({
      signal: controller.signal,
      onStats: (stats) => {
        statsCalls += 1
        // Abort at the end of the first full window.
        if (stats.windows >= 1) {
          controller.abort()
        }
      }
    })

    expect(result.kind).toBe('stopped')
    expect(result.stats.windows).toBe(1)
    expect(result.stats.uuidSamples).toBe(ENTROPY_UUID_SAMPLES)
    expect(result.stats.ivSamples).toBe(ENTROPY_IV_SAMPLES)
    expect(result.stats.samplesPerSecond).toBeGreaterThan(0)
    expect(result.stats.lastWindowMs).not.toBeNull()
    expect(result.stats.minWindowMs).not.toBeNull()
    expect(result.stats.maxWindowMs).not.toBeNull()
    expect(
      result.stats.minWindowMs! <= result.stats.maxWindowMs!
    ).toBe(true)
    expect(statsCalls).toBeGreaterThan(0)
  })

  it('detects a uuid collision in the first window', async () => {
    mockRandomUuid.mockReturnValue(VALID_UUID)
    const result = await runEntropySoak({
      signal: new AbortController().signal
    })

    expect(result).toMatchObject({
      kind: 'collision',
      source: 'uuid',
      window: 1,
      duplicates: ENTROPY_UUID_SAMPLES - 1
    })
  })

  it('detects an iv collision in the first window', async () => {
    mockRandomIv.mockReturnValue('cd'.repeat(16))
    const result = await runEntropySoak({
      signal: new AbortController().signal
    })

    expect(result).toMatchObject({
      kind: 'collision',
      source: 'iv',
      window: 1,
      duplicates: ENTROPY_IV_SAMPLES - 1
    })
  })

  it('flags malformed uuid output', async () => {
    mockRandomUuid.mockReturnValue('not-a-uuid')
    const result = await runEntropySoak({
      signal: new AbortController().signal
    })

    expect(result).toMatchObject({ kind: 'malformed', detail: 'randomUuid' })
  })

  it('flags malformed randomKey output after the window', async () => {
    mockRandomKey.mockResolvedValue('zz')
    const result = await runEntropySoak({
      signal: new AbortController().signal
    })

    expect(result).toMatchObject({ kind: 'malformed', detail: 'randomKey' })
    expect(result.stats.windows).toBe(0)
  })

  it('stops before producing anything when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await runEntropySoak({ signal: controller.signal })

    expect(result.kind).toBe('stopped')
    expect(result.stats.uuidSamples).toBe(0)
    expect(result.stats.ivSamples).toBe(0)
    expect(result.stats.windows).toBe(0)
  })
})
