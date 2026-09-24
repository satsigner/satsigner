# Plan: Stateless Satsigner — applying "State considered harmful"

**Status**: draft
**Date**: 2026-09-21
**Reference**: Joanna Rutkowska, *State considered harmful: A proposal for a
stateless laptop*, Invisible Things Lab, December 2015
([pdf](https://blog.invisiblethings.org/papers/2015/state_harmful.pdf))

## 1. The idea we are importing

Rutkowska's argument, stripped to its core:

1. **State is the attack surface that persists.** Code can be re-verified at
   every boot; state cannot. Malware that lands in mutable state survives
   reboots, and the user has no way to tell "good state" from "bad state".
2. **Therefore: minimize state, and make what remains explicit.** The only
   state worth keeping is the user's own data. Everything else should be
   disposable and trivially rebuildable from a trusted source.
3. **Separate the precious from the disposable.** On her stateless laptop: a
   read-only verified OS (disposable, reinstallable in minutes) vs. encrypted
   user data on a user-controlled stick (precious, small, well-defined).
4. **Keep precious state small, simple, and in well-defined locations with
   simple formats** — so it can be backed up, audited, migrated, and wiped
   with confidence.
5. **Prefer ephemeral execution contexts** (Qubes DisposableVMs) for risky
   work: do the dangerous thing somewhere that is destroyed afterwards.

Bitcoin already gives us the ideal substrate for this thinking: **the
blockchain is the trusted, verifiable source of truth**. A signer app's local
copy of transactions, UTXOs, and balances is a *cache*, not state. The only
truly precious state in Satsigner is:

- key material (mnemonics, passphrases, descriptors, xpubs)
- the user's *judgments* about their money: labels, tags, UTXO selections
- configuration (servers, settings, contacts/identities)

This plan restructures Satsigner so that the precious state is small,
explicitly enumerated, encrypted, and exportable — and everything else is
provably disposable.

## 2. State of the world (verified 2026-09-21)

Current persistence inventory (`apps/mobile`):

| Layer | Contents | Disposable? |
|---|---|---|
| `expo-secure-store` (`storage/encrypted.ts`) | PIN-encrypted key secrets, PIN digests/salts/KDF config; **ecash + ark mnemonics unencrypted** | Precious (secrets) |
| SQLite (`db/`) | accounts metadata, txs, utxos, addresses, labels, tags, nostr DMs/caches/relays, ark labels, **chat messages in plaintext** | Mixed: chain data disposable; labels/tags/DMs precious |
| MMKV (`storage/mmkv.ts`) | zustand persist: settings, blockchain servers, tx-builder drafts (incl. **signed PSBT/tx hex**), ark/ecash stores (incl. **ecash proofs** — bearer tokens), **`energy.ts` RPC password in cleartext**, nostr cursors, payjoin sessions | Mixed |
| Filesystem | BDK wallet `.sqlite` files, ark datadirs | Disposable |
| Bundled assets | historical fiat prices | Disposable (read-only) |

Known deviations from the ideal, found while mapping:

1. **Three wipe paths with different coverage.** Duress PIN
   (`utils/secureWipe.ts`), max-tries (`app/unlock.tsx` `handleTriesOver`), and
   developer clear (`settings/developer.tsx`) each erase a different subset.
   Max-tries leaves BDK wallet files on disk and MMKV settings behind — exactly
   the "did we really wipe?" uncertainty the paper warns about.
2. **Session secret sprawl.** PIN digest in `pinSession.ts` module state;
   plaintext nostr secrets in `utils/nostrSecrets.ts` Maps (cleared only on
   wipe, not on lock); LND/RPC credentials hydrated into zustand stores; live
   BDK wallet objects embedding keys. No zeroization anywhere.
3. **Eager full hydration.** `store/accounts.ts` loads every account with its
   entire tx/utxo/address/label graph into memory at module import.
4. **Plaintext-at-rest exceptions.** Ecash proofs (bearer value) and mining
   RPC password in MMKV; ecash/ark mnemonics in SecureStore without the AES
   layer; nostr chat plaintext in SQLite (already acknowledged in schema
   comment).
5. **Persist-key collision bug.** `store/chartSettings.ts` writes to MMKV key
   `satsigner-blockchain`, clobbering `store/blockchain.ts` state.

## 3. Goal

Make it true — and demonstrable — that:

> **The user can wipe Satsigner to a factory-fresh state in seconds, restore
> from a small encrypted backup, and lose nothing that matters. Anything the
> app holds beyond the backup is either encrypted precious state or a cache
> that rebuilds itself from the chain.**

Four sub-goals, mirroring the paper:

1. **Enumerate and classify all state** — every byte the app writes is
   labeled `precious-secret`, `precious-user`, or `disposable-cache`, in one
   registry, in the repo.
2. **One wipe, total coverage** — a single code path that provably destroys
   all state, used by duress, max-tries, developer tools, and account delete.
3. **Shrink and harden the precious set** — secrets encrypted everywhere, no
   plaintext-at-rest exceptions, secrets held in memory for the shortest
   possible time.
4. **Make the cache behave like a cache** — rebuildable, lazily loaded,
   cheap to drop; blockchain is the source of truth.

## 4. Non-goals

- No changes to BDK, bark, or ecash SDK internals — we adapt at our boundary.
- No new backup *format* — the existing full backup (`version: 1`) already
  covers the precious set; we extend coverage, not redesign it.
- No firmware/hardware work (the paper's chapters 1–2 don't translate to a
  mobile app; the OS statelessness chapter does, mapped onto app state).
- Not rewriting state management wholesale — zustand + MMKV + SQLite stay;
  we fix classification, coverage, and lifetimes.

## 5. Workstreams

### WS0 — State registry (foundation, no behavior change)

Create `apps/mobile/constants/stateRegistry.ts`: the single enumerative list
of every persistence slot the app uses, each entry:

```ts
{
  key: string | ((id: string) => string), // storage key / table / file path
  layer: 'secureStore' | 'mmkv' | 'sqlite' | 'filesystem',
  class: 'precious-secret' | 'precious-user' | 'disposable-cache',
  wipeStrategy: 'delete-key' | 'drop-rows' | 'delete-file' | 'rebuild',
  notes?: string,
}
```

Every existing store/mutation/storage call gets mapped. The registry is the
paper's "well-defined locations" requirement made literal, and it drives
WS1–WS3. Add a unit test that fails when a `setItem`/table/file write exists
in the codebase with no registry entry (grep-based lint test, following the
existing test setup) — this keeps the registry honest as the app grows.

### WS1 — One wipe to rule them all

Implement `utils/wipeAppState.ts` as a pure function of the registry: for each
entry, run its `wipeStrategy`, report per-entry success. Then:

1. Route **all three existing wipe paths** (duress, max-tries, developer
   clear) through it, deleting `utils/secureWipe.ts` duplication.
2. Fix the coverage gaps: max-tries must also delete BDK wallet files
   (`wallets/*.sqlite`) and the MMKV stores.
3. Per-account delete becomes `wipeAppState(filter: byAccountId)` — same code,
   narrower scope.
4. Integration test: seed the app with every state class, wipe, assert zero
   residue (SecureStore keys gone, SQLite rows gone, files gone, MMKV empty).

This is the paper's core UX promise: *"destroy the OS and reinstall in
minutes with confidence that no user data was lost and no malware persists"* —
except our reinstall is a resync.

### WS2 — Harden the precious set

1. **Close plaintext-at-rest gaps**: encrypt ecash proofs and the `energy.ts`
   RPC password under the PIN-derived key (or move to SecureStore); add the
   AES layer to ecash/ark mnemonics; encrypt `nostr_chat_messages` content
   (already flagged in the schema). Version-bump the affected zustand persist
   migrations (pattern already exists in `ecash.ts` v2).
2. **Fix the `chartSettings`/`blockchain` persist-key collision** (one-line
   key rename + migration test).
3. **Shrink secret lifetimes**: clear `nostrSecrets.ts` caches on lock (not
   just on wipe), alongside the existing PIN-digest clear in
   `setLockTriggered`. Audit `accountBuilder`/`ecashAccountBuilder` plaintext
   mnemonic fields for post-use clearing.
4. **Lock-scope audit**: enumerate what stays decrypted in memory during an
   unlocked session (BDK wallets, hydrated service secrets) and document the
   residual exposure in `SECURITY.md` — the honest "state we still carry"
   list. Byte-level zeroization is out of scope (JS strings, GC); lock-time
   cache clearing is the achievable bar.

### WS3 — Make the cache a cache

1. **Lazy hydration**: replace `store/accounts.ts` eager full-graph hydration
   with metadata-first loading (accounts + summaries at startup; txs/utxos/
   addresses loaded per account on demand). Biggest single reduction of
   resident state mass.
2. **Declare chain data disposable in code**: `db/mutations/sync.ts` already
   rebuilds tables from BDK sync — encode the invariant that no sync-table
   write may carry information that can't be re-derived (guardrail: labels/
   tags live only in their own tables, never merged into chain tables).
3. **Drop disposable state confidently**: add "clear chain cache" (rescan
   already does this per account) and "clear nostr caches" developer actions
   built on the registry, so users/support can shed state without touching
   precious data.
4. **Verify rebuild**: integration test — wipe only `disposable-cache`
   entries, resync from a mock Esplora/Core, assert byte-identical tx/utxo/
   address tables and unchanged labels/tags.

### WS4 — Prove the promise: backup round-trip as the app's "reinstall"

The full backup *is* the stateless-laptop "trusted stick": the small,
encrypted, user-held artifact from which everything rebuilds.

1. Extend `buildBackupWithSeeds` coverage audit against the registry: every
   `precious-*` entry must appear in the backup or be explicitly excluded with
   a reason (e.g., watch-only descriptors are re-importable). Registry test
   enforces this.
2. Round-trip integration test: build state → backup → `wipeAppState` →
   restore → assert functional equivalence (accounts, labels, settings,
   ecash/ark/lightning/nostr sections).
3. Settings UI copy that states the promise plainly: what the backup
   contains, what rebuilds from the chain, what is gone forever without it.

### WS5 — USB vault mode

An optional, additive mode: an independent vault on a user-held USB stick
that takes precedence when plugged in; the current device-storage UX is the
untouched default. Large enough to deserve its own section — see §6.

## 6. USB vault mode — the paper's "trusted stick", literally

The paper's centerpiece is a trusted stick that holds all user data (encrypted
with user keys) while the laptop itself is stateless. We build the mobile
equivalent as an **optional, additive mode**: the app's current UX is the
default and unchanged; a user who enables USB vault mode gets a second,
independent world on a stick that takes precedence when plugged in.

