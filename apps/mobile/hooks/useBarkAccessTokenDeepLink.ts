import * as Linking from 'expo-linking'

import { useArkServerAccessToken } from '@/hooks/useArkServerAccessToken'
import { useMountEffect } from '@/hooks/useMountEffect'
import type { Network } from '@/types/settings/blockchain'

const BARK_ACCESS_TOKEN_PARAM = 'bark_access_token'
const BARK_ACCESS_TOKEN_NETWORK: Network = 'bitcoin'

function useBarkAccessTokenDeepLink() {
  const { applyAccessToken } = useArkServerAccessToken()

  useMountEffect(() => {
    function handle(url: string | null) {
      if (!url) {
        return
      }
      const { queryParams } = Linking.parse(url)
      const token = queryParams?.[BARK_ACCESS_TOKEN_PARAM]
      if (typeof token !== 'string') {
        return
      }
      applyAccessToken(BARK_ACCESS_TOKEN_NETWORK, token)
    }

    async function handleInitialUrl() {
      const url = await Linking.getInitialURL()
      handle(url)
    }

    handleInitialUrl()
    const sub = Linking.addEventListener('url', ({ url }) => handle(url))
    return () => sub.remove()
  })
}

export { useBarkAccessTokenDeepLink }
