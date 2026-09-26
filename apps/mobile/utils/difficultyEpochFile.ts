import z from 'zod'

/**
 * One block row of a pvxg.net difficulty epoch file: single-key objects in a
 * fixed order. Extra trailing entries are ignored.
 */
const DifficultyEpochBlockSchema = z.tuple(
  [
    z.object({ height: z.number() }),
    z.object({ time: z.number() }),
    z.object({ nTx: z.number() }),
    z.object({ chainwork: z.string() }),
    z.object({ nonce: z.number() }),
    z.object({ size: z.number() }),
    z.object({ weight: z.number() }),
    z.object({ block_in_cycle: z.number() }),
    z.object({ time_difference: z.number() })
  ],
  z.unknown()
)

/**
 * Validates a pvxg.net difficulty epoch file, whose first entry holds the
 * epoch's block rows. Throws when the file does not match.
 */
const parseDifficultyEpochFile = z.tuple(
  [z.array(DifficultyEpochBlockSchema)],
  z.unknown()
).parse

export { parseDifficultyEpochFile }
