import { Psbt } from 'react-native-bdk-sdk'

import {
  hasUnfinishedDraft,
  useTransactionBuilderStore
} from '@/store/transactionBuilder'

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

describe('transactionBuilder fee replacement drafts', () => {
  const REPLACED_TXID = 'cc'.repeat(32)
  const draft = {
    fee: 500,
    feeRate: 4,
    inputs: [
      {
        keychain: 'internal' as const,
        txid: 'aa'.repeat(32),
        value: 90_500,
        vout: 1
      }
    ],
    outputs: [{ amount: 90_000, label: '', to: 'tb1qtest' }]
  }

  beforeEach(() => {
    useTransactionBuilderStore.getState().clearTransaction()
    useTransactionBuilderStore.setState({ drafts: {} })
  })

  it('keeps a prebuilt psbt so the preview does not rebuild it', () => {
    const psbt = new Psbt('')
    useTransactionBuilderStore
      .getState()
      .replaceDraft(ACCOUNT_ID, draft, { psbt, replacesTxid: REPLACED_TXID })

    const state = useTransactionBuilderStore.getState()
    expect(state.psbt).toBe(psbt)
    expect(state.isPsbtPrebuilt).toBe(true)
    expect(state.fee).toBe(500)
    expect(state.inputs.size).toBe(1)
    expect(state.rbf).toBe(true)
    expect(state.replacesTxid).toBe(REPLACED_TXID)
    expect(state.drafts[ACCOUNT_ID]?.replacesTxid).toBe(REPLACED_TXID)
  })

  it('forgets the prebuilt psbt once it is cleared', () => {
    useTransactionBuilderStore.getState().replaceDraft(ACCOUNT_ID, draft, {
      psbt: new Psbt(''),
      replacesTxid: REPLACED_TXID
    })
    useTransactionBuilderStore.getState().clearPsbt()

    const state = useTransactionBuilderStore.getState()
    expect(state.psbt).toBeUndefined()
    expect(state.isPsbtPrebuilt).toBe(false)
  })

  it('builds normally when no psbt is given', () => {
    useTransactionBuilderStore.getState().replaceDraft(ACCOUNT_ID, draft)

    const state = useTransactionBuilderStore.getState()
    expect(state.psbt).toBeUndefined()
    expect(state.isPsbtPrebuilt).toBe(false)
    expect(state.replacesTxid).toBeUndefined()
  })

  it('discards a replacement draft when one of its inputs is removed', () => {
    useTransactionBuilderStore.getState().replaceDraft(ACCOUNT_ID, draft, {
      psbt: new Psbt(''),
      replacesTxid: REPLACED_TXID
    })
    useTransactionBuilderStore.getState().removeInput(draft.inputs[0])

    const state = useTransactionBuilderStore.getState()
    expect(state.inputs.size).toBe(0)
    expect(state.outputs).toHaveLength(0)
    expect(state.replacesTxid).toBeUndefined()
    expect(state.drafts[ACCOUNT_ID]).toBeUndefined()
  })

  it('discards a replacement draft when its spent inputs are removed', () => {
    useTransactionBuilderStore.getState().replaceDraft(ACCOUNT_ID, draft, {
      psbt: new Psbt(''),
      replacesTxid: REPLACED_TXID
    })
    useTransactionBuilderStore.getState().removeOrphanedInputs([])

    const state = useTransactionBuilderStore.getState()
    expect(state.outputs).toHaveLength(0)
    expect(state.drafts[ACCOUNT_ID]).toBeUndefined()
  })

  it('keeps a replacement draft when an unrelated input is removed', () => {
    useTransactionBuilderStore.getState().replaceDraft(ACCOUNT_ID, draft, {
      psbt: new Psbt(''),
      replacesTxid: REPLACED_TXID
    })
    useTransactionBuilderStore
      .getState()
      .removeInput({ ...draft.inputs[0], vout: 7 })

    expect(useTransactionBuilderStore.getState().outputs).toHaveLength(1)
  })

  it('keeps editing a normal draft input by input', () => {
    useTransactionBuilderStore.getState().replaceDraft(ACCOUNT_ID, draft)
    useTransactionBuilderStore.getState().removeInput(draft.inputs[0])

    const state = useTransactionBuilderStore.getState()
    expect(state.inputs.size).toBe(0)
    expect(state.outputs).toHaveLength(1)
  })

  it('restores the replaced txid with the account draft', () => {
    useTransactionBuilderStore.getState().replaceDraft(ACCOUNT_ID, draft, {
      psbt: new Psbt(''),
      replacesTxid: REPLACED_TXID
    })
    useTransactionBuilderStore.getState().setAccountId('other-account')
    expect(useTransactionBuilderStore.getState().replacesTxid).toBeUndefined()

    useTransactionBuilderStore.getState().setAccountId(ACCOUNT_ID)
    const state = useTransactionBuilderStore.getState()
    expect(state.replacesTxid).toBe(REPLACED_TXID)
    expect(state.isPsbtPrebuilt).toBe(false)
  })

  it('reports an unfinished draft for the account', () => {
    expect(
      hasUnfinishedDraft(useTransactionBuilderStore.getState(), ACCOUNT_ID)
    ).toBe(false)

    useTransactionBuilderStore.getState().setAccountId(ACCOUNT_ID)
    useTransactionBuilderStore
      .getState()
      .addOutput({ amount: 10_000, label: '', to: 'tb1qtest' })

    expect(
      hasUnfinishedDraft(useTransactionBuilderStore.getState(), ACCOUNT_ID)
    ).toBe(true)
    expect(
      hasUnfinishedDraft(useTransactionBuilderStore.getState(), 'other')
    ).toBe(false)
  })
})
