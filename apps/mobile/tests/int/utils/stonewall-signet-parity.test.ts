import {
  matchUtxoToRef,
  outpointKey,
  SPARROW_STONEWALL_FEE,
  SPARROW_STONEWALL_SELECTION,
  SPARROW_UTXO_CATALOG,
  toOutpoint,
  type SparrowUtxoRef
} from '@/tests/int/utils/signetStonewallFixture'
/**
 * STONEWALL parity vs Sparrow on Signet.
 *
 * Both wallets should use mempool.space Signet:
 * - SatSigner: Settings → Network → Signet → Mempool (Esplora)
 *   https://mempool.space/signet/api
 * - Sparrow: Settings → Server → Public server → Mempool Signet (Electrum)
 *   ssl://mempool.space:60602 — then resync the wallet
 *
 * Run: cd apps/mobile && npx jest tests/int/utils/stonewall-signet-parity.test.ts
 */
import {
  fetchWalletSnapshot,
  SIGNET_STONEWALL_AMOUNT,
  SIGNET_STONEWALL_FEE_RATE,
  SIGNET_STONEWALL_RECIPIENT,
  type ScannedUtxo
} from '@/tests/int/utils/signetStonewallWallet'
import { type Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint, selectStonewallUtxos } from '@/utils/utxo'

function formatOutpoints(outpoints: string[]) {
  return outpoints.map((outpoint) => `  ${outpoint}`).join('\n')
}

function compareCatalog(
  label: string,
  catalog: SparrowUtxoRef[],
  utxos: ScannedUtxo[]
) {
  const matched: string[] = []
  const missing: string[] = []
  const extras: string[] = []

  for (const ref of catalog) {
    const hit = utxos.find((utxo) => matchUtxoToRef(utxo, ref))
    if (hit) {
      matched.push(`${toOutpoint(ref)} (${hit.value} sats)`)
    } else {
      missing.push(`${toOutpoint(ref)} (${ref.value} sats)`)
    }
  }

  for (const utxo of utxos) {
    const inCatalog = catalog.some((ref) => matchUtxoToRef(utxo, ref))
    if (!inCatalog) {
      extras.push(`${getUtxoOutpoint(utxo)} (${utxo.value} sats)`)
    }
  }

  console.log(`\n--- ${label} ---`)
  console.log(`Matched ${matched.length}/${catalog.length}`)
  if (matched.length > 0) {
    console.log('Matched:')
    console.log(formatOutpoints(matched))
  }
  if (missing.length > 0) {
    console.log('Missing from scan (in Sparrow, not on esplora):')
    console.log(formatOutpoints(missing))
  }
  if (extras.length > 0) {
    console.log('Extra in scan (on esplora, not in Sparrow UI):')
    console.log(formatOutpoints(extras))
  }

  return { extras, matched, missing }
}

function runStonewall(
  utxos: Utxo[],
  addresses: SignetStonewallWalletSnapshot['addresses'],
  excluded: Utxo[] = []
) {
  const excludedSet = new Set(excluded.map(getUtxoOutpoint))
  const pool = utxos.filter((utxo) => !excludedSet.has(getUtxoOutpoint(utxo)))

  return selectStonewallUtxos(
    pool,
    SIGNET_STONEWALL_AMOUNT,
    SIGNET_STONEWALL_FEE_RATE,
    {
      addresses,
      changeScriptType: 'P2WPKH',
      outputs: [
        {
          amount: SIGNET_STONEWALL_AMOUNT,
          label: 'Test utxos selection',
          to: SIGNET_STONEWALL_RECIPIENT
        }
      ],
      recipientScriptType: 'P2WPKH'
    }
  )
}

function compareSelection(
  label: string,
  selected: Utxo[],
  expected: SparrowUtxoRef[],
  fee: number
) {
  const selectedOutpoints = selected.map(getUtxoOutpoint)
  const resolvedExpected = expected.flatMap((ref) => {
    const hit = selected.find((utxo) => matchUtxoToRef(utxo, ref))
    if (hit) {
      return [getUtxoOutpoint(hit)]
    }
    return ref.txid
      ? [`${ref.txid}:${ref.vout}`]
      : [`${ref.prefix}…:${ref.vout}`]
  })

  const overlap = selectedOutpoints.filter((outpoint) =>
    resolvedExpected.some((expectedOutpoint) => outpoint === expectedOutpoint)
  )

  console.log(`\n--- ${label} ---`)
  console.log(
    `SatSigner (${selectedOutpoints.length} inputs, fee ${fee} sats):`
  )
  console.log(formatOutpoints(selectedOutpoints))
  console.log(
    `Sparrow expected (${expected.length} inputs, fee ${SPARROW_STONEWALL_FEE} sats):`
  )
  console.log(formatOutpoints(resolvedExpected))
  console.log(`Overlap: ${overlap.length}/${expected.length}`)

  return { overlap, selectedOutpoints }
}

