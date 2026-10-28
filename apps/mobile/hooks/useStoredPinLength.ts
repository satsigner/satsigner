import { useQuery } from '@tanstack/react-query'

import { PIN_SIZE } from '@/config/auth'
import { getStoredPinLength } from '@/utils/pin'

async function fetchStoredPinLength() {
  return (await getStoredPinLength()) ?? PIN_SIZE
}

/** Undefined until the stored PIN length has loaded. */
function useStoredPinLength() {
  const { data } = useQuery({
    // The length changes with the PIN, so a cached value can be stale.
    gcTime: 0,
    queryFn: fetchStoredPinLength,
    queryKey: ['stored-pin-length']
  })
  return data
}

export { useStoredPinLength }
