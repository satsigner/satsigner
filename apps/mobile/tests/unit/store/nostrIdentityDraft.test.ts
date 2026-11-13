import {
  selectDraftMnemonic,
  useNostrIdentityDraftStore
} from '@/store/nostrIdentityDraft'

const MNEMONIC = 'abandon ability able about above absent'

function draftMnemonicFor(draftId: string | undefined) {
  return selectDraftMnemonic(useNostrIdentityDraftStore.getState(), draftId)
}

describe('nostr identity draft', () => {
  beforeEach(() => {
    useNostrIdentityDraftStore.getState().clearDraft()
  })

  it('hands the seed to the profile screen opened with its draft id', () => {
    const draftId = useNostrIdentityDraftStore.getState().startDraft(MNEMONIC)

    expect(draftMnemonicFor(draftId)).toBe(MNEMONIC)
  })

  it('keeps the seed from a profile screen opened without the draft id', () => {
    useNostrIdentityDraftStore.getState().startDraft(MNEMONIC)

    expect(draftMnemonicFor(undefined)).toBeNull()
    expect(draftMnemonicFor('')).toBeNull()
    expect(draftMnemonicFor('guessed-id')).toBeNull()
  })

  it('retires the id of an earlier draft when a new one starts', () => {
    const { startDraft } = useNostrIdentityDraftStore.getState()
    const abandonedId = startDraft(MNEMONIC)
    const currentId = startDraft('zoo zoo zoo')

    expect(abandonedId).not.toBe(currentId)
    expect(draftMnemonicFor(abandonedId)).toBeNull()
    expect(draftMnemonicFor(currentId)).toBe('zoo zoo zoo')
  })

  it('forgets the seed and its id once cleared', () => {
    const draftId = useNostrIdentityDraftStore.getState().startDraft(MNEMONIC)

    useNostrIdentityDraftStore.getState().clearDraft()

    expect(draftMnemonicFor(draftId)).toBeNull()
    expect(useNostrIdentityDraftStore.getState().mnemonic).toBeNull()
  })
})