type SignetStonewallWalletSnapshot = Awaited<
  ReturnType<typeof fetchWalletSnapshot>
>

describe('signet stonewall sparrow parity', () => {
  jest.setTimeout(180_000)

  it('compares wallet UTXOs and STONEWALL selection against Sparrow', async () => {
    const wallet = await fetchWalletSnapshot()

    expect(wallet.utxos.length).toBeGreaterThan(0)

    const catalogCompare = compareCatalog(
      'UTXO catalog vs esplora scan',
      SPARROW_UTXO_CATALOG,
      wallet.utxos
    )

    expect(catalogCompare.matched.length).toBeGreaterThan(0)

    // Full-pool selection (what SatSigner auto-select does today).
    const fullPool = runStonewall(wallet.utxos, wallet.addresses)
    expect(fullPool.error).toBeUndefined()
    compareSelection(
      'Selection — full pool',
      fullPool.inputs,
      SPARROW_STONEWALL_SELECTION,
      fullPool.fee
    )

    // Sparrow often picks small UTXOs; exclude the three large ones Sparrow
    // did not use (present on esplora but absent from Sparrow's UI list).
    const largePrefixes = ['5d13cf36', '98981d2d']
    const withoutLarge = wallet.utxos.filter(
      (utxo) => !largePrefixes.some((prefix) => utxo.txid.startsWith(prefix))
    )
    const smallPool = runStonewall(withoutLarge, wallet.addresses)
    if (!smallPool.error) {
      compareSelection(
        'Selection — excluding large esplora-only UTXOs',
        smallPool.inputs,
        SPARROW_STONEWALL_SELECTION,
        smallPool.fee
      )
    }

    // Simulate removing one input (re-run selector on reduced pool).
    expect(fullPool.inputs.length).toBeGreaterThan(0)
    const [removed] = fullPool.inputs
    const afterRemoval = runStonewall(wallet.utxos, wallet.addresses, [removed])
    expect(afterRemoval.error).toBeUndefined()
    console.log('\n--- Selection — after removing first auto-pick ---')
    console.log(`Removed: ${getUtxoOutpoint(removed)}`)
    console.log(formatOutpoints(afterRemoval.inputs.map(getUtxoOutpoint)))
    console.log(`Fee: ${afterRemoval.fee} sats`)
    expect(afterRemoval.inputs.map(getUtxoOutpoint)).not.toContain(
      getUtxoOutpoint(removed)
    )

    // Build a pool from catalog entries we can resolve on esplora (intersection).
    const intersection = SPARROW_UTXO_CATALOG.flatMap((ref) => {
      const hit = wallet.utxos.find((utxo) => matchUtxoToRef(utxo, ref))
      return hit ? [hit] : []
    })
    if (intersection.length >= 4) {
      const intersectionResult = runStonewall(intersection, wallet.addresses)
      if (!intersectionResult.error) {
        compareSelection(
          `Selection — Sparrow∩esplora pool (${intersection.length} UTXOs)`,
          intersectionResult.inputs,
          SPARROW_STONEWALL_SELECTION,
          intersectionResult.fee
        )
      }
    }

    console.log('\n--- Summary ---')
    console.log(`Sparrow catalog: ${SPARROW_UTXO_CATALOG.length} UTXOs`)
    console.log(`Esplora scan: ${wallet.utxos.length} UTXOs`)
    console.log(
      `Catalog keys: ${SPARROW_UTXO_CATALOG.map((ref) => outpointKey(ref.prefix, ref.vout, ref.value)).join(', ')}`
    )
    console.log('---\n')

    expect(fullPool.inputs.length).toBeGreaterThanOrEqual(2)
    expect(
      fullPool.inputs.reduce((sum, input) => sum + input.value, 0)
    ).toBeGreaterThan(SIGNET_STONEWALL_AMOUNT * 2)
  })
})