### 6.1 Platform reality (verified 2026-09-21)

- **Android — first-class.** USB OTG mass-storage drives appear in the
  Storage Access Framework; the user grants a persistable URI permission to a
  directory on the stick once. Attach/detach events are observable via
  `UsbManager` (`ACTION_USB_DEVICE_ATTACHED` / `DETACHED`), so true
  "plug in → vault available" detection is possible.
- **iOS — possible, degraded UX.** Since iOS 13, external drives (USB-C
  iPhones directly; Lightning via adapter, FAT32/exFAT only) are reachable
  through `UIDocumentPickerViewController` with security-scoped directory
  bookmarks that persist across launches. **But** there is no API to detect
  physical attach/detach — the app discovers the stick is gone only when a
  bookmarked access fails. So: one-time directory pick, then transparent
  access while plugged; "insert stick" prompt when not.

### 6.2 Design

**Two worlds, never mixed.** Device storage keeps working exactly as today.
The stick holds its own independent vault. Neither world reads, writes, or
merges the other's data — no sync, no fallback-merge, no cross-references.

- **Source selection at unlock (precedence rule).** When vault mode is
  enabled *and* a stick is attached *and* a valid vault file is detected →
  the session loads from the stick and phone storage is ignored. Otherwise →
  the session loads phone storage, exactly as today (stick present but no
  valid vault → phone storage; vault mode off → phone storage). The decision
  is made once, at unlock, before any state hydration.
