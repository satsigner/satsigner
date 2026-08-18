# Plan: NIP-04 + NIP-17 Direct Messages, Relay Settings, and Chat Infrastructure

**Status**: draft — pending #471 and #474 merge
**Date**: 2026-08-07
**Depends on**: #471 (`fix/encrypt-nostr-secrets`), #474 (`fix/pin-kdf-strengthening`)
**Related**: `SECURITY.md` (#477) — the project npub accepts NIP-17 security reports at its inbox relays; this plan implements both sides of that contract.

## 1. Goal

Add person-to-person encrypted DMs (NIP-04 legacy + NIP-17 gift-wrapped) to the
nostr section of the app, with:

1. **NIP-17 as the primary protocol**, NIP-04 for legacy interop
2. **Inbox/outbox relay configuration** in settings (NIP-65 + kind 10050)
3. **A shared, hardened chat UI** — extracted from the existing devices group
   chat so both instances improve together
4. **Reliable relay connections** — reconnect supervision, publish acks,
   persistent outbox
5. **Anonymous security reporting** — users can message the project npub from
   an ephemeral identity, optionally saving the key to return to the
   conversation

## 2. State of the world (verified 2026-08-07)

**Protocol layer** (`apps/mobile/api/nostr.ts`, ~1600 lines)

- NDK 2.14.5, `enableOutboxModel: false`, `autoConnectUserRelays: false`;
  one shared NDK per relay-set (`ndkRegistry`)
- NIP-17/59 primitives exist: `createKind1059()` (`nip17.wrapEvent`),
  `subscribeToKind1059()` + `nip59.unwrapEvent` — used only for **self-sync**
  (label sync between own devices: `useNostrLabelSync`,
  `useNostrDeviceAnnouncement`, `nostrSyncService`)
- NIP-04 exists only in `utils/nip46Handlers.ts` (remote signing) — no kind-4
  DM support
- Batched ingest queue (`BATCH_SIZE=10`, 350 ms interval, dedup sets),
  `nostrRetryManager` (exponential backoff + jitter), relay reachability
  probe, NetInfo imported for one-shot checks

**Data layer**

- SQLite `nostr_dms` — shaped for label-sync messages, per account; written
  via `upsertNostrData` which **deletes and re-inserts all rows** per update
  (`insertDm` single-row upsert exists but is unused by the store path)
- `nostr_relays` (per account), `db/nostrCache` (profiles/events/notes),
  `relayStatuses` field in `NostrAccount` schema — **currently unused**
- `useNostrIdentityStore`: flat global `relays: string[]` — no inbox/outbox
  distinction

**UI**

- `signer/nostr/account/[npub]/chat.tsx` — placeholder tabs (NIP-4 / NIP-17 /
  Marmot / Mesh), all "coming soon"
- Existing chat: `signer/bitcoin/account/[id]/settings/nostr/devicesGroupChat.tsx`
  (687 lines) + `components/SSNostrMessage.tsx` (237 lines) +
  `hooks/useNostrMessage.ts` — inverted FlatList, windowed pagination,
  optimistic send with rollback, author colors/aliases, PSBT/transaction
  payloads with sign-flow CTA
- Relay pickers: `signer/nostr/relays.tsx` (identity-level) and per-account
  `.../settings/nostr/selectRelays.tsx` — checkbox directory + custom URL

**Identity infrastructure**

- Identities are NIP-06-derived from 12-word mnemonics
  (`deriveNostrKeysFromMnemonic` in `utils/nostrIdentity.ts`)
- `account/[npub]/keys.tsx` has nsec-reveal + `SSQRCode` + `SSSeedQR` +
  clipboard patterns
- Post-#471: nostr secrets encrypted at rest with PIN-derived key
  (`utils/nostrSecrets.ts`, session cache via `setCachedAccountSecrets`);
  `secureWipeAllWalletData()` is the duress-wipe extension point
- Post-#474: `utils/pinKdf.ts` (Argon2id → scrypt → PBKDF2-600k, per-digest
  KDF config), `useKdfMigration`, `useReEncryptAccounts`; `getPin()` returns
  the stored digest (SecureStore read, no KDF roundtrip); skipPin is
  dev-only — production always has a PIN

