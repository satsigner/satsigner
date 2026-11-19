/* Demo personas. Swaps the shared fixtures (accounts, activity, Nostr identity)
   so the prototype can be walked as three different people. No keys, no network. */

function personaShot(persona) {
  return persona.images[persona.shot || 0]
}

function personaTx(p) {
  return {
    type: p.type,
    label: p.label,
    tags: p.tags || [],
    amount: p.amount,
    fiat: p.fiat,
    historical: p.historical || '',
    priceChange: p.priceChange || '',
    ago: p.ago,
    txid: p.txid,
    conf: p.conf,
    block: p.block,
    balance: p.balance,
    inputs: p.inputs || 1,
    outputs: p.outputs || (p.type === 'send' ? 2 : 1),
    size: p.size || 222,
    vsize: p.vsize || 141,
    weight: p.weight || 561,
    fee: p.fee || 180,
    version: 2,
    payjoin: p.payjoin || false,
    rbf: p.rbf || false,
    contributed: p.contributed,
    flowInputs: p.flowInputs,
    flowOutputs: p.flowOutputs
  }
}

const STUDIO_PERSONAS = [
  {
    id: 'cold',
    name: 'Mira Voss',
    role: 'Cold storage',
    personality: 'Patient, private, allergic to hot wallets.',
    bio: 'Mira moved coins off an exchange in 2021 and has barely touched them. The phone holds a watch-only descriptor. The keys live on two metal plates and a laptop that stays offline. She checks the vault a few times a year and writes labels for whoever inherits it.',
    motivation: 'Keep the coins where a hurried decision cannot reach them, and leave instructions a heir can follow without her in the room.',
    attacks: ['A swapped descriptor note', 'A helper who photographs a metal plate', 'A watch-only wallet that turns out to be spendable', 'Inheritance papers that include the passphrase'],
    fears: ['Moving coins by mistake', 'A fire that takes both plates', 'Someone treating the blue envelope as the whole key'],
    images: [
      { src: '/imgs/studio/personas/mira-study.jpg', alt: 'Photorealistic scene of Mira Voss in a wood-paneled study, checking the wallet on her phone at an oak desk.' },
      { src: '/imgs/studio/personas/mira-photo.jpg', alt: 'Photorealistic studio photo of Mira Voss: short silver hair, charcoal coat, dark backdrop.' },
      { src: '/imgs/studio/personas/mira-cartoon.jpg', alt: 'Flat cartoon sticker of Mira Voss: silver hair, simple coat shape, thick outline.' },
      { src: '/imgs/studio/personas/mira-print.jpg', alt: 'Black-and-white linocut of Mira Voss: carved marks, high contrast, paper grain.' }
    ],
    accounts: [
      {
        name: 'Inheritance',
        network: 'signet',
        balance: 148767137,
        fiat: '148,767.14',
        fingerprint: 'a3f19c72',
        watchOnly: true,
        stats: [['4', 'Transactions'], ['3', 'Addresses'], ['4', 'Outputs'], ['0', 'Mempool']]
      },
      {
        name: 'Air gap',
        network: 'signet',
        balance: 20716713,
        fiat: '20,716.71',
        fingerprint: '7e04b8d1',
        watchOnly: false,
        multisig: true,
        stats: [['2', 'Transactions'], ['2', 'Addresses'], ['2', 'Outputs'], ['0', 'Mempool']]
      }
    ],
    activity: {
      a3f19c72: [
        personaTx({ type: 'receive', label: 'DCA 2021', tags: ['cold'], amount: 41837219, fiat: '41,837.22', historical: '18,400.00', priceChange: '+128%', ago: 'Mar 12, 2021 · 5 years ago', txid: 'dca2021aa11bb22cc33dd44ee55ff66778899aabbccddeeff001122334455', conf: 280000, block: 675100, balance: 41837219, fee: 420 }),
        personaTx({ type: 'receive', label: 'DCA 2021', tags: ['cold'], amount: 37204883, fiat: '37,204.88', historical: '21,100.00', priceChange: '+80%', ago: 'Nov 2, 2021 · 5 years ago', txid: 'dca2021bb22cc33dd44ee55ff66778899aabbccddeeff0011223344556677', conf: 250000, block: 708400, balance: 79042102, fee: 310 }),
        personaTx({ type: 'receive', label: 'Inheritance', tags: ['estate'], amount: 71608447, fiat: '71,608.45', historical: '41,000.00', priceChange: '+67%', ago: 'Jan 18, 2023 · 3 years ago', txid: 'inherit011aa22bb33cc44dd55ee66ff778899aabbccddeeff0011223344', conf: 140000, block: 772200, balance: 150650549, fee: 540 }),
        personaTx({ type: 'send', label: 'Vault sweep', tags: ['consolidate'], amount: 1883412, fiat: '1,883.41', historical: '1,640.00', priceChange: '+14%', ago: 'Aug 4, 2024 · 2 years ago', txid: 'sweep0011aa22bb33cc44dd55ee66ff778899aabbccddeeff001122334455', conf: 90000, block: 855100, balance: 148767137, inputs: 3, outputs: 1, fee: 890 })
      ],
      '7e04b8d1': [
        personaTx({ type: 'receive', label: 'Cold storage', tags: ['multisig'], amount: 18473291, fiat: '18,473.29', historical: '9,800.00', priceChange: '+114%', ago: 'Jun 9, 2022 · 4 years ago', txid: 'airgap0011aa22bb33cc44dd55ee66ff778899aabbccddeeff0011223344', conf: 210000, block: 740200, balance: 18473291, fee: 250 }),
        personaTx({ type: 'receive', label: 'Cold storage', tags: ['multisig'], amount: 3291084, fiat: '3,291.08', historical: '2,040.00', priceChange: '+61%', ago: 'Feb 1, 2024 · 2 years ago', txid: 'airgap0022bb33cc44dd55ee66ff778899aabbccddeeff00112233445566', conf: 110000, block: 828800, balance: 21764375, fee: 180 }),
        personaTx({ type: 'send', label: 'Vault sweep', tags: ['consolidate'], amount: 1047662, fiat: '1,047.66', ago: 'Sep 12, 2025 · 1 year ago', txid: 'airgap0033cc44dd55ee66ff778899aabbccddeeff001122334455667788', conf: 52000, block: 910400, balance: 20716713, inputs: 2, outputs: 1, fee: 640 })
      ]
    },
    nostr: {
      meName: 'vault',
      meExtra: { nip05: '', lud16: '', about: 'Watch-only. Keys stay offline. If you are reading this, check the descriptor note.' },
      mnemonic: 'vault ocean quiet stone winter river copper lantern harbor meadow cedar frost',
      contacts: [
        { name: 'Notary', about: 'Holds one plate. Does not have the passphrase.' }
      ],
      notes: [
        { me: true, id: 'n1', kind: 1, atOffset: 864e5 * 400, content: 'Descriptor for the inheritance vault is on the card in the blue envelope. Two of three. Do not move coins unless both plates are in the room.' }
      ],
      zaps: [],
      files: [
        { name: 'descriptor.txt', ext: 'txt', mime: 'text/plain', category: 'document', size: 860, days: 400 }
      ],
      calendar: [],
      chats: [],
      relays: ['wss://relay.damus.io'],
      customRelays: [],
      sessions: [],
      cache: { ownNotes: 1, ownZaps: 0, feedNotes: 0, zapReceipts: 0, profiles: 2 },
      presets: [100000, 1000000],
      oneTap: '',
      autoApprove: false
    }
  },
  {
    id: 'nyx',
    name: 'Nyx',
    role: 'Cypherpunk',
    personality: 'Fast, opinionated, treats the phone as a signing device.',
    bio: 'Nyx runs a hot wallet for the week, a 2-of-3 with two friends, and a Nostr identity that is the device group. Coinjoin, payjoin, and OP_RETURN labels are how they remember which coins are still clean. The feed is busy. The legal name is not on the profile.',
    motivation: 'Spend without a name on the coins, and keep the council stash out of the wallet that pays for the week.',
    attacks: ['Address reuse after a coinjoin', 'A relay that logs the device group', 'A cosigner who broadcasts before the second signature', 'A phone backup that includes the seed'],
    fears: ['A clean coin falling back into the hot wallet', 'A legal name leaking through a nip-05', 'Losing one cosigner and stalling the 2-of-3'],
    images: [
      { src: '/imgs/studio/personas/nyx-room.jpg', alt: 'Photorealistic scene of Nyx in a computer room, hood up, holding a phone among monitors and servers.' },
      { src: '/imgs/studio/personas/nyx-photo.jpg', alt: 'Photorealistic night photo of Nyx: black hair, silver hoop, hoodie, thin green rim light.' },
      { src: '/imgs/studio/personas/nyx-cartoon.jpg', alt: 'Chunky cartoon of Nyx: spiky hair, hoop, flat neon-green glow on a dark field.' },
      { src: '/imgs/studio/personas/nyx-pixel.jpg', alt: 'Pixel-art bust of Nyx: blocky black hair, hoop, hoodie, green edge pixels.' }
    ],
    accounts: [
      {
        name: 'Hot',
        network: 'signet',
        balance: 807217,
        fiat: '807.22',
        fingerprint: '2c8a91f4',
        watchOnly: false,
        stats: [['18', 'Transactions'], ['22', 'Addresses'], ['9', 'Outputs'], ['12400', 'Mempool']]
      },
      {
        name: 'Council',
        network: 'signet',
        balance: 6180514,
        fiat: '6,180.51',
        fingerprint: '91d6e0ab',
        watchOnly: false,
        multisig: true,
        stats: [['7', 'Transactions'], ['8', 'Addresses'], ['4', 'Outputs'], ['0', 'Mempool']]
      },
      {
        name: 'Nostr device',
        network: 'signet',
        balance: 208195,
        fiat: '208.20',
        fingerprint: '5b17c3e8',
        watchOnly: false,
        stats: [['4', 'Transactions'], ['4', 'Addresses'], ['3', 'Outputs'], ['2100', 'Mempool']]
      }
    ],
    activity: {
      '2c8a91f4': [
        personaTx({ type: 'receive', label: 'Coinjoin', tags: ['mix'], amount: 487331, fiat: '487.33', historical: '470.00', priceChange: '+6%', ago: 'Sep 2, 2026 · 2 months ago', txid: 'cj0001aa11bb22cc33dd44ee55ff66778899aabbccddeeff00112233445566', conf: 8000, block: 910200, balance: 487331, inputs: 5, outputs: 5, fee: 2400 }),
        personaTx({ type: 'send', label: 'Samourai change', tags: ['mix', 'change'], amount: 79418, fiat: '79.42', ago: 'Sep 2, 2026 · 2 months ago', txid: 'cj0002bb22cc33dd44ee55ff66778899aabbccddeeff001122334455667788', conf: 7998, block: 910202, balance: 407913, inputs: 1, outputs: 2, fee: 410 }),
        personaTx({
          type: 'receive', label: 'Payjoin', tags: ['payjoin'], amount: 173846, fiat: '173.85', ago: 'Sep 18, 2026 · 1 month ago',
          txid: 'pj0003cc33dd44ee55ff66778899aabbccddeeff00112233445566778899', conf: 5600, block: 912600, balance: 581759,
          inputs: 2, outputs: 2, fee: 520, payjoin: true, contributed: 61247,
          flowInputs: [
            { value: 61247, label: 'Hot', ours: true, from: '2c8a91f4aa' },
            { value: 250000, label: 'Counterparty', ours: false, from: 'e44f02d199aa' }
          ],
          flowOutputs: [
            { value: 173846, label: 'Payjoin', ours: true, to: 'tb1qnyxpayjoin' },
            { value: 122725, label: 'Sender change', ours: false, to: 'tb1qsender009' },
            { value: 522, label: 'Miner fee', fee: true }
          ]
        }),
        personaTx({ type: 'send', label: 'Op return', tags: ['op_return'], amount: 546, fiat: '0.55', ago: 'Oct 1, 2026 · 4 weeks ago', txid: 'op0004dd44ee55ff66778899aabbccddeeff00112233445566778899aabb', conf: 3800, block: 914400, balance: 581213, outputs: 2, fee: 330 }),
        personaTx({ type: 'send', label: 'Nym', tags: ['nostr'], amount: 18437, fiat: '18.44', ago: 'Oct 20, 2026 · 10 days ago', txid: 'nym005ee55ff66778899aabbccddeeff00112233445566778899aabbccdd', conf: 1200, block: 917000, balance: 562776, fee: 210 }),
        personaTx({ type: 'receive', label: 'Coinjoin', tags: ['mix'], amount: 263914, fiat: '263.91', ago: 'Oct 28, 2026 · 2 days ago', txid: 'cj0006ff66778899aabbccddeeff00112233445566778899aabbccddee', conf: 40, block: 918160, balance: 826690, inputs: 8, outputs: 8, fee: 3100 }),
        personaTx({ type: 'send', label: 'RBF bump', tags: ['rbf'], amount: 19473, fiat: '19.47', ago: 'Oct 30, 2026 · today', txid: 'rbf007778899aabbccddeeff00112233445566778899aabbccddeeff00', conf: 0, block: 0, balance: 807217, rbf: true, fee: 980 })
      ],
      '91d6e0ab': [
        personaTx({ type: 'receive', label: 'Council deposit', tags: ['multisig'], amount: 4837291, fiat: '4,837.29', ago: 'Apr 4, 2026 · 7 months ago', txid: 'ms0001aa11bb22cc33dd44ee55ff66778899aabbccddeeff001122334455', conf: 28000, block: 890100, balance: 4837291, fee: 400 }),
        personaTx({ type: 'receive', label: 'Council deposit', tags: ['multisig'], amount: 1926440, fiat: '1,926.44', ago: 'Jul 19, 2026 · 3 months ago', txid: 'ms0002bb22cc33dd44ee55ff66778899aabbccddeeff0011223344556677', conf: 14000, block: 904200, balance: 6763731, fee: 360 }),
        personaTx({ type: 'send', label: 'Nym', tags: ['cosign'], amount: 583217, fiat: '583.22', ago: 'Oct 8, 2026 · 3 weeks ago', txid: 'ms0003cc33dd44ee55ff66778899aabbccddeeff00112233445566778899', conf: 2800, block: 915400, balance: 6180514, inputs: 2, outputs: 2, fee: 740 })
      ],
      '5b17c3e8': [
        personaTx({ type: 'receive', label: 'Zap sink', tags: ['nostr', 'lightning'], amount: 87413, fiat: '87.41', ago: 'Aug 1, 2026 · 3 months ago', txid: 'dv0001aa11bb22cc33dd44ee55ff66778899aabbccddeeff001122334455', conf: 12000, block: 906100, balance: 87413, fee: 140 }),
        personaTx({ type: 'receive', label: 'Zap sink', tags: ['nostr'], amount: 141902, fiat: '141.90', ago: 'Oct 11, 2026 · 3 weeks ago', txid: 'dv0002bb22cc33dd44ee55ff66778899aabbccddeeff0011223344556677', conf: 2400, block: 915800, balance: 229315, fee: 160 }),
        personaTx({ type: 'send', label: 'Relay fee', tags: ['nostr'], amount: 17846, fiat: '17.85', ago: 'Oct 29, 2026 · yesterday', txid: 'dv0003cc33dd44ee55ff66778899aabbccddeeff00112233445566778899', conf: 12, block: 918188, balance: 211469, fee: 200 }),
        personaTx({ type: 'send', label: '', tags: [], amount: 3274, fiat: '3.27', ago: 'Oct 30, 2026 · today', txid: 'dv0004dd44ee55ff66778899aabbccddeeff00112233445566778899aabb', conf: 0, block: 0, balance: 208195, rbf: true, fee: 90 })
      ]
    },
    nostr: {
      meName: 'nyx',
      meExtra: { nip05: 'nyx@nostr.example', lud16: 'nyx@getalby.com', about: 'Signing device with a feed. Coins are labeled. The name is not.' },
      mnemonic: 'nym shadow relay cipher orbit vault signal quiet mesh frost cedar lantern',
      contacts: [
        { name: 'ash', nip05: 'ash@nostr.example', about: 'Cosigner. Holds key 2 of the council.' },
        { name: 'quill', about: 'Writes the long notes. Runs a relay.' },
        { name: 'moth', nip05: 'moth@citadel.example', lud16: 'moth@coinos.io', about: 'Payjoin counterparty.' },
        { name: 'kite', about: 'Device group. Signs from a second phone.' }
      ],
      notes: [
        { me: true, id: 'n1', kind: 1, hours: 5, content: 'Payjoin landed. Receiver added a coin. Labels updated: Payjoin, not income.' },
        { contact: 2, id: 'n2', kind: 1, hours: 8, content: 'Your output was the one with the odd amount. I did not reuse the change address.' },
        { me: true, id: 'n3', kind: 1, hours: 20, content: 'Council PSBT is on the device group. Two signatures. Do not broadcast until ash replies.' },
        { contact: 1, id: 'n4', kind: 30023, hours: 30, content: '# Labels are the memory\n\nIf the coin has no label it does not get spent. Coinjoin, payjoin, and the OP_RETURN stay in different piles.' },
        { contact: 0, id: 'n5', kind: 1, hours: 48, content: 'Signed. Broadcasting from my side so the hot wallet does not touch the council change.' },
        { me: true, id: 'n6', kind: 1, hours: 2, content: 'gm. RBF is sitting in the mempool on purpose.' }
      ],
      zaps: [
        { id: 'z1', from: 2, sats: 2100, hours: 4, comment: 'for the payjoin note', note: 'n1', incoming: true },
        { id: 'z2', fromMe: true, to: 1, sats: 1000, hours: 18, comment: '', note: 'n4', incoming: false },
        { id: 'z3', from: 0, sats: 21000, hours: 40, comment: 'council coffee', note: 'n3', incoming: true },
        { id: 'z4', from: 3, sats: 500, hours: 6, comment: 'signed', note: 'n6', incoming: true }
      ],
      files: [
        { name: 'avatar.png', ext: 'png', mime: 'image/png', category: 'image', size: 182344, days: 2 },
        { name: 'council-descriptor.txt', ext: 'txt', mime: 'text/plain', category: 'document', size: 1240, days: 40 },
        { name: 'labels-bip329.jsonl', ext: 'jsonl', mime: 'application/jsonl', category: 'document', size: 4211, days: 6 },
        { name: 'psbt-council.psbt', ext: 'psbt', mime: 'application/octet-stream', category: 'other', size: 2048, days: 3 }
      ],
      calendar: [
        { title: 'Council key check', days: 6, hours: 2, location: 'Signal then Nostr' },
        { title: 'Payjoin office hours', days: 12, location: 'Online' }
      ],
      chats: [
        { contact: 3, unread: 1, lines: [
          { them: true, hours: 3, text: 'PSBT is in the group. I can sign key 3.' },
          { hours: 2.8, text: 'Wait for ash. Do not broadcast the hot-wallet change into it.' },
          { them: true, hours: 2.5, text: 'Holding.' }
        ]},
        { contact: 0, unread: 1, lines: [
          { them: true, hours: 26, text: 'Can you cosign the vault spend?' },
          { hours: 20, text: 'Signed. Note is up.' }
        ]},
        { contact: 2, lines: [
          { them: true, hours: 9, text: 'Payjoin proposal sent. Odd-sized output is yours.' },
          { hours: 8.5, text: 'Added a coin from Hot. Label is Payjoin.' }
        ]}
      ],
      relays: ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.nostr.band'],
      customRelays: ['wss://relay.nyx.example'],
      sessions: [
        { name: 'Amethyst', relay: 'wss://relay.nsec.app', status: 'connected', hours: 0.4 },
        { name: 'Gossip', relay: 'wss://relay.damus.io', status: 'connected', hours: 5 },
        { name: 'Coracle', relay: 'wss://relay.nsec.app', status: 'disconnected', days: 2 }
      ],
      cache: { ownNotes: 640, ownZaps: 188, feedNotes: 9020, zapReceipts: 1440, profiles: 310 },
      presets: [21, 210, 2100, 21000],
      oneTap: '21',
      autoApprove: true
    }
  },
  {
    id: 'leo',
    name: 'Leo Park',
    role: 'Beginner',
    personality: 'Curious, careful, still naming things out loud.',
    bio: 'Leo set the app up last month after his dad walked him through a seed phrase on paper. There is one wallet. The labels say what the money was for, because “UTXO” did not stick. Nostr is a profile photo and a single gm.',
    motivation: 'Learn self-custody with amounts he can afford to lose, and pay for ordinary things without calling his dad first.',
    attacks: ['A fake wallet app', 'A market QR that is not the stall’s', 'The seed saved in a notes app', 'A friend who says to screenshot the words'],
    fears: ['Sending to the wrong address', 'Losing the paper seed', 'Looking lost in front of the vendor'],
    images: [
      { src: '/imgs/studio/personas/leo-market.jpg?v=3', alt: 'Photorealistic scene of Leo Park from behind, olive cap, confirming a 5,000 sat payment at a farmers market.' },
      { src: '/imgs/studio/personas/leo-photo.jpg', alt: 'Photorealistic photo of Leo Park: brown hair, shy smile, grey t-shirt, warm indoor light.' },
      { src: '/imgs/studio/personas/leo-cartoon.jpg', alt: 'Round cartoon of Leo Park: messy brown hair, shy smile, flat grey shirt, thick outlines.' },
      { src: '/imgs/studio/personas/leo-wash.jpg', alt: 'Loose watercolor and ink sketch of Leo Park: brown hair, grey shirt, visible paper.' }
    ],
    accounts: [
      {
        name: 'My bitcoin',
        network: 'signet',
        balance: 83473,
        fiat: '83.47',
        fingerprint: 'e46a2d90',
        watchOnly: false,
        stats: [['5', 'Transactions'], ['4', 'Addresses'], ['3', 'Outputs'], ['0', 'Mempool']]
      }
    ],
    activity: {
      e46a2d90: [
        personaTx({ type: 'receive', label: 'Gift from dad', tags: ['family'], amount: 97418, fiat: '97.42', historical: '95.10', priceChange: '+2%', ago: 'Sep 28, 2026 · 1 month ago', txid: 'leo001aa11bb22cc33dd44ee55ff66778899aabbccddeeff00112233445566', conf: 4300, block: 913900, balance: 97418, fee: 140 }),
        personaTx({ type: 'receive', label: 'Allowance', tags: ['family'], amount: 12637, fiat: '12.64', ago: 'Oct 6, 2026 · 3 weeks ago', txid: 'leo002bb22cc33dd44ee55ff66778899aabbccddeeff001122334455667788', conf: 3200, block: 915000, balance: 110055, fee: 120 }),
        personaTx({ type: 'send', label: 'Pizza', tags: ['food'], amount: 17863, fiat: '17.86', ago: 'Oct 12, 2026 · 2 weeks ago', txid: 'leo003cc33dd44ee55ff66778899aabbccddeeff00112233445566778899', conf: 2400, block: 915800, balance: 92192, fee: 210 }),
        personaTx({ type: 'send', label: 'Bus', tags: ['transit'], amount: 3847, fiat: '3.85', ago: 'Oct 22, 2026 · 8 days ago', txid: 'leo004dd44ee55ff66778899aabbccddeeff00112233445566778899aabb', conf: 900, block: 917300, balance: 88345, fee: 160 }),
        personaTx({ type: 'receive', label: '', tags: [], amount: 2419, fiat: '2.42', ago: 'Oct 27, 2026 · 3 days ago', txid: 'leo005ee55ff66778899aabbccddeeff00112233445566778899aabbccdd', conf: 180, block: 918020, balance: 90764, fee: 90 }),
        personaTx({ type: 'send', label: 'Pizza', tags: ['food'], amount: 7291, fiat: '7.29', ago: 'Oct 29, 2026 · yesterday', txid: 'leo006ff66778899aabbccddeeff00112233445566778899aabbccddee', conf: 8, block: 918192, balance: 83473, fee: 180 })
      ]
    },
    nostr: {
      meName: 'leo',
      meExtra: { nip05: '', lud16: '', about: 'Learning self-custody. Dad helped with the seed.' },
      mnemonic: 'lemon paper river dad pizza bus pencil notebook window garden simple teach',
      contacts: [
        { name: 'Mina', about: 'Friend from school. Sent the Nostr invite.' }
      ],
      notes: [
        { me: true, id: 'n1', kind: 1, hours: 30, content: 'gm. figuring out this app. coins are on signet so it is ok if I mess up.' }
      ],
      zaps: [],
      files: [
        { name: 'avatar.png', ext: 'png', mime: 'image/png', category: 'image', size: 240112, days: 20 }
      ],
      calendar: [
        { title: 'Dad explains fees', days: 4, hours: 1, location: 'Kitchen table' }
      ],
      chats: [
        { contact: 0, lines: [
          { them: true, days: 2, text: 'Did you make the profile?' },
          { days: 1.5, text: 'Yeah. I only posted gm. Is that enough?' },
          { them: true, hours: 20, text: 'That is plenty. Do not post the seed words.' }
        ]}
      ],
      relays: ['wss://relay.damus.io', 'wss://relay.primal.net'],
      customRelays: [],
      sessions: [
        { name: 'Damus', relay: 'wss://relay.damus.io', status: 'connected', hours: 20 }
      ],
      cache: { ownNotes: 1, ownZaps: 0, feedNotes: 12, zapReceipts: 0, profiles: 2 },
      presets: [100, 500, 1000],
      oneTap: '100',
      autoApprove: false
    }
  }
]