- **Sessions are single-world.** A session is bound to its source. Stick
  removed mid-session → lock. Stick inserted mid-session → lock only when it
  carries a valid vault (a random OTG device must never interrupt); the next
  unlock re-evaluates the source. This makes mixing structurally impossible
  rather than merely avoided. The full flow matrix is in §6.3.
- **The vault file is the backup file.** Reuse the WS4 full-backup format as
  the *live* precious-state store on the stick — one format, two uses (the
  backup IS the vault; the vault IS the backup). Precious state only: keys,
  labels/tags, settings, identities. **Chain data never goes on the stick** —
  it's disposable (WS3), which keeps the stick file small and writes rare.
- **Stick sessions are diskless on the phone.** In a stick session, chain
  cache (BDK wallets, tx/utxo/address data) lives in memory only and dies at
  lock — the stick world leaves no residue in device storage (the "never
  mixes" guarantee, enforced at the storage layer). Trade-off: resync each
  stick session; an opt-in persistent cache keyed by vault fingerprint is a
  possible later refinement.
- **Stick holds ciphertext only.** The vault is encrypted with its own
  passphrase (distinct from the device PIN) via the existing backup
  encryption path, upgraded from legacy PBKDF2-10k to the `pinKdf.ts`
  preference order (WS2). A FAT32 stick is readable by anyone; a 4–6 digit
  PIN does not brute-force-resist an offline attacker the way SecureStore
  hardware gating does. *Optional* hardening at enrollment: device key-split
  (vault key = HKDF(passphrase ∥ device share)) — ties the vault to this
  phone, at the cost of multi-device portability.
- **"No secrets on the phone" is the user's choice, not the mode's
  requirement.** Enrollment offers "copy accounts to stick" with an optional
  follow-up "remove these accounts from this phone" (WS1 wipe scoped to those
  accounts). Users who want the strict property get it; users who want the
  stick as a roaming second copy keep today-plus-stick.
- **Lock on detach** (Android): USB detach broadcast during a stick session →
  the session ends via the normal lock path, clearing session secrets (WS2).
  Removing the stick becomes the physical "lock" gesture — very much in the
  paper's spirit. (Also a correctness requirement: it is what makes
  single-world sessions airtight.)
