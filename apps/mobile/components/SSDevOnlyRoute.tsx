import { Redirect } from 'expo-router'
import { type ReactNode } from 'react'

import { isDevConsoleAvailable } from '@/utils/devConsole'

const DEV_TOOLS_AVAILABLE = isDevConsoleAvailable()

type SSDevOnlyRouteProps = {
  children: ReactNode
}

function SSDevOnlyRoute({ children }: SSDevOnlyRouteProps) {
  if (!DEV_TOOLS_AVAILABLE) {
    return <Redirect href="/settings/developer" />
  }
  return children
}

export default SSDevOnlyRoute
