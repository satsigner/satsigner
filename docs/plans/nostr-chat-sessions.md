# Plan: Agent Chat Sessions and Remote Signing

**Status**: Part A implemented on `feat/nostr-chat-sessions`; Part B implemented on `feat/nostr-chat-signing` (no grants yet); Part C (§12) phase 2 on `feat/nostr-chat-session-state`
**Date**: 2026-11-24
**Scope**: `apps/mobile` (identity chat, NIP-17 only, and the NIP-46 signer), plus a small upstream change to the agent bridge (`@pi-nostr/durable-nip17`)

## 1. Goal

Two features for working with an AI agent on nostr (a pi agent through
`@pi-nostr/cli`):

- **Part A, sessions (§2–§6):** the user runs several independent NIP-17
  conversations ("sessions") with the same npub at the same time. Each session
  is its own agent context, so the user can work on two tasks in parallel
  without one polluting the other.
- **Part B, remote signing (§7):** the agent does the work, such as building
  and publishing a Zapstore release, and asks Satsigner for every signature.
  The nsec never leaves the phone. Only the identity the chat belongs to can
  sign, and every NIP-46 method is supported. The user approves either live, through a
  NIP-46 bunker, or later, through a sign request sent in the chat session.
  In the second case, the agent picks the work up again once the signature
  arrives.
- **Part C, agent status (§12):** the session shows what the pi terminal
  footer shows: model, thinking level, context window, token use and the
  routstr balance. The agent sends it as private session metadata, and the
  user can change some of it (model, thinking level) from Satsigner.

## 2. Where things stand

| Area                                 | Where                                                                                         | Today                                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Thread identity                      | `db/schema.ts` V9 `nostr_chat_messages`                                                       | One thread per `(identity_npub, protocol, peer_pubkey)`                                                                          |
| Conversation list                    | `db/queries/nostrChat.ts#listChatConversations`                                               | `GROUP BY peer_pubkey`                                                                                                           |
| Thread / replies / reactions queries | `db/queries/nostrChat.ts`                                                                     | All filter on `peer_pubkey` only                                                                                                 |
| Mark read                            | `db/mutations/nostrChat.ts#markChatThreadRead`                                                | Per peer                                                                                                                         |
| Send                                 | `utils/nostrChat.ts#createNip17Rumor` / `sendNip17Chat`                                       | Tags: `p` + optional reply `e`                                                                                                   |
| Ingest                               | `utils/nostrChat.ts#ingestChatRumor`                                                          | Peer from `getChatPeerFromRumor`, no session concept                                                                             |
| Tags                                 | `utils/nostrChatTags.ts`                                                                      | Reply + deletion tags                                                                                                            |
| Query keys / reply store             | `nostrChatQueryKeys.thread`, `store/nostrChatReply.ts#identityChatKey`                        | Keyed by peer                                                                                                                    |
| Routes                               | `signer/nostr/account/[npub]/chat/[peer].tsx`, `utils/nostrNavigation.ts#nostrChatThreadHref` | `peer` + `protocol` params                                                                                                       |
| Agent side                           | `@pi-nostr/durable-nip17` `bridge`                                                            | `inbox.conversations[conversationKey(rumor)]`: **one agent conversation per participant set**. Replies carry `["e", <rumor id>]` |

The agent keys conversations by the set of participants, so today the same
user can never get two agent contexts. **Both sides need a change.**

## 3. Protocol

NIP-17 has no thread id inside one participant set (`subject` only renames the
room). We add one custom tag on the kind 14 rumor:

```
["session", "<32 lowercase hex chars>"]
```

- It lives in the rumor, so relays only see the gift wrap. It does not leak.
- **No tag means the default session.** That is today's behaviour, so old
  messages, other clients and agents without the patch keep working.
- The id is random (16 bytes from `expo-crypto`/`utils/crypto.ts`). It is made
  when the user taps "New session" and never derived from content.
- The first message of a session may also carry the standard NIP-17
  `["subject", title]`, so other clients show a title.
- Self copies use the same rumor (see `createNip17Rumor`), so the user's other
  devices file the message under the same session for free.
- Reactions (kind 7) and deletions (kind 5) do not need the tag. They target
  message ids, and the session comes from the target.
- **NIP-04 is out of scope.** Kind 4 tags are public, so a session tag would
  leak the thread structure.

Open question: the tag name. Agree it with the pi-nostr maintainer (hodlbod)
before shipping, so other clients can adopt it. An alternative is to infer a
thread from reply chains (NIP-10 `root` marker). It is rejected as the main
mechanism: it breaks when a message has no `e` tag, and the first message of a
session cannot name itself as root.

## 4. Agent side (upstream patch to `@pi-nostr/durable-nip17`)

Small and backwards compatible:

1. `bridge` → `admit`: key = `conversationKey(rumor)` plus `#<session>` when the
   rumor has a valid session tag. Validate it with `/^[0-9a-f]{32}$/` and
   ignore it otherwise.
2. `Nip17Binding` stores `session?: string`.
3. `Reply.sign`: pass `tags: [["session", id]]` to `wrapMessage` (it already
   accepts `tags`) when the binding or rumor has one.
4. Optional: add a `session` parameter to `nostr_dm_send` so the agent can
   speak in a session on its own.

Separate durable conversations already run independently, so this alone makes
the sessions parallel.

Until the patch lands, Satsigner still routes agent replies correctly with
the fallback in §5.3. The agent's context stays shared in that case.

## 5. Satsigner

### 5.1 Data (`SCHEMA_V14` on master)

