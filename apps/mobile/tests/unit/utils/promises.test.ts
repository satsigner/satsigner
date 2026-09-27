import {
  initPromiseStatuses,
  setPromiseError,
  setPromisePending,
  setPromiseSuccessful
} from '@/utils/promises'

describe('promise statuses', () => {
  it('starts every named promise as idle', () => {
    expect(initPromiseStatuses(['sync', 'broadcast'])).toStrictEqual({
      broadcast: { status: 'idle' },
      sync: { status: 'idle' }
    })
  })

  it('tracks pending, success and error transitions per promise', () => {
    const statuses = initPromiseStatuses(['sync', 'broadcast'])

    expect(setPromisePending(statuses, 'sync')).toStrictEqual({
      broadcast: { status: 'idle' },
      sync: { status: 'pending' }
    })
    expect(setPromiseSuccessful(statuses, 'sync').sync).toStrictEqual({
      status: 'success'
    })
    expect(setPromiseError(statuses, 'sync', 'boom').sync).toStrictEqual({
      error: 'boom',
      status: 'error'
    })
  })
})
