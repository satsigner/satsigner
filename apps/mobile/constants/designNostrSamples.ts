import {
  MS_PER_SECOND,
  SECONDS_PER_DAY as DAY,
  SECONDS_PER_HOUR as HOUR,
  SECONDS_PER_MINUTE as MINUTE
} from '@/constants/time'
import { type AuthorDisplayInfo } from '@/hooks/useNostrMessage'
import {
  type NostrChatConversationItem,
  type NostrDM,
  type NostrReactionRow,
  type NostrReactionSummaryEntry
} from '@/types/models/Nostr'
import { safeNpubEncode } from '@/utils/nostr'
import { type NostrMessagePreview } from '@/utils/nostrMessageDetail'

import { type DesignSampleSet } from './designSampleVariations'

const NOW = Math.floor(Date.now() / MS_PER_SECOND)

const ME_HEX =
  '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e'
const ALICE_HEX =
  'a1f3c5d7e9b2a4c6e8f0a1b3c5d7e9f1a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2'
const BOB_HEX =
  'b0b5ca11ab1e0ddba11c0ffee15600dfacade5eed5beefcafe0123456789abcd'
const STRANGER_HEX =
  'c0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ff'

export const DESIGN_NOSTR_ME_NPUB = safeNpubEncode(ME_HEX)

export const DESIGN_NOSTR_SAMPLE_NSEC =
  'nsec1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqstywftw'

const LONG_TEXT =
  'Here is the PSBT for the cold storage sweep. Please check the change output goes back to the vault descriptor and the fee rate is around 12 sat/vB before signing. If anything looks off, reply here and do not broadcast until we have two signatures.'

export const DESIGN_NOSTR_AUTHORS = new Map<string, AuthorDisplayInfo>([
  [
    ME_HEX,
    { color: '#ffffff', displayName: 'Satoshi', npubShort: 'npub1me…df4e' }
  ],
  [
    ALICE_HEX,
    {
      alias: 'laptop',
      color: '#7c4dff',
      displayName: 'Alice',
      npubShort: 'npub1al…c0d2'
    }
  ],
  [
    BOB_HEX,
    {
      alias: 'hardware wallet desk with a very long alias name',
      color: '#00bfa5',
      displayName: 'Bob the extremely verbose multisig cosigner',
      npubShort: 'npub1bo…abcd'
    }
  ],
  [STRANGER_HEX, { color: '#ff9100', npubShort: 'npub1co…ffff' }]
])

function dm(
  id: string,
  author: string,
  createdAt: number,
  description: string,
  extra: Partial<NostrDM> = {}
): NostrDM {
  return {
    author,
    content: { created_at: createdAt, description, pubkey: author },
    created_at: createdAt,
    description,
    event: '',
    id: id.padStart(64, '0'),
    label: 1,
    ...extra
  }
}

const STANDARD_CHAT: NostrDM[] = [
  dm('1', ALICE_HEX, NOW - DAY - 3 * HOUR, 'Morning! Did the new device sync?'),
  dm('2', ME_HEX, NOW - DAY - 3 * HOUR + MINUTE, 'Yes, labels are all there.'),
  dm('3', ME_HEX, NOW - DAY - 3 * HOUR + 2 * MINUTE, 'Checking UTXOs now.'),
  dm('4', ALICE_HEX, NOW - 2 * HOUR, 'Can you sign the sweep today?'),
  dm('5', ME_HEX, NOW - 2 * HOUR + MINUTE, 'On it.', {
    replyToId: '4'.padStart(64, '0')
  }),
  dm('6', ALICE_HEX, NOW - 10 * MINUTE, 'Thanks 🙏'),
  dm('7', STRANGER_HEX, NOW - 8 * MINUTE, 'I only have an npub, no profile.')
]

const MINIMAL_CHAT: NostrDM[] = [dm('1', ME_HEX, NOW - MINUTE, 'hi')]

const HEAVY_CHAT: NostrDM[] = [
  dm('1', BOB_HEX, NOW - 3 * DAY, LONG_TEXT),
  dm('2', STRANGER_HEX, NOW - 3 * DAY + HOUR, 'gm'),
  dm('3', ME_HEX, NOW - DAY, 'Replying to a message that is not loaded', {
    replyToId: 'f'.repeat(64)
  }),
  dm('4', ME_HEX, NOW - 5 * MINUTE, LONG_TEXT, {
    replyToId: '1'.padStart(64, '0')
  }),
  dm('5', ME_HEX, NOW - 4 * MINUTE, 'Still sending…', { pending: true }),
  dm('6', ME_HEX, NOW - 3 * MINUTE, 'This one failed to reach a device'),
  dm(
    '7',
    BOB_HEX,
    NOW - MINUTE,
    'https://example.com/a/really/long/url/without/spaces/that/should/wrap/inside/the/card/body/and/not/overflow'
  )
]

export type DesignNostrChatSample = {
  failedIds: string[]
  messages: NostrDM[]
}

export const DESIGN_NOSTR_CHAT_SETS: DesignSampleSet<DesignNostrChatSample>[] =
  [
    { data: { failedIds: [], messages: STANDARD_CHAT }, name: 'standard' },
    { data: { failedIds: [], messages: MINIMAL_CHAT }, name: 'minimal' },
    {
      data: { failedIds: ['6'.padStart(64, '0')], messages: HEAVY_CHAT },
      name: 'heavy'
    }
  ]

