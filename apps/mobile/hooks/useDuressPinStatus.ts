import { useQuery } from '@tanstack/react-query'

import { hasDuressPin } from '@/utils/pin'

function useDuressPinStatus() {
  const { data: isDuressPinSet = false } = useQuery({
    queryFn: hasDuressPin,
    queryKey: ['duress-pin-set']
  })
  return isDuressPinSet
}

export { useDuressPinStatus }
