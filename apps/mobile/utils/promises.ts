export type PromiseName = string

export type PromiseStatus = 'unstarted' | 'pending' | 'success' | 'error'

export type PromiseStatusObj = {
  name?: PromiseName
  status?: PromiseStatus
  error?: string
}

export type PromiseStatuses = Record<PromiseName, PromiseStatusObj>

export function updatePromiseStatus(
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

export function markPromisePending(
  statuses: PromiseStatuses,
  name: PromiseName
) {
  return {
    ...statuses,
    [name]: {
      name,
      status: 'pending'
    }
  } as PromiseStatuses
}

export function markPromiseSuccessful(
  statuses: PromiseStatuses,
  name: PromiseName
) {
  return {
    ...statuses,
    [name]: {
      name,
      status: 'success'
    }
  } as PromiseStatuses
}

export function markPromiseError(
  statuses: PromiseStatuses,
  name: PromiseName,
  error?: string
) {
  return {
    ...statuses,
    [name]: {
      name,
      status: 'errir',
      error: error || ''
    }
  } as PromiseStatuses
}