```sql
ALTER TABLE nostr_chat_messages ADD COLUMN session_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_ncm_session_thread
  ON nostr_chat_messages(identity_npub, protocol, peer_pubkey, session_id, created_at);

CREATE TABLE IF NOT EXISTS nostr_chat_sessions (
  identity_npub TEXT NOT NULL,
  peer_pubkey TEXT NOT NULL,
  session_id TEXT NOT NULL,
  title TEXT,
  created_at INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (identity_npub, peer_pubkey, session_id)
)
```

- The default session is `''`, so existing rows need no backfill.
- `nostr_chat_sessions` holds the title (from `subject` or a local rename) and
  the archive flag. It also lets a session that has no messages yet exist
  locally.
- `deleteChatMessagesForIdentity` and the duress wipe (`secureWipe`) must also
  clear `nostr_chat_sessions`.

### 5.2 Types and tags

- `NostrChatMessageSchema`: `sessionId: z.string()` (`''` = default).
- `NostrChatConversation` gains `sessionId` and `title?`. Add a
  `NostrChatSession` type. Don't duplicate fields: build it with
  `Pick`/intersection.
- `utils/nostrChatTags.ts`: `buildSessionTag(id)`, `getSessionId(tags)`
  (returns `''` for missing or invalid), `buildSubjectTag`, `getSubject`.
- `constants/nostr.ts`: `NOSTR_CHAT_SESSION_TAG`, `NOSTR_CHAT_SESSION_ID_RE`,
  `NOSTR_CHAT_SESSION_ID_BYTES`, `NOSTR_CHAT_SESSION_TITLE_MAX`,
  `NOSTR_CHAT_SESSIONS_PER_PEER_MAX`.

### 5.3 Send and ingest (`utils/nostrChat.ts`)

- `sendNip17Chat(api, identity, peerNpub, text, { replyToId, sessionId, subject })`.
  Replace the positional args with an options object. Add the session tag when
  `sessionId !== ''`, and the subject tag only on the first message of a
  session.
- `ingestChatRumor` resolves the session with one pure function
  (`resolveChatSessionId`, unit tested):
  1. a valid session tag → that id;
  2. else a reply `e` tag whose parent is stored **for the same identity and
     peer** → the parent's session (the fallback for unpatched agents);
  3. else `''`.
- Upsert the `nostr_chat_sessions` row when a new session id arrives. Take the
  title from `subject`, trimmed to `NOSTR_CHAT_SESSION_TITLE_MAX`.

### 5.4 Queries and mutations

Add `sessionId` to every peer-scoped query: `listChatThread`,
`listChatThreadReactions`, `getChatReplyParent`, `listChatReplies` and
`markChatThreadRead`. Reply links stay inside one session, following the
existing rule that they stay inside one chat.

`listChatConversations` groups by `(peer_pubkey, session_id)` and joins
`nostr_chat_sessions` for title/archived. `hasOutgoingChatMessage` and
`listPeersWrittenTo` stay per peer, since they are about the person.

### 5.5 Hooks and state

- `nostrChatQueryKeys.thread(identity, protocol, peer, sessionId, limit)`.
- `identityChatKey(identity, protocol, peer, sessionId)` for reply drafts.
- `useNostrChatThread(identity, protocol, peerNpub, peerPubkey, sessionId)`.
- New `useNostrChatSessions(identityNpub, peerPubkey)` (TanStack Query) and
  `useNostrChatSessionCreate`. The create hook makes the id and the local
  row, then navigates. Nothing is published until the first message is sent.
- Input/`sending` state is already per hook instance, so two sessions can be
  sending at the same time.

### 5.6 UI

- `nostrChatThreadHref(npub, peerNpub, protocol, sessionId?)` adds a `session`
  search param to `chat/[peer].tsx`. The route stays the same, and no param
  means the default session.
- Conversation list (`SSNostrConversationList`): a peer with one session looks
  like today. A peer with several shows one row per session (peer name plus
  session title and its own unread badge). Sessions are sorted by last
  activity.
- Thread header: the session title, plus a menu with "New session", "Rename"
  and "Archive".
- `chat/new.tsx` gets an "Open as new session" option when the peer already
  has a thread.
- New i18n keys in `locales/*.json` (`nostrChat.sessions.*`).
- Components stay dumb: grouping and sorting live in `utils/nostrChatRows.ts`.

## 6. Security

- A peer controls the session id and subject: validate both with zod and the
  regex, cap the title length, and render it as plain text only.
- Session spam: a peer could open thousands of sessions. Apply
  `NOSTR_CHAT_SESSIONS_PER_PEER_MAX` at ingest (the oldest archived ones go
  first). The PoW/follow inbound filter (`isInboundAllowed`) still applies to
  every message.
- The reply-parent fallback only looks at the same identity and peer, so a
  stranger cannot pull a message into someone else's session.
- Session ids only exist inside NIP-44 payloads and local SQLite. They are
  never logged and never added to diagnostics reports.
- Privacy mode masks session titles like it masks peer names.

## 7. Part B: remote signing for agents

The agent does the work. Satsigner holds the keys and signs what the user
approves. There are two transports, and both feed **one signing queue** with
one approval UI:

|             | Live (NIP-46 bunker)                                             | Later (sign requests over NIP-17)                                          |
| ----------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| When        | Satsigner is open                                                | Satsigner may be closed for hours                                          |
| How         | `bunker://` link, for `zsp`, `ngit`, `nak` and any NIP-46 client | NIP-46-shaped request and answer, carried in the chat session's gift wraps |
| Agent waits | On the socket (seconds)                                          | Durably: it stops and resumes when the answer arrives                      |

### 7.1 Keys and methods

