import { Psbt } from 'react-native-bdk-sdk'

import { mmkvStorage } from '@/storage/mmkv'
import {
  hasUnfinishedDraft,
  useTransactionBuilderStore
} from '@/store/transactionBuilder'
import { type FeeReplacementDraft } from '@/types/models/FeeReplacement'

const ACCOUNT_ID = 'acc-draft-1'
const PAYJOIN_URI = 'bitcoin:tb1qtest?pj=https://pj.example'
const PERSIST_KEY = 'satsigner-transaction-builder'
const REPLACED_TXID = 'cc'.repeat(32)
const FEE_REPLACEMENT_DRAFT: FeeReplacementDraft = {
  fee: 500,
  feeRate: 4,
  inputs: [
    {
      keychain: 'internal',
      txid: 'aa'.repeat(32),
      value: 90_500,
      vout: 1
    }
  ],
  outputs: [{ amount: 90_000, label: '', to: 'tb1qtest' }]
}

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

  it('clears signed draft fields when the RBF flag changes', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({ amount: 10_000, to: 'tb1qtest' })
    store.setSignedTx('deadbeef', 'cHNidP8=')

    store.setRbf(false)

    expect(useTransactionBuilderStore.getState().signedTx).toBeUndefined()
    expect(
      useTransactionBuilderStore.getState().drafts[ACCOUNT_ID]?.signedTx
    ).toBeUndefined()
  })

  it('forgets the account draft once the transaction is broadcast', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({ amount: 10_000, to: 'tb1qtest' })
    store.setSignedTx('deadbeef', 'cHNidP8=')

    store.setBroadcasted(true)

    const state = useTransactionBuilderStore.getState()
    expect(state.broadcasted).toBe(true)
    expect(state.drafts[ACCOUNT_ID]).toBeUndefined()
    expect(state.signedTx).toBe('deadbeef')
  })

  it('does not save a broadcast transaction again on an account switch', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({ amount: 10_000, to: 'tb1qtest' })
    store.setSignedTx('deadbeef', 'cHNidP8=')
    store.setBroadcasted(true)

    store.setAccountId('other-account')

    expect(
      useTransactionBuilderStore.getState().drafts[ACCOUNT_ID]
    ).toBeUndefined()
  })

  it('does not carry a payjoin URI into another account', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.setPayjoinUri('bitcoin:tb1qtest?pj=https://pj.example')

    store.setAccountId('other-account')

    expect(useTransactionBuilderStore.getState().payjoinUri).toBeUndefined()
  })
})

describe('transactionBuilder discardDraft', () => {
  const OTHER_ACCOUNT_ID = 'acc-draft-2'

  beforeEach(() => {
    useTransactionBuilderStore.getState().clearTransaction()
    useTransactionBuilderStore.setState({ drafts: {} })
  })

  it('discards the draft of an account the builder is not on', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({ amount: 10_000, label: '', to: 'tb1qtest' })
    store.setAccountId(OTHER_ACCOUNT_ID)
    store.addOutput({ amount: 20_000, label: '', to: 'tb1qother' })

    store.discardDraft(ACCOUNT_ID)

    const state = useTransactionBuilderStore.getState()
    expect(state.drafts[ACCOUNT_ID]).toBeUndefined()
    expect(state.drafts[OTHER_ACCOUNT_ID]?.outputs).toHaveLength(1)
    expect(state.accountId).toBe(OTHER_ACCOUNT_ID)
    expect(state.outputs).toHaveLength(1)
  })

  it('clears the builder when it discards the open draft', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({ amount: 10_000, label: '', to: 'tb1qtest' })

    store.discardDraft(ACCOUNT_ID)

    const state = useTransactionBuilderStore.getState()
    expect(state.drafts[ACCOUNT_ID]).toBeUndefined()
    expect(state.accountId).toBeUndefined()
    expect(state.outputs).toHaveLength(0)
  })
})

