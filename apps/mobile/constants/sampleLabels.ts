// Fictional story used to label every transaction, UTXO and address of the
// sample segwit wallet for demos. Each bucket holds stories that fit amounts
// up to maxSats; stories cycle within a bucket in chronological order.
// Wording is deliberately uneven so it reads like a person typed it.
// "#word" is parsed as a tag, so only use "#" for tags.
type SampleStoryBucket = { maxSats: number; stories: string[] }

export const SAMPLE_RECEIVE_BUCKETS: SampleStoryBucket[] = [
  {
    maxSats: 5000,
    stories: [
      '☕ tip from a blog reader',
      'zap on nostr post ⚡ #nostr',
      'Faucet',
      'tip jar at the meetup #meetup'
    ]
  },
  {
    maxSats: 20_000,
    stories: [
      '🍕 pizza money from Sam #friends',
      'sold used book',
      'Board game night winnings 🎲',
      'paid back for the uber #friends'
    ]
  },
  {
    maxSats: 60_000,
    stories: [
      'freelance bug fix 🛠️ #work',
      'Birthday gift from mom 🎂',
      'sold bike lights',
      'logo design (half upfront) #work #invoice'
    ]
  },
  {
    maxSats: 150_000,
    stories: [
      'Sold old monitor 🖥️',
      'design invoice - paid late lol #work #invoice'
    ]
  },
  {
    maxSats: Number.POSITIVE_INFINITY,
    stories: ['🏦 withdrawal from exchange #kyc', 'Consulting gig, March #work']
  }
]

export const SAMPLE_SEND_BUCKETS: SampleStoryBucket[] = [
  {
    maxSats: 5000,
    stories: [
      'coffee ☕ #food',
      'Croissant 🥐 #food',
      'juice at the market',
      'parking'
    ]
  },
  {
    maxSats: 20_000,
    stories: [
      'lunch w/ friends 🍔 #food #friends',
      'Book order',
      'meetup ticket 🎟️ #meetup',
      'gift for Ana #gifts'
    ]
  },
  {
    maxSats: 60_000,
    stories: [
      'dinner split 🍽️ #food #friends',
      'Concert tickets!!',
      'VPS + domain renewal #bills',
      'new headphones 🎧'
    ]
  },
  {
    maxSats: 150_000,
    stories: ['🔐 hardware wallet #security', 'Rent share - april #bills']
  },
  {
    maxSats: Number.POSITIVE_INFINITY,
    stories: ['to cold storage 🧊 #savings', 'Sweep to cold wallet #savings']
  }
]

export const SAMPLE_SELF_TRANSFER_LABELS = [
  '🔁 consolidating coins',
  'test tx',
  'Testing the new wallet',
  'moving to fresh address',
  'consolidate small utxos (low fees today)',
  '🧪 Test transaction #testing',
  'RBF test #testing',
  'checking fees before the big send'
]

export const SAMPLE_DUST_LABELS = [
  '🧹 Dust - do not spend #dust',
  "random dust?? don't touch",
  'dust attack ⚠️ #dust',
  'Unknown sender, freeze'
]

export const SAMPLE_CHANGE_LABEL_PREFIX = '↩️ change from'
export const SAMPLE_RECEIVE_ADDRESS_PREFIX = '📥 Invoice address'
export const SAMPLE_CHANGE_ADDRESS_PREFIX = '↩️ Change address'
