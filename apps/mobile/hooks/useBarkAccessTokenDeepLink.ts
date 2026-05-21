import * as Linking from 'expo-linking'

import {
  BARK_ACCESS_TOKEN_NETWORK,
  BARK_ACCESS_TOKEN_PARAM
} from '@/constants/ark'
import { useArkServerAccessToken } from '@/hooks/useArkServerAccessToken'
import { useMountEffect } from '@/hooks/useMountEffect'

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