function personaWhen(spec) {
  const base = typeof noNow === 'number' ? noNow : Date.UTC(2026, 9, 20, 15, 0)
  if (spec.at) return spec.at
  if (spec.atOffset) return base - spec.atOffset
  if (spec.days) return base - spec.days * 864e5
  if (spec.hours) return base - spec.hours * 36e5
  return base
}

function materializePersona(persona) {
  const spec = persona.nostr
  const me = {
    ...noPerson(spec.meName, spec.meExtra),
    nsec: noBech('nsec', spec.meName + persona.id),
    mnemonic: spec.mnemonic,
    picture: personaShot(persona).src,
    pictureAlt: personaShot(persona).alt
  }
  const contacts = spec.contacts.map((c) => noPerson(c.name, c))
  const notes = spec.notes.map((n) => ({
    id: n.id,
    author: n.me ? me : contacts[n.contact],
    kind: n.kind || 1,
    at: personaWhen(n),
    content: n.content,
    reply: Boolean(n.reply)
  }))
  const zaps = (spec.zaps || []).map((z) => ({
    id: z.id,
    from: z.fromMe ? me : contacts[z.from],
    to: z.incoming ? me : contacts[z.to],
    sats: z.sats,
    at: personaWhen(z),
    comment: z.comment || '',
    note: z.note,
    incoming: z.incoming
  }))
  const files = (spec.files || []).map((f) => ({
    ...f,
    at: noNow - (f.days || 1) * 864e5,
    sha256: demoTxid('blossom' + persona.id + f.name)
  }))
  const calendar = (spec.calendar || []).map((ev) => ({
    title: ev.title,
    start: noNow + (ev.days || 1) * 864e5,
    end: ev.hours ? noNow + (ev.days || 1) * 864e5 + ev.hours * 36e5 : undefined,
    location: ev.location
  }))
  const chats = {}
  const unread = {}
  ;(spec.chats || []).forEach((thread) => {
    const person = contacts[thread.contact]
    chats[person.npub] = thread.lines.map((line) => ({
      from: line.them ? person.npub : me.npub,
      text: line.text,
      at: personaWhen(line)
    }))
    if (thread.unread) unread[person.npub] = thread.unread
  })
  const sessions = (spec.sessions || []).map((s) => ({
    name: s.name,
    relay: s.relay,
    status: s.status,
    lastActive: personaWhen(s)
  }))
  return { me, contacts, notes, zaps, files, calendar, chats, unread, sessions }
}

