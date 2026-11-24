# Plan: Agent Chat Sessions and Remote Signing

**Status**: Part A implemented on `feat/nostr-chat-sessions`; Part B on `feat/nostr-chat-signing`
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

## 11. Decisions

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