- **Only the chat identity signs.** That is the identity the session belongs
  to (`[npub]` in the chat route). There is no key picker, and no other
  identity on the device is ever looked up.
  - A request may name a `pubkey`. If it is not the chat identity, it is
    answered with the error `wrong key` and never shown as signable.
  - A watch-only chat identity cannot lend a signer. **Lend signer** is
    hidden, and incoming sign requests are answered with `no signing key`.
- A live bunker offer is for the chat identity, and `get_public_key` returns
  it. A manual offer on `bunker.tsx` uses that page's identity, as pairing
  does today.
- **Every NIP-46 method is supported**, for compatibility with other flows:
  `sign_event` of any kind, `nip04_*`, `nip44_*`, `get_public_key`, `ping` and
  `connect`. Nothing is refused by kind. Kind only decides how loudly the
  card warns and whether a grant (§7.6) can cover it.
- The handlers stay in `utils/nip46Handlers.ts`. `executeHandler` moves out
  of `useNip46SessionManager.ts` into `utils/signingQueue.ts`, so both
  transports call the same code.

### 7.2 Signing queue

- A new table, `nostr_sign_requests`, in the next schema version. It replaces the
  in-memory `pendingRequests` for durable requests, so a request survives an
  app restart:

  ```sql
  CREATE TABLE IF NOT EXISTS nostr_sign_requests (
    id TEXT NOT NULL,              -- request id from the client
    transport TEXT NOT NULL,       -- 'nip46' | 'chat'
    origin_id TEXT NOT NULL,       -- nip46 session id, or chat message id
    identity_npub TEXT NOT NULL,   -- chat identity or bunker identity
    peer_pubkey TEXT,              -- chat origin only
    session_id TEXT,               -- chat origin only
    method TEXT NOT NULL,
    params TEXT NOT NULL,          -- JSON
    batch_id TEXT NOT NULL,        -- request rumor id (nip46: first request id)
    status TEXT NOT NULL,          -- pending | approved | rejected | expired | answered
    result TEXT,                   -- signed answer, kept so a retry never signs again
    received_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (transport, origin_id, id)
  )
  ```

- A live NIP-46 request is queued in memory, as today. If the client gives up
  before the user answers, it is dropped, because nobody is listening any
  more.
- Pure functions in `utils/signingQueue.ts` handle everything else:
  validation, the chat-identity check, batch grouping, expiry and building the answer.
  `hooks/useSigningQueue.ts` stays thin.

### 7.3 Approval UI

- The card shows in the chat thread of the session that asked (a new
  `SSChatSignRequestCard`, built like `SSChatPaymentRequestCard`). A request
  that did not come from a chat shows in the existing `SSNip46ApprovalModal`.
  A conversation row with pending requests gets a signing badge in the
  conversation list, so they are found without opening every session.
- Requests that arrive together are grouped into one card: "4 events to sign
  with _alice_: app listing, release, asset, upload auth". There is one
  **Approve all** / **Reject** pair, and each event can be opened in full.
  Previews are never truncated, as the existing rule says.
- Kind-aware summaries live in `utils/nip46EventSummary.ts` (pure, unit
  tested):
  - 0: profile changes as a diff against the current kind 0.
  - 3: follows added and removed.
  - 5: what gets deleted.
  - 10002 and 10050: relays added and removed.
  - 32267, 30063, 3063 and 24242: as for Zapstore below.
  - Unknown kinds: the raw JSON.
- Kinds that can do lasting damage (0, 3, 5, the lists, 22242 relay auth) and
  every decrypt request get a red banner. They can still be approved.
- A Satsigner-specific check: a 3063 for `com.satsigner.satsigner` with a
  certificate hash other than the release certificate (copied from
  `tools/release/keystore.mjs#RELEASE_CERT_SHA256` into `constants`) gets a
  red warning.

### 7.4 Live transport: `bunker://` issued by Satsigner

- New `utils/nip46Bunker.ts#createBunkerOffer(identity, relays)`. It returns
  `bunker://<pubkey>?relay=…&secret=<32 random bytes, hex>` and a pending
  `Nip46Session` with no `clientPubkey` yet.
- The **first `connect` carrying the secret** binds the session to that
  client. The secret is then spent. An offer nobody uses expires after
  `NOSTR_NIP46_OFFER_TTL_MS` (10 min).
- `Nip46SessionSchema` gains
  `origin: { kind: 'chat'; peerPubkey; sessionId } | { kind: 'manual' }`,
  `grant?` and `expiresAt?`.
- **Lend signer** in the thread menu: Satsigner sends the
  offer as a NIP-17 message in that session, with the tag
  `["bunker", "<url>"]` and readable text. On `bunker.tsx` there is also a
  QR / copy option for tools run by hand (`origin: manual`).
- The bunker runs only while the app is open and unlocked, as today. When a
  live request times out, the agent switches to the later transport (§7.5).

### 7.5 Later transport: sign requests over NIP-17

The request and answer reuse the NIP-46 JSON-RPC shape, so the handlers and
the agent tooling stay the same. They travel as kind 14 rumors in the chat
session, which gives:

- the same encryption;
- the same inbound filter and per-peer trust;
- delivery whenever the app next syncs.

**Request** (agent → Satsigner), in the session:

```
kind 14
content: "Signature request: 4 events (app listing, release, asset, upload auth)"
tags:
  ["p", <user identity pubkey>]
  ["session", <session id>]
  ["sign_request", "<json>"]
```

`<json>` is
`{ "id", "method", "params", "pubkey"?, "expires"?, "label"? }`:

- `method` and `params` are exactly as in NIP-46, so no new method is added.
- `pubkey`, if given, must be the chat identity (§7.1).
- `expires` is a unix time, capped at `NOSTR_SIGN_REQUEST_MAX_TTL_SECS`
  (7 days).
