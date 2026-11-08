import { ARK_SUPPORTED_NETWORKS } from '@/constants/ark'
import { getArkNetworkTabIndex } from '@/utils/ark'

describe('getArkNetworkTabIndex', () => {
  it('opens on the selected network when Ark supports it', () => {
    expect(getArkNetworkTabIndex('signet')).toBe(
      ARK_SUPPORTED_NETWORKS.indexOf('signet')
    )
    expect(getArkNetworkTabIndex('bitcoin')).toBe(
      ARK_SUPPORTED_NETWORKS.indexOf('bitcoin')
    )
  })

  it('falls back to the first tab for networks Ark does not run on', () => {
    expect(getArkNetworkTabIndex('testnet')).toBe(0)
  })
})
