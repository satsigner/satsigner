/**
 * Test script: verify a descriptor can be imported into Bitcoin Core and
 * that wallet transactions are retrievable.
 *
 * Usage:
 *   node apps/mobile/scripts/test-rpc-descriptor.mjs
 *
 * Edit the CONFIG block below before running.
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
const NODE_URL = 'http://192.168.68.103:8332'
const USERNAME = 'bitcoin'
const PASSWORD = 'h-JeCaG2JG_FrDTo'

// The descriptor to test (can be multi-path <0;1> or a single /0/* descriptor)
const DESCRIPTOR =
  'wpkh([b2ac127d/84h/0h/0h]xpub6C55j3PTgN6H8bWHxurWnoSMiQLjGaZgTewGzSLNMWMx4xf3YLDMzVvCvcybnscwhf2JdjG1yQe1BUVhiB84465xncxKtcrbv2khVAJmt6y/<0;1>/*)#x53zj6h2'

// Wallet name to create on the node (will be re-used on subsequent runs)
const WALLET_NAME = 'satsigner-test-b2ac127d'

// Unix timestamp for the wallet birthday (start of historical rescan).
// 'now'        → no history, only sees new txs going forward (fastest for testing)
// 1700000000   → Nov 2023 (≈ block 818000), ~30 min rescan on a fast node
// 1640000000   → Jan 2022 (≈ block 718000), ~40 min rescan
// 0            → genesis — DO NOT USE (takes ~24+ hours)
const BIRTHDAY_TIMESTAMP = 1700000000 // change to match your wallet's age

// Gap limit (number of addresses beyond last used to scan)
const GAP_LIMIT = 200
// ─────────────────────────────────────────────────────────────────────────────

const AUTH = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}`

async function rpcCall(url, method, params = []) {
  const res = await fetch(url, {
    body: JSON.stringify({ id: method, jsonrpc: '1.0', method, params }),
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    method: 'POST'
  })
  const json = await res.json()
  if (json.error) {
    throw new Error(
      `RPC ${method}: ${json.error.message} (code ${json.error.code})`
    )
  }
  return json.result
}

const nodeCall = (method, params) => rpcCall(NODE_URL, method, params)
const walletUrl = `${NODE_URL}/wallet/${encodeURIComponent(WALLET_NAME)}`
const walletCall = (method, params) => rpcCall(walletUrl, method, params)

function sep(label) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${label}`)
  console.log('─'.repeat(60))
}

async function run() {
  // ── 1. Basic connectivity ───────────────────────────────────────────────
  sep('1 / Connection test')
  const chainInfo = await nodeCall('getblockchaininfo')
  console.log(`  chain:   ${chainInfo.chain}`)
  console.log(`  blocks:  ${chainInfo.blocks}`)
  console.log(
    `  synced:  ${(chainInfo.verificationprogress * 100).toFixed(2)}%`
  )

  // ── 2. Validate descriptor ──────────────────────────────────────────────
  sep('2 / getdescriptorinfo')

  // Expand <0;1> multi-path syntax into separate /0/* and /1/* descriptors.
  // getdescriptorinfo does not accept <0;1> notation even in Core 28.
  function splitMultiPath(desc) {
    if (!desc.includes('<0;1>')) {
      return [desc, null]
    }
    const bare = desc.replace(/#[^#]*$/, '') // strip existing checksum
    const ext = bare.replace('/<0;1>/*', '/0/*')
    const int = bare.replace('/<0;1>/*', '/1/*')
    return [ext, int]
  }

  const [rawExt, rawInt] = splitMultiPath(DESCRIPTOR)
  const isMultiPath = rawInt !== null

  console.log(`  multi-path: ${isMultiPath}`)
  console.log(`  raw ext:    ${rawExt}`)
  if (isMultiPath) {
    console.log(`  raw int:    ${rawInt}`)
  }

  const extNormalized = await nodeCall('getdescriptorinfo', [rawExt]).then(
    (r) => {
      console.log(`  ext normalized: ${r.descriptor}  solvable=${r.issolvable}`)
      return r.descriptor
    }
  )
  const intNormalized = isMultiPath
    ? await nodeCall('getdescriptorinfo', [rawInt]).then((r) => {
        console.log(
          `  int normalized: ${r.descriptor}  solvable=${r.issolvable}`
        )
        return r.descriptor
      })
    : null

  // ── 3. Ensure wallet ────────────────────────────────────────────────────
  sep('3 / Ensure wallet exists')
  const loaded = await nodeCall('listwallets')
  console.log(`  currently loaded: ${JSON.stringify(loaded)}`)

  if (loaded.includes(WALLET_NAME)) {
    console.log(`  ✓ wallet already loaded: ${WALLET_NAME}`)
  } else {
    // try to load from disk first
    let created = false
    try {
      await nodeCall('loadwallet', [WALLET_NAME])
      console.log(`  ✓ loaded from disk: ${WALLET_NAME}`)
    } catch (error) {
      console.log(`  not on disk (${error.message}) — creating…`)
      const result = await nodeCall('createwallet', [
        WALLET_NAME,
        true, // disable_private_keys
        true, // blank
        '', // passphrase
        false, // avoid_reuse
        true, // descriptors
        true // load_on_startup
      ])
      console.log(
        `  ✓ created: ${result.name}${result.warning ? '  ⚠ ' + result.warning : ''}`
      )
      created = true
    }

    if (!created) {
      // Freshly loaded — check if it has descriptors already
    }
  }

  // ── 4. Wallet info (check if already imported / scanning) ───────────────
  sep('4 / getwalletinfo')
  let walletInfo = await walletCall('getwalletinfo')
  console.log(`  descriptors:   ${walletInfo.descriptors}`)
  console.log(`  balance:       ${walletInfo.balance} BTC`)
  console.log(`  scanning:      ${JSON.stringify(walletInfo.scanning)}`)

  // ── 5. Import descriptor (or skip if already imported / scanning) ────────
  sep('5 / importdescriptors')

  // Check if descriptors already exist (listdescriptors is Core 21+)
  let alreadyImported = false
  try {
    const existing = await walletCall('listdescriptors')
    alreadyImported = existing.descriptors?.length > 0
    if (alreadyImported) {
      console.log(
        `  ✓ descriptors already imported (${existing.descriptors.length} found) — skipping`
      )
      for (const d of existing.descriptors) {
        console.log(
          `    ${d.desc.slice(0, 80)}… active=${d.active} internal=${d.internal}`
        )
      }
    }
  } catch {
    // listdescriptors not available on this version
  }

  // If currently scanning from a prior run, skip import and just poll.
  const isScanningNow = walletInfo.scanning !== false
  if (isScanningNow) {
    const pct = (walletInfo.scanning.progress * 100).toFixed(1)
    console.log(
      `  wallet is already scanning (${pct}%) — skipping import, going straight to poll`
    )
    alreadyImported = true
  }

  if (!alreadyImported) {
    const importRequests = intNormalized
      ? [
          {
            active: true,
            desc: extNormalized,
            internal: false,
            range: [0, GAP_LIMIT],
            timestamp: 'now'
          },
          {
            active: true,
            desc: intNormalized,
            internal: true,
            range: [0, GAP_LIMIT],
            timestamp: 'now'
          }
        ]
      : [
          {
            active: true,
            desc: extNormalized,
            range: [0, GAP_LIMIT],
            timestamp: 'now'
          }
        ]

    const importResults = await walletCall('importdescriptors', [
      importRequests
    ])
    console.log(`  result: ${JSON.stringify(importResults, null, 2)}`)
    for (const r of importResults) {
      if (!r.success) {
        console.log(`  ✗ failed: ${r.error?.message ?? 'unknown'}`)
      } else {
        console.log(`  ✓ imported`)
        if (r.warnings?.length) {
          console.log(`  ⚠ ${r.warnings.join(', ')}`)
        }
      }
    }
  }

  // ── 5b. Trigger historical rescan ───────────────────────────────────────
  // importdescriptors with timestamp="now" registers the wallet instantly but
  // won't see historical transactions. rescanblockchain covers the history.
  // We fire it with a short fetch timeout and fall through to polling if it
  // blocks longer than expected.
  sep('5b / rescanblockchain (historical)')

  // Convert BIRTHDAY_TIMESTAMP to a block height approximation.
  // For 'now' we scan 0 extra blocks; for a Unix timestamp we estimate height.
  let startHeight = chainInfo.blocks // default: no rescan
  if (BIRTHDAY_TIMESTAMP !== 'now' && typeof BIRTHDAY_TIMESTAMP === 'number') {
    const GENESIS_TIME = 1231006505 // Bitcoin genesis block timestamp
    const MS_PER_BLOCK = 10 * 60 * 1000
    const ageMs = Math.max(0, BIRTHDAY_TIMESTAMP * 1000 - GENESIS_TIME * 1000)
    startHeight = Math.max(0, Math.round(ageMs / MS_PER_BLOCK) - 2016)
    console.log(
      `  birthday=${new Date(BIRTHDAY_TIMESTAMP * 1000).toISOString()}  startHeight≈${startHeight}`
    )
  } else {
    console.log(
      `  timestamp="now" — skipping historical rescan (wallet will only see new txs)`
    )
  }

  if (startHeight < chainInfo.blocks) {
    try {
      console.log(`  calling rescanblockchain(${startHeight}) …`)
      const rescanResult = await Promise.race([
        walletCall('rescanblockchain', [startHeight]),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('timeout — rescan running in background')),
            10000
          )
        )
      ])
      console.log(`  ✓ rescan complete: ${JSON.stringify(rescanResult)}`)
    } catch (error) {
      console.log(`  ⚠ ${error.message} — will poll getwalletinfo.scanning`)
    }
  }

  // ── 6. Poll rescan progress ─────────────────────────────────────────────
  sep('6 / Poll rescan progress')
  for (let i = 0; i < 120; i++) {
    walletInfo = await walletCall('getwalletinfo')
    if (walletInfo.scanning === false) {
      console.log(`  ✓ rescan complete (or was never needed)`)
      break
    }
    const { duration, progress } = walletInfo.scanning
    const pct = (progress * 100).toFixed(1)
    process.stdout.write(`  \r  scanning… ${pct}%  (${duration}s elapsed)   `)
    await new Promise((r) => setTimeout(r, 2000))
  }
  console.log()

  // ── 7. Fetch transactions ───────────────────────────────────────────────
  sep('7 / listunspent')
  const unspent = await walletCall('listunspent', [0, 9999999])
  console.log(`  UTXOs found: ${unspent.length}`)
  for (const u of unspent.slice(0, 5)) {
    console.log(
      `    ${u.txid}:${u.vout}  ${u.amount} BTC  confs=${u.confirmations}  addr=${u.address}`
    )
  }

  sep('8 / listtransactions')
  const txs = await walletCall('listtransactions', ['*', 99999, 0, true])
  console.log(`  transactions found: ${txs.length}`)

  // Group by txid
  const txMap = new Map()
  for (const entry of txs) {
    const e = txMap.get(entry.txid) ?? {
      blockheight: entry.blockheight,
      received: 0,
      sent: 0,
      time: entry.time,
      txid: entry.txid
    }
    if (entry.category === 'receive') {
      e.received += entry.amount
    } else if (entry.category === 'send') {
      e.sent += Math.abs(entry.amount)
    }
    txMap.set(entry.txid, e)
  }

  const unique = [...txMap.values()].toSorted(
    (a, b) => (b.blockheight ?? Infinity) - (a.blockheight ?? Infinity)
  )
  console.log(`  unique txids:       ${unique.length}`)
  for (const tx of unique.slice(0, 10)) {
    const dir = tx.sent > 0 ? '↑ send' : '↓ recv'
    const amt = tx.sent > 0 ? tx.sent.toFixed(8) : tx.received.toFixed(8)
    const blk = tx.blockheight ?? 'mempool'
    console.log(
      `    ${dir}  ${amt} BTC  block=${blk}  txid=${tx.txid.slice(0, 16)}…`
    )
  }
  if (unique.length > 10) {
    console.log(`    … and ${unique.length - 10} more`)
  }

  // ── 9. Sample first few receive addresses ──────────────────────────────
  sep('9 / getaddressesbylabel (first 5 receive addresses)')
  try {
    const addrInfo = await walletCall('listdescriptors')
    const externalDesc = addrInfo.descriptors?.find((d) => !d.internal)
    console.log(`  active external descriptor: ${externalDesc?.desc ?? 'n/a'}`)
  } catch {
    // older nodes don't have listdescriptors
  }

  sep('Done')
  console.log(`  wallet: ${WALLET_NAME}`)
  console.log(`  txs:    ${unique.length}`)
  console.log(`  utxos:  ${unspent.length}`)
}

run().catch((error) => {
  console.error('\n✗ Fatal error:', error.message)
  process.exit(1)
})