## 3. Locked decisions

1. **Keep NDK outbox model off.** Manual role-based relay routing is simpler
   and matches the privacy requirement: gift wraps go only to the recipient's
   inbox relays, never broadcast.
2. **Anonymous send with save-and-return.** Ephemeral report identities are
   mnemonic-derived from the start; the chat header offers "save this
   identity" via seed words / SeedQR / nsec so the user can return to the
   conversation. UX must state the tradeoff: saving links future messages to
   the same sender (pseudonymous continuity).
3. **Envelope encryption for the message store** (see §5.2) — builds on
   #471 + #474.
4. **Spam policy: requests bucket, plain-text-only rendering, no PoW on day
   one** (see §8).

## 4. Relay model: inbox/outbox split (NIP-65 + kind 10050)

Foundation for everything else.

### 4.1 Data model

- `useNostrIdentityStore`: replace flat `relays: string[]` with
  `{ url, read, write }[]` (NIP-65 semantics) + separate
  `dmInboxRelays: string[]` (kind 10050)
- Migration: existing flat list becomes read+write; ship sensible DM-capable
  defaults
- `nostr_relays` table gains `read`/`write` columns (schema migration in
  `db/schema.ts`)

### 4.2 Publish our relay metadata

- Publish kind 10002 (NIP-65 relay list) and kind 10050 (DM inbox relays)
  from each identity — required so reporters can reach the project npub per
  the SECURITY.md contract
- Re-publish on relay-list change

### 4.3 Settings UI

Extend `signer/nostr/relays.tsx` into three sections — **Outbox** (we publish
to), **Inbox** (we read from), **DM inbox** (where gift wraps arrive) —
reusing the existing `SSCheckbox` + curated directory + custom-URL pattern.
Show per-relay connection status (activates the dead `relayStatuses` field).
wss-only enforcement.

## 5. Message storage

### 5.1 Schema (new table — do not contort `nostr_dms`; label sync stays

untouched)

```sql
CREATE TABLE IF NOT EXISTS nostr_chat_messages (
  id TEXT NOT NULL,
  identity_npub TEXT NOT NULL,
  peer_pubkey TEXT NOT NULL,
  protocol TEXT NOT NULL,              -- 'nip04' | 'nip17'
  direction TEXT NOT NULL,             -- 'in' | 'out'
  content_enc TEXT NOT NULL,           -- envelope-encrypted
  content_iv TEXT NOT NULL,
  raw_wrap TEXT DEFAULT '',            -- original event JSON for audit/re-process
  reply_to TEXT,
  rumor_id TEXT,
  wrap_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent', -- 'pending' | 'sent' | 'failed'
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (id, identity_npub)
);
CREATE INDEX idx_nostr_chat_thread
  ON nostr_chat_messages(identity_npub, peer_pubkey, created_at);
CREATE INDEX idx_nostr_chat_unread
  ON nostr_chat_messages(identity_npub, read) WHERE read = 0;
```

Plus a persistent **outbox** table for reliable sends (§7.3) and a
conversation index (peer, last_message_at, unread_count, protocol, accepted
flag for the requests bucket).

### 5.2 Envelope encryption (post-#471/#474)

```
SecureStore:  chat_mk  = aesEncrypt(MK, await getPin(), mk_iv)   ← one item
SQLite:       content  = aesEncrypt(plaintext, MK, per_msg_iv)   ← N rows
```

- **MK**: one random 256-bit key per install (`randomKey()` in
  `utils/crypto.ts`), wrapped by the PIN-derived digest, stored as
  `chat_db_key` / `chat_db_key_iv` — the `EncryptedKeySecret` pattern from
  `storage/encrypted.ts`