describe('transactionBuilder draft after an app restart', () => {
  // A fresh module registry stands in for a cold start: the store is created
  // again and hydrates from what the previous run left in storage.
  function restartStore(): typeof useTransactionBuilderStore {
    const persisted = mmkvStorage.getItem(PERSIST_KEY)
    let restarted = useTransactionBuilderStore
    jest.isolateModules(() => {
      const storage: typeof import('@/storage/mmkv') = require('@/storage/mmkv')
      storage.mmkvStorage.setItem(PERSIST_KEY, persisted)
      const builder: typeof import('@/store/transactionBuilder') = require('@/store/transactionBuilder')
      restarted = builder.useTransactionBuilderStore
    })
    return restarted
  }

  function replaceWithPrebuiltPsbt() {
    const psbt = new Psbt('')
    jest.mocked(psbt.toBase64).mockReturnValue('cHNidP8=')
    useTransactionBuilderStore
      .getState()
      .replaceDraft(ACCOUNT_ID, FEE_REPLACEMENT_DRAFT, {
        psbt,
        replacesTxid: REPLACED_TXID
      })
  }

  beforeEach(() => {
    useTransactionBuilderStore.getState().clearTransaction()
    useTransactionBuilderStore.setState({ drafts: {} })
  })

  it('restores the unsent draft into the builder', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({ amount: 10_000, label: 'Rent', to: 'tb1qtest' })

    const state = restartStore().getState()

    expect(state.accountId).toBe(ACCOUNT_ID)
    expect(state.outputs).toHaveLength(1)
    expect(state.outputs[0]?.label).toBe('Rent')
  })

  it('keeps the draft when the builder is edited after the restart', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({ amount: 10_000, label: 'Rent', to: 'tb1qtest' })

    const restarted = restartStore()
    restarted.getState().setFeeRate(3)

    expect(restarted.getState().drafts[ACCOUNT_ID]?.outputs).toHaveLength(1)
  })

  it('restores a signed draft so it can still be broadcast', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({ amount: 10_000, label: '', to: 'tb1qtest' })
    store.setSignedTx('deadbeef', 'cHNidP8=')

    const state = restartStore().getState()

    expect(state.signedTx).toBe('deadbeef')
    expect(state.signedPsbtBase64).toBe('cHNidP8=')
  })

  it('restores the payjoin URI of an unsent payjoin draft', () => {
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(ACCOUNT_ID)
    store.addOutput({ amount: 10_000, label: '', to: 'tb1qtest' })
    store.setPayjoinUri(PAYJOIN_URI)

    expect(restartStore().getState().payjoinUri).toBe(PAYJOIN_URI)
  })

  it('restores the prebuilt psbt of an unsigned fee replacement', () => {
    replaceWithPrebuiltPsbt()

    const state = restartStore().getState()

    expect(state.isPsbtPrebuilt).toBe(true)
    expect(state.psbt).toBeDefined()
  })

  it('forgets the prebuilt psbt once the builder rebuilds it', () => {
    replaceWithPrebuiltPsbt()
    useTransactionBuilderStore.getState().clearPsbt()

    expect(
      useTransactionBuilderStore.getState().drafts[ACCOUNT_ID]
        ?.prebuiltPsbtBase64
    ).toBeUndefined()
  })

  it('does not save a prebuilt psbt that no longer matches an edited builder', () => {
    replaceWithPrebuiltPsbt()
    useTransactionBuilderStore.getState().setFeeRate(8)

    const live = useTransactionBuilderStore.getState()
    expect(live.isPsbtPrebuilt).toBe(true)
    expect(live.drafts[ACCOUNT_ID]?.prebuiltPsbtBase64).toBeUndefined()

    const restored = restartStore().getState()
    expect(restored.isPsbtPrebuilt).toBe(false)
    expect(restored.psbt).toBeUndefined()
    expect(restored.feeRate).toBe(8)
    expect(restored.replacesTxid).toBe(REPLACED_TXID)
  })

  it('saves the prebuilt psbt again once an edit is undone', () => {
    replaceWithPrebuiltPsbt()
    const store = useTransactionBuilderStore.getState()
    store.setFeeRate(8)
    store.setFeeRate(4)

    expect(
      useTransactionBuilderStore.getState().drafts[ACCOUNT_ID]
        ?.prebuiltPsbtBase64
    ).toBe('cHNidP8=')
  })
})

