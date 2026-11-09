import { useZapFlowStore } from '@/store/zapFlow'

const INVOICE = 'lnbc10n1zapinvoice'

function startZap() {
  useZapFlowStore.getState().setPendingZap({
    amountSats: 21,
    invoice: INVOICE,
    nostrUri: 'nevent1note',
    noteNpub: 'npub1author',
    paymentMethod: { id: 'lnd', label: 'Node', type: 'lightning' },
    zapRequestJson: '{}'
  })
}

describe('zap flow store', () => {
  beforeEach(() => {
    useZapFlowStore.setState({ pendingZap: null, zapResult: null })
  })

  it('settles the pending zap when its own invoice is paid', () => {
    startZap()

    const isZap = useZapFlowStore
      .getState()
      .reportZapOutcome(`lightning:${INVOICE.toUpperCase()}`, 'success')

    expect(isZap).toBe(true)
    expect(useZapFlowStore.getState().zapResult).toStrictEqual({
      invoice: INVOICE,
      outcome: 'success'
    })
  })

  it('ignores a later payment of another invoice after a zap was abandoned', () => {
    startZap()

    const isZap = useZapFlowStore
      .getState()
      .reportZapOutcome('lnbc99n1unrelated', 'success')

    expect(isZap).toBe(false)
    expect(useZapFlowStore.getState().zapResult).toBeNull()
  })

  it('ignores a payment when no zap is pending', () => {
    expect(
      useZapFlowStore.getState().reportZapOutcome(INVOICE, 'cancelled')
    ).toBe(false)
  })
})