function conversation(
  peerHex: string,
  preview: string,
  ageSec: number,
  unreadCount: number
): NostrChatConversationItem {
  return {
    lastMessageAt: NOW - ageSec,
    lastMessagePreview: preview,
    peerNpub: safeNpubEncode(peerHex),
    peerPubkey: peerHex,
    unreadCount
  }
}

export const DESIGN_NOSTR_FOLLOWING_CONVERSATIONS = [
  conversation(ALICE_HEX, 'Thanks 🙏', 10 * MINUTE, 2),
  conversation(BOB_HEX, LONG_TEXT, DAY, 0)
]

export const DESIGN_NOSTR_OTHER_CONVERSATIONS = [
  conversation(STRANGER_HEX, 'Claim your free sats now!!!', HOUR, 14)
]

function preview(
  id: string,
  authorLabel: string,
  text: string,
  ageSec: number
): NostrMessagePreview {
  return {
    authorLabel,
    date: new Date((NOW - ageSec) * 1000).toLocaleString(),
    id: id.padStart(64, '0'),
    text
  }
}

export type DesignNostrMessageDetailSample = {
  canDeleteForEveryone: boolean
  canReply: boolean
  message: NostrMessagePreview
  parent: NostrMessagePreview | null
  replies: NostrMessagePreview[]
  tags: string | null
}

export const DESIGN_NOSTR_MESSAGE_DETAIL_SETS: DesignSampleSet<DesignNostrMessageDetailSample>[] =
  [
    {
      data: {
        canDeleteForEveryone: true,
        canReply: true,
        message: preview('5', 'Satoshi (You)', 'On it.', 2 * HOUR),
        parent: preview(
          '4',
          'Alice',
          'Can you sign the sweep today?',
          2 * HOUR
        ),
        replies: [preview('6', 'Alice', 'Thanks 🙏', 10 * MINUTE)],
        tags: JSON.stringify(
          [
            ['p', ALICE_HEX],
            ['p', ME_HEX],
            ['e', '4'.padStart(64, '0'), '', 'reply']
          ],
          null,
          2
        )
      },
      name: 'standard'
    },
    {
      data: {
        canDeleteForEveryone: false,
        canReply: false,
        message: preview('9', 'npub1co…ffff', 'gm', MINUTE),
        parent: null,
        replies: [],
        tags: null
      },
      name: 'minimal'
    },
    {
      data: {
        canDeleteForEveryone: true,
        canReply: true,
        message: preview(
          '1',
          'Bob the extremely verbose multisig cosigner',
          LONG_TEXT,
          3 * DAY
        ),
        parent: null,
        replies: Array.from({ length: 8 }, (_, index) =>
          preview(
            `${index + 10}`,
            index % 2 ? 'Alice' : 'Satoshi (You)',
            `Reply number ${index + 1}`,
            DAY - index * HOUR
          )
        ),
        tags: null
      },
      name: 'heavy'
    }
  ]

function reactionRow(
  id: string,
  authorHex: string,
  authorLabel: string,
  ageSec: number,
  reaction: NostrReactionRow['reaction']
): NostrReactionRow {
  return {
    authorLabel,
    authorNpub: safeNpubEncode(authorHex),
    authorPubkey: authorHex,
    createdAt: NOW - ageSec,
    id,
    reaction
  }
}

const LIKE = { key: '+', type: 'like' } as const
const FIRE = { content: '🔥', key: '🔥', type: 'emoji' } as const
const DISLIKE = { key: '-', type: 'dislike' } as const
const CUSTOM = {
  key: ':sats:',
  shortcode: 'sats',
  type: 'customEmoji',
  url: 'https://satsigner.com/favicon.png'
} as const

export type DesignNostrReactionsSample = {
  rows: NostrReactionRow[]
  summary: NostrReactionSummaryEntry[]
}

const HEAVY_REACTIONS = Array.from({ length: 24 }, (_, index) =>
  reactionRow(
    `r${index}`,
    [ALICE_HEX, BOB_HEX, STRANGER_HEX, ME_HEX][index % 4],
    [
      'Alice',
      'Bob the extremely verbose multisig cosigner',
      'npub1co…ffff',
      'Satoshi'
    ][index % 4],
    index * HOUR,
    [LIKE, FIRE, DISLIKE, CUSTOM][index % 4]
  )
)

export const DESIGN_NOSTR_REACTION_SETS: DesignSampleSet<DesignNostrReactionsSample>[] =
  [
    {
      data: {
        rows: [
          reactionRow('a', ALICE_HEX, 'Alice', 5 * MINUTE, LIKE),
          reactionRow('b', BOB_HEX, 'Bob', HOUR, FIRE),
          reactionRow('c', STRANGER_HEX, 'npub1co…ffff', DAY, LIKE)
        ],
        summary: [
          { count: 2, reaction: LIKE },
          { count: 1, reaction: FIRE }
        ]
      },
      name: 'standard'
    },
    { data: { rows: [], summary: [] }, name: 'minimal' },
    {
      data: {
        rows: HEAVY_REACTIONS,
        summary: [
          { count: 6, reaction: LIKE },
          { count: 6, reaction: FIRE },
          { count: 6, reaction: CUSTOM },
          { count: 6, reaction: DISLIKE }
        ]
      },
      name: 'heavy'
    }
  ]