function replaceList(list, next) {
  list.splice(0, list.length, ...next)
}

function personaLabels(persona) {
  const labels = []
  Object.values(persona.activity).forEach((txs) => {
    txs.forEach((tx) => {
      if (tx.label && !labels.includes(tx.label)) labels.push(tx.label)
    })
  })
  return labels
}

let activePersonaId = 'cold'

function applyPersona(id, options) {
  const persona = STUDIO_PERSONAS.find((p) => p.id === id) || STUDIO_PERSONAS[0]
  const opts = options || {}
  const built = materializePersona(persona)
  activePersonaId = persona.id

  replaceList(accounts, persona.accounts.map((a) => ({ ...a })))
  Object.keys(activity).forEach((key) => delete activity[key])
  Object.assign(activity, persona.activity)
  openAccountData = accounts[0]

  Object.keys(noMe).forEach((key) => delete noMe[key])
  Object.assign(noMe, built.me)
  replaceList(noContacts, built.contacts)
  replaceList(noNotes, built.notes)
  replaceList(noZaps, built.zaps)
  replaceList(noFiles, built.files)
  replaceList(noCalendar, built.calendar)

  const spec = persona.nostr
  noState.peer = built.contacts[0] ? built.contacts[0].npub : noMe.npub
  noState.contact = noState.peer
  noState.note = built.notes[0] ? built.notes[0].id : ''
  noState.zap = built.zaps[0] ? built.zaps[0].id : ''
  noState.file = built.files[0] ? built.files[0].sha256 : ''
  noState.chats = built.chats
  noState.unread = built.unread
  noState.profile = {
    displayName: noMe.name,
    picture: noMe.picture || '',
    banner: '',
    nip05: noMe.nip05,
    lud16: noMe.lud16
  }
  noState.relays = spec.relays.slice()
  noState.customRelays = spec.customRelays.slice()
  noState.sessions = built.sessions
  noState.cache = Object.assign({}, spec.cache)
  noState.presets = spec.presets.slice()
  noState.oneTap = spec.oneTap
  noState.autoApprove = spec.autoApprove
  noState.liked = {}
  noState.reposted = {}
  noState.bookmarked = {}

  if (!opts.silent) {
    try { localStorage.setItem('studio-persona', persona.id) } catch (err) { /* private mode */ }
  }
  const picker = document.getElementById('persona-picker')
  if (picker && picker.value !== persona.id) picker.value = persona.id

  if (!opts.quiet && typeof routeId === 'string') refreshPersonaView()
  return persona
}

