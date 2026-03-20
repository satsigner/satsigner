import { useState } from 'react'

import {
  initPromiseStatuses,
  type PromiseStatuses,
  setPromiseError,
  setPromisePending
} from '@/utils/promises'

type runPromiseProps = {
  callback: () => Promise<void>
  onSuccess?: () => Promise<void>
  onError?: () => Promise<void>
  name: string
  errorMessage?: string
}

export function usePromiseStatuses(promiseNames: string[] = []) {
  const [statuses, setStatuses] = useState<PromiseStatuses>(
    initPromiseStatuses(promiseNames)
  )

  const runPromise = async ({
    callback,
    onSuccess,
    onError,
    name,
    errorMessage = ''
  }: runPromiseProps) => {
    setStatuses((statuses) => setPromisePending(statuses, name))
    try {
      await callback()
      setStatuses((value) => ({
        ...value,
        [name]: {
          ...(value[name] || {}),
          status: 'success'
        }
      }))
      if (onSuccess) await onSuccess()
    } catch (error: unknown) {
      const defaultErrorMsg = error instanceof Error ? error.message : ''
      const errorMsg = errorMessage || defaultErrorMsg
      setStatuses((value) => setPromiseError(value, name, errorMsg))
      if (onError) await onError()
    }
  }

  return [statuses, runPromise] as [
    PromiseStatuses,
    (args: runPromiseProps) => Promise<void>
  ]
}
