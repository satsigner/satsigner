import {
  isAlreadyHasProposalError,
  isMailboxExpiredError
} from '@/utils/payjoinErrors'

describe('isAlreadyHasProposalError', () => {
  it('matches extract and processResponse proposal-already-present errors', () => {
    expect(
      isAlreadyHasProposalError(
        'receiver already has a proposal; finalize instead of polling'
      )
    ).toBe(true)
    expect(
      isAlreadyHasProposalError('receiver already has unchecked proposal')
    ).toBe(true)
  })

  it('ignores unrelated poll errors', () => {
    expect(isAlreadyHasProposalError('original psbt missing')).toBe(false)
    expect(isAlreadyHasProposalError('iterator method is not callable')).toBe(
      false
    )
  })
})

describe('isMailboxExpiredError', () => {
  it('matches PDK CreateRequestError(Expired(Time(...)))', () => {
    expect(
      isMailboxExpiredError(
        'ReceiverCreateRequestError: ReceiverCreateRequestError(CreateRequestError(Expired(Time(Time(1789471451)))))'
      )
    ).toBe(true)
  })

  it('matches the older session-expired wording', () => {
    expect(isMailboxExpiredError('Session expired')).toBe(true)
    expect(isMailboxExpiredError('Protocol error: mailbox expired')).toBe(true)
  })

  it('ignores unrelated poll errors', () => {
    expect(isMailboxExpiredError('iterator method is not callable')).toBe(false)
    expect(isMailboxExpiredError('receiver session not found')).toBe(false)
  })
})
