export type PromiseName = string

export type PromiseStatus = 'idle' | 'pending' | 'success' | 'error'

export type PromiseStatusObj = {
  name?: PromiseName
  status?: PromiseStatus
  error?: string
}

export type PromiseStatuses = Record<PromiseName, PromiseStatusObj>

export function initPromiseStatuses(promiseNames: string[]) {
  return promiseNames.reduce((initialStatuses, promiseName) => {
    return {
      ...initialStatuses,
      [promiseName]: {
        status: 'idle'
      }
    }
  }, {}) as PromiseStatuses
}

export function setPromiseStatus(
  statuses: PromiseStatuses,
  name: PromiseName,
  newStatus: PromiseStatus
) {
  return {
    ...statuses,
    [name]: {
      ...(statuses[name] || {}),
      status: newStatus
    }
  }
}

export function setPromisePending(
  statuses: PromiseStatuses,
  name: PromiseName
) {
  return {
    ...statuses,
    [name]: {
      ...(statuses[name] || {}),
      status: 'pending'
    }
  } as PromiseStatuses
}

export function setPromiseSuccessful(
  statuses: PromiseStatuses,
  name: PromiseName
) {
  return {
    ...statuses,
    [name]: {
      ...(statuses[name] || {}),
      status: 'success'
    }
  } as PromiseStatuses
}

export function setPromiseError(
  statuses: PromiseStatuses,
  name: PromiseName,
  error?: string
) {
  return {
    ...statuses,
    [name]: {
      ...(statuses[name] || {}),
      status: 'error',
      error: error || ''
    }
  } as PromiseStatuses
}
