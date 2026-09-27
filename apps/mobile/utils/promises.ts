type PromiseName = string

type PromiseStatus = 'idle' | 'pending' | 'success' | 'error'

type PromiseStatusObj = {
  name?: PromiseName
  status?: PromiseStatus
  error?: string
}

export type PromiseStatuses = Record<PromiseName, PromiseStatusObj>

export function initPromiseStatuses(promiseNames: string[]): PromiseStatuses {
  return Object.fromEntries(
    promiseNames.map((promiseName): [PromiseName, PromiseStatusObj] => [
      promiseName,
      { status: 'idle' }
    ])
  )
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
): PromiseStatuses {
  return {
    ...statuses,
    [name]: {
      ...(statuses[name] || {}),
      status: 'pending'
    }
  }
}

export function setPromiseSuccessful(
  statuses: PromiseStatuses,
  name: PromiseName
): PromiseStatuses {
  return {
    ...statuses,
    [name]: {
      ...(statuses[name] || {}),
      status: 'success'
    }
  }
}

export function setPromiseError(
  statuses: PromiseStatuses,
  name: PromiseName,
  error?: string
): PromiseStatuses {
  return {
    ...statuses,
    [name]: {
      ...(statuses[name] || {}),
      error: error || '',
      status: 'error'
    }
  }
}