function refreshPersonaView() {
  if (typeof kitCurrent !== 'undefined' && kitCurrent && typeof kitScreens !== 'undefined' && kitScreens[kitCurrent]) {
    openKitScreen(kitCurrent)
    return
  }
  if (routeId === 'accounts' && typeof renderAccounts === 'function') {
    renderAccounts()
    return
  }
  if ((routeId === 'account' || routeId === 'coins' || routeId === 'chart') && typeof renderAccount === 'function') {
    openAccountData = accounts[0]
    renderAccount()
    return
  }
  if (typeof go === 'function' && routeId) go(routeId)
}

function personaIdFromLocation() {
  const q = new URLSearchParams(location.search).get('persona')
  if (q && STUDIO_PERSONAS.some((p) => p.id === q)) return q
  try {
    const saved = localStorage.getItem('studio-persona')
    if (saved && STUDIO_PERSONAS.some((p) => p.id === saved)) return saved
  } catch (err) { /* ignore */ }
  return 'cold'
}

function mountPersonaPicker() {
  const picker = document.getElementById('persona-picker')
  if (!picker || picker.dataset.ready) return
  picker.dataset.ready = '1'
  picker.innerHTML = STUDIO_PERSONAS.map((p) => `<option value="${p.id}">${p.role}</option>`).join('')
  picker.value = activePersonaId
  picker.addEventListener('change', () => applyPersona(picker.value))
}