describe('transactionBuilder fee replacement drafts', () => {
  beforeEach(() => {
    useTransactionBuilderStore.getState().clearTransaction()
    useTransactionBuilderStore.setState({ drafts: {} })
  })

  it('keeps a prebuilt psbt so the preview does not rebuild it', () => {
    const psbt = new Psbt('')
    useTransactionBuilderStore
      .getState()
      .replaceDraft(ACCOUNT_ID, FEE_REPLACEMENT_DRAFT, {
        psbt,
        replacesTxid: REPLACED_TXID
      })

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
    useTransactionBuilderStore
      .getState()
      .replaceDraft(ACCOUNT_ID, FEE_REPLACEMENT_DRAFT, {
        psbt: new Psbt(''),
        replacesTxid: REPLACED_TXID
      })
    useTransactionBuilderStore.getState().clearPsbt()

    const state = useTransactionBuilderStore.getState()
    expect(state.psbt).toBeUndefined()
    expect(state.isPsbtPrebuilt).toBe(false)
  })

  it('builds normally when no psbt is given', () => {
    useTransactionBuilderStore
      .getState()
      .replaceDraft(ACCOUNT_ID, FEE_REPLACEMENT_DRAFT)

    const state = useTransactionBuilderStore.getState()
    expect(state.psbt).toBeUndefined()
    expect(state.isPsbtPrebuilt).toBe(false)
    expect(state.replacesTxid).toBeUndefined()
  })

  it('discards a replacement draft when one of its inputs is removed', () => {
    useTransactionBuilderStore
      .getState()
      .replaceDraft(ACCOUNT_ID, FEE_REPLACEMENT_DRAFT, {
        psbt: new Psbt(''),
        replacesTxid: REPLACED_TXID
      })
    useTransactionBuilderStore
      .getState()
      .removeInput(FEE_REPLACEMENT_DRAFT.inputs[0])

    const state = useTransactionBuilderStore.getState()
    expect(state.inputs.size).toBe(0)
    expect(state.outputs).toHaveLength(0)
    expect(state.replacesTxid).toBeUndefined()
    expect(state.drafts[ACCOUNT_ID]).toBeUndefined()
  })

  it('discards a replacement draft when its spent inputs are removed', () => {
    useTransactionBuilderStore
      .getState()
      .replaceDraft(ACCOUNT_ID, FEE_REPLACEMENT_DRAFT, {
        psbt: new Psbt(''),
        replacesTxid: REPLACED_TXID
      })
    useTransactionBuilderStore.getState().removeOrphanedInputs([])

    const state = useTransactionBuilderStore.getState()
    expect(state.outputs).toHaveLength(0)
    expect(state.drafts[ACCOUNT_ID]).toBeUndefined()
  })

  it('keeps a replacement draft when an unrelated input is removed', () => {
    useTransactionBuilderStore
      .getState()
      .replaceDraft(ACCOUNT_ID, FEE_REPLACEMENT_DRAFT, {
        psbt: new Psbt(''),
        replacesTxid: REPLACED_TXID
      })
    useTransactionBuilderStore
      .getState()
      .removeInput({ ...FEE_REPLACEMENT_DRAFT.inputs[0], vout: 7 })

    expect(useTransactionBuilderStore.getState().outputs).toHaveLength(1)
  })

  it('keeps editing a normal draft input by input', () => {
    useTransactionBuilderStore
      .getState()
      .replaceDraft(ACCOUNT_ID, FEE_REPLACEMENT_DRAFT)
    useTransactionBuilderStore
      .getState()
      .removeInput(FEE_REPLACEMENT_DRAFT.inputs[0])

    const state = useTransactionBuilderStore.getState()
    expect(state.inputs.size).toBe(0)
    expect(state.outputs).toHaveLength(1)
  })

  it('restores the replaced txid with the account draft', () => {
    useTransactionBuilderStore
      .getState()
      .replaceDraft(ACCOUNT_ID, FEE_REPLACEMENT_DRAFT, {
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

describe('transactionBuilder cold start', () => {
  const SIGNED_TX = 'deadbeef'
  const INPUT = {
    keychain: 'external',
    script: [],
    txid: 'a'.repeat(64),
    value: 5000,
    vout: 0
  }

  it('reopens the signed draft of the account the app was on', () => {
    jest.isolateModules(() => {
      const mmkv: typeof import('react-native-mmkv') = require('react-native-mmkv')
      mmkv.createMMKV({ id: 'mmkv.satsigner' }).set(
        PERSIST_KEY,
        JSON.stringify({
          state: {
            accountId: ACCOUNT_ID,
            drafts: {
              [ACCOUNT_ID]: {
                cpfp: true,
                fee: 141,
                feeRate: 1,
                inputs: { [`${INPUT.txid}:0`]: INPUT },
                outputs: [],
                rbf: true,
                signedTx: SIGNED_TX,
                timeLock: 0
              }
            }
          },
          version: 0
        })
      )

      // The store hydrates while its module is first evaluated, as on launch.
      const builder: typeof import('@/store/transactionBuilder') = require('@/store/transactionBuilder')
      const state = builder.useTransactionBuilderStore.getState()

      expect(state.accountId).toBe(ACCOUNT_ID)
      expect(state.signedTx).toBe(SIGNED_TX)
      expect(state.fee).toBe(141)
      expect([...state.inputs.keys()]).toStrictEqual([`${INPUT.txid}:0`])
    })
  })
})
