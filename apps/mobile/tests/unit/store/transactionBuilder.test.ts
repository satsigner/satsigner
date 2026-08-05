import { useTransactionBuilderStore } from '@/store/transactionBuilder'

const ACCOUNT_ID = 'acc-draft-1'

describe('transactionBuilder signed draft persistence', () => {
  beforeEach(() => {
    useTransactionBuilderStore.getState().clearTransaction()
    useTransactionBuilderStore.setState({ drafts: {} })
  })

  it('persists signedTx into the account draft on setSignedTx', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({
      amount: 10_000,
      to: 'tb1qtest'
    })
    store.setSignedTx('deadbeef', 'cHNidP8=')

    const draft = useTransactionBuilderStore.getState().drafts[ACCOUNT_ID]
    expect(draft?.signedTx).toBe('deadbeef')
    expect(draft?.signedPsbtBase64).toBe('cHNidP8=')
    expect(useTransactionBuilderStore.getState().signedTx).toBe('deadbeef')
  })

  it('restores signedTx when switching back to the account', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({
      amount: 10_000,
      to: 'tb1qtest'
    })
    store.setSignedTx('aabbccdd', 'cHNidP8=')

    store.setAccountId('other-account')
    expect(useTransactionBuilderStore.getState().signedTx).toBeUndefined()

    store.setAccountId(ACCOUNT_ID)
    expect(useTransactionBuilderStore.getState().signedTx).toBe('aabbccdd')
    expect(useTransactionBuilderStore.getState().signedPsbtBase64).toBe(
      'cHNidP8='
    )
  })

  it('clears signed draft fields when outputs change', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({
      amount: 10_000,
      to: 'tb1qtest'
    })
    store.setSignedTx('deadbeef', 'cHNidP8=')

    const localId =
      useTransactionBuilderStore.getState().outputs[0]?.localId ?? ''
    store.updateOutput(localId, {
      amount: 11_000,
      to: 'tb1qtest'
    })

    expect(useTransactionBuilderStore.getState().signedTx).toBeUndefined()
    expect(
      useTransactionBuilderStore.getState().drafts[ACCOUNT_ID]?.signedTx
    ).toBeUndefined()
  })
})
