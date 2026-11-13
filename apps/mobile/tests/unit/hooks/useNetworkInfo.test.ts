import { storeNetworkInfo } from '@/hooks/useNetworkInfo'
import { useBlockchainStore } from '@/store/blockchain'

// @/api/electrum pulls in react-native-tcp-socket, whose native
// NativeEventEmitter setup can't run under Jest. Nothing here connects.
jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  closeElectrumClientQuietly: jest.fn(),
  default: {} as unknown as typeof import('@/api/electrum').default
}))

const TIP = 330_361
const FEE = 4.6

describe('storeNetworkInfo', () => {
  beforeEach(() => {
    useBlockchainStore.setState({
      lastKnownBlockHeight: 0,
      nextBlockFee: null,
      selectedNetwork: 'signet'
    })
  })

  it('keeps the tip and the rounded fee of the selected network', () => {
    storeNetworkInfo('signet', { blockHeight: TIP, fee: FEE })

    const { lastKnownBlockHeight, nextBlockFee } = useBlockchainStore.getState()
    expect(lastKnownBlockHeight).toBe(TIP)
    expect(nextBlockFee).toBe(Math.round(FEE))
  })

  it('keeps the last tip when the backends report none', () => {
    useBlockchainStore.setState({ lastKnownBlockHeight: TIP })

    storeNetworkInfo('signet', { blockHeight: null, fee: null })

    expect(useBlockchainStore.getState().lastKnownBlockHeight).toBe(TIP)
  })

  it('ignores a result for a network the user has left', () => {
    storeNetworkInfo('bitcoin', { blockHeight: 900_000, fee: FEE })

    const { lastKnownBlockHeight, nextBlockFee } = useBlockchainStore.getState()
    expect(lastKnownBlockHeight).toBe(0)
    expect(nextBlockFee).toBeNull()
  })
})