- **Batch:** one rumor carries several `sign_request` tags (at most
  `NOSTR_SIGN_REQUEST_BATCH_MAX`). The rumor is the batch. It is approved or
  rejected as a whole, and answered with one rumor holding one
  `sign_response` tag per request.

**Answer** (Satsigner → agent), in the same session:

```
kind 14
content: "Signed 4 events" | "Rejected"
tags:
  ["e", <request message id>, "", "reply"]
  ["session", <session id>]
  ["sign_response", "<json: { id, result } | { id, error }>"]
```

`result` is the signed event as NIP-46 returns it, one `sign_response` per
request. The content is
plain text, so other NIP-17 clients still show something sensible.

**On the phone:**

- `ingestChatRumor` passes a `sign_request` tag to `utils/signingQueue.ts`.
  The queue validates it with zod (size caps, method allowlist, well-formed
  unsigned events) and stores the row. The message still shows in the thread,
  rendered as the request card.
- The request is inactive once it is expired, answered or rejected. When the
  same id arrives again, it is ignored.
- Approving signs with the chat identity, then sends the answer with
  `sendNip17Chat` (same session, `e` reply tag). If sending fails, the row
  stays `approved`, and the answer is retried from the chat outbox. The
  signatures are stored with the row, so a retry never signs again.
- `created_at`: when an event leaves it out, Satsigner sets it to the time of
  signing. When it is set, it must be within `NOSTR_NIP46_MAX_CLOCK_SKEW_SECS`
  of the **request** time, not of the signing time, so signing a day later
  still works. Anything else is rejected, which stops back-dating.

**Agent side, continuing the work** (upstream, `@pi-nostr/durable-nip17` +
`@pi-nostr/core`):

- A new tool, `nostr_request_signature({ requests: [{ method, params }],
label? })`. It sends the request in the current session and returns right
  away with the request id. The agent is told it will get the result as a new
  message.
- A new doc, `Nip17SignRequests` (scope: conversation), keeps
  `{ id → { status, result? } }`.
- The bridge's `admit` reads `sign_response` before anything else.
  1. It checks that the answer comes from the user's identity, matches a
     pending id in that conversation, and has a valid signature from the
     user's chat identity (`verifyEvent` on every returned event).
  2. It stores the result in the doc.
  3. It submits a message to the same durable conversation: "Signature
     request `<label>` was approved: N signed events are available with
     `nostr_signature_result(id)`" (or "rejected" / "expired").
- That submission is an ordinary reply task, so the agent wakes up in the
  right session with its context intact, even after a restart.
- `nostr_signature_result(id)` returns the signed events, or writes them to a
  file for CLI tools (for example `/tmp/<id>.jsonl` for `nak event`).
- The agent can also poll with `nostr_signature_result` while it waits on
  other work. Nothing blocks.

### 7.6 Grants (fewer taps)

Plain version: when you approve a request, you can tick **"also sign
requests like this one, for the next 30 minutes"**. Matching requests are
then signed without asking. Example: the release takes 6 signatures, and you
tap once instead of six times.

- A grant covers one transport origin (one bunker or one chat session), one
  key, a set of kinds, a maximum count and an end time (at most
  `NOSTR_NIP46_GRANT_MAX_MS`). It can be narrowed to one Zapstore app id.
- Kinds with a red banner (§7.3) and every decrypt request **always ask**,
  even inside a grant.
- Every request signed under a grant is listed in the thread as "signed
  automatically", with a **Revoke** button.
- A grant ends when its count or time runs out, when it is revoked, when the
  session is archived, or when the app locks.
- `canAutoApproveRequest` stays the single gate, with a grant branch added.

### 7.7 Zapstore with the later transport

1. The agent builds and signs the APK with its own keystore.
2. It runs `SIGN_WITH=<npub> zsp publish zapstore.yaml --offline`. The
   events go to stdout and the upload manifest to stderr. The events are
   32267, 30063 and 3063. The 3063 already names the blob hash, so the upload
   does not have to happen first.
   **To verify:** `zsp identity` documents that an npub signer gives
   unsigned output, but `zsp publish` does not say so. If `publish` can't do
   it, add the flag upstream in zapstore/zsp, or have the agent build the
   events from `zsp`'s templates.
3. The agent builds the 24242 Blossom upload auth for that hash, with an
   `expiration` a little after the request's `expires`. It then calls
   `nostr_request_signature` with all 4 events and stops.
4. Later, the user opens Satsigner, sees one card in the session and approves
   it.
5. The agent wakes, uploads the APK with the signed 24242, publishes the
   events to `wss://relay.zapstore.dev` (`nak event`), and reports back in
   the session.
6. If the 24242 expired first, the agent asks only for a fresh 24242.

The live path is the same flow with `SIGN_WITH=bunker://…`, when the app is
open.

### 7.8 Security (Part B)

- **The agent is not trusted.** It can be prompt-injected. Nothing is signed
  without a tap, except inside a narrow, time-boxed grant. High-risk kinds
  and decrypt requests always ask.
- **Who may ask.** Chat sign requests are accepted only from a peer that the
  user has written to in that session (`hasOutgoingChatMessage` plus the
  session). A stranger's `sign_request` shows as plain text and is never
  queued. Requests are capped per peer (`NOSTR_SIGN_REQUESTS_PENDING_MAX`)
  and by size (`NOSTR_SIGN_REQUEST_MAX_BYTES`).
- **Wrong key.** Only the chat identity can sign, so an agent cannot get a
  signature from another identity on the device, even by naming it. The
  card shows the identity's name and colour anyway.
- **Decrypt over chat.** A decrypt answer means plaintext crosses to the
  agent. It is supported, but the card names the counterparty whose messages
  get decrypted, and grants never cover it.
