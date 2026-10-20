/* Nostr — app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/nostr/*
   Ports every Nostr route not hand-ported in screen.js ('nostr', 'nostr-account',
   'nostr-relays', 'nostr-add'). Registered with registerScreen() from screens.js.
   Fixture data only: demo npubs, profiles, notes, zaps, chats and files. */

document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
  /* Avatars: SSNostrAccountCard / SSNostrHeroCard / feed rows (fallback letter discs) */
  .no-avatar { display: inline-flex; flex: none; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 50%; border: 1px solid rgba(255,255,255,0.18); background: var(--gray-800); color: var(--white); font-weight: var(--sizes-text-font-weight-bold); }
  .no-dot { display: inline-block; flex: none; width: 8px; height: 8px; border-radius: 4px; }
  .no-mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .no-list { display: flex; flex-direction: column; gap: 8px; }
  .no-card[hidden], .no-relay[hidden], .no-row[hidden] { display: none; }
  /* Equal-width action rows; SSClipboardCopy wraps its button in a span that must stretch too */
  .no-eq > * { flex: 1; min-width: 0; }
  .no-eq > .ss-copy > .ss-button { width: 100%; }
  .no-break .ss-text { word-break: break-all; }
  .no-empty { padding: 40px 0; text-align: center; }

  /* SSNostrAccountCard (contact rows) */
  .no-card { display: flex; align-items: center; gap: 16px; width: 100%; box-sizing: border-box; padding: 14px; border: 0; border-top: 1px solid var(--gray-800); border-radius: var(--sizes-button-border-radius); background: var(--gray-925); color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .no-card:active { opacity: 0.8; }
  .no-card-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .no-card-text .ss-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

  /* Underlined tab bar (chat/index.tsx, import/index.tsx, SSNostrFeedTabs) */
  .no-tabs { display: flex; border-bottom: 1px solid var(--gray-800); }
  .no-tab { position: relative; flex: 1; height: 48px; border: 0; padding: 0; background: none; color: var(--gray-300); font: inherit; font-size: var(--sizes-text-font-size-sm); text-transform: uppercase; cursor: pointer; }
  .no-tab.is-on { color: var(--white); }
  .no-tab.is-on::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--white); }

  /* settings.tsx chiclets */
  .no-chiclets { display: flex; gap: 8px; }
  .no-chiclet { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; border: 0; padding: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
  .no-chiclet:active { opacity: 0.7; }
  .no-chiclet-tile { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 1; border-radius: var(--sizes-button-border-radius); overflow: hidden; background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0)), var(--gray-950); color: var(--white); }

  /* SSNostrHeroCard */
  .no-hero { position: relative; display: flex; flex-direction: column; align-items: center; padding-bottom: 12px; }
  .no-hero-banner { position: absolute; top: 0; left: 0; right: 0; height: 160px; overflow: hidden; background: var(--gray-850); }
  .no-hero-banner::before { content: ""; position: absolute; inset: 0; background: radial-gradient(120% 90% at 30% 20%, rgba(167,255,175,0.10), transparent 60%), radial-gradient(90% 80% at 80% 40%, rgba(255,113,113,0.08), transparent 60%); }
  .no-hero-banner::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 60px; background: linear-gradient(180deg, rgba(10,10,10,0), rgba(10,10,10,0.6), rgba(10,10,10,0.9), #0a0a0a); }
  .no-hero .no-avatar { position: relative; margin-top: 20px; border-width: 1.5px; border-color: rgba(255,255,255,0.15); }
  .no-hero-meta { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 12px; padding: 0 var(--layout-main-container-padding-horizontal); text-align: center; }
  .no-hero-about { max-width: 300px; margin-top: 6px; }

  /* Feed rows (SSNostrFeedNoteRow, zap rows) */
  .no-feed-row { display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box; padding: 12px 0; border: 0; border-bottom: 1px solid var(--gray-875); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .no-feed-row:active { opacity: 0.7; }
  .no-author { display: flex; align-items: center; gap: 16px; }
  .no-zap-row { display: flex; align-items: center; gap: 8px; }
  .no-zap-row .no-grow { flex: 1; min-width: 0; }
  .no-zap-amount { text-align: right; }
  .no-zap-amount.is-in { color: var(--main-green); }
  .no-zap-amount.is-out { color: var(--main-red); }

  /* Chat (SSNostrConversationList, SSChatThread, SSNostrMessage) */
  .no-convo { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 0; border: 0; border-bottom: 1px solid var(--gray-875); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .no-convo:active { background: var(--gray-900); }
  .no-convo-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .no-convo-text .ss-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .no-convo-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .no-unread { min-width: 18px; height: 18px; box-sizing: border-box; padding: 0 5px; border-radius: 9px; background: var(--white); color: var(--black); font-size: var(--sizes-text-font-size-xs); line-height: 18px; text-align: center; }
  .no-thread { display: flex; flex-direction: column; height: 100%; }
  .no-messages { flex: 1; min-height: 0; overflow: auto; padding-bottom: 8px; }
  .no-msg { margin-top: 8px; padding: 5px 10px 15px; border-radius: 8px; background: var(--gray-900); }
  .no-msg.is-own { background: var(--gray-800); }
  .no-msg-author { display: flex; align-items: center; gap: 6px; }
  .no-msg-body { padding-left: 30px; }
  .no-composer { display: flex; gap: 8px; padding-bottom: 16px; }
  .no-composer textarea { flex: 0.8; min-height: 60px; box-sizing: border-box; padding: 10px; border: 0; border-radius: 8px; background: var(--gray-900); color: var(--white); font: inherit; resize: none; outline: none; }
  .no-composer textarea::placeholder { color: var(--gray-500); }
  .no-composer .ss-button { flex: 0.2; height: auto; min-height: 60px; }

  /* calendar.tsx, files list, cache rows */
  .no-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--gray-875); }
  .no-row .no-grow { flex: 1; min-width: 0; }
  button.no-row { width: 100%; border-left: 0; border-right: 0; border-top: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .no-file-badge { display: flex; align-items: center; justify-content: center; flex: none; width: 44px; height: 44px; border-radius: 6px; background: var(--gray-850); }
  .no-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .no-chip { height: 30px; padding: 0 12px; border: 1px solid var(--gray-700); border-radius: 15px; background: none; color: var(--gray-300); font: inherit; font-size: var(--sizes-text-font-size-xs); text-transform: uppercase; cursor: pointer; }
  .no-chip.is-on { border-color: var(--white); color: var(--white); }
  .no-preview { display: flex; align-items: center; justify-content: center; height: 220px; border-radius: 6px; background: linear-gradient(135deg, var(--gray-800), var(--gray-900)); color: var(--gray-400); }

  /* keys.tsx shaded key text */
  .no-key { margin: 0; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 15px; line-height: 1.5; letter-spacing: 0.4px; text-align: center; word-break: break-all; }
  .no-key span:nth-child(odd) { color: var(--white); }
  .no-key span:nth-child(even) { color: var(--gray-200); }
  .no-mask { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; padding: 12px 0; border: 0; background: none; color: var(--white); font: inherit; cursor: pointer; }
  .no-words { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .no-word { display: flex; align-items: baseline; gap: 6px; padding: 8px; border-radius: 3px; background: var(--gray-900); }
  .no-word input { width: 100%; min-width: 0; border: 0; background: none; color: var(--white); font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: var(--sizes-text-font-size-sm); outline: none; }

  /* note.tsx */
  .no-note-card { position: relative; padding: 14px; border-radius: 6px; background: var(--gray-900); }
  .no-note-card .ss-text { white-space: pre-wrap; line-height: 1.45; }
  .no-reply-tag { display: inline-block; margin-bottom: 6px; padding: 1px 6px; border: 1px solid var(--gray-700); border-radius: 4px; }
  .no-actions { display: flex; justify-content: space-around; padding: 4px 0; }
  .no-actions .ss-icon-button { width: 44px; height: 44px; color: var(--gray-300); }
  .no-actions .ss-icon-button.is-on { color: var(--white); }
  .no-meta-toggle { display: flex; align-items: center; gap: 6px; border: 0; padding: 4px 0; background: none; color: inherit; font: inherit; cursor: pointer; }
  .no-meta-row { display: flex; gap: 8px; align-items: baseline; }
  .no-meta-row > :first-child { flex: none; width: 52px; }
  .no-meta-row > :last-child { min-width: 0; word-break: break-all; }
  .no-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; background: var(--gray-800); }
  .no-json { padding: 10px; border-radius: 6px; background: var(--gray-925); white-space: pre-wrap; word-break: break-all; }
  .no-toggle-row { display: flex; gap: 8px; }
  .no-toggle-row button { height: 28px; padding: 0 10px; border: 1px solid var(--gray-700); border-radius: 4px; background: none; color: var(--gray-300); font: inherit; font-size: var(--sizes-text-font-size-xs); cursor: pointer; }
  .no-toggle-row button.is-on { border-color: var(--white); color: var(--white); }

  /* profile.tsx banner + avatar preview */
  .no-profile-head { position: relative; height: 170px; }
  .no-profile-banner { height: 120px; border-radius: 6px; background: linear-gradient(135deg, var(--gray-800), var(--gray-900)); background-size: cover; background-position: center; }
  .no-profile-head .no-avatar { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); border: 2px solid #0a0a0a; }

  /* blossom.tsx, zapSettings.tsx, bunker.tsx */
  .no-server { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 6px; background: var(--gray-900); }
  .no-server .no-grow { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }
  .no-server .no-grow .ss-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .no-primary { padding: 1px 6px; border: 1px solid var(--gray-700); border-radius: 4px; }
  .no-x { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 0; padding: 0; background: none; color: var(--gray-300); cursor: pointer; }
  .no-popular { display: flex; align-items: center; gap: 8px; }
  .no-popular .no-grow { flex: 1; }
  .no-popular .ss-button { width: auto; height: 40px; padding: 0 16px; }
  .no-preset { display: inline-flex; align-items: baseline; gap: 6px; height: 34px; padding: 0 12px; border: 1px solid var(--gray-700); border-radius: 17px; background: none; color: var(--white); font: inherit; line-height: 34px; cursor: pointer; }
  .no-box { padding: 16px; border: 1px solid var(--gray-800); border-radius: 6px; }
  .no-wallet { width: 100%; padding: 12px; border: 1px solid var(--gray-800); border-radius: 6px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .no-wallet.is-on { border-color: var(--white); background: var(--gray-900); }
  .no-session { padding: 14px; border-radius: 6px; background: var(--gray-900); }
  .no-err { color: var(--error); }
  .no-clear { border: 0; padding: 6px 0 6px 12px; background: none; color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-xs); text-transform: uppercase; cursor: pointer; }
  .no-clear[disabled] { color: var(--gray-300); cursor: default; }

  /* compose.tsx */
  .no-compose-input { box-sizing: border-box; width: 100%; min-height: 160px; padding: 12px; border: 0; border-radius: 6px; background: var(--gray-900); color: var(--white); font: inherit; font-size: var(--sizes-text-font-size-md); resize: none; outline: none; }
  .no-compose-input::placeholder, .no-plain-input::placeholder { color: var(--gray-500); }
  .no-plain-input { box-sizing: border-box; width: 100%; height: 44px; padding: 0 12px; border: 0; border-radius: 6px; background: var(--gray-900); color: var(--white); font: inherit; outline: none; }
  .no-mode { flex: 1; height: 36px; border: 1px solid var(--gray-700); border-radius: 4px; background: none; color: var(--gray-300); font: inherit; font-size: var(--sizes-text-font-size-xs); text-transform: uppercase; cursor: pointer; }
  .no-mode.is-on { border-color: var(--white); color: var(--white); background: var(--gray-900); }
  .no-link { border: 0; padding: 0; background: none; color: var(--gray-300); font: inherit; font-size: var(--sizes-text-font-size-xs); text-decoration: underline; cursor: pointer; }

  /* relays.tsx */
  .no-relay { display: flex; align-items: center; gap: 12px; }
  .no-relay .ss-checkbox { width: auto; }
  .no-relay-add { display: flex; align-items: center; gap: 4px; }
  .no-relay-add .ss-input { flex: 1; }

  /* Edge-to-edge screens (account index style: paddingHorizontal 0) */
  #kit-body:has(.no-flush) { padding-left: 0; padding-right: 0; }
  .no-pad { padding: 0 var(--layout-main-container-padding-horizontal); }
  </style>`
)

// --- fixtures -----------------------------------------------------------------------

const NO_BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

// Deterministic, valid-looking bech32 key: prefix + 58 chars.
function noBech(prefix, seed) {
  const hex = demoTxid(prefix + seed) + demoTxid(seed + prefix)
  let out = ''
  for (let i = 0; i < 58; i++) out += NO_BECH32[parseInt(hex.slice(i * 2, i * 2 + 2), 16) % 32]
  return prefix + '1' + out
}

const noShort = (npub, size) => (size === 'xs' ? npub.slice(0, 10) + '…' + npub.slice(-4) : npub.slice(0, 12) + '…' + npub.slice(-8))
const noColorOf = (npub) => ['#A7FFAF', '#FF7171', '#DCBB13', '#7FB4FF', '#C79BFF', '#FFB36B'][parseInt(demoTxid(npub).slice(0, 2), 16) % 6]

function noPerson(name, extra = {}) {
  return { name, npub: noBech('npub', name), nip05: extra.nip05 ?? name.toLowerCase().replace(/\s+/g, '') + '@nostr.example', lud16: extra.lud16 ?? name.toLowerCase().replace(/\s+/g, '') + '@getalby.com', about: extra.about || '' }
}

const noMe = {
  ...noPerson('satoshi', { nip05: 'satoshi@example.com', lud16: 'satoshi@getalby.com', about: 'Studio demo identity. Nothing here is real.' }),
  nsec: noBech('nsec', 'satoshi'),
  mnemonic: 'abandon ability able about above absent absorb abstract absurd abuse access accident'
}

const noContacts = [
  noPerson('Hal', { about: 'Running bitcoin.' }),
  noPerson('Adam Back', { nip05: 'adam@blockstream.example' }),
  noPerson('Lyn', { about: 'Macro and money.' }),
  noPerson('Odell', { nip05: 'odell@citadel.example' }),
  noPerson('Jack', { nip05: 'jack@primal.example' }),
  noPerson('Gigi', { about: 'Bitcoin is time.' }),
  noPerson('Fiatjaf', { nip05: '_@fiatjaf.example', lud16: '' }),
  noPerson('Will', { nip05: 'will@damus.example' })
]
const noByNpub = (npub) => (npub === noMe.npub ? noMe : noContacts.find((c) => c.npub === npub) || noPerson('Unknown'))

const noNow = Date.UTC(2026, 9, 20, 15, 0)
const noNotes = [
  { id: 'n1', author: noContacts[0], kind: 1, at: noNow - 36e5 * 2, content: 'Running bitcoin. Studio prototype notes are fixtures, so zap away.' },
  { id: 'n2', author: noMe, kind: 1, at: noNow - 36e5 * 5, content: 'Testing payjoin in the SatSigner Studio prototype. Every send here is fake.' },
  { id: 'n3', author: noContacts[2], kind: 1, at: noNow - 36e5 * 9, reply: true, content: 'Self-custody gets easier every release. Multisig with Nostr device sync is a nice touch.' },
  { id: 'n4', author: noContacts[5], kind: 30023, at: noNow - 36e5 * 26, content: '# Bitcoin is time\n\nA long-form note rendered as markdown in the app.' },
  { id: 'n5', author: noMe, kind: 1, at: noNow - 36e5 * 50, content: 'gm. Coins have no value on signet.' }
]
const noZaps = [
  { id: 'z1', from: noContacts[0], to: noMe, sats: 2100, at: noNow - 36e5 * 1, comment: 'Great note!', note: 'n2', incoming: true },
  { id: 'z2', from: noMe, to: noContacts[2], sats: 21, at: noNow - 36e5 * 4, comment: '', note: 'n3', incoming: false },
  { id: 'z3', from: noContacts[4], to: noMe, sats: 10000, at: noNow - 36e5 * 20, comment: 'For the studio work', note: 'n5', incoming: true },
  { id: 'z4', from: noContacts[3], to: noMe, sats: 500, at: noNow - 36e5 * 70, comment: '', note: 'n2', incoming: true }
]
const noCalendar = [
  { title: 'Bitcoin meetup', start: noNow + 864e5 * 3, end: noNow + 864e5 * 3 + 36e5 * 3, location: 'Lisbon' },
  { title: 'Payjoin workshop', start: noNow + 864e5 * 9, location: 'Online' },
  { title: 'Halving watch party', start: Date.UTC(2028, 3, 17, 18), location: 'Everywhere' },
  { title: 'Nostr hack day', start: noNow + 864e5 * 21, end: noNow + 864e5 * 22 }
]
const noFiles = [
  { name: 'avatar.png', ext: 'png', mime: 'image/png', category: 'image', size: 182344, at: noNow - 864e5 * 2 },
  { name: 'banner.jpg', ext: 'jpg', mime: 'image/jpeg', category: 'image', size: 912004, at: noNow - 864e5 * 2 },
  { name: 'whitepaper.pdf', ext: 'pdf', mime: 'application/pdf', category: 'document', size: 184292, at: noNow - 864e5 * 40 },
  { name: 'labels-bip329.jsonl', ext: 'jsonl', mime: 'application/jsonl', category: 'document', size: 4211, at: noNow - 864e5 * 6 },
  { name: 'meetup-clip.mp4', ext: 'mp4', mime: 'video/mp4', category: 'video', size: 14822991, at: noNow - 864e5 * 12 },
  { name: 'podcast-ep21.mp3', ext: 'mp3', mime: 'audio/mpeg', category: 'audio', size: 31233920, at: noNow - 864e5 * 30 },
  { name: 'backup.bin', ext: 'bin', mime: 'application/octet-stream', category: 'other', size: 2048, at: noNow - 864e5 * 90 }
].map((f) => ({ ...f, sha256: demoTxid('blossom' + f.name) }))

const NO_BLOSSOM_POPULAR = [
  { name: 'Primal', url: 'https://blossom.primal.net' },
  { name: 'Satellite', url: 'https://cdn.satellite.earth' },
  { name: 'Blossom Band', url: 'https://blossom.band' },
  { name: 'nostr.download', url: 'https://nostr.download' },
  { name: 'Media Nostr Band', url: 'https://media.nostr.band' },
  { name: 'Nostr Build', url: 'https://blossom.nostr.build' }
]
const NO_RELAYS = [
  ['0xchat', 'wss://relay.0xchat.com'], ['Agora', 'wss://relay.agora.social'], ['Azzamo', 'wss://relay.azzamo.net'],
  ['Bitcoiner Social', 'wss://nostr.bitcoiner.social'], ['Coracle', 'wss://bucket.coracle.social'], ['Damus', 'wss://relay.damus.io'],
  ['Einundzwanzig Space', 'wss://nostr.einundzwanzig.space'], ['Hodlbod', 'wss://relay.hodlbod.com'], ['Mostro', 'wss://relay.mostro.network'],
  ['Nos lol (POW 28 bits required)', 'wss://nos.lol'], ['Nostr Band', 'wss://relay.nostr.band'], ['Nostr Land', 'wss://relay.nostr.land'],
  ['Primal', 'wss://relay.primal.net'], ['Snort', 'wss://relay.snort.social']
].map(([name, url]) => ({ name, url }))

// Screen state. Survives navigation so edits show when you come back.
const noState = {
  peer: noContacts[0].npub,
  contact: noContacts[0].npub,
  note: 'n2',
  zap: 'z1',
  file: noFiles[0].sha256,
  fileFilter: 'all',
  chatTab: 0,
  feedTab: 'notes',
  importTab: 0,
  chats: {
    [noContacts[0].npub]: [
      { from: noContacts[0].npub, text: 'Did the payjoin go through?', at: noNow - 36e5 * 3 },
      { from: noMe.npub, text: 'Yes, receiver added a coin. Fixture data though.', at: noNow - 36e5 * 2.9 },
      { from: noContacts[0].npub, text: 'Nice. Running studio now.', at: noNow - 36e5 * 2.5 }
    ],
    [noContacts[2].npub]: [{ from: noContacts[2].npub, text: 'Can you cosign the vault spend?', at: noNow - 864e5 }],
    [noContacts[5].npub]: [
      { from: noMe.npub, text: 'Sent the PSBT over the device group.', at: noNow - 864e5 * 3 },
      { from: noContacts[5].npub, text: 'Signed 👍', at: noNow - 864e5 * 3 + 6e5 }
    ]
  },
  unread: { [noContacts[0].npub]: 1, [noContacts[2].npub]: 1 },
  profile: { displayName: noMe.name, picture: '', banner: '', nip05: noMe.nip05, lud16: noMe.lud16 },
  blossom: ['https://blossom.primal.net', 'https://cdn.satellite.earth'],
  presets: [21, 100, 500, 1000, 5000],
  oneTap: '21',
  autoApprove: false,
  walletId: 'ln',
  cache: { ownNotes: 128, ownZaps: 37, feedNotes: 2140, zapReceipts: 412, profiles: 96 },
  sessions: [
    { name: 'Coracle', relay: 'wss://relay.nsec.app', status: 'connected', lastActive: noNow - 6e5 },
    { name: 'Habla', relay: 'wss://relay.damus.io', status: 'disconnected', lastActive: noNow - 864e5 * 4 }
  ],
  relays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'],
  customRelays: ['wss://relay.studio.example'],
  liked: {},
  reposted: {},
  bookmarked: {}
}

// --- helpers ------------------------------------------------------------------------

// t() plus the {{x}} placeholders some nostr strings use.
function noT(key, vars = {}) {
  return t(key, vars).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}
const nt = (key, vars) => noT('nostrIdentity.' + key, vars)

// Screens remember who opened them, so Back returns there (router.back()).
const noReturn = {}
function noRemember(id) {
  if (typeof routeId !== 'undefined' && routeId && routeId !== id) noReturn[id] = routeId
}
const noBack = (id, fallback) => () => noReturn[id] || fallback

function noAvatar(person, size = 36) {
  const letter = (person.name || person.npub || 'N').replace(/^npub1/, '')[0].toUpperCase()
  return `<span class="no-avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px">${ss.esc(letter)}</span>`
}

const noDate = (ms) => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const noDay = (ms) => new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
function noAgo(ms) {
  const m = Math.round((noNow - ms) / 6e4)
  if (m < 60) return m + 'm'
  if (m < 1440) return Math.round(m / 60) + 'h'
  return Math.round(m / 1440) + 'd'
}
const noSize = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : b > 1e3 ? (b / 1e3).toFixed(1) + ' KB' : b + ' B')

// SSNostrAccountCard (used by SSNostrContactList)
function noCard(person, attrs) {
  return `<button type="button" class="no-card" ${attrs}>${noAvatar(person)}<span class="no-card-text">${ss.text({ weight: 'medium', as: 'span' }, ss.esc(person.name))}${ss.text(
    { size: 'xs', color: 'muted', type: 'mono', as: 'span' },
    noShort(person.npub)
  )}${person.nip05 ? ss.text({ size: 'xs', color: 'muted', as: 'span' }, ss.esc(person.nip05)) : ''}</span>${ss.icon('chevronRight', { width: 6, height: 11.6 })}</button>`
}

function noTabs(labels, active, attr) {
  return `<div class="no-tabs">${labels.map((l, i) => `<button type="button" class="no-tab${i === active ? ' is-on' : ''}" data-${attr}="${i}">${ss.esc(l)}</button>`).join('')}</div>`
}

// SSNostrHeroCard
function noHero(person) {
  return `<div class="no-hero"><div class="no-hero-banner"></div>${noAvatar(person, 80)}<div class="no-hero-meta">${ss.text({ size: 'xl', weight: 'medium' }, ss.esc(person.name || 'Unnamed'))}${ss.clipboardCopy(
    { text: person.npub },
    ss.hstack({ gap: 'xs', style: 'justify-content:center' }, `<i class="no-dot" style="background:${noColorOf(person.npub)}"></i>`, ss.text({ size: 'xs', type: 'mono', color: 'muted' }, noShort(person.npub)))
  )}${
    person.nip05
      ? ss.clipboardCopy({ text: person.nip05 }, ss.hstack({ gap: 'xs', style: 'justify-content:center' }, ss.icon('checkCircleThin', { size: 12 }), ss.text({ color: 'muted' }, ss.esc(person.nip05))))
      : ''
  }${person.about ? ss.text({ color: 'muted', center: true, className: 'no-hero-about' }, ss.esc(person.about)) : ''}</div></div>`
}

// SSNostrFeedTabs: Zaps / Notes / Feed for one npub.
function noFeed(npub) {
  const tab = noState.feedTab
  const tabs = ['zaps', 'notes', 'feed']
  const bar = noTabs(tabs.map((k) => nt('feed.' + k)), tabs.indexOf(tab), 'feed-tab')
  let body = ''
  if (tab === 'zaps') {
    const zaps = noZaps.filter((z) => z.to.npub === npub || z.from.npub === npub)
    body = zaps.length
      ? zaps
          .map((z) => {
            const out = z.from.npub === npub
            const who = out ? z.to : z.from
            return `<button type="button" class="no-feed-row" data-zap="${z.id}"><div class="no-zap-row">${noAvatar(who, 32)}<div class="no-grow">${
              out ? ss.text({ size: 'xxs', color: 'muted', uppercase: true }, nt('feed.outgoingZap')) : ''
            }${ss.text({ weight: 'medium' }, ss.esc(who.name))}${z.comment ? ss.text({ size: 'xs', color: 'muted' }, ss.esc(z.comment)) : ''}</div><div class="no-zap-amount ${out ? 'is-out' : 'is-in'}">${ss.text(
              { size: 'xxs', color: 'muted' },
              noAgo(z.at)
            )}${ss.text({ weight: 'medium', as: 'span', style: 'color:inherit' }, (out ? '-' : '+') + z.sats.toLocaleString('en-US'))}${ss.text({ size: 'xxs', color: 'muted', as: 'span' }, ' sats')}</div></div></button>`
          })
          .join('')
      : `<p class="no-empty">${ss.text({ color: 'muted', as: 'span' }, nt('feed.noZaps'))}</p>`
  } else {
    const notes = tab === 'notes' ? noNotes.filter((n) => n.author.npub === npub) : noNotes.filter((n) => n.author.npub !== npub)
    body = notes.length
      ? notes.map((n) => noNoteRow(n)).join('') + ss.button({ label: nt('feed.loadMore'), variant: 'ghost' })
      : `<p class="no-empty">${ss.text({ color: 'muted', as: 'span' }, tab === 'notes' ? nt('feed.noNotes') : nt('feed.noFeed'))}</p>`
  }
  return bar + `<div class="no-list" style="gap:0">${body}</div>`
}

// SSNostrFeedNoteRow + content preview
function noNoteRow(n) {
  return `<button type="button" class="no-feed-row" data-note="${n.id}"><span class="no-author">${noAvatar(n.author, 32)}<span style="display:flex;flex-direction:column;min-width:0">${ss.text(
    { weight: 'medium', as: 'span' },
    ss.esc(n.author.name)
  )}${ss.text({ size: 'xxs', color: 'muted', type: 'mono', as: 'span' }, noShort(n.author.npub))}</span><span style="margin-left:auto">${ss.text(
    { size: 'xxs', color: 'muted', as: 'span' },
    noAgo(n.at)
  )}</span></span>${n.reply ? `<span>${ss.text({ size: 'xxs', color: 'muted', uppercase: true, as: 'span', className: 'no-reply-tag' }, nt('feed.replyTag'))}</span>` : ''}${ss.text(
    { size: 'md', style: 'white-space:pre-wrap' },
    ss.esc(n.content.replace(/^# /, ''))
  )}</button>`
}

// keys.tsx ShadedNostrKeyText: 4-char chunks alternate shade, 28 chars per line.
function noKey(value) {
  const lines = value.match(/.{1,28}/g) || []
  return `<p class="no-key">${lines.map((line) => (line.match(/.{1,4}/g) || []).map((c) => `<span>${c}</span>`).join('')).join('<br>')}</p>`
}

function noWords(words, editable) {
  return `<div class="no-words">${words
    .map((w, i) =>
      editable
        ? `<label class="no-word">${ss.text({ size: 'xs', color: 'muted', as: 'span' }, String(i + 1))}<input data-word="${i}" value="${ss.esc(w)}" autocomplete="off" autocapitalize="off"></label>`
        : `<span class="no-word">${ss.text({ size: 'xs', color: 'muted', as: 'span' }, String(i + 1))}${ss.text({ type: 'mono', as: 'span' }, w)}</span>`
    )
    .join('')}</div>`
}

function noQrModal(id, title, value) {
  return ss.modal(
    { id, fullOpacity: true, label: t('common.cancel') },
    ss.vstack({ itemsCenter: true, gap: 'lg', style: 'margin:auto 0' }, ss.text({ uppercase: true, center: true }, ss.esc(title)), ss.qr({ value, size: 240 }), ss.text({ size: 'xs', type: 'mono', center: true, color: 'muted', style: 'word-break:break-all' }, ss.esc(value)))
  )
}

function noConfirmModal(id, title, copy, action, actionId) {
  return ss.modal(
    { id, fullOpacity: true, label: t('common.cancel') },
    ss.vstack(
      { gap: 'md', itemsCenter: true, widthFull: true, style: 'margin:auto 0' },
      ss.vstack({ gap: 'sm', itemsCenter: true }, ss.text({ center: true, color: 'muted', uppercase: true }, ss.esc(title)), ss.text({ center: true, color: 'muted' }, ss.esc(copy))),
      ss.button({ label: action, variant: 'danger', id: actionId })
    )
  )
}

// One click handler for both the body and the overlay layer of a screen.
function noOn(body, handler) {
  const guarded = (e) => {
    // The overlay layer is shared by every kit screen; ignore clicks once we've left Nostr.
    if (!String(kitCurrent).startsWith('nostr-')) return
    handler(e)
  }
  body.onclick = guarded
  document.getElementById('kit-overlays').onclick = guarded
}

const noTitle = () => noState.profile.displayName || noMe.name
const NO_SRC = 'app/(authenticated)/(tabs)/(signer,explorer,converter)/signer/nostr/'

// --- account/[npub]/settings.tsx -----------------------------------------------------

registerScreen('nostr-settings', {
  source: NO_SRC + 'account/[npub]/settings.tsx',
  title: noTitle,
  back: 'nostr-account',
  gear: false,
  render: () => {
    const chiclet = (label, icon, go) =>
      `<button type="button" class="no-chiclet" data-go="${go}"><span class="no-chiclet-tile"><span class="ss-glass is-outline"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i></span>${ss.icon(icon, {
        size: 24
      })}</span>${ss.text({ size: 'xs', color: 'muted', uppercase: true, center: true, as: 'span' }, label)}</button>`
    return ss.vstack(
      { gap: 'lg', style: 'padding-bottom:24px' },
      `<div class="no-chiclets">${chiclet(nt('chat.title'), 'chatBubble', 'nostr-chat')}${chiclet(nt('contacts.title'), 'contacts', 'nostr-contacts')}${chiclet(nt('calendar.title'), 'calendar', 'nostr-calendar')}${chiclet(
        nt('files.title'),
        'files',
        'nostr-files'
      )}</div>`,
      ss.vstack(
        { gap: 'md', widthFull: true },
        ss.button({ label: nt('settings.profile'), variant: 'outline', go: 'nostr-profile' }),
        ss.button({ label: nt('settings.keys'), variant: 'outline', go: 'nostr-keys' }),
        ss.button({ label: nt('settings.relays'), variant: 'outline', go: 'nostr-relays' }),
        ss.button({ label: nt('settings.blossom'), variant: 'outline', go: 'nostr-blossom' }),
        ss.button({ label: nt('settings.zaps'), variant: 'outline', go: 'nostr-zap-settings' }),
        ss.button({ label: nt('settings.signer'), variant: 'outline', go: 'nostr-bunker' }),
        ss.button({ label: nt('settings.cache.title'), variant: 'outline', go: 'nostr-cache' }),
        ss.button({ label: nt('settings.deleteIdentity'), variant: 'danger', id: 'no-delete' })
      )
    )
  },
  overlays: () => noConfirmModal('no-delete-modal', nt('settings.deleteModalTitle'), nt('settings.deleteConfirm'), t('common.delete'), 'no-delete-confirm'),
  bind: (body) =>
    noOn(body, (e) => {
      if (e.target.closest('#no-delete')) ss.open('no-delete-modal')
      if (e.target.closest('#no-delete-confirm')) {
        ss.toast('Demo: identity kept', document.getElementById('view-kit'))
        go('nostr')
      }
    })
})

// --- chat/index.tsx ---------------------------------------------------------------

function noConversations() {
  return Object.entries(noState.chats)
    .map(([peer, msgs]) => ({ peer, last: msgs[msgs.length - 1] }))
    .sort((a, b) => b.last.at - a.last.at)
}

registerScreen('nostr-chat', {
  source: NO_SRC + 'account/[npub]/chat/index.tsx',
  title: () => noTitle(),
  back: noBack('nostr-chat', 'nostr-account'),
  render: () => {
    noRemember('nostr-chat')
    const tab = noState.chatTab
    const labels = [nt('chat.tabNip4'), nt('chat.tabNip17'), nt('chat.tabMarmot'), nt('chat.tabMesh')]
    let scene
    if (tab >= 2) {
      scene = `<div class="no-empty">${ss.text({ color: 'muted', as: 'span' }, nt('chat.comingSoon'))}</div>`
    } else {
      // NIP-04 holds the fixture threads; NIP-17 shows one so both tabs have content.
      const convos = noConversations().filter((c, i) => (tab === 0 ? true : i === 0))
      scene = ss.vstack(
        { gap: 'sm', style: 'padding-top:12px' },
        convos.length
          ? `<div>${convos
              .map(({ peer, last }) => {
                const p = noByNpub(peer)
                const unread = noState.unread[peer] || 0
                return `<button type="button" class="no-convo" data-peer="${peer}">${noAvatar(p, 44)}<span class="no-convo-text">${ss.text({ weight: 'medium', as: 'span' }, ss.esc(p.name))}${ss.text(
                  { size: 'xs', color: 'muted', as: 'span' },
                  noShort(p.npub)
                )}${ss.text({ color: 'muted', as: 'span' }, ss.esc(last.text))}</span><span class="no-convo-meta">${ss.text({ size: 'xs', color: 'muted', as: 'span' }, noAgo(last.at))}${
                  unread ? `<span class="no-unread">${unread}</span>` : ''
                }</span></button>`
              })
              .join('')}</div>`
          : `<div class="no-empty">${ss.text({ color: 'muted', as: 'span' }, nt('chat.noConversations'))}</div>`,
        ss.button({ label: nt('chat.newMessage'), variant: 'secondary', go: 'nostr-chat-new' })
      )
    }
    return noTabs(labels, tab, 'chat-tab') + scene
  },
  bind: (body) =>
    noOn(body, (e) => {
      const tab = e.target.closest('[data-chat-tab]')
      if (tab) {
        noState.chatTab = +tab.dataset.chatTab
        openKitScreen('nostr-chat')
      }
      const peer = e.target.closest('[data-peer]')
      if (peer) {
        noState.peer = peer.dataset.peer
        go('nostr-chat-peer')
      }
    })
})

// --- chat/[peer].tsx (SSChatThread) ------------------------------------------------

function noMessage(m) {
  const author = noByNpub(m.from)
  const own = m.from === noMe.npub
  return `<div class="no-msg${own ? ' is-own' : ''}"><button type="button" class="no-msg-author no-link" style="text-decoration:none" data-author="${m.from}">${noAvatar(author, 24)}${ss.text(
    { weight: 'medium', as: 'span' },
    ss.esc(own ? noTitle() : author.name)
  )}${ss.text({ size: 'xxs', color: 'muted', type: 'mono', as: 'span' }, noShort(author.npub, 'xs'))}</button><div class="no-msg-body">${ss.text({ style: 'white-space:pre-wrap' }, ss.esc(m.text))}${ss.text(
    { size: 'xxs', color: 'muted' },
    noDate(m.at) + (m.failed ? ' · ' + nt('chat.status.failed') : '')
  )}</div></div>`
}

registerScreen('nostr-chat-peer', {
  source: NO_SRC + 'account/[npub]/chat/[peer].tsx',
  title: () => noByNpub(noState.peer).name,
  back: noBack('nostr-chat-peer', 'nostr-chat'),
  render: () => {
    noRemember('nostr-chat-peer')
    noState.unread[noState.peer] = 0
    const msgs = noState.chats[noState.peer] || []
    return `<div class="no-thread"><div class="no-messages" id="no-messages">${
      msgs.length ? msgs.map(noMessage).join('') : `<div class="no-empty">${ss.text({ color: 'muted', as: 'span' }, nt('chat.noMessages'))}</div>`
    }</div><div class="no-composer"><textarea id="no-chat-input" maxlength="500" placeholder="${ss.esc(nt('chat.messagePlaceholder'))}"></textarea>${ss.button({
      label: nt('chat.send'),
      id: 'no-chat-send',
      disabled: true
    })}</div></div>`
  },
  bind: (body) => {
    const list = body.querySelector('#no-messages')
    list.scrollTop = list.scrollHeight
    const input = body.querySelector('#no-chat-input')
    const send = body.querySelector('#no-chat-send')
    input.addEventListener('input', () => (send.disabled = !input.value.trim()))
    noOn(body, (e) => {
      const author = e.target.closest('[data-author]')
      if (author && author.dataset.author !== noMe.npub) {
        noState.contact = author.dataset.author
        go('nostr-contact')
      }
      if (e.target.closest('#no-chat-send') && input.value.trim()) {
        const peer = noState.peer
        ;(noState.chats[peer] = noState.chats[peer] || []).push({ from: noMe.npub, text: input.value.trim(), at: Date.now() })
        openKitScreen('nostr-chat-peer')
        // A fixture reply so the thread feels alive.
        setTimeout(() => {
          noState.chats[peer].push({ from: peer, text: 'Got it (demo reply).', at: Date.now() })
          if (kitCurrent === 'nostr-chat-peer' && noState.peer === peer) openKitScreen('nostr-chat-peer')
        }, 1400)
      }
    })
  }
})

// --- chat/new.tsx and send.tsx share a "pick someone" layout ----------------------

function noPicker(id, placeholder, buttonLabel, list) {
  return ss.vstack(
    { gap: 'md' },
    ss.vstack(
      { gap: 'sm' },
      ss.textInput({ placeholder, align: 'left', name: 'no-npub', className: 'no-picker-input' }),
      `<p class="ss-input-note is-error" id="${id}-error" hidden></p>`,
      ss.button({ label: buttonLabel, id: id + '-go', disabled: true })
    ),
    `<div class="no-list" id="${id}-list">${list.map((c) => noCard(c, `data-pick="${c.npub}"`)).join('')}</div>`
  )
}

function noBindPicker(body, id, errorKey, onPick) {
  const input = body.querySelector('[name="no-npub"]')
  const go = body.querySelector('#' + id + '-go')
  const error = body.querySelector('#' + id + '-error')
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase()
    go.disabled = !q
    error.hidden = true
    body.querySelectorAll('[data-pick]').forEach((row) => {
      const c = noByNpub(row.dataset.pick)
      row.hidden = q && !(c.name.toLowerCase().includes(q) || c.npub.includes(q))
    })
  })
  noOn(body, (e) => {
    const pick = e.target.closest('[data-pick]')
    if (pick) onPick(pick.dataset.pick)
    if (e.target.closest('#' + id + '-go')) {
      const v = input.value.trim()
      const byName = noContacts.find((c) => c.name.toLowerCase() === v.toLowerCase())
      if (byName) return onPick(byName.npub)
      if (/^npub1[0-9a-z]{50,}$/.test(v)) return onPick(v)
      error.textContent = noT(errorKey)
      error.hidden = false
    }
  })
}

registerScreen('nostr-chat-new', {
  source: NO_SRC + 'account/[npub]/chat/new.tsx',
  title: () => nt('chat.newMessage'),
  back: 'nostr-chat',
  render: () => noPicker('no-new', nt('chat.npubPlaceholder'), nt('chat.startChat'), noContacts),
  bind: (body) =>
    noBindPicker(body, 'no-new', 'nostrIdentity.chat.invalidNpub', (npub) => {
      if (!noContacts.some((c) => c.npub === npub)) noContacts.push({ ...noPerson('npub ' + npub.slice(5, 9)), npub })
      noState.peer = npub
      go('nostr-chat-peer')
    })
})

registerScreen('nostr-send', {
  source: NO_SRC + 'account/[npub]/send.tsx',
  title: () => nt('account.followingTitle'),
  back: 'nostr-account',
  render: () => noPicker('no-send', nt('send.npubPlaceholder'), nt('send.send'), noContacts),
  bind: (body) =>
    noBindPicker(body, 'no-send', 'nostrIdentity.send.invalidNpub', (npub) => {
      noState.contact = npub
      go('nostr-contact')
    })
})

// --- contacts.tsx --------------------------------------------------------------------

registerScreen('nostr-contacts', {
  source: NO_SRC + 'account/[npub]/contacts.tsx',
  title: () => nt('contacts.title'),
  back: noBack('nostr-contacts', 'nostr-settings'),
  render: () => {
    noRemember('nostr-contacts')
    return ss.vstack(
      { gap: 'md' },
      ss.textInput({ placeholder: nt('contacts.searchPlaceholder'), align: 'left', name: 'no-search' }),
      `<div class="no-list">${noContacts.map((c) => noCard(c, `data-contact="${c.npub}"`)).join('')}</div>`,
      `<p class="no-empty" id="no-contacts-none" hidden>${ss.text({ color: 'muted', as: 'span' }, nt('chat.noMatchingContacts'))}</p>`,
      ss.button({ label: nt('contacts.publishToOtherRelays'), variant: 'outline', id: 'no-publish' })
    )
  },
  bind: (body) => {
    const input = body.querySelector('[name="no-search"]')
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase()
      let shown = 0
      body.querySelectorAll('[data-contact]').forEach((row) => {
        const c = noByNpub(row.dataset.contact)
        row.hidden = q && !(c.name.toLowerCase().includes(q) || c.npub.includes(q))
        if (!row.hidden) shown++
      })
      body.querySelector('#no-contacts-none').hidden = shown > 0
    })
    noOn(body, (e) => {
      const row = e.target.closest('[data-contact]')
      if (row) {
        noState.contact = row.dataset.contact
        go('nostr-contact')
      }
      const pub = e.target.closest('#no-publish')
      if (pub && !pub.disabled) {
        pub.disabled = true
        pub.innerHTML = '<span class="ss-spinner"></span>'
        setTimeout(() => {
          ss.toast(nt('contacts.publishSuccess', { count: noContacts.length, relays: 4 }), document.getElementById('view-kit'))
          openKitScreen('nostr-contacts')
        }, 900)
      }
    })
  }
})

// --- contact/[targetNpub].tsx ----------------------------------------------------------

registerScreen('nostr-contact', {
  source: NO_SRC + 'account/[npub]/contact/[targetNpub].tsx',
  title: () => nt('contact.title'),
  back: noBack('nostr-contact', 'nostr-contacts'),
  render: () => {
    noRemember('nostr-contact')
    const c = noByNpub(noState.contact)
    return `<div class="no-flush">${noHero(c)}<div class="no-pad">${ss.vstack(
      { gap: 'md' },
      ss.hstack(
        { gap: 'sm' },
        c.lud16 ? ss.button({ label: `${nt('note.zap')} 21 sats`, variant: 'elevated', id: 'no-zap', style: 'flex:1' }) : '',
        ss.button({ label: nt('contact.more'), variant: 'elevated', id: 'no-more', style: 'flex:1' })
      ),
      c.lud16 ? '' : ss.text({ size: 'xs', color: 'muted', center: true }, nt('note.zapEndpointNotFound')),
      `<div>${noFeed(c.npub)}</div>`
    )}</div></div>`
  },
  overlays: () => {
    const c = noByNpub(noState.contact)
    const opts = [
      ['npub', nt('contact.qrNpub'), c.npub],
      ['nprofile', nt('contact.qrNprofile'), noBech('nprofile', c.name).slice(0, 70)],
      c.lud16 ? ['lud16', nt('contact.qrLightningAddress'), c.lud16] : null
    ].filter(Boolean)
    return ss.modal(
      { id: 'no-profile-qr', fullOpacity: true, label: t('common.close') },
      ss.vstack(
        { itemsCenter: true, gap: 'lg', widthFull: true, style: 'margin:auto 0' },
        ss.text({ uppercase: true, center: true }, ss.esc(nt('contact.qrTitleNamed', { name: c.name }))),
        noTabs(opts.map((o) => o[1]), 0, 'qr-tab').replace('class="no-tabs"', 'class="no-tabs" style="width:100%"'),
        `<div id="no-qr-slot">${ss.qr({ value: opts[0][2], size: 220 })}</div>`,
        ss.text({ size: 'xs', type: 'mono', color: 'muted', center: true, id: 'no-qr-value', style: 'word-break:break-all' }, ss.esc(opts[0][2]))
      )
    )
  },
  bind: (body) => {
    const c = noByNpub(noState.contact)
    const opts = [c.npub, noBech('nprofile', c.name).slice(0, 70), c.lud16].filter(Boolean)
    noOn(body, (e) => {
      if (e.target.closest('#no-more')) ss.open('no-profile-qr')
      const qt = e.target.closest('[data-qr-tab]')
      if (qt) {
        document.querySelectorAll('[data-qr-tab]').forEach((b) => b.classList.toggle('is-on', b === qt))
        document.getElementById('no-qr-slot').innerHTML = ss.qr({ value: opts[+qt.dataset.qrTab], size: 220 })
        document.getElementById('no-qr-value').textContent = opts[+qt.dataset.qrTab]
      }
      const zap = e.target.closest('#no-zap')
      if (zap && !zap.disabled) {
        zap.disabled = true
        zap.querySelector('.ss-button-label').textContent = nt('note.zapSending')
        setTimeout(() => {
          noZaps.unshift({ id: 'z' + Date.now(), from: noMe, to: c, sats: 21, at: noNow, comment: '', incoming: false })
          ss.toast('⚡ 21 sats (demo)', document.getElementById('view-kit'))
          openKitScreen('nostr-contact')
        }, 900)
      }
      noFeedClicks(e, 'nostr-contact')
    })
  }
})

// Shared feed interactions (tabs, notes, zaps, authors).
function noFeedClicks(e, screen) {
  const tab = e.target.closest('[data-feed-tab]')
  if (tab) {
    noState.feedTab = ['zaps', 'notes', 'feed'][+tab.dataset.feedTab]
    openKitScreen(screen)
  }
  const note = e.target.closest('[data-note]')
  if (note) {
    noState.note = note.dataset.note
    go('nostr-note')
  }
  const zap = e.target.closest('[data-zap]')
  if (zap) {
    noState.zap = zap.dataset.zap
    go('nostr-zap')
  }
}

// --- calendar.tsx ---------------------------------------------------------------------

registerScreen('nostr-calendar', {
  source: NO_SRC + 'account/[npub]/calendar.tsx',
  title: () => nt('calendar.title'),
  back: 'nostr-settings',
  render: () =>
    `<div>${noCalendar
      .sort((a, b) => a.start - b.start)
      .map(
        (ev) =>
          `<div class="no-row"><div class="no-grow">${ss.text({}, ss.esc(ev.title))}${ss.text({ size: 'xs', color: 'muted' }, noDay(ev.start) + (ev.end ? ' → ' + noDay(ev.end) : ''))}${
            ev.location ? ss.text({ size: 'xs', color: 'muted' }, ss.esc(ev.location)) : ''
          }</div></div>`
      )
      .join('')}</div>`
})

// --- files.tsx + files/[sha256].tsx -----------------------------------------------------

registerScreen('nostr-files', {
  source: NO_SRC + 'account/[npub]/files.tsx',
  title: () => nt('files.title'),
  back: 'nostr-settings',
  render: () => {
    const cats = ['all', ...['image', 'document', 'video', 'audio', 'other'].filter((c) => noFiles.some((f) => f.category === c))]
    const f = noState.fileFilter
    const files = noFiles.filter((x) => f === 'all' || x.category === f)
    return ss.vstack(
      { gap: 'md' },
      `<div class="no-chips">${cats.map((c) => `<button type="button" class="no-chip${c === f ? ' is-on' : ''}" data-filter="${c}">${c === 'all' ? nt('files.filter.all') : nt('files.category.' + c)}</button>`).join('')}</div>`,
      `<div>${files
        .map(
          (x) =>
            `<button type="button" class="no-row" data-file="${x.sha256}"><span class="no-file-badge">${ss.text({ size: 'xs', color: 'muted', as: 'span' }, x.ext)}</span><span class="no-grow" style="display:flex;flex-direction:column">${ss.text(
              { as: 'span' },
              ss.esc(x.name)
            )}${ss.text({ size: 'xs', color: 'muted', as: 'span' }, noSize(x.size) + '  ·  ' + noDay(x.at))}</span></button>`
        )
        .join('')}</div>`,
      ss.text({ size: 'xs', color: 'muted', center: true }, noState.blossom[0].replace(/^https?:\/\//, ''))
    )
  },
  bind: (body) =>
    noOn(body, (e) => {
      const chip = e.target.closest('[data-filter]')
      if (chip) {
        noState.fileFilter = chip.dataset.filter
        openKitScreen('nostr-files')
      }
      const file = e.target.closest('[data-file]')
      if (file) {
        noState.file = file.dataset.file
        go('nostr-file')
      }
    })
})

registerScreen('nostr-file', {
  source: NO_SRC + 'account/[npub]/files/[sha256].tsx',
  title: () => nt('files.detail.title'),
  back: 'nostr-files',
  render: () => {
    const f = noFiles.find((x) => x.sha256 === noState.file) || noFiles[0]
    const url = noState.blossom[0] + '/' + f.sha256 + '.' + f.ext
    return ss.vstack(
      { gap: 'lg' },
      f.category === 'image' ? `<div class="no-preview">${ss.icon('files', { size: 40 })}</div>` : '',
      ss.vstack(
        { gap: 'sm', className: 'no-break' },
        ss.text({ size: 'lg', type: 'mono' }, ss.esc(f.name)),
        ss.detailsList({
          columns: 1,
          copyToClipboard: true,
          gap: 16,
          uppercase: true,
          variant: 'mono',
          items: [
            [nt('files.detail.name'), f.name],
            [nt('files.detail.extension'), f.ext],
            [nt('files.detail.mime'), f.mime],
            [nt('files.detail.category'), nt('files.category.' + f.category)],
            [nt('files.detail.size'), noSize(f.size)],
            [nt('files.detail.uploaded'), noDay(f.at)],
            [nt('files.detail.sha256'), f.sha256],
            [nt('files.detail.url'), url]
          ]
        })
      )
    )
  }
})

// --- keys.tsx --------------------------------------------------------------------------

const noReveal = { nsec: false, seed: false }

registerScreen('nostr-keys', {
  source: NO_SRC + 'account/[npub]/keys.tsx',
  title: () => nt('keys.title'),
  back: 'nostr-settings',
  render: () => {
    const mask = (what) =>
      `<button type="button" class="no-mask" data-reveal="${what}">${ss.text({ size: 'xl', type: 'mono', center: true, as: 'span' }, '••••••••••••••••')}${ss.icon('eyeOff', { size: 18 })}</button>`
    return ss.vstack(
      { gap: 'lg', style: 'padding-bottom:24px' },
      ss.vstack(
        { gap: 'sm' },
        ss.hstack({ gap: 'xs', style: 'justify-content:center' }, `<i class="no-dot" style="background:${noColorOf(noMe.npub)}"></i>`, ss.text({ center: true }, nt('keys.npub'))),
        noKey(noMe.npub),
        ss.hstack({ gap: 'sm', className: 'no-eq' }, ss.clipboardCopy({ text: noMe.npub }, ss.button({ label: t('common.copy'), variant: 'outline' })), ss.button({ label: t('common.showQR'), variant: 'outline', data: { qr: 'npub' } }))
      ),
      ss.vstack(
        { gap: 'sm' },
        ss.text({ center: true }, nt('keys.nsec')),
        noReveal.nsec
          ? noKey(noMe.nsec) +
              ss.hstack(
                { gap: 'sm', className: 'no-eq' },
                ss.clipboardCopy({ text: noMe.nsec }, ss.button({ label: t('common.copy'), variant: 'outline' })),
                ss.button({ label: t('common.showQR'), variant: 'outline', data: { qr: 'nsec' } }),
                ss.button({ label: t('common.hide'), variant: 'outline', data: { hide: 'nsec' } })
              )
          : mask('nsec')
      ),
      ss.vstack(
        { gap: 'sm' },
        ss.text({ center: true }, nt('keys.seedWords')),
        noReveal.seed
          ? noWords(noMe.mnemonic.split(' ')) +
              ss.hstack(
                { gap: 'sm', className: 'no-eq' },
                ss.clipboardCopy({ text: noMe.mnemonic }, ss.button({ label: t('common.copy'), variant: 'outline' })),
                ss.button({ label: t('account.seed.seedqr.title'), variant: 'outline', data: { qr: 'seed' } }),
                ss.button({ label: t('common.hide'), variant: 'outline', data: { hide: 'seed' } })
              )
          : mask('seed')
      ),
      ss.button({ label: t('common.back'), variant: 'ghost', go: 'nostr-settings' })
    )
  },
  overlays: () =>
    noQrModal('no-qr-npub', nt('keys.npub'), noMe.npub) +
    noQrModal('no-qr-nsec', nt('keys.nsec'), noMe.nsec) +
    noQrModal('no-qr-seed', t('account.seed.seedqr.title'), noMe.mnemonic.split(' ').map((w, i) => String(i * 83 + 17).padStart(4, '0')).join('')),
  bind: (body) =>
    noOn(body, (e) => {
      const r = e.target.closest('[data-reveal]')
      if (r) {
        noReveal[r.dataset.reveal] = true
        openKitScreen('nostr-keys')
      }
      const h = e.target.closest('[data-hide]')
      if (h) {
        noReveal[h.dataset.hide] = false
        openKitScreen('nostr-keys')
      }
      const q = e.target.closest('[data-qr]')
      if (q) ss.open('no-qr-' + q.dataset.qr)
    })
})

// --- note.tsx --------------------------------------------------------------------------

const noNoteUi = { formatted: true, meta: false, json: false, sort: 'date' }

registerScreen('nostr-note', {
  source: NO_SRC + 'account/[npub]/note.tsx',
  title: () => nt('note.title'),
  back: noBack('nostr-note', 'nostr-account'),
  render: () => {
    noRemember('nostr-note')
    const n = noNotes.find((x) => x.id === noState.note) || noNotes[0]
    const nevent = noBech('nevent', n.id).slice(0, 68)
    const noteId = noBech('note', n.id)
    const hex = demoTxid('note' + n.id)
    const markdown = n.kind === 30023
    const zaps = noZaps.filter((z) => z.note === n.id).sort((a, b) => (noNoteUi.sort === 'date' ? b.at - a.at : b.sats - a.sats))
    const json = JSON.stringify({ id: hex, pubkey: demoTxid('pk' + n.author.name), created_at: Math.round(n.at / 1000), kind: n.kind, tags: n.reply ? [['e', demoTxid('parent')], ['p', demoTxid('pk' + noMe.name)]] : [], content: n.content, sig: demoTxid('sig' + n.id) + demoTxid('sig2' + n.id) }, null, 2)
    const icon = (name, key, map) => ss.iconButton({ label: name, className: map && map[n.id] ? 'is-on' : '', data: { act: key } }, ss.icon(name, { width: 18, height: 17 }))
    const content = markdown && noNoteUi.formatted ? n.content.replace(/^# (.*)$/m, '<strong style="font-size:20px">$1</strong>') : ss.esc(n.content)
    return ss.vstack(
      { gap: 'md', style: 'padding-bottom:24px' },
      `<button type="button" class="no-author no-link" style="text-decoration:none" data-author="${n.author.npub}">${noAvatar(n.author, 44)}<span style="display:flex;flex-direction:column;align-items:flex-start">${ss.text(
        { size: 'md', weight: 'medium', as: 'span' },
        ss.esc(n.author.name)
      )}${ss.text({ size: 'xs', type: 'mono', color: 'muted', as: 'span' }, noShort(n.author.npub))}${
        n.author.nip05 ? `<span style="display:flex;align-items:center;gap:4px">${ss.text({ size: 'xs', color: 'muted', as: 'span' }, ss.esc(n.author.nip05))}${ss.icon('checkCircleThin', { size: 12 })}</span>` : ''
      }</span></button>`,
      markdown
        ? `<div class="no-toggle-row"><button type="button" class="${noNoteUi.formatted ? '' : 'is-on'}" data-fmt="0">${nt('note.plainText')}</button><button type="button" class="${noNoteUi.formatted ? 'is-on' : ''}" data-fmt="1">${nt(
            'note.formattedMarkdown'
          )}</button></div>`
        : '',
      `<div class="no-note-card">${n.reply ? ss.text({ size: 'xxs', color: 'muted', uppercase: true, as: 'span', className: 'no-reply-tag' }, nt('feed.replyTag')) : ''}${ss.text({ size: 'md' }, content)}${ss.text(
        { size: 'xxs', color: 'muted', style: 'margin-top:8px' },
        noDay(n.at)
      )}</div>`,
      `<div class="no-actions">${icon('qR', 'qr')}${icon('repost', 'repost', noState.reposted)}${icon('heart', 'like', noState.liked)}${icon('bookmark', 'bookmark', noState.bookmarked)}</div>`,
      ss.vstack(
        { gap: 'xxs' },
        `<button type="button" class="no-meta-toggle" data-toggle="meta">${ss.text({ size: 'xs', color: 'muted', uppercase: true, as: 'span' }, nt('note.metadata'))}${ss.icon(noNoteUi.meta ? 'chevronUp' : 'chevronDown', { size: 10 })}</button>`,
        noNoteUi.meta
          ? ss.vstack(
              { gap: 'xs' },
              `<div class="no-meta-row">${ss.text({ size: 'xxs', color: 'muted', as: 'span' }, nt('note.metaKind'))}<span class="no-badge">${ss.text({ size: 'xxs', as: 'span' }, String(n.kind))}</span></div>`,
              ...[
                [nt('note.metaNevent'), nevent],
                [nt('note.metaNote'), noteId],
                [nt('note.metaHex'), hex]
              ].map(([k, v]) => `<div class="no-meta-row">${ss.text({ size: 'xxs', color: 'muted', as: 'span' }, k)}${ss.clipboardCopy({ text: v }, ss.text({ size: 'xxs', type: 'mono', as: 'span' }, v))}</div>`),
              `<button type="button" class="no-meta-toggle" data-toggle="json">${ss.text({ size: 'xxs', color: 'muted', uppercase: true, as: 'span' }, nt('note.showJson'))}${ss.icon(noNoteUi.json ? 'chevronUp' : 'chevronDown', { size: 10 })}</button>`,
              noNoteUi.json ? ss.clipboardCopy({ text: json }, ss.text({ size: 'xxs', type: 'mono', className: 'no-json' }, ss.esc(json))) : ''
            )
          : ''
      ),
      n.author.lud16
        ? ss.hstack({ gap: 'sm' }, ss.button({ label: nt('note.zapOneTap', { amount: noState.oneTap }), variant: 'outline', id: 'no-note-zap', style: 'flex:1' }), ss.button({ label: nt('note.more'), variant: 'outline', id: 'no-note-more', style: 'flex:1' }))
        : ss.text({ size: 'xs', color: 'muted', center: true }, nt('note.zapEndpointNotFound')),
      zaps.length
        ? ss.vstack(
            { gap: 'sm' },
            ss.hstack(
              { gap: 'sm' },
              ss.text({ size: 'xs', color: 'muted', uppercase: true, style: 'flex:1' }, `${nt('note.zapReceipts')} (${zaps.length})`),
              `<button type="button" class="no-link" data-sort="date" style="${noNoteUi.sort === 'date' ? 'color:var(--white)' : ''}">${nt('zapSort.date')}</button>`,
              `<button type="button" class="no-link" data-sort="amount" style="${noNoteUi.sort === 'amount' ? 'color:var(--white)' : ''}">${nt('zapSort.amount')}</button>`
            ),
            zaps
              .map(
                (z) =>
                  `<button type="button" class="no-feed-row" data-zap="${z.id}"><div class="no-zap-row">${noAvatar(z.from, 28)}<div class="no-grow">${ss.text({ weight: 'medium' }, ss.esc(z.from.name))}${
                    z.comment ? ss.text({ size: 'xs', color: 'muted' }, ss.esc(z.comment)) : ''
                  }</div><div class="no-zap-amount is-in">${ss.text({ size: 'xxs', color: 'muted' }, noAgo(z.at))}${ss.text({ weight: 'medium', as: 'span', style: 'color:inherit' }, z.sats.toLocaleString('en-US'))}${ss.text(
                    { size: 'xxs', color: 'muted', as: 'span' },
                    ' sats'
                  )}</div></div></button>`
              )
              .join('')
          )
        : ss.text({ size: 'xs', color: 'muted', center: true }, nt('note.noZapsYet'))
    )
  },
  overlays: () => {
    const n = noNotes.find((x) => x.id === noState.note) || noNotes[0]
    return (
      noQrModal('no-note-qr', nt('note.qrTitle'), 'nostr:' + noBech('nevent', n.id).slice(0, 68)) +
      ss.bottomSheet(
        { id: 'no-zap-sheet', title: nt('note.zapChooseAmount'), height: '55%' },
        `<div class="no-chips" style="justify-content:center">${noState.presets.map((p) => `<button type="button" class="no-chip" data-zap-amount="${p}">${p.toLocaleString('en-US')}</button>`).join('')}</div>`,
        ss.textInput({ placeholder: nt('note.zapCommentPlaceholder'), align: 'left', size: 'small', name: 'no-zap-comment' }),
        ss.button({ label: t('common.cancel'), variant: 'ghost', data: { 'ss-close': '' } })
      )
    )
  },
  bind: (body) =>
    noOn(body, (e) => {
      const n = noNotes.find((x) => x.id === noState.note) || noNotes[0]
      const act = e.target.closest('[data-act]')
      if (act) {
        const a = act.dataset.act
        if (a === 'qr') return ss.open('no-note-qr')
        const map = { repost: noState.reposted, like: noState.liked, bookmark: noState.bookmarked }[a]
        map[n.id] = !map[n.id]
        if (a === 'bookmark') ss.toast(map[n.id] ? nt('note.bookmarkAdded') : nt('note.bookmarkRemoved'), document.getElementById('view-kit'))
        return openKitScreen('nostr-note')
      }
      const tg = e.target.closest('[data-toggle]')
      if (tg) {
        noNoteUi[tg.dataset.toggle] = !noNoteUi[tg.dataset.toggle]
        return openKitScreen('nostr-note')
      }
      const fmt = e.target.closest('[data-fmt]')
      if (fmt) {
        noNoteUi.formatted = fmt.dataset.fmt === '1'
        return openKitScreen('nostr-note')
      }
      const sort = e.target.closest('[data-sort]')
      if (sort) {
        noNoteUi.sort = sort.dataset.sort
        return openKitScreen('nostr-note')
      }
      const author = e.target.closest('[data-author]')
      if (author) {
        if (author.dataset.author === noMe.npub) return go('nostr-account')
        noState.contact = author.dataset.author
        return go('nostr-contact')
      }
      if (e.target.closest('#no-note-more')) return ss.open('no-zap-sheet')
      const amt = e.target.closest('[data-zap-amount]')
      const one = e.target.closest('#no-note-zap')
      if (amt || one) {
        const sats = amt ? +amt.dataset.zapAmount : +noState.oneTap
        const comment = (document.querySelector('[name="no-zap-comment"]') || {}).value || ''
        noZaps.unshift({ id: 'z' + Date.now(), from: noMe, to: n.author, sats, at: noNow, comment, note: n.id, incoming: false })
        ss.toast(`⚡ ${sats.toLocaleString('en-US')} sats (demo)`, document.getElementById('view-kit'))
        return openKitScreen('nostr-note')
      }
      noFeedClicks(e, 'nostr-note')
    })
})

// --- zap/[zapId].tsx -------------------------------------------------------------------

registerScreen('nostr-zap', {
  source: NO_SRC + 'account/[npub]/zap/[zapId].tsx',
  title: () => nt('zapDetail.title'),
  back: noBack('nostr-zap', 'nostr-account'),
  render: () => {
    noRemember('nostr-zap')
    const z = noZaps.find((x) => x.id === noState.zap) || noZaps[0]
    const who = z.incoming ? z.from : z.to
    const field = (label, value) => ss.vstack({ gap: 'xs' }, ss.text({ size: 'xxs', color: 'muted', uppercase: true }, label), value)
    const note = noNotes.find((x) => x.id === z.note)
    return ss.vstack(
      { gap: 'md', style: 'padding-bottom:24px' },
      ss.vstack(
        { gap: 'sm', className: 'no-box' },
        ss.text({ size: 'xxs', color: 'muted', uppercase: true }, z.incoming ? nt('zapDetail.profileIncoming') : nt('zapDetail.profileOutgoing')),
        `<button type="button" class="no-author no-link" style="text-decoration:none" data-author="${who.npub}">${noAvatar(who, 44)}${ss.text({ size: 'lg', weight: 'medium', as: 'span' }, ss.esc(who.name))}</button>`,
        field(nt('keys.npub'), ss.clipboardCopy({ text: who.npub }, ss.text({ size: 'xs', type: 'mono', color: 'muted', style: 'word-break:break-all' }, who.npub))),
        field(nt('profile.nip05'), ss.text({ color: 'muted' }, ss.esc(who.nip05 || nt('account.nip05NotSet')))),
        field(nt('profile.lud16'), ss.text({ color: who.lud16 ? 'white' : 'muted' }, ss.esc(who.lud16 || nt('account.lud16NotSet'))))
      ),
      field(nt('zapDetail.amount'), ss.text({ size: '3xl', weight: 'light', style: `color:var(${z.incoming ? '--main-green' : '--main-red'})` }, z.sats.toLocaleString('en-US'))),
      field(nt('zapDetail.directionLabel'), ss.text({ weight: 'medium' }, z.incoming ? nt('zapDetail.direction.incoming') : nt('zapDetail.direction.outgoing'))),
      field(nt('zapDetail.eventId'), ss.text({ type: 'mono', size: 'xs', color: 'muted', style: 'word-break:break-all' }, demoTxid('zap' + z.id))),
      field(nt('zapDetail.time'), ss.text({}, noDay(z.at))),
      z.comment ? field(nt('zapDetail.comment'), ss.text({}, ss.esc(z.comment))) : '',
      note
        ? ss.vstack(
            { gap: 'sm' },
            field(nt('zapDetail.referenceNote'), ss.text({ type: 'mono', size: 'xs', color: 'muted', style: 'word-break:break-all' }, demoTxid('note' + note.id))),
            field(nt('zapDetail.notePreview'), ss.text({}, ss.esc(note.content))),
            ss.button({ label: nt('zapDetail.viewNote'), variant: 'outline', data: { note: note.id } })
          )
        : ''
    )
  },
  bind: (body) =>
    noOn(body, (e) => {
      const author = e.target.closest('[data-author]')
      if (author && author.dataset.author !== noMe.npub) {
        noState.contact = author.dataset.author
        go('nostr-contact')
      }
      noFeedClicks(e, 'nostr-zap')
    })
})

// --- profile.tsx + create/profile.tsx ----------------------------------------------------

function noProfileForm(withBanner) {
  const p = noState.profile
  const field = (label, name, placeholder, value, hint, upload) =>
    ss.vstack(
      { gap: 'xs' },
      ss.text({ color: 'muted', uppercase: true }, label),
      ss.textInput({ placeholder, value, align: 'left', name: 'no-' + name }),
      hint ? ss.text({ size: 'xs', color: 'muted' }, hint) : '',
      upload ? ss.button({ label: upload, variant: 'outline', data: { upload: name } }) : ''
    )
  return [
    field(nt('profile.displayName'), 'displayName', nt('profile.displayNamePlaceholder'), p.displayName),
    field(nt('profile.picture'), 'picture', nt('profile.picturePlaceholder'), p.picture, nt('profile.pictureHint'), nt('profile.uploadImage')),
    withBanner ? field(nt('profile.banner'), 'banner', nt('profile.bannerPlaceholder'), p.banner, nt('profile.bannerHint'), nt('profile.uploadBanner')) : '',
    field(nt('profile.nip05'), 'nip05', nt('profile.nip05Placeholder'), p.nip05),
    field(nt('profile.lud16'), 'lud16', nt('profile.lud16Placeholder'), p.lud16)
  ]
}

function noBindProfile(body, done) {
  body.querySelector('[name="no-displayName"]').addEventListener('input', (e) => {
    const av = body.querySelector('.no-profile-head .no-avatar, .no-create-avatar .no-avatar')
    if (av) av.textContent = (e.target.value || 'N')[0].toUpperCase()
  })
  noOn(body, (e) => {
    const up = e.target.closest('[data-upload]')
    if (up && !up.disabled) {
      const label = up.querySelector('.ss-button-label')
      const original = label.textContent
      up.disabled = true
      label.textContent = nt('profile.uploading')
      setTimeout(() => {
        body.querySelector(`[name="no-${up.dataset.upload}"]`).value = noState.blossom[0] + '/' + demoTxid(up.dataset.upload).slice(0, 16) + '.jpg'
        up.disabled = false
        label.textContent = original
        ss.toast(nt('profile.uploadSuccess'), document.getElementById('view-kit'))
      }, 900)
    }
    if (e.target.closest('#no-profile-save')) {
      for (const k of ['displayName', 'picture', 'banner', 'nip05', 'lud16']) {
        const el = body.querySelector(`[name="no-${k}"]`)
        if (el) noState.profile[k] = el.value.trim()
      }
      done()
    }
  })
}

registerScreen('nostr-profile', {
  source: NO_SRC + 'account/[npub]/profile.tsx',
  title: () => nt('profile.title'),
  back: 'nostr-settings',
  render: () =>
    ss.vstack(
      { gap: 'lg', style: 'padding-bottom:24px' },
      `<div class="no-profile-head"><div class="no-profile-banner"></div>${noAvatar({ name: noState.profile.displayName || 'N' }, 80)}</div>`,
      ...noProfileForm(true),
      ss.button({ label: nt('settings.save'), variant: 'secondary', id: 'no-profile-save' })
    ),
  bind: (body) =>
    noBindProfile(body, () => {
      ss.toast(nt('settings.saved'), document.getElementById('view-kit'))
      go('nostr-settings')
    })
})

registerScreen('nostr-create-profile', {
  source: NO_SRC + 'create/profile.tsx',
  title: () => nt('profile.title'),
  back: 'nostr-create',
  render: () =>
    ss.vstack(
      { gap: 'lg', style: 'padding-bottom:24px' },
      `<div class="no-create-avatar" style="display:flex;justify-content:center">${noAvatar({ name: noState.profile.displayName || 'N' }, 80)}</div>`,
      ...noProfileForm(false),
      ss.button({ label: nt('profile.save'), variant: 'secondary', id: 'no-profile-save' })
    ),
  bind: (body) =>
    noBindProfile(body, () => {
      ss.toast(nt('create.success'), document.getElementById('view-kit'))
      go('nostr')
    })
})

// --- zapSettings.tsx ---------------------------------------------------------------------

registerScreen('nostr-zap-settings', {
  source: NO_SRC + 'account/[npub]/zapSettings.tsx',
  title: () => nt('zapSettings.title'),
  back: 'nostr-settings',
  render: () => {
    const wallets = [
      { id: 'ln', label: 'Lightning node', detail: 'LND REST · satsigner.local' },
      { id: 'ecash', label: 'ECash', detail: 'mint.minibits.cash' },
      { id: 'ark', label: 'Ark', detail: 'Second · signet' }
    ]
    return ss.vstack(
      { gap: 'lg', style: 'padding-bottom:24px' },
      ss.vstack(
        { gap: 'sm' },
        ss.vstack({ gap: 'none' }, ss.text({ color: 'muted', uppercase: true }, nt('zapSettings.presets')), ss.text({ size: 'xs', color: 'muted' }, nt('zapSettings.presetsHint'))),
        `<div class="no-chips">${noState.presets.map((a) => `<button type="button" class="no-preset" data-preset="${a}">${ss.text({ as: 'span' }, String(a))}${ss.text({ size: 'xs', color: 'muted', as: 'span' }, 'x')}</button>`).join('')}</div>`,
        ss.textInput({ placeholder: 'e.g. 2100', align: 'left', inputMode: 'numeric', name: 'no-preset' }),
        ss.button({ label: nt('zapSettings.addPreset'), variant: 'outline', id: 'no-add-preset' })
      ),
      ss.separator(),
      ss.vstack(
        { gap: 'sm' },
        ss.vstack({ gap: 'none' }, ss.text({ color: 'muted', uppercase: true }, nt('zapSettings.oneTapAmount')), ss.text({ size: 'xs', color: 'muted' }, nt('zapSettings.oneTapAmountHint'))),
        ss.textInput({ value: noState.oneTap, align: 'left', inputMode: 'numeric', name: 'no-one-tap' })
      ),
      ss.separator(),
      `<div class="no-box">${ss.vstack(
        { gap: 'md' },
        ss.checkbox({ label: nt('zapSettings.autoApprove'), description: nt('zapSettings.autoApproveHint'), selected: noState.autoApprove, id: 'no-auto' }),
        noState.autoApprove
          ? ss.vstack(
              { gap: 'sm' },
              ss.text({ size: 'xs', color: 'muted', uppercase: true }, nt('zapSettings.autoApproveWallet')),
              wallets
                .map(
                  (w) =>
                    `<button type="button" class="no-wallet${noState.walletId === w.id ? ' is-on' : ''}" data-wallet="${w.id}">${ss.text({ size: 'md', weight: 'medium' }, w.label)}${ss.text({ size: 'xs', color: 'muted' }, w.detail)}</button>`
                )
                .join('')
            )
          : ''
      )}</div>`,
      ss.separator(),
      ss.button({ label: nt('settings.save'), variant: 'secondary', id: 'no-zap-save' })
    )
  },
  bind: (body) =>
    noOn(body, (e) => {
      const keepOneTap = () => (noState.oneTap = body.querySelector('[name="no-one-tap"]').value)
      const p = e.target.closest('[data-preset]')
      if (p) {
        keepOneTap()
        noState.presets = noState.presets.filter((x) => x !== +p.dataset.preset)
        return openKitScreen('nostr-zap-settings')
      }
      if (e.target.closest('#no-add-preset')) {
        const v = parseInt(body.querySelector('[name="no-preset"]').value, 10)
        keepOneTap()
        if (v > 0 && !noState.presets.includes(v)) noState.presets = [...noState.presets, v].sort((a, b) => a - b)
        return openKitScreen('nostr-zap-settings')
      }
      if (e.target.closest('#no-auto')) {
        keepOneTap()
        noState.autoApprove = !noState.autoApprove
        return openKitScreen('nostr-zap-settings')
      }
      const w = e.target.closest('[data-wallet]')
      if (w) {
        keepOneTap()
        noState.walletId = w.dataset.wallet
        return openKitScreen('nostr-zap-settings')
      }
      if (e.target.closest('#no-zap-save')) {
        keepOneTap()
        ss.toast(nt('zapSettings.saved'), document.getElementById('view-kit'))
        go('nostr-settings')
      }
    })
})

// --- blossom.tsx ------------------------------------------------------------------------

registerScreen('nostr-blossom', {
  source: NO_SRC + 'account/[npub]/blossom.tsx',
  title: () => nt('blossom.title'),
  back: 'nostr-settings',
  render: () => {
    const strip = (u) => u.replace(/^https?:\/\//, '')
    const popular = NO_BLOSSOM_POPULAR.filter((s) => !noState.blossom.includes(s.url))
    return ss.vstack(
      { gap: 'lg', style: 'padding-bottom:24px' },
      ss.text({ size: 'xs', color: 'muted' }, nt('blossom.hint')),
      noState.blossom.length
        ? ss.vstack(
            { gap: 'xs' },
            ss.hstack(
              { justifyBetween: true },
              ss.text({ color: 'muted', uppercase: true }, nt('blossom.yourServers')),
              ss.button({ label: nt('blossom.importFromNostr'), variant: 'ghost', id: 'no-blossom-import', className: 'is-auto' })
            ),
            noState.blossom
              .map(
                (u, i) =>
                  `<div class="no-server"><span class="no-grow">${i === 0 ? ss.text({ size: 'xs', color: 'muted', uppercase: true, as: 'span', className: 'no-primary' }, nt('blossom.primary')) : ''}${ss.text(
                    { as: 'span' },
                    strip(u)
                  )}</span><button type="button" class="no-x" data-remove="${i}" aria-label="Remove">${ss.icon('x', { size: 10 })}</button></div>`
              )
              .join('')
          )
        : '',
      ss.vstack(
        { gap: 'sm' },
        ss.text({ color: 'muted', uppercase: true }, nt('blossom.addCustom')),
        ss.textInput({ placeholder: nt('blossom.inputPlaceholder'), align: 'left', name: 'no-blossom-url' }),
        ss.button({ label: nt('blossom.add'), variant: 'outline', id: 'no-blossom-add', disabled: true })
      ),
      popular.length
        ? ss.vstack(
            { gap: 'sm' },
            ss.text({ color: 'muted', uppercase: true }, nt('blossom.popular')),
            popular
              .map(
                (s) =>
                  `<div class="no-popular"><span class="no-grow">${ss.text({}, s.name)}${ss.text({ size: 'xs', color: 'muted' }, strip(s.url))}</span>${ss.button({
                    label: nt('blossom.add'),
                    variant: 'outline',
                    data: { popular: s.url }
                  })}</div>`
              )
              .join('')
          )
        : '',
      ss.button({ label: nt('settings.save'), variant: 'secondary', id: 'no-blossom-save' })
    )
  },
  bind: (body) => {
    const input = body.querySelector('[name="no-blossom-url"]')
    input.addEventListener('input', () => (body.querySelector('#no-blossom-add').disabled = !input.value.trim()))
    noOn(body, (e) => {
      const rm = e.target.closest('[data-remove]')
      if (rm) {
        noState.blossom.splice(+rm.dataset.remove, 1)
        return openKitScreen('nostr-blossom')
      }
      const pop = e.target.closest('[data-popular]')
      if (pop) {
        noState.blossom.push(pop.dataset.popular)
        return openKitScreen('nostr-blossom')
      }
      if (e.target.closest('#no-blossom-add')) {
        let url = input.value.trim()
        if (!/^https?:\/\//.test(url)) url = 'https://' + url
        if (noState.blossom.includes(url)) return ss.toast(nt('blossom.alreadyAdded'), document.getElementById('view-kit'))
        noState.blossom.push(url)
        return openKitScreen('nostr-blossom')
      }
      const imp = e.target.closest('#no-blossom-import')
      if (imp && !imp.disabled) {
        imp.disabled = true
        imp.querySelector('.ss-button-label').textContent = nt('blossom.importing')
        setTimeout(() => {
          if (!noState.blossom.includes('https://blossom.band')) noState.blossom.push('https://blossom.band')
          ss.toast(nt('blossom.serversImported'), document.getElementById('view-kit'))
          openKitScreen('nostr-blossom')
        }, 900)
      }
      if (e.target.closest('#no-blossom-save')) {
        ss.toast(nt('blossom.saved'), document.getElementById('view-kit'))
        go('nostr-settings')
      }
    })
  }
})

// --- bunker.tsx (NIP-46 remote signer) -------------------------------------------------

registerScreen('nostr-bunker', {
  source: NO_SRC + 'account/[npub]/bunker.tsx',
  title: () => t('nip46.title'),
  back: 'nostr-settings',
  render: () =>
    ss.vstack(
      { gap: 'lg', style: 'padding-bottom:24px' },
      ss.vstack({ gap: 'sm' }, ss.button({ label: t('nip46.scanConnection'), variant: 'secondary', id: 'no-bunker-scan' }), ss.button({ label: t('nip46.pasteConnection'), variant: 'outline', id: 'no-bunker-paste' })),
      ss.vstack(
        { gap: 'sm' },
        ss.text({ color: 'muted', uppercase: true }, t('nip46.sessions')),
        noState.sessions.length
          ? noState.sessions
              .map((s, i) =>
                ss.vstack(
                  { gap: 'xs', className: 'no-session' },
                  ss.hstack(
                    { justifyBetween: true },
                    ss.text({ weight: 'bold' }, ss.esc(s.name)),
                    s.status === 'connecting'
                      ? ss.hstack({ gap: 'xs' }, '<span class="ss-spinner" style="width:12px;height:12px"></span>', ss.text({ size: 'xs', color: 'muted' }, t('nip46.connecting')))
                      : s.status === 'connected'
                        ? ss.text({ size: 'xs' }, t('nip46.connected'))
                        : ss.text({ size: 'xs', color: 'muted' }, t('nip46.disconnected'))
                  ),
                  ss.text({ size: 'xs', color: 'muted' }, s.relay),
                  ss.text({ size: 'xs', color: 'muted' }, `${t('nip46.lastActive')}: ${noDate(s.lastActive)}`),
                  ss.button({ label: t('nip46.disconnect'), variant: 'danger', data: { disconnect: i } })
                )
              )
              .join('')
          : ss.vstack({ gap: 'xs', itemsCenter: true, style: 'padding:24px 0' }, ss.text({ color: 'muted' }, t('nip46.noSessions')), ss.text({ size: 'xs', color: 'muted', center: true }, t('nip46.noSessionsHint')))
      )
    ),
  overlays: () =>
    ss.modal(
      { id: 'no-bunker-paste-modal', fullOpacity: true, label: t('common.cancel') },
      ss.vstack(
        { gap: 'md', widthFull: true, style: 'margin:auto 0' },
        ss.text({ color: 'muted', uppercase: true }, t('nip46.pasteConnection')),
        ss.textInput({ placeholder: 'nostrconnect://…', align: 'left', name: 'no-bunker-uri', value: 'nostrconnect://' + demoTxid('app').slice(0, 64) + '?relay=wss%3A%2F%2Frelay.nsec.app&name=Primal' }),
        `<p class="ss-input-note is-error" id="no-bunker-error" hidden>${t('nip46.invalidUri')}</p>`,
        ss.button({ label: t('nip46.approval.approve'), variant: 'secondary', id: 'no-bunker-approve' })
      )
    ) + noConfirmModal('no-bunker-disconnect', t('nip46.title'), t('nip46.disconnectConfirm'), t('nip46.disconnect'), 'no-bunker-disconnect-go'),
  bind: (body) => {
    let pending = -1
    noOn(body, (e) => {
      if (e.target.closest('#no-bunker-paste') || e.target.closest('#no-bunker-scan')) ss.open('no-bunker-paste-modal')
      if (e.target.closest('#no-bunker-approve')) {
        const uri = document.querySelector('[name="no-bunker-uri"]').value.trim()
        if (!uri.startsWith('nostrconnect://')) return (document.getElementById('no-bunker-error').hidden = false)
        const name = decodeURIComponent((uri.match(/name=([^&]+)/) || [])[1] || t('nip46.unknownApp'))
        noState.sessions.unshift({ name, relay: decodeURIComponent((uri.match(/relay=([^&]+)/) || [])[1] || 'wss://relay.nsec.app'), status: 'connecting', lastActive: Date.now() })
        openKitScreen('nostr-bunker')
        setTimeout(() => {
          noState.sessions[0].status = 'connected'
          ss.toast(t('nip46.connectionSuccess').replace('{{name}}', name), document.getElementById('view-kit'))
          if (kitCurrent === 'nostr-bunker') openKitScreen('nostr-bunker')
        }, 1100)
      }
      const d = e.target.closest('[data-disconnect]')
      if (d) {
        pending = +d.dataset.disconnect
        ss.open('no-bunker-disconnect')
      }
      if (e.target.closest('#no-bunker-disconnect-go') && pending > -1) {
        noState.sessions.splice(pending, 1)
        openKitScreen('nostr-bunker')
      }
    })
  }
})

// --- cache.tsx --------------------------------------------------------------------------

registerScreen('nostr-cache', {
  source: NO_SRC + 'account/[npub]/cache.tsx',
  title: () => nt('settings.cache.nostrCache'),
  back: 'nostr-settings',
  render: () => {
    const row = (key) =>
      `<div class="no-row">${ss.text({ className: 'no-grow' }, nt('settings.cache.' + key))}${ss.text({ color: 'muted' }, noState.cache[key].toLocaleString('en-US'))}<button type="button" class="no-clear" data-clear="${key}"${
        noState.cache[key] ? '' : ' disabled'
      }>${t('common.clear')}</button></div>`
    return ss.vstack(
      { gap: 'lg' },
      ss.vstack({ gap: 'sm' }, ss.text({ color: 'muted', uppercase: true }, nt('settings.cache.thisIdentity')), row('ownNotes') + row('ownZaps')),
      ss.vstack({ gap: 'sm' }, ss.text({ color: 'muted', uppercase: true }, nt('settings.cache.allNostr')), row('feedNotes') + row('zapReceipts') + row('profiles')),
      ss.button({ label: nt('settings.cache.clearAll'), variant: 'danger', id: 'no-clear-all' })
    )
  },
  overlays: () => noConfirmModal('no-clear-modal', nt('settings.cache.clearAllTitle'), nt('settings.cache.clearAllConfirm'), nt('settings.cache.clearAll'), 'no-clear-go'),
  bind: (body) =>
    noOn(body, (e) => {
      const c = e.target.closest('[data-clear]')
      if (c && !c.disabled) {
        noState.cache[c.dataset.clear] = 0
        ss.toast(nt('settings.cache.cleared'), document.getElementById('view-kit'))
        openKitScreen('nostr-cache')
      }
      if (e.target.closest('#no-clear-all')) ss.open('no-clear-modal')
      if (e.target.closest('#no-clear-go')) {
        Object.keys(noState.cache).forEach((k) => (noState.cache[k] = 0))
        ss.toast(nt('settings.cache.cleared'), document.getElementById('view-kit'))
        openKitScreen('nostr-cache')
      }
    })
})

// --- compose.tsx ------------------------------------------------------------------------

const noCompose = { text: '', mode: 'none', fixed: '', min: '', max: '', goal: '', uses: '', lnurl: '', advanced: false, json: false }

registerScreen('nostr-compose', {
  source: NO_SRC + 'account/[npub]/compose.tsx',
  title: () => nt('compose.title'),
  back: 'nostr-account',
  render: () => {
    const c = noCompose
    const plain = (name, placeholder, value, mode = 'numeric') => `<input class="no-plain-input" name="no-c-${name}" inputmode="${mode}" placeholder="${ss.esc(placeholder)}" value="${ss.esc(value)}">`
    const tags = [['client', 'satsigner']]
    if (c.mode === 'fixed' && c.fixed) tags.push(['zap-min', String(+c.fixed * 1000)], ['zap-max', String(+c.fixed * 1000)])
    if (c.mode === 'range' && c.min) tags.push(['zap-min', String(+c.min * 1000)], ['zap-max', String(+(c.max || c.min) * 1000)])
    if (c.goal) tags.push(['zap-goal', String(+c.goal * 1000)])
    if (c.uses) tags.push(['zap-uses', c.uses])
    if (c.lnurl) tags.push(['zap-lnurl', c.lnurl])
    const json = JSON.stringify({ kind: 1, created_at: Math.round(noNow / 1000), tags, content: c.text }, null, 2)
    return ss.vstack(
      { gap: 'md', style: 'padding-bottom:24px' },
      ss.vstack({ gap: 'xs' }, ss.text({ size: 'xs', color: 'muted' }, ss.esc(noTitle()))),
      ss.hstack({ gap: 'sm' }, ss.button({ label: nt('compose.importPasteJson'), variant: 'outline', id: 'no-c-paste', style: 'flex:1' }), ss.button({ label: nt('compose.importScanQr'), variant: 'outline', id: 'no-c-paste', style: 'flex:1' })),
      `<textarea class="no-compose-input" name="no-c-text" maxlength="5000" placeholder="${ss.esc(nt('compose.placeholder'))}">${ss.esc(c.text)}</textarea>`,
      ss.text({ size: 'xxs', color: 'muted', style: 'text-align:right;margin-top:-8px', id: 'no-c-count' }, `${c.text.length}/5000`),
      ss.vstack(
        { gap: 'sm' },
        ss.text({ size: 'xs', color: 'muted', uppercase: true }, nt('compose.paymentRequest')),
        ss.hstack({ gap: 'sm' }, ['none', 'fixed', 'range'].map((m) => `<button type="button" class="no-mode${c.mode === m ? ' is-on' : ''}" data-mode="${m}">${nt('compose.mode_' + m)}</button>`)),
        c.mode === 'fixed' ? plain('fixed', nt('compose.fixedPlaceholder'), c.fixed) : '',
        c.mode === 'range' ? ss.hstack({ gap: 'sm' }, plain('min', nt('compose.minPlaceholder'), c.min), plain('max', nt('compose.maxPlaceholder'), c.max)) : '',
        c.mode !== 'none' ? `<button type="button" class="no-link" data-advanced>${c.advanced ? nt('compose.hideAdvanced') : nt('compose.showAdvanced')}</button>` : '',
        c.mode !== 'none' && c.advanced
          ? ss.vstack(
              { gap: 'sm' },
              ss.text({ size: 'xs', color: 'muted' }, nt('compose.goalLabel')),
              plain('goal', nt('compose.goalPlaceholder'), c.goal),
              ss.text({ size: 'xs', color: 'muted' }, nt('compose.usesLabel')),
              plain('uses', nt('compose.usesPlaceholder'), c.uses),
              ss.text({ size: 'xs', color: 'muted' }, nt('compose.lnurlLabel')),
              plain('lnurl', nt('compose.lnurlPlaceholder'), c.lnurl, 'email')
            )
          : ''
      ),
      ss.vstack(
        { gap: 'sm' },
        ss.button({ label: c.json ? nt('compose.hideJson') : nt('compose.showJson'), variant: 'outline', id: 'no-c-json' }),
        c.json ? ss.text({ size: 'xxs', type: 'mono', className: 'no-json' }, ss.esc(json)) : ''
      ),
      ss.button({ label: nt('compose.publish'), variant: 'gradient', id: 'no-c-publish', disabled: !c.text.trim() }),
      ss.hstack(
        { gap: 'sm', className: 'no-eq' },
        ss.clipboardCopy({ text: json }, ss.button({ label: nt('compose.copySigned'), variant: 'outline', disabled: !c.text.trim() })),
        ss.button({ label: nt('compose.qrSigned'), variant: 'outline', id: 'no-c-qr', disabled: !c.text.trim(), style: 'flex:1' })
      )
    )
  },
  overlays: () => noQrModal('no-c-qr-modal', nt('compose.qrSigned'), 'nostr:' + noBech('nevent', noCompose.text || 'draft').slice(0, 68)),
  bind: (body) => {
    const keep = () =>
      body.querySelectorAll('[name^="no-c-"]').forEach((el) => {
        noCompose[el.name.slice(5)] = el.value
      })
    const text = body.querySelector('[name="no-c-text"]')
    text.addEventListener('input', () => {
      body.querySelector('#no-c-count').textContent = `${text.value.length}/5000`
      const empty = !text.value.trim()
      body.querySelector('#no-c-publish').disabled = empty
      body.querySelector('#no-c-qr').disabled = empty
    })
    noOn(body, (e) => {
      const m = e.target.closest('[data-mode]')
      if (m) {
        keep()
        noCompose.mode = m.dataset.mode
        return openKitScreen('nostr-compose')
      }
      if (e.target.closest('[data-advanced]')) {
        keep()
        noCompose.advanced = !noCompose.advanced
        return openKitScreen('nostr-compose')
      }
      if (e.target.closest('#no-c-json')) {
        keep()
        noCompose.json = !noCompose.json
        return openKitScreen('nostr-compose')
      }
      if (e.target.closest('#no-c-paste')) {
        noCompose.text = 'Imported draft from JSON (demo).'
        ss.toast(nt('compose.importSuccess'), document.getElementById('view-kit'))
        return openKitScreen('nostr-compose')
      }
      if (e.target.closest('#no-c-qr')) {
        keep()
        document.getElementById('kit-overlays').innerHTML = kitScreens['nostr-compose'].overlays()
        return ss.open('no-c-qr-modal')
      }
      const pub = e.target.closest('#no-c-publish')
      if (pub && !pub.disabled) {
        keep()
        pub.disabled = true
        pub.querySelector('.ss-button-label').textContent = nt('compose.publishing')
        setTimeout(() => {
          noNotes.unshift({ id: 'n' + Date.now(), author: noMe, kind: 1, at: noNow, content: noCompose.text })
          Object.assign(noCompose, { text: '', mode: 'none', fixed: '', min: '', max: '', goal: '', uses: '', lnurl: '', advanced: false, json: false })
          ss.toast(nt('compose.published'), document.getElementById('view-kit'))
          go('nostr-account')
        }, 900)
      }
    })
  }
})

// --- create/index.tsx ---------------------------------------------------------------------

let noCreateShowNsec = false
registerScreen('nostr-create', {
  source: NO_SRC + 'create/index.tsx',
  title: () => nt('create.title'),
  back: 'nostr-add',
  render: () => {
    const nsec = noBech('nsec', 'new-identity')
    const npub = noBech('npub', 'new-identity')
    const words = 'legal winner thank year wave sausage worth useful legal winner thank yellow'.split(' ')
    const group = (title, body, actions) => ss.vstack({ gap: 'sm' }, ss.text({ center: true, color: 'muted', uppercase: true }, title), body, ss.hstack({ gap: 'sm', className: 'no-eq' }, ...actions))
    return ss.vstack(
      { gap: 'lg', style: 'padding-bottom:24px' },
      group(nt('create.seedWords'), noWords(words), [
        ss.clipboardCopy({ text: words.join(' ') }, ss.button({ label: t('common.copy'), variant: 'outline' })),
        ss.button({ label: t('account.seed.seedqr.title'), variant: 'outline', data: { qr: 'seed' } })
      ]),
      group(nt('create.nsec'), noCreateShowNsec ? noKey(nsec) : ss.text({ size: 'xl', type: 'mono', center: true }, '••••••••••••••••'), [
        ss.button({ label: noCreateShowNsec ? t('common.hide') : t('common.show'), variant: 'outline', id: 'no-create-show' }),
        ss.clipboardCopy({ text: nsec }, ss.button({ label: t('common.copy'), variant: 'outline' })),
        ss.button({ label: t('common.showQR'), variant: 'outline', data: { qr: 'nsec' } })
      ]),
      group(nt('create.npub'), noKey(npub), [ss.clipboardCopy({ text: npub }, ss.button({ label: t('common.copy'), variant: 'outline' })), ss.button({ label: t('common.showQR'), variant: 'outline', data: { qr: 'npub' } })]),
      ss.button({ label: nt('create.next'), variant: 'secondary', go: 'nostr-create-profile' })
    )
  },
  overlays: () =>
    noQrModal('no-qr-seed', t('account.seed.seedqr.title'), '0101203604430987040014271997178301712007037707320987040014272051') +
    noQrModal('no-qr-nsec', nt('create.nsec'), noBech('nsec', 'new-identity')) +
    noQrModal('no-qr-npub', nt('create.npub'), noBech('npub', 'new-identity')),
  bind: (body) =>
    noOn(body, (e) => {
      if (e.target.closest('#no-create-show')) {
        noCreateShowNsec = !noCreateShowNsec
        openKitScreen('nostr-create')
      }
      const q = e.target.closest('[data-qr]')
      if (q) ss.open('no-qr-' + q.dataset.qr)
    })
})

// --- import/index.tsx -----------------------------------------------------------------------

registerScreen('nostr-import', {
  source: NO_SRC + 'import/index.tsx',
  title: () => nt('import.title'),
  back: 'nostr-add',
  render: () => {
    const tab = noState.importTab
    const keyTab = (kind) =>
      ss.vstack(
        { gap: 'lg', style: 'padding-top:16px' },
        ss.vstack(
          { gap: 'xs' },
          ss.text({ color: 'muted', uppercase: true }, nt(`import.${kind}Label`)),
          ss.textInput({ placeholder: kind + '1...', align: 'left', name: 'no-import-' + kind }),
          `<p class="ss-input-note is-error" id="no-import-error" hidden></p>`,
          kind === 'npub' ? ss.text({ size: 'xs', color: 'muted' }, nt('import.npubHint')) : ''
        ),
        ss.hstack({ gap: 'sm' }, ss.button({ label: t('common.paste'), variant: 'outline', data: { paste: kind }, style: 'flex:1' }), ss.button({ label: t('common.scanQR'), variant: 'outline', data: { paste: kind }, style: 'flex:1' })),
        ss.button({ label: nt('import.importButton'), variant: 'secondary', data: { import: kind } })
      )
    const seedTab = ss.vstack(
      { gap: 'lg', style: 'padding-top:16px' },
      noWords(Array(12).fill(''), true),
      ss.hstack({ gap: 'sm' }, ss.button({ label: t('common.paste'), variant: 'outline', data: { paste: 'seed' }, style: 'flex:1' })),
      `<p class="ss-input-note is-error" id="no-import-error" hidden></p>`,
      ss.button({ label: nt('import.importButton'), variant: 'secondary', data: { import: 'seed' } })
    )
    return noTabs(['nsec', 'Seed Words', 'npub'], tab, 'import-tab') + [keyTab('nsec'), seedTab, keyTab('npub')][tab]
  },
  bind: (body) =>
    noOn(body, (e) => {
      const tb = e.target.closest('[data-import-tab]')
      if (tb) {
        noState.importTab = +tb.dataset.importTab
        return openKitScreen('nostr-import')
      }
      const p = e.target.closest('[data-paste]')
      if (p) {
        const kind = p.dataset.paste
        if (kind === 'seed') noMe.mnemonic.split(' ').forEach((w, i) => (body.querySelector(`[data-word="${i}"]`).value = w))
        else body.querySelector(`[name="no-import-${kind}"]`).value = noBech(kind, 'imported')
      }
      const imp = e.target.closest('[data-import]')
      if (imp) {
        const kind = imp.dataset.import
        const err = body.querySelector('#no-import-error')
        let ok
        if (kind === 'seed') ok = [...body.querySelectorAll('[data-word]')].every((i) => /^[a-z]{3,8}$/.test(i.value.trim()))
        else ok = new RegExp('^' + kind + '1[0-9a-z]{50,}$').test(body.querySelector(`[name="no-import-${kind}"]`).value.trim())
        if (!ok) {
          err.textContent = kind === 'seed' ? nt('import.derivationError') : nt(kind === 'nsec' ? 'import.invalidNsec' : 'import.invalidNpub')
          err.hidden = false
          return
        }
        ss.toast(nt('import.success'), document.getElementById('view-kit'))
        go('nostr')
      }
    })
})

// --- relays.tsx (global relay list) ---------------------------------------------------------

registerScreen('nostr-global-relays', {
  source: NO_SRC + 'relays.tsx',
  title: () => nt('relays.title'),
  back: 'nostr',
  render: () => {
    const row = (r) => `<div class="no-relay" data-relay-row="${r.url}">${ss.checkbox({ selected: noState.relays.includes(r.url), data: { relay: r.url } })}${ss.vstack({ gap: 'none' }, ss.text({}, ss.esc(r.name)), ss.text({ size: 'xs', color: 'muted' }, r.url))}</div>`
    return ss.vstack(
      { gap: 'lg', style: 'padding-bottom:24px' },
      ss.vstack({ gap: 'sm' }, ss.text({ uppercase: true }, nt('relays.public')), ss.textInput({ placeholder: nt('relays.search'), align: 'left', name: 'no-relay-search' }), NO_RELAYS.map(row).join('')),
      ss.vstack(
        { gap: 'md' },
        ss.text({ uppercase: true }, nt('relays.custom')),
        noState.customRelays.map((u) => row({ name: u.replace('wss://', ''), url: u })).join(''),
        ss.vstack(
          { gap: 'sm' },
          `<div class="no-relay-add">${ss.text({ color: 'muted', size: 'lg', as: 'span' }, 'wss://')}${ss.textInput({ placeholder: nt('relays.inputPlaceholder'), align: 'left', name: 'no-relay-new' })}</div>`,
          ss.button({ label: nt('relays.addCustom'), variant: 'secondary', id: 'no-relay-add' })
        )
      ),
      ss.button({ label: t('common.save'), variant: 'secondary', id: 'no-relay-save' })
    )
  },
  bind: (body) => {
    const search = body.querySelector('[name="no-relay-search"]')
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase()
      body.querySelectorAll('[data-relay-row]').forEach((r) => (r.hidden = q && !r.textContent.toLowerCase().includes(q)))
    })
    noOn(body, (e) => {
      // ss.checkbox toggles itself (data-ss-toggle); mirror it into state after it runs.
      const box = e.target.closest('[data-relay]')
      if (box)
        setTimeout(() => {
          const url = box.dataset.relay
          noState.relays = box.classList.contains('is-on') ? [...new Set([...noState.relays, url])] : noState.relays.filter((x) => x !== url)
        })
      if (e.target.closest('#no-relay-add')) {
        const v = body.querySelector('[name="no-relay-new"]').value.trim().replace(/^wss?:\/\//, '')
        if (!v) return
        const url = 'wss://' + v
        if (!noState.customRelays.includes(url)) noState.customRelays.push(url)
        noState.relays.push(url)
        openKitScreen('nostr-global-relays')
      }
      if (e.target.closest('#no-relay-save')) {
        ss.toast(nt('relays.saved'), document.getElementById('view-kit'))
        go('nostr')
      }
    })
  }
})