- Per-message cost: one AES-256 after a once-per-session MK unwrap. No KDF in
  the hot path (post-#474 `getPin()` is a SecureStore read of the digest)
- **PIN change / KDF migration**: add a single re-wrap of `chat_mk` to
  #474's `useKdfMigration` / `useReEncryptAccounts` flows — one AES op, not a
  table rewrite
- **Duress wipe**: register `deleteItem(chat_mk)` + table drop in #471's
  `secureWipeAllWalletData()` — crypto-shredding makes history unrecoverable
  instantly, including WAL remnants
- **Lock behavior**: clear in-memory MK + plaintext LRU on auth-store lock
- In-memory plaintext cache: bounded LRU keyed by message id (scroll perf +
  limited plaintext residency), mirroring #471's `setCachedAccountSecrets`
  pattern
- Never log decrypted content; extend `privacyMode` masking to conversation
  list previews

## 6. Protocol implementation

### 6.1 NIP-17 (primary — phase 1)

Reuse existing primitives; add chat-shaped wrappers in `api/nostr.ts`:

- `sendNip17Chat(senderNsec | null, peerNpub, text, opts)`:
  - rumor kind 14 (NIP-17 chat message), `nip17.wrapEvent`
  - publish **only to recipient's kind 10050 inbox relays** (fetch; fallback:
    their kind 10002 read relays; fallback: our DM defaults) + copy to own
    inbox relays for self-history
  - `senderNsec: null` → ephemeral mnemonic-derived keypair (see §6.3)
- `subscribeToNip17Chat(nsec, npub, cb)`: chat wrapper over existing
  `subscribeToKind1059`, subscribed on **our inbox relay set**, extracting
  kind-14 text + reply-to tags; dedupe by rumor id
- Max content length enforced **before** unwrap (oversized-wrap DoS guard)

### 6.2 NIP-04 (legacy interop — phase 2)

- `subscribeToKind4`: `{kinds:[4], '#p':[me]}` + `{kinds:[4], authors:[me]}`
- `sendNip04Chat`: kind 4 via `nostr-tools/nip04`, publish to outbox + peer
  inbox relays
- UI badges NIP-04 threads "legacy — metadata visible" to nudge toward NIP-17

### 6.3 Anonymous send + save-and-return

- Ephemeral identity: `generateMnemonic(12)` →
  `deriveNostrKeysFromMnemonic` (NIP-06), held in memory only
- Chat header affordance (header slot of `SSChatView`): **"Save this
  identity to return to the conversation"** → sheet with seed words / SeedQR
  / nsec, reusing `SSQRCode`, `SSSeedQR`, and the `keys.tsx` reveal patterns
