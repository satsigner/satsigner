import { useQuery } from '@tanstack/react-query'

import { useLND } from '@/hooks/useLND'

function useLndChannelsQuery() {
  const { config, getChannels, isConnected } = useLND()

  return useQuery({
    enabled: Boolean(config) && isConnected,
    queryFn: () => getChannels(),
    queryKey: ['lnd', 'channels']
  })
}

export { useLndChannelsQuery }