- **Pairing race (live).** The secret is single use and expires after 10
  min. The pairing is announced in the thread with **Revoke**.
- **Replay.** Request ids are unique per origin. Answered or expired ids are
  never processed again. The agent checks every returned signature, and
  `created_at` is bound to the request time.
- **Storage.** `nostr_sign_requests` holds unsigned events and signatures,
  no secrets. Rows are deleted 30 days after they settle, or with their
  session. Identity wipe,
  duress wipe and `secureWipe` clear the table, bunker offers and grants.
- Bunker secrets, request payloads and grants are never logged and never put
  in diagnostics.

## 8. Tests

- Unit: `nostrChatTags` (session/subject build and parse, invalid ids),
  `resolveChatSessionId` (tag, reply fallback, cross-peer parent ignored,
  default), conversation grouping in `nostrChatRows`.
- DB: the sessions migration on an existing database. Existing rows land in `''`.
- Int (`tests/int/api/nip17-roundtrip.test.ts`): the tag survives
  wrap → unwrap. The self copy lands in the same session.
- Relay (`tests/relay/chat.test.ts`): two sessions with one peer stay
  separate, unread counts are per session, and a tagless reply to a session
  message lands in that session.
- Part B unit tests:
  - `signingQueue`: chat identity only (another identity's pubkey gets
    `wrong key`; a watch-only identity gets `no signing key`), zod caps,
    batch size and all-or-nothing approval, expiry, duplicate ids, `created_at` bound to the
    request time, and the answer built once and reused on retry.
  - `createBunkerOffer`: link format, a single-use secret, expiry.
  - `canAutoApproveRequest` with grants: origin, key, kinds, count, expiry,
    app-id scope, and high-risk kinds or decrypt still asking.
  - Event summaries per kind (0 diff, 3, 5, the lists, the Zapstore kinds),
    and the certificate warning.
  - Chat sign requests from a peer the user never wrote to are not queued.
- Part B relay tests:
  - Live: a `nostr-tools` `BunkerSigner` pairs through an offer and signs a
    kind 0 and a 32267 with the chat identity.
  - Later: the agent sends a 4-request batch, the app is restarted, the
    batch is approved, and the answer arrives with valid signatures from the
    chat identity. A request naming another identity is refused. A replayed answer is ignored.
- Agent side (pi-nostr): the bridge wakes the right conversation on a
  `sign_response`, rejects forged or mismatched answers, and survives a
  restart between request and answer.

## 9. Phases

1. **Protocol + storage**: tags, the sessions migration, ingest resolution and queries, with the
   default session behaving exactly as today. Ship and verify no regressions.
2. **Send + UI**: new session, session rows, header menu, i18n.
3. **Agent patch**: PR to pi-nostr (`durable-nip17`) as described in §4, and
   agree the tag name there.
4. **Polish**: rename/archive, the spam cap, and the `subject` title shown in
   other clients.
5. **Signing queue**: `utils/signingQueue.ts`, the next schema version, signing with the
   chat identity, the shared approval card and the list badge. The
   existing NIP-46 flow moves onto it with no change in behaviour.
6. **Live transport**: `bunker://` offers, **Lend signer**, the manual offer
   on `bunker.tsx`.
7. **Later transport**: `sign_request` / `sign_response` in NIP-17 sessions,
   the outbox retry and batches.
8. **Agent tools (upstream)**: `nostr_request_signature`,
   `nostr_signature_result`, waking the conversation on a response.
9. **Grants**, then an end-to-end dev-channel Zapstore release on both
   transports.

## 10. Implementation notes (Part A)

- The migration is `SCHEMA_V14` on master. `feat/account-passwords` also adds
  a `SCHEMA_V14`, so whichever merges second renumbers its migration.
- Queries take a `NostrChatThreadRef` (identity, protocol, peer, session)
  instead of positional arguments.
- `sendNip17Chat` takes `{ replyToId, sessionId }`. The `subject` tag goes on
  a session's first message only, from the local title.
- A session over `NOSTR_CHAT_SESSIONS_PER_PEER_MAX` is refused at ingest,
  and its wrap is marked processed, so it is never decrypted again.
- The incoming `subject` only names a session the first time. A later one
  can't rename it.
- "Delete for everyone" sends one kind 5 naming every message we sent in the
  session, then asks relays to drop the wraps.
- Not done yet: the "Open as new session" option in `chat/new.tsx` (the
  thread menu covers it), and the `bot` header button.

## 11. Implementation notes (Part B)

- **Storage.** `SCHEMA_V15` adds `nostr_sign_requests`. One chat message is
  one batch. It is decided once (`decideSignRequestBatch` refuses a batch
  that is already signed, rejected, expired or answered), and the signed
  answer is kept so a resend never signs again.
- **Transport.** Requests arrive as `sign_request` tags, or as fenced
  `nostr-sign-request` JSON blocks for agents whose tools only send text.
  Answers carry both `sign_response` tags and a `nostr-sign-response` block.
  A batch is several requests in one message, so no new NIP-46 method was
  added. `connect` is refused over chat.
- **Checks at ingest** (`utils/signingQueue.ts`):
  - A request that names another key is stored as invalid (`wrong key`).
  - An event dated more than `NOSTR_SIGN_MAX_CLOCK_SKEW_SECS` from the
    request is invalid.
  - A message dated in the future, compared with the local clock, is
    invalid, because it would let events be pre-dated.
  - Only a peer we wrote to in that session can queue requests.
  - There are caps on pending requests per peer and on batch size and
    message size.
