import { useQuery } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'

import { hasDuressPin } from '@/utils/pin'

function useDuressPinStatus() {
  const { data: isDuressPinSet = false, refetch } = useQuery({
    queryFn: hasDuressPin,
    queryKey: ['duress-pin-set']
  })

  // The PIN screens are pushed on top of the caller, so re-read the digest
  // when the caller is focused again.
  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch])
  )

  return isDuressPinSet
}

export { useDuressPinStatus }
