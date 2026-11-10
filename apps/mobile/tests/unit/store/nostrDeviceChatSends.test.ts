import { useNostrDeviceChatSendsStore } from '@/store/nostrDeviceChatSends'

const ACCOUNT_ID = 'account-1'
const MESSAGE_ID = 'f'.repeat(64)

function failedDevices() {
  return useNostrDeviceChatSendsStore.getState().failedDevicesByAccount[
    ACCOUNT_ID
  ]
}

describe('useNostrDeviceChatSendsStore', () => {
  beforeEach(() => {
    useNostrDeviceChatSendsStore.setState({ failedDevicesByAccount: {} })
  })

  it('remembers the devices a message did not reach', () => {
    useNostrDeviceChatSendsStore
      .getState()
      .setFailedDevices(ACCOUNT_ID, MESSAGE_ID, ['npub1device'])

    expect(failedDevices()).toStrictEqual({ [MESSAGE_ID]: ['npub1device'] })
  })

  it('forgets a message once a retry reached every device', () => {
    const { setFailedDevices } = useNostrDeviceChatSendsStore.getState()
    setFailedDevices(ACCOUNT_ID, MESSAGE_ID, ['npub1device'])

    setFailedDevices(ACCOUNT_ID, MESSAGE_ID, [])

    expect(failedDevices()).toStrictEqual({})
  })
})