- **Live signer.** `bunker://` offers come from `utils/nip46Bunker.ts`. The
  first `connect` with the secret claims the offer, which is compared in
  constant time. The secret is then dropped, the offer expires after 10
  minutes, and an unclaimed offer is forgotten on restart or lock.
  - Signers lent in a chat never auto-approve: "always allow" is hidden and
    ignored for them.
  - Their `sign_event` calls must be dated near now.
  - Archiving or deleting the session revokes them.
- **Grants (§7.6)** were not built. Batches make a Zapstore release a single
  tap.
- **Agent side** (§7.5: `nostr_request_signature`, waking the conversation)
  is upstream work for pi-nostr. Until then, an agent can send the fenced
  block as plain text and read the fenced answer.

## 12. Decisions

Agreed with the developer:

- Only the chat identity signs. Every NIP-46 method is supported (§7.1).
- Signing later is in, and the agent resumes once the signature arrives
  (§7.5).

Recommended (to confirm):

1. **Session tag name: `session`.** It is short and generic, and it lives
   inside the encrypted rumor, so it can't clash with anything public. Raise
   it with the pi-nostr maintainer before phase 3. Write a NIP draft only
   after both Satsigner and pi-nostr ship it, so the draft describes
   something that works.
2. **"New session" for every peer**, in the thread menu. A client without
   support just sees one longer thread, so nothing breaks. Promote it to a
   header button when the peer's kind 0 has `bot: true` (NIP-24 defines that
   field), which is where parallel sessions matter.
3. **Archive is a local hide, and it can be undone.** A separate **Delete
   session** removes the session locally. It then offers to send NIP-09 wrap
   deletions for my own messages, reusing `deleteChatMessageForEveryone`. A
   peer's copies are theirs, and the agent may need its history.
4. **Signing tags: `sign_request`, `sign_response` and `bunker`.** The JSON
   is NIP-46 unchanged, and a batch is several tags in one rumor (§7.5), so
   the NIP-46 method set doesn't grow. Agree the names with pi-nostr at the
   same time as `session`. Propose them together as one small NIP: "sessions
   and remote signing over NIP-17".
5. **Delete settled sign requests after 30 days, or with their session**,
   whichever comes first. The chat message stays, and its card renders as
   "signed", "rejected" or "expired" from the message alone, so nothing
   visible is lost. The rows only exist for retries and replay protection,
   and 30 days is well past the 7-day request cap.
6. **Keep grants, but ship them last** (phase 9). Batches already turn a
   Zapstore release into one tap. Grants only help with long tasks that keep
   asking. If phases 5–8 feel fine without them, drop them.

## 12. Part C: agent status in the session

### 12.1 What the terminal shows

The pi footer with the `routstr-balance` extension:

```
↑24 ↓3.0k R125k W11k CH99.1% 1.5%/1.0M (auto)      (routstr) claude-opus-5.5 • medium
⚡ 47709 + 437 sat ($28.86) · session 115 sat ($0.069)
```

| Shown                       | Meaning                                     | Where the bridge gets it                                                                                           |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `↑24 ↓3.0k`                 | input / output tokens in the pi session     | RPC `get_session_stats` → `tokens.input`, `tokens.output`                                                          |
| `R125k W11k`                | prompt cache read / write tokens            | `get_session_stats` → `tokens.cacheRead`, `tokens.cacheWrite`                                                      |
| `CH99.1%`                   | cache hit rate of the **last** request      | the last assistant `message_end` usage: `cacheRead / (input + cacheRead + cacheWrite)`                             |
| `1.5%/1.0M (auto)`          | context used / context window, auto-compact | `get_session_stats` → `contextUsage` (`tokens`, `contextWindow`, `percent`); `get_state` → `autoCompactionEnabled` |
| `(routstr) claude-opus-5.5` | provider and model                          | `get_state` → `model.provider`, `model.id`                                                                         |
| `medium`                    | thinking level                              | `get_state` → `thinkingLevel` (only when `model.reasoning`)                                                        |
| `47709 + 437 sat`           | routstr wallet + API key balance            | `routstrd balance` (`topup.mjs#readBalance` already parses it)                                                     |
| `($28.86)`                  | fiat value                                  | mempool.space price. **Satsigner computes this itself**, see §12.6                                                 |
| `session 115 sat`           | routstr spend since the pi session started  | `routstrd usage`, summed for `client: pi-agent` after the session start                                            |

The bridge (`pi-nip17-bridge/responder.mjs`) already holds an `RpcClient`,
calls `getState()` every minute for its health check, and keeps the routstr
balance in `status.routstrSats`. Today it only shows them in
`bridge-status.json`, the local dashboard and the `!pi status` reply. All the
data is there; it just never reaches the chat.

### 12.2 Options

1. **Text in the reply.** The bridge appends a footer line to every answer.
   Works in every client, but it is noise in the thread, it is stale between
   replies, and Satsigner would have to parse prose. Rejected.
2. **A tag on every kind 14 reply.** `["agent_status", "<json>"]` on the
   bridge's answers. No extra wraps. But the status only moves when the agent
   speaks, so a top-up or a model switch stays invisible until the next answer.
3. **A status rumor in the session (recommended).** A separate gift-wrapped
   rumor that only carries state. Sent after each turn and on every change
   (model, thinking level, top-up, compaction). Clients that don't know it
   ignore it, as Satsigner and the bridge already do with unknown kinds.
4. **A public event** (NIP-78 kind 30078, a profile field). Rejected: the
   balance, the model and how much the user works with the agent would be
   public and signed by the agent's key.

Recommended: option 3 for the header. The bridge also ships a narrow form of
option 2: each reply carries what _that_ answer cost and which model wrote
it (§12.3.1). That isn't session status; it belongs to the message, and the
state rumor can't say it.

### 12.3 Protocol: session state rumor

