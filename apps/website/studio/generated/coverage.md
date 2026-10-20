# Studio coverage

**116 / 175 routes** (66%) have a Studio screen.

| Area | Covered | Missing routes |
|---|---|---|
| _session | 0/1 | `/_session` |
| converter | 1/2 | `/converter/energy` |
| explorer | 16/16 |  |
| home | 1/1 |  |
| setDuressPin | 0/1 | `/setDuressPin` |
| setPin | 0/1 | `/setPin` |
| settings | 25/25 |  |
| signer/ark | 2/15 | `/signer/ark/account/:id/address/:addr/label`, `/signer/ark/account/:id/movement/:movementId`, `/signer/ark/account/:id/movement/:movementId/label`, `/signer/ark/account/:id/pay-invoice`, `/signer/ark/account/:id/receive`, `/signer/ark/account/:id/receive-lnurl-withdraw`, `/signer/ark/account/:id/send`, `/signer/ark/account/:id/send/confirm`, `/signer/ark/account/:id/settings`, `/signer/ark/account/:id/settings/board`, `/signer/ark/account/:id/settings/offboard`, `/signer/ark/account/add`, `/signer/ark/receive` |
| signer/bitcoin | 59/59 |  |
| signer/ecash | 5/14 | `/signer/ecash/account/:id/proof/:proofIndex`, `/signer/ecash/account/:id/settings`, `/signer/ecash/account/:id/settings/backup`, `/signer/ecash/account/:id/settings/mint`, `/signer/ecash/account/:id/settings/recovery`, `/signer/ecash/account/:id/settings/seed`, `/signer/ecash/receive`, `/signer/ecash/send`, `/signer/ecash/transaction/:id` |
| signer/lightning | 3/10 | `/signer/lightning/invoice`, `/signer/lightning/node/backup`, `/signer/lightning/node/channel/:chanId`, `/signer/lightning/node/open-channel`, `/signer/lightning/node/settings`, `/signer/lightning/node/transaction/:txId`, `/signer/lightning/pay` |
| signer/nostr | 4/27 | `/signer/nostr/account/:npub/blossom`, `/signer/nostr/account/:npub/bunker`, `/signer/nostr/account/:npub/cache`, `/signer/nostr/account/:npub/calendar`, `/signer/nostr/account/:npub/chat`, `/signer/nostr/account/:npub/chat/:peer`, `/signer/nostr/account/:npub/chat/new`, `/signer/nostr/account/:npub/compose`, `/signer/nostr/account/:npub/contact/:targetNpub`, `/signer/nostr/account/:npub/contacts`, `/signer/nostr/account/:npub/files`, `/signer/nostr/account/:npub/files/:sha256`, `/signer/nostr/account/:npub/keys`, `/signer/nostr/account/:npub/note`, `/signer/nostr/account/:npub/profile`, `/signer/nostr/account/:npub/send`, `/signer/nostr/account/:npub/settings`, `/signer/nostr/account/:npub/zap/:zapId`, `/signer/nostr/account/:npub/zapSettings`, `/signer/nostr/create`, `/signer/nostr/create/profile`, `/signer/nostr/import`, `/signer/nostr/relays` |
| unlock | 0/1 | `/unlock` |
| upcoming | 0/1 | `/upcoming` |
| warning | 0/1 | `/warning` |