- Saving promotes it to a persisted identity in `nostrIdentityStore` (nsec
  into the #471 encrypted-secret path)
- Resume path: re-import key → re-subscribe with `since` → history rebuilds
  from inbox relays
- UX copy must state: saving links future messages to the same sender

## 7. Chat UI — extract, harden, reuse

The existing `devicesGroupChat.tsx` is the foundation. Transport and storage
differ between the two instances; interaction and rendering are identical.

### 7.1 Shared kit — `components/chat/`

| Piece              | Role                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SSChatView`       | Thread shell: inverted list, windowing, new-message pill, scroll handling. Props: `messages`, `onSend`, `onLoadMore`, `authorInfo(pubkey)`, header slot                                           |
| `SSChatMessage`    | Evolved `SSNostrMessage`, `React.memo`'d; **attachment slot** `renderAttachment?: (msg) => ReactNode` — bitcoin side injects `SSTransactionDetails` + sign-flow CTA; DM side empty (later: media) |
| `SSChatComposer`   | Extract raw `TextInput`+`SSButton` row → styled component (multiline, maxLength, disabled state)                                                                                                  |
| `ChatMessage` type | Normalized: `{ id, authorPubkey, text, createdAt, pending, status, isOwn, attachment? }`                                                                                                          |
| Adapter hooks      | `useDevicesChatMessages(accountId)` (existing store) and `useDmChatMessages(identityNpub, peerNpub)` (new table) — same interface, different transport/storage                                    |

### 7.2 Instance-specific (stays out of the kit)

- **Bitcoin devices chat**: PSBT/transaction attachments, sign-flow nav,
  member colors, `autoSync` gating, self-sync transport (group semantics over
  own devices — keep NIP-17 wraps to self)
- **DM chat**: protocol selector (NIP-17 default), peer inbox routing,
  requests bucket, save-identity header, conversation list screen (peer,
  last-message preview, unread badge, protocol tag)

### 7.3 Performance fixes — land once, benefit both instances

1. **Kill the table rewrite**: today every message goes through
   `updateAccountNostr` → `upsertNostrData`, which DELETEs and re-INSERTs all
   DMs (and relays, and trusted devices) per message. Switch the store path
   to the existing single-row `insertDm` upsert (+ delete-by-id)
2. **Batch profile resolution**: replace the sequential
   `new NostrAPI(relays).fetchKind0(npub)` per-author loop with the existing
   `fetchKind0Batch` (40/batch) inside a shared `useChatAuthorInfo` hook
3. **Stop recompute storms**: `formattedNpubs` currently rebuilds over all
   messages on every change; `messages.slice(-displayCount).reverse()` copies
   the array every render. Incremental author map + cursor-based DB
   pagination instead
4. **FlashList** + memoized rows + stable `renderItem` (inline closure
   today); pass per-row visibility state instead of the whole
   `visibleComponents` Map (currently re-renders every row on any toggle)
5. **Messages out of the account object**: arriving messages mutate
   `accounts[]` state today, re-rendering everything subscribed to it.
   Per-conversation slices/selectors; conversation list updates via index row
   (`last_msg_at`, `unread_count`)
6. Generalize `setActiveChatAccount` → `setActiveConversation(id)` so
   notification suppression works for DMs too
7. **Lazy per-bubble decrypt** into the bounded plaintext LRU; never decrypt
   in render; local-first thread rendering (SQLite instantly, relay backfill
   with `until`, ~30/page); batch inserts in single transactions
   (`bulkInsert` pattern)
8. **Optimistic send**: composer inserts `pending` row immediately; publish →
   ack quorum flips to `sent`; input never blocks on network
9. **Ingest queue**: fix the silent `eventQueue.shift()` drop at
   `NOSTR_MAX_QUEUE_SIZE` — persist-before-drop for chat (queue becomes a
   write-behind buffer); batched unwrap during scroll-idle, newest-first

## 8. Spam & abuse policy (public project npub)

Threat model once kind 10050 is published: anyone can gift-wrap us; we pay
unwrap CPU to discover spam; the DM renderer is wallet attack surface.

**Ship day one:**

- **Message Requests bucket** — unknown senders: no notifications,
  plain-text-only rendering, **no link previews, no media auto-fetch, no
  markdown**. Actions: Accept (→ inbox + contacts), Delete, Block
- **Local blocklist + per-peer rate cap** — cap unwraps/peer/day and total
  queue depth (extends `NOSTR_MAX_QUEUE_SIZE` / `processedMessageIds`
  pattern)
- **DM-specialized inbox relays** — prefer relays that only accept kind
  1059/4; optionally self-host later with a write policy of "only gift wraps
  p-tagged to our npub"

**Explicitly deferred / rejected:**

- **NIP-13 PoW — deferred.** Prices out low-end mobile reporters. If abuse
  materializes, make it adaptive: PoW required only when the rate limiter is
  tripping
- **WoT gating — rejected.** Every anonymous report is a fresh key with zero
  web-of-trust; gating would bin 100% of legitimate reports

Metadata floor: relays see _that_ we received a kind 1059 (sender hidden,
timestamp randomized ±2 days per NIP-59). Acceptable.

## 9. Relay connectivity hardening

| Today                                                                                                               | Improvement                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `publishEvent` races all relays, succeeds on 1 ACK, failure = throw → message lost                                  | **Ack quorum + persistent outbox**: sent = ≥2 write ACKs (DMs: ≥1 recipient-inbox + own-inbox copy); failures → SQLite outbox (`pending/failed`), retried on reconnect; sends survive restarts |
| NDK registry keyed by whole sorted relay set — divergent lists spawn duplicate pools; list changes kill shared subs | **Role-keyed pools**: `dm-inbox` (long-lived, holds gift-wrap sub), `outbox` (ephemeral publish), `general` (profiles/notes). DM socket survives navigation/settings changes                   |
| Subscriptions component-owned; navigation tears them down                                                           | **Manager-owned subscriptions**: extend `useNostrSubscriptionManager` (already does per-account EOSE tracking for sync) — one gift-wrap sub per identity, screens attach/detach                |
| NetInfo used only as one-shot pre-flight; no reconnect on regain                                                    | **Connection supervisor** (app-scoped): NetInfo listener → reconnect with `createRetryManager` backoff; `AppState` foreground → reconnect + resubscribe + `since`-based catch-up               |
| `relayStatuses` in schema but dead                                                                                  | **Per-relay liveness**: last-event-seen, connected/connecting/disconnected → status dots in relay settings; stale relay → targeted reconnect instead of pool nuke                              |
| `connect()` blocks up to 20 s (`NOSTR_NDK_CONNECT_TIMEOUT_MS`)                                                      | Short non-blocking connect (NDK routes subs as relays come online — `connectForPublish` already proves this); per-op timeouts                                                                  |
| Unbounded relay lists                                                                                               | Cap + dedupe after `normalizeRelayUrl`, wss-only                                                                                                                                               |

## 10. Security-report flow (the forcing function)

- **"Report a security issue"** entry (Settings → About + nostr section):
  pre-addressed to the project npub, **NIP-17 only**, "send anonymously"
  toggle (default on → ephemeral key), warning copy: _never include seed
  words, keys, or PINs_
- Receiving side: gift wrap from unknown npub → new conversation in Requests;
  maintainer identities get notified
- Fulfills the `SECURITY.md` contract (#477): NIP-17 gift wraps to the
  project npub's inbox relays only

## 11. Phasing

- **P0 — Relay model** (§4): store migration, kind 10002/10050 publish,
  settings UI
- **P1 — NIP-17 chat core** (§5, §6.1, §6.3): schema + envelope encryption,
  send/subscribe, ephemeral identity + save affordance
- **P2 — Shared chat kit** (§7): extract `components/chat/`, migrate devices
  group chat onto it (its perf fixes ship here), DM thread + conversation
  list
- **P3 — Report flow** (§10): entry points, warning copy, requests bucket (§8)
- **P4 — Reliability** (§9): supervisor, role-keyed pools, persistent outbox
- **P5 — NIP-04** (§6.2): legacy interop

Minimum viable contract with `SECURITY.md`: P0 + P1 + P3.

## 12. Testing

- **Unit**: wrap/unwrap roundtrips (NIP-04/NIP-17), envelope
  encrypt/decrypt + MK re-wrap on PIN change, relay-list migration, retry
  math, requests-bucket reducers, oversized-wrap guard
- **Integration**: local relay (nostr-rs-relay in CI) two-client roundtrips;
  duress-wipe leaves only ciphertext; duress + MK deletion renders history
  unrecoverable
- **Maestro**: send anonymous report → appears in requests on receiver;
  save-identity → kill app → re-import → history rebuilds; offline send →
  outbox → reconnect → delivered
- **Perf**: 5k-message thread scroll on mid-range Android; 50-wrap burst on
  reconnect without frame drops

## 13. Open questions

1. Plaintext LRU size and exact `privacyMode` behavior in thread view
2. Adaptive-PoW thresholds if abuse materializes (defer to a future ADR)
3. Self-hosted inbox relay for the project npub (ops cost vs. spam filtering)
4. Marmot/Mesh tabs in `chat.tsx` — remain placeholders; revisit after DM
   core ships