A kind 30078 rumor (NIP-78 "application data"), **only ever inside a NIP-17
gift wrap**, so relays see a kind 1059 like any message. NIP-78 is
addressable, which gives the right semantics for free: one current document
per `(author, d)`, newest `created_at` wins.

```
kind 30078   (rumor, never published unwrapped)
content: "<json>"
tags:
  ["d", "nip17-session-state"]
  ["p", <other participant>]
  ["session", <session id>]      // absent = default session
```

- **Each participant publishes its own document.** The agent publishes what
  it runs on; the user publishes what they ask for. Nobody edits someone
  else's document, so there is nothing to merge, and the seal already proves
  who wrote it. In a group chat every member's document shows; that answers
  "all users in a chat can see it" without a shared mutable object.
- **Scope.** Fields under `session` belong to that session (context, tokens).
  Fields under `agent` are the same for every session (balance, default
  model). The bridge sends the `agent` part in every session's document, so
  a client never has to look elsewhere.
- **Wraps.** Sent with kind 1059 to the peer only, without a self copy
  (the agent has no other device that needs it). Frequent pulses while a
  turn runs, if wanted later, use kind 21059 (ephemeral, not stored), as the
  typing indicator in `rich-dm-research.md` does.
- **Rate.** At most one document per session per `NOSTR_CHAT_STATE_MIN_INTERVAL`
  (30 s), except right after a reply or a change the user asked for.

Agent document (`content`):

```json
{
  "v": 1,
  "agent": {
    "name": "pi",
    "provider": "routstr",
    "balance": { "unit": "sat", "wallet": 47709, "apiKeys": 437, "low": false }
  },
  "session": {
    "model": {
      "provider": "routstr",
      "id": "claude-opus-5.5",
      "name": "Anthropic: Claude Opus 5.5",
      "reasoning": true,
      "vision": true
    },
    "thinkingLevel": "medium",
    "context": { "tokens": 15000, "window": 1000000, "autoCompact": true },
    "tokens": {
      "input": 24,
      "output": 3000,
      "cacheRead": 125000,
      "cacheWrite": 11000
    },
    "cacheHitRate": 0.991,
    "spent": { "unit": "sat", "amount": 115 },
    "busy": false
  },
  "options": {
    "models": [
      { "provider": "routstr", "id": "claude-opus-5.5" },
      { "provider": "routstr", "id": "glm-5.3" }
    ],
    "thinkingLevels": ["off", "low", "medium", "high", "xhigh", "max"]
  }
}
```

User document (`content`): only what the user wants changed.

```json
{
  "v": 1,
  "want": {
    "model": { "provider": "routstr", "id": "glm-5.3" },
    "thinkingLevel": "high"
  }
}
```

The agent applies a `want` (RPC `set_model`, `set_thinking_level`), then
sends its new document. The user's document is a request, the agent's is the
truth: Satsigner always shows the agent's values, with "switching…" while a
`want` it sent is newer than the agent's last document.

The session title stays the NIP-17 `subject` (Part A). It is not repeated
here.

#### 12.3.1 Per-reply tags (as shipped by pi-nip17-bridge)

The bridge's `docs/satsigner-agent-cost.md` is the source of truth. On the
**last** kind 14 chunk of each agent answer:

- `["agent_cost", "<json>"]`: `{ v: 1, unit: "sat", amount, requests,
partial?, tokens?, models?, durationMs? }`. `amount ≤ 10_000_000`,
  `requests 1…10_000`, tag ≤ 2 KB. `partial: true` means a lower bound.
- `["agent_model", "<json>"]`: `{ v: 1, provider, id, name?, thinkingLevel?,
used? }`. Sent even when the cost is unknown.

Absent means unknown, not free. Command replies, notices and reactions carry
neither. The sum of `agent_cost` in a session can be lower than
`session.spent`; show both, don't reconcile.

#### 12.3.2 Agent document as shipped

Two differences from the draft above:

- `session.shared` is **`session.sharedModel`**. The bridge keeps one pi
  session file per chat session, so context, tokens and spend are per
  session; only the model setting is shared across sessions.
- `session.spent.partial: true` when some requests couldn't be matched.
  `context.tokens` may be absent right after a compaction, and
  `thinkingLevel` is absent for models without reasoning.

The bridge sends it after every reply, after `!pi new` (counters zeroed),
after `!pi restart`, and after a paid top-up (to every session used in the
last 24 h). Not on compaction: the context share can lag until the next
reply. `want` is not handled yet.

### 12.4 Agent side (pi-nip17-bridge, then upstream)

`responder.mjs` already has every input:

- `pi.getState()` and `pi.getSessionStats()` after each `agent_settled`,
  plus the last assistant usage from `onPiEvent` for the cache hit rate.
- `status.routstrSats` from `topup.mjs`. Return wallet and API keys
  separately instead of the sum, and keep the session spend by summing
  `routstrd usage` entries since the pi session started (the same rule as
  `routstr-balance.ts#sumSessionSats`).
- `getAvailableModels()` and `getAvailableThinkingLevels()` for `options`.

Changes:

1. `sendSessionState(to, sessionId)`: build the document, wrap it like
   `react()` does, publish to the peer only.
2. Call it after each reply, after `!pi new` / `!pi restart`, after a top-up
   lands, and after a model or thinking change.
3. `handleRumor`: accept kind 30078 with `d = nip17-session-state` from an
   admin. Validate `want` against `options` (never a free-form model id),
   apply it, answer with the new document. Anything else in it is ignored.
4. Upstream, the same in `@pi-nostr/durable-nip17` once Part A's session
   patch (§4) lands, so the state is per durable conversation.