- **Writes follow the active world, never cross.** Stick session →
  write-through to the stick, using the staging + atomic-replace pattern
  already in `storage/arkDatadir.ts`, with a `.bak` rotation so a yanked
  stick never leaves a half-written vault. A failed vault write fails the
  action with an error — it never falls through to device storage. Device
  session → device storage, as today.
- **Multi-device**: the same stick works across phones because the vault is
  the backup — the restore path already exists. Monotonic vault counter +
  fingerprint (pattern from `nostr_last_backup_fingerprint`) to detect
  divergence between stick copies.

### 6.3 Flow map

Session state machine:

```
                 unlock (probe: stick attached? valid vault readable?)
   LOCKED ────────────────────────────────────────► SESSION(source)
     ▲                                              source ∈ {device, stick}
     │                                                     │
     └────────────────────── lock ◄────────────────────────┘
             lock triggers: background timer, explicit lock, duress,
             max-tries, stick detach (stick session), valid-vault
             stick attach (any session), vault liveness failure
```

The unlock-time probe is bounded (≤2 s, "checking for vault…" indicator) and
never blocks the device path. iOS: "attached" = the bookmarked vault file is
readable right now; there is no attach event.

**A. Opening the app**

| # | Scenario | Behavior |
|---|---|---|
| A1 | Cold open, vault mode off | Device session — today, untouched |
| A2 | Cold open, vault on, stick attached, valid vault | Vault unlock (vault passphrase) → stick session |
| A3 | Cold open, stick attached, no vault file | Device session + subtle "no vault on this stick — create one?" hint |
| A4 | Cold open, stick attached, vault corrupt (MAC/counter check fails) | "Vault unreadable" notice → choose: recover from `.bak` (if valid) or use phone storage. Never silently loads device when the user expected the stick |
| A5 | Cold open, no stick | Device session, indistinguishable from today |
| A6 | Cold open during stick mount race (SAF volume not ready) | Probe waits ≤2 s → timeout → device session; next unlock re-probes |
| A7 | Re-open from background, stick never removed, within lock window | Session resumes; cheap vault liveness read → failure → lock |
| A8 | Re-open from background, past lock window, stick still attached | Locked → unlock → probe → stick session again (vault passphrase re-entered) |
| A9 | App killed by OS, stick still attached | Cold open → A2 |

**B. Working in a stick session**

