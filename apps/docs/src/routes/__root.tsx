import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts
} from '@tanstack/react-router'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import * as React from 'react'

import appCss from '@/styles/app.css?url'

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    links: [
      { href: appCss, rel: 'stylesheet' },
      { href: '/favicon.png', rel: 'icon', type: 'image/png' }
    ],
    meta: [
      {
        charSet: 'utf-8'
      },
      {
        content: 'width=device-width, initial-scale=1',
        name: 'viewport'
      },
      {
        title: 'SatSigner Docs'
      }
    ]
  })
})

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  )
}