function renderPersonasPage() {
  const root = document.getElementById('personas-view')
  if (!root) return
  root.innerHTML = `
    <section class="dash-hero">
      <p class="dash-eyebrow">SatSigner Studio</p>
      <h1>Demo personas</h1>
      <p class="dash-lede">Three fixture sets for the prototype. Each one swaps wallets, labels, and the Nostr identity. Nothing here is a real key.</p>
    </section>
    <section class="dash-personas" aria-label="Demo personas">
      <div class="dash-persona-grid">
        ${STUDIO_PERSONAS.map((p) => {
          const built = materializePersona(p)
          const labels = personaLabels(p)
          const wallets = p.accounts.map((a) => {
            const kind = a.watchOnly ? 'Watch-only' : a.multisig ? 'Multisig' : 'Spending'
            return `<li><strong>${ss.esc(a.name)}</strong> <code>${a.fingerprint}</code> <span>${a.balance.toLocaleString('en-US')} sats · ${kind}</span></li>`
          }).join('')
          const shot = personaShot(p)
          const dots = p.images.map((img, i) => `<button type="button" class="dash-persona-dot${i === (p.shot || 0) ? ' is-on' : ''}" data-shot="${i}" aria-label="Portrait ${i + 1} of ${p.images.length}"></button>`).join('')
          return `<article class="dash-persona" data-persona="${p.id}">
            <div class="dash-persona-slider">
              <img src="${ss.esc(shot.src)}" alt="${ss.esc(shot.alt)}">
              <button type="button" class="dash-persona-nav is-prev" data-nudge="-1" aria-label="Previous portrait"></button>
              <button type="button" class="dash-persona-nav is-next" data-nudge="1" aria-label="Next portrait"></button>
              <div class="dash-persona-dots">${dots}</div>
            </div>
            <div class="dash-persona-id">
              <p class="dash-persona-role">${ss.esc(p.role)}</p>
              <h3>${ss.esc(p.name)}</h3>
            </div>
            <p class="dash-persona-personality">${ss.esc(p.personality)}</p>
            <p class="dash-persona-bio">${ss.esc(p.bio)}</p>
            <div class="dash-persona-block">
              <h4>Motivation</h4>
              <p>${ss.esc(p.motivation)}</p>
            </div>
            <div class="dash-persona-block">
              <h4>Attack vectors</h4>
              <ul class="dash-persona-points">${p.attacks.map((item) => `<li>${ss.esc(item)}</li>`).join('')}</ul>
            </div>
            <div class="dash-persona-block">
              <h4>Fears</h4>
              <ul class="dash-persona-points">${p.fears.map((item) => `<li>${ss.esc(item)}</li>`).join('')}</ul>
            </div>
            <div class="dash-persona-block">
              <h4>Wallets</h4>
              <ul class="dash-persona-wallets">${wallets}</ul>
            </div>
            <div class="dash-persona-block">
              <h4>Labels</h4>
              <p class="dash-persona-labels">${labels.map((l) => `<span>${ss.esc(l)}</span>`).join('')}</p>
            </div>
            <div class="dash-persona-block">
              <h4>Nostr</h4>
              <p class="dash-persona-nostr"><img src="${ss.esc(shot.src)}" alt="${ss.esc(shot.alt)}"> <span><strong>${ss.esc(built.me.name)}</strong> ${ss.esc(built.me.nip05 || 'no nip-05')}<br>${ss.esc(built.me.about)}<br>${built.notes.length} notes · ${built.zaps.length} zaps · ${built.contacts.length} contacts</span></p>
            </div>
            <button type="button" data-load-persona="${p.id}">Load in prototype</button>
          </article>`
        }).join('')}
      </div>
    </section>`
  root.addEventListener('click', (e) => {
    const nudge = e.target.closest('[data-nudge], [data-shot]')
    if (nudge) {
      const card = nudge.closest('[data-persona]')
      const persona = STUDIO_PERSONAS.find((p) => p.id === card.dataset.persona)
      const count = persona.images.length
      const current = persona.shot || 0
      persona.shot = nudge.dataset.shot != null ? +nudge.dataset.shot : (current + +nudge.dataset.nudge + count) % count
      const shot = personaShot(persona)
      const frame = card.querySelector('.dash-persona-slider img')
      frame.src = shot.src
      frame.alt = shot.alt
      const thumb = card.querySelector('.dash-persona-nostr img')
      thumb.src = shot.src
      thumb.alt = shot.alt
      card.querySelectorAll('[data-shot]').forEach((dot) => dot.classList.toggle('is-on', +dot.dataset.shot === persona.shot))
      if (activePersonaId === persona.id) {
        noMe.picture = shot.src
        noMe.pictureAlt = shot.alt
        if (typeof noState !== 'undefined') noState.profile.picture = shot.src
      }
      return
    }
    const load = e.target.closest('[data-load-persona]')
    if (!load) return
    applyPersona(load.dataset.loadPersona)
    if (typeof setView === 'function') setView('prototype', true)
  })
}

mountPersonaPicker()
applyPersona(personaIdFromLocation())
renderPersonasPage()