| # | Scenario | Behavior |
|---|---|---|
| B1 | Browse, receive | In-memory chain sync; addresses derived from vault keys; nothing touches device storage |
| B2 | Label edit / new account / settings change | Write-through: `vault.tmp` → verify → atomic rename → `.bak` rotation; world badge stays visible |
| B3 | Sign + broadcast | Secrets decrypted in memory → sign → broadcast via the phone's normal network path (Tor if configured) → tx enters the in-memory chain view |
| B4 | Broadcast with no network | Signed tx held in memory; offer PSBT/hex export (QR). Never written to device |
| B5 | Tx-builder drafts | Memory-only in stick sessions (device sessions keep today's MMKV drafts); lock discards them |
| B6 | App backgrounded mid-task | Normal background rules; lock timer fires; in-memory chain cache discarded → next stick session resyncs (accepted cost) |

**C. Stick removed**

| # | Scenario | Behavior |
|---|---|---|
| C1 | Mid-write | Atomic write: vault is old version or new version, never torn; the write call fails → the action errors; detach → lock. Next stick unlock runs vault verification (`.bak` recovery if needed) |
| C2 | Mid-sign / mid-broadcast | Detach → immediate lock → session secrets cleared → pending broadcast aborted; draft lost (B5) |
| C3 | Idle, app in foreground | Detach broadcast → lock screen; world badge clears |
| C4 | App backgrounded/unfocused | Detach recorded by the receiver; on next foreground → lock (the background timer usually locks first); next unlock probes fresh |
| C5 | Phone locked / screen off | Nothing runs; next unlock probes fresh — stick gone → device session (today's UX) |
| C6 | Phone dies / reboots mid-write | Same guarantee as C1 with no error path — verification at the next stick unlock recovers |

**D. Stick inserted**

| # | Scenario | Behavior |
|---|---|---|
| D1 | App closed or locked | Next unlock probes → A2 / A3 / A4 |
| D2 | Mid-device-session, inserted stick has a valid vault | Lock (source may have changed) → unlock → stick session |
| D3 | Mid-device-session, stick has NO valid vault | Nothing happens — random OTG devices (chargers, card readers, a stranger's stick) must never interrupt |
| D4 | Mid-stick-session, same stick re-inserted after detach | Already locked at detach (C3); unlock → probe → stick session |
| D5 | Stick swap (A out, B in) | Detach A → lock; insert B → unlock → stick session on B; no A state survives the lock |
| D6 | Two sticks at once | Enrolled directory wins; no enrolled match + multiple unknown valid vaults → device session + "multiple vaults found" notice — never auto-pick |

D2 note: "valid vault" can only be detected on sticks the app already has
SAF permission for (enrolled). A never-enrolled stick is unreadable → D3.
Enrollment is always an explicit settings action, never triggered by attach.

**E. Guardrails and special paths**

| # | Scenario | Behavior |
|---|---|---|
| E1 | Duress PIN entered with stick attached | Wipes the device world only (WS1); never writes or deletes on the stick — vault untouched |
| E2 | Max-tries wipe with stick attached | Same: device world only |
| E3 | Vault write error without detach (failing stick) | Retry once → action fails with "vault write failed"; session stays open; never falls through to device storage (never mix) |
| E4 | Vault verification at every stick unlock | Magic/version/MAC/counter; primary bad + `.bak` good → recover from `.bak` and tell the user; both bad → A4 |
| E5 | App update with enrolled vault | Vault = versioned backup format; migrations run on first open post-update as a normal atomic vault write; read-only open never migrates |
| E6 | Enrollment copy (device→stick) / import (stick→device) | The only sanctioned cross-world actions: explicit, user-initiated, verified read-back, optional source-side delete |
| E7 | Charging-only USB / PC (gadget mode) connection | No host-mode mass-storage event → nothing happens |

Every row above is a named integration test case; the mock vault layer
(§6.4) makes detach, mid-write failure, and corruption injectable.

### 6.4 Implementation pieces

- `modules/usb-vault/` — Expo Modules API native module: Android (SAF +
  `UsbManager` attach/detach), iOS (document picker + security-scoped
  bookmarks).
- `storage/vault.ts` — adapter implementing the precious-state storage
  interface against the stick; the WS0 registry gains a
  `location: device | stick` dimension so wipe (WS1) and backup (WS4) treat
  both uniformly.
- `sessionSource: 'device' | 'stick'` in the auth store — set at unlock by
  the probe, cleared at lock; all hydration and mutation paths read it to
  pick their backend. **Never persisted**: the source is re-derived at every
  unlock, so MMKV only ever learns "vault mode enabled" + the enrollment
  record (SAF URI, vault name, fingerprint) — config, not world data. This
  metadata leak is accepted and documented.
- Resume liveness: foregrounding within the lock window (A7) performs a cheap
  vault read before unfreezing the UI; failure → lock. Covers
  detached-while-backgrounded on both platforms.
- `storage/vault.ts` sits behind an interface with a mock implementation, so
  every §6.3 row is testable: inject detach mid-write, corrupt the primary
  file, expire the `.bak`, simulate the SAF mount race.
- Enrollment flow in settings: pick stick directory → then either create a
  fresh vault, copy selected device accounts into it, or adopt an existing
  vault/backup file already on the stick → verify read-back → optionally
  remove copied accounts from the phone (WS1 scoped wipe). Enrollment is the
  only flow that writes to an attached stick unprompted, and never strands
  or silently duplicates secrets.
- Unlock flow: bounded probe (≤2 s) decides the source → stick session asks
  for the *vault* passphrase, device session for the device PIN; a persistent
  header badge shows which world is active.
- Authenticated encryption for the vault/backup payload (AES-GCM or
  CBC+HMAC) — a stick that leaves the user's possession needs tamper
  evidence, and current backup crypto has no MAC. Folded into WS2.

### 6.5 Risks

- User confusion about which world is active (same app, two states) —
  mitigated by the persistent badge and world-scoped unlock copy; worth
  explicit UX attention, not an afterthought.
- FAT32/exFAT fragility and stick removal mid-write (mitigated by atomic
  replace + `.bak`, but stick corruption remains an availability risk —
  reinforce "the vault is one copy; keep a paper/second backup").
- iOS cannot detect attach; the "auto-load when detected" experience is
  Android-only. iOS gets the same model with a manual directory pick, and
  discovers removal only when a bookmarked access fails (→ lock).
- SAF write latency on cheap sticks; keep vault writes small (precious state
  only — another reason chain cache stays off the stick).

## 7. Sequencing

1. **WS0** registry + lint test (unblocks everything, zero risk)
2. **WS1** unified wipe (small, high security value, needs registry)
3. **WS2** hardening (independent of WS1 except shared registry)
4. **WS3** cache semantics (largest refactor — lazy hydration touches many
   screens; do after WS1/WS2 land)
5. **WS4** backup proof (depends on WS0; can start any time after)
6. **WS5** USB vault mode (depends on WS0 registry, WS1 wipe for enrollment,
   WS2 authenticated encryption, WS4 vault=backup format)

WS1 and WS2 can ship in one PR; WS3 and WS4 are separate PRs. WS5 is its own
PR train: native module → vault adapter → enrollment flow → unlock branch.

## 8. Risks & open questions

- **Lazy hydration perf**: some screens assume the full account graph is
  resident. Mitigation: per-account TanStack Query hooks (aligns with the
  repo's async-state guidance), keep summaries eager so lists stay instant.
- **Encrypting ecash proofs** adds an unlock requirement to mint interactions;
  acceptable — proofs are bearer value and deserve key-material treatment.
- **Backup = single artifact**: strengthening its role raises its blast
  radius. Keep the optional passphrase encryption, and consider upgrading its
  legacy PBKDF2-10k to the `pinKdf.ts` preference order (Argon2id → scrypt →
  PBKDF2-600k) as a follow-up.
- **Scope discipline**: the paper tempts grand redesigns. Resist. The win is
  classification + one wipe + honest lifetimes, not a new architecture.

## 9. Success criteria

- One command (`wipeAppState`) demonstrably leaves zero residue; all entry
  points use it.
- Every persisted byte classified in the registry; CI fails on unregistered
  writes.
- No bearer value or credential stored unencrypted at rest.
- A user with only the encrypted backup can restore onto a fresh install and
  lose nothing precious — proven by an automated round-trip test.
- Resident secret lifetime reduced to the unlocked session, with lock-time
  clearing for all caches.
- USB vault mode: stick attached + valid vault → session loads from the stick
  and device storage is untouched; stick absent → device UX identical to
  today; an automated test proves no state crosses between the two worlds.
