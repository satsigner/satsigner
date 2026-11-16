# react-native-bdk-sdk: changes for quick address checks

The app decides how many addresses a sync should check (`getSyncScope` in
`apps/mobile/utils/accountSync.ts`). Soon after a sync it only needs recent
addresses. Two weeks after the last sync (`FULL_ADDRESS_CHECK_AFTER_MS`) it
checks all of them again. react-native-bdk-sdk 0.8.0 cannot run that policy
yet: `syncWithElectrum` and `syncWithEsplora` always check every revealed
address, one request at a time. Until the SDK changes below ship, every
incremental sync is a "Full check".

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

1. Rebuild the native module with ubrn and bump `react-native-bdk-sdk` in
   `apps/mobile/package.json`.
2. In `hooks/useSyncAccountWithWallet.ts`, compute `getSyncScope` for
   incremental syncs. For `recent`, build the request from:
   - the last `recentPerKeychain` revealed scripts of each keychain;
   - unused addresses up to the stop gap;
   - scripts and outpoints of unspent UTXOs, and txids of unconfirmed
     transactions, so spends and confirmations are never missed.
3. Call `syncScriptsWith*` from `scanWithServer` (`api/bdk.ts`) for `recent`
   and report `scope: 'quick'`. Keep `syncWith*` and `scope: 'full'` for `all`
   and for manual refreshes.
4. Remove `account.sync.details.quickCheckPending` from the sync details
   modal.
