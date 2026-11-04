import { toast } from 'sonner-native'

import { ElectrumUnreachableError } from '@/api/electrumReachability'
import {
  createSyncFailureBatch,
  reportSyncFailure
} from '@/utils/syncFailureToasts'

const mockToastError = jest.mocked(toast.error)

describe('sync failure toasts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows one toast for a batch of accounts behind a dead server', () => {
    const batch = createSyncFailureBatch()
    for (const name of ['Fafe', 'Support', 'Admin B26']) {
      batch.report(name, new ElectrumUnreachableError('192.168.0.13:50001'))
    }
    expect(mockToastError).not.toHaveBeenCalled()

    batch.flush()

    expect(mockToastError).toHaveBeenCalledTimes(1)
    expect(mockToastError.mock.calls[0][0]).toContain('192.168.0.13:50001')
    expect(mockToastError.mock.calls[0][1]).toMatchObject({
      description: expect.stringContaining('3')
    })
  })

  it('empties the batch once flushed', () => {
    const batch = createSyncFailureBatch()
    batch.report('Fafe', new Error('timeout'))
    batch.flush()
    batch.flush()

    expect(mockToastError).toHaveBeenCalledTimes(1)
  })

  it('shows a single account failure right away', () => {
    reportSyncFailure('Fafe', new Error('timeout'))

    expect(mockToastError).toHaveBeenCalledTimes(1)
    expect(mockToastError.mock.calls[0][0]).toContain('Fafe')
  })
})