**Shipped:** the bridge keeps one pi session file per chat session, so
context, tokens and spend are per session. The `PI_AGENTS` processes still
share one model setting, which the document says with
`"sharedModel": true`. Satsigner then notes in the sheet that switching the
model in one session switches it in every session.

### 12.5 Satsigner

Phase 2 (read only) is implemented as below. Differences from the first
draft: the per-reply tags are included, the store keeps the validated JSON
re-parsed on read, and a document is accepted only for a session we already
have (a known session row, or the default session with a peer we wrote to)
so a peer can't fill the table with made-up session ids.

- **Per reply.** `parseAgentReplyTags` (zod, capped) on incoming kind 14
  only, never our self copies. Nullable `agent_cost` / `agent_model` JSON
  columns on `nostr_chat_messages` (`SCHEMA_V17` in the release stack, `SCHEMA_V15` on its own branch). A dim
  `model · thinking · 272 sats` line under the bubble (`≥`/`+` when
  partial, masked in privacy mode), and a "Reported by the agent" block on
  the message detail page: model, models used, cost with fiat, requests,
  tokens, duration.

- **Parse.** `utils/nostrChatState.ts`: a zod schema for both documents,
  every field optional, numbers finite and non-negative, strings capped
  (`NOSTR_CHAT_STATE_STRING_MAX`), arrays capped, whole content capped
  (`NOSTR_CHAT_STATE_MAX_BYTES`). Unknown fields dropped. Pure and unit
  tested.
- **Ingest.** `ingestChatRumor` gets a fourth branch next to deletion and
  reaction: kind 30078 with that `d`. The session comes from the tag, with
  the same `resolveChatSessionId` and per-peer session cap as messages. The
  author must be the peer or us (seal-authenticated, as for messages).
  Older than the stored one → dropped.
- **Store.** New table in the next schema version, one row per
  `(identity_npub, peer_pubkey, session_id, author)` with `content` and
  `created_at`. Wipes (`deleteChatMessagesForIdentity`, `secureWipe`) clear
  it, as with `nostr_chat_sessions`.
- **Hooks.** `useNostrChatSessionState(thread)` (TanStack Query, invalidated
  by the chat event observer) and `useNostrChatSessionStateUpdate(thread)`,
  which sends the user document with the existing wrap helpers.
- **UI.**
  - Thread header, under the session title: one compact line,
    `claude-opus-5.5 · medium · 1.5% of 1M · 48.1k sat`. The context part
    turns warning at 70% and error at 90%, as in the pi footer.
  - Tap → `SSChatSessionStateSheet`: everything in §12.1, "updated 2 min
    ago", the model and thinking pickers (from `options`), and a "Top up"
    row when `balance.low` (it scrolls to the invoice the bridge already
    sends; nothing is paid automatically).
  - The line hides when the peer never sent a document, so ordinary
    contacts look as today. Stale after `NOSTR_CHAT_STATE_STALE_MS`
    (10 min): greyed, with the age.
  - Components only render props; formatting (`formatTokens`, percent,
    staleness) lives in `utils/nostrChatState.ts`.
  - New i18n keys under `nostrChat.sessionState.*`.

### 12.6 Security and privacy

- **Never public.** The document only exists inside NIP-44 payloads and
  local SQLite. No public kind 30078, no profile field.
- **Untrusted input.** Every value comes from the peer. Plain-text rendering
  only, capped strings, numbers checked. The model list only fills a picker;
  a model id is never opened as a link or run.
- **Fiat.** The agent sends sats only. Satsigner converts with its own price
  source and the user's currency, so an agent can't show a misleading fiat
  amount, and it follows the user's privacy settings.
- **Privacy mode** masks the balance and spend, like other amounts.
- **No automatic action.** A low balance shows a hint; paying stays the
  normal invoice card flow. A `want` the agent didn't confirm changes
  nothing on screen except "switching…".
- **Agent side.** Only admins can send a `want`. Model ids must be in
  `options`. The document never carries keys, invoices, cashu tokens, file
  paths or prompt text, and goes through `redact()` like everything else.
- **Metadata.** A status wrap after each reply doubles the wraps the agent's
  relay sees for that conversation, nothing more. The 30 s floor stops a
  busy agent from flooding the user's inbox relays.

### 12.7 Tests

- Unit: schema caps and bad values, newest-wins, author check, session
  resolution and cap, formatting (tokens, percent, staleness, masking).
- Relay: the agent document lands in the right session and updates the
  header; a `want` round-trips; a document from a stranger is dropped.
- Bridge: the document matches `get_state` / `get_session_stats`; a `want`
  for a model outside `options` is refused.

### 12.8 Phases

1. Bridge: send the agent document after each reply (no `want` yet). Done,
   with the per-reply `agent_cost` / `agent_model` tags.
2. Satsigner: parse, store, header line and sheet, read only, plus the
   per-reply line and detail rows. Done.
3. `want`: model and thinking pickers, applied by the bridge.
4. Upstream to `@pi-nostr/durable-nip17` with §4, so the values are per
   session.

### 12.9 Open questions

1. **Kind.** NIP-78 kind 30078 inside the wrap reads well, but a reviewer
   may object to reusing an addressable public kind as a rumor. The
   alternative is a new kind proposed with `session` and `sign_request` in
   the same NIP (§11.4). Decide with the pi-nostr maintainer.
2. **Session spend. Solved in the bridge.** It matches each assistant
   message's tokens in the session's pi file to routstrd's usage rows, so
   parallel sessions don't mix and restarts don't reset it. `spent.partial`
   flags rows it couldn't match.
3. **Should the user document carry more?** For example a per-session
   budget cap ("stop at 500 sat"). Useful, but it is a new policy the agent
   must enforce; leave it for after phase 3.
