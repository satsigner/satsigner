# react-native-bdk-sdk: changes for quick address checks

Status: proposed in
[Psycarlo/react-native-bdk-sdk#24](https://github.com/Psycarlo/react-native-bdk-sdk/pull/24)
(issue #23), not released yet.

Until it ships, the app runs its own quick check
(`apps/mobile/api/addressActivity.ts`, `apps/mobile/utils/quickCheck.ts`). It
asks the server only about addresses whose history can change if none is
reused: those holding a UTXO, those with an unconfirmed transaction, and the
unused ones after the last used address, up to the stop gap. When nothing
changed, the BDK sync is skipped. When something changed, BDK still checks
every revealed address, one request at a time, which is what the SDK changes
below fix. Every two weeks (`FULL_ADDRESS_CHECK_AFTER_MS`) and on "Check all
addresses", every address is checked.

## 1. Sync a chosen set of scripts

Today `ffi/src/wallet.rs` builds the request with
`wallet.start_sync_with_revealed_spks()`. Add methods that take the request
contents from the caller:

```ts
wallet.syncScriptsWithElectrum(
  client: ElectrumClient,
  request: { scripts: Script[]; outpoints: OutPoint[]; txids: string[] },
  batchSize: bigint,
  inspector?: SyncScriptInspector,
  options?: { signal?: AbortSignal }
): Promise<void>

wallet.syncScriptsWithEsplora(
  client: EsploraClient,
  request: { scripts: Script[]; outpoints: OutPoint[]; txids: string[] },
  parallelRequests: bigint,
  inspector?: SyncScriptInspector,
  options?: { signal?: AbortSignal }
): Promise<void>
```

In Rust, build the request with
`SyncRequest::builder().spks(scripts).outpoints(outpoints).txids(txids)`,
run it on the client, then call `apply_update` and `persist` like the existing
sync does. Keep the existing methods for full checks.

## 2. List revealed scripts with their position

The app needs to pick the most recent addresses per keychain, so expose:

```ts
wallet.revealedScripts(keychain: KeychainKind): { index: number; script: Script }[]
```

The other option is to accept `(keychain, index)` pairs and derive the
scripts in Rust.

## 3. Configurable batch size

Electrum syncs use batch size 1 and Esplora uses one parallel request. Every
address is a separate round trip, which is very slow over Tor. Pass
`batchSize` and `parallelRequests` through on both the full scan and sync
methods. This is the biggest speed win on its own.

## 4. Honour the AbortSignal

The wrapper drops the `signal` option, so the app calls `wallet.raw.*` in
`apps/mobile/api/bdk.ts` `scanWithServer` to cancel stalled syncs. The new
methods, and the existing ones, should forward it.

## App side once the SDK ships

1. Bump `react-native-bdk-sdk` in `apps/mobile/package.json`.
2. Create `BdkElectrumClient` with `{ batchSize }` and `BdkEsploraClient` with
   `{ parallelRequests }` in `scanWithServer` (`api/bdk.ts`). This speeds up
   every sync, full checks included.
3. When the quick check finds changes, call `syncScriptsWith*` with the same
   addresses (as keychain positions), the outpoints of unspent UTXOs and the
   txids of unconfirmed transactions, instead of `syncWith*`. Report
   `scope: 'quick'`.
4. Keep `syncWith*` and `scope: 'full'` for full checks.
