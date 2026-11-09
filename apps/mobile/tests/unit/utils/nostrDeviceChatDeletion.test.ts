import { type NostrDM } from '@/types/models/Nostr'
import { applyDeviceDeletionRumor } from '@/utils/nostrDeviceChat'

const mockRemoveAccountDms = jest.fn()
const mockTombstoneMessages = jest.fn()
const mockDeleteMessageWraps = jest.fn()

const AUTHOR = 'a'.repeat(64)
const INTRUDER = 'c'.repeat(64)
const MESSAGE_ID = '1'.repeat(64)
const LATE_ID = '2'.repeat(64)

const mockStoredMessage: NostrDM = {
  author: AUTHOR,
  content: { created_at: 1, description: 'hi' },
  created_at: 1,
  description: 'hi',
  event: '',
  id: MESSAGE_ID,
  label: 1
}

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: {
    getState: () => ({
      accounts: [{ id: 'account-1', nostr: { dms: [mockStoredMessage] } }],
      removeAccountDms: mockRemoveAccountDms
    })
  }
}))

jest.mock<typeof import('@/db/nostrMessageState')>(
  '@/db/nostrMessageState',
  () => ({
    deleteMessageWraps: (...args: unknown[]) => mockDeleteMessageWraps(...args),
    getMessageWraps: () => [],
    tombstoneMessages: (...args: unknown[]) => mockTombstoneMessages(...args)
  })
)

jest.mock<typeof import('@/hooks/useNostrPublish')>(
  '@/hooks/useNostrPublish',
  () => ({})
)
jest.mock<typeof import('@/api/nostr')>('@/api/nostr', () => ({}))
jest.mock<typeof import('@/api/nostrGiftWrap')>(
  '@/api/nostrGiftWrap',
  () => ({})
)

function deletionRumor(pubkey: string, targetIds: string[]) {
  return {
    content: '',
    id: 'd'.repeat(64),
    kind: 5,
    pubkey,
    tags: [...targetIds.map((id) => ['e', id]), ['k', '14']]
  }
}

describe('applyDeviceDeletionRumor', () => {
  beforeEach(() => {
    mockRemoveAccountDms.mockReset()
    mockTombstoneMessages.mockReset()
    mockDeleteMessageWraps.mockReset()
  })

  it('deletes a message when its author asks', () => {
    applyDeviceDeletionRumor('account-1', deletionRumor(AUTHOR, [MESSAGE_ID]))

    expect(mockRemoveAccountDms).toHaveBeenCalledWith('account-1', [MESSAGE_ID])
    expect(mockTombstoneMessages).toHaveBeenCalledWith(
      'account-1',
      [{ author: AUTHOR, messageId: MESSAGE_ID }],
      expect.any(Number)
    )
  })

  it('ignores a request from anyone but the author', () => {
    applyDeviceDeletionRumor('account-1', deletionRumor(INTRUDER, [MESSAGE_ID]))

    expect(mockRemoveAccountDms).not.toHaveBeenCalled()
    expect(mockTombstoneMessages).not.toHaveBeenCalled()
  })

  it('remembers a deletion that arrives before its message', () => {
    applyDeviceDeletionRumor('account-1', deletionRumor(INTRUDER, [LATE_ID]))

    expect(mockTombstoneMessages).toHaveBeenCalledWith(
      'account-1',
      [{ author: INTRUDER, messageId: LATE_ID }],
      expect.any(Number)
    )
  })
})
