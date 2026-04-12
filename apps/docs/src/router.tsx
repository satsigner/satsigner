import { createRouter as createTanStackRouter } from '@tanstack/react-router'

import { NotFound } from '@/components/not-found'

import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createTanStackRouter({
    basepath: import.meta.env.VITE_BASE_PATH ?? '/',
    defaultNotFoundComponent: NotFound,
    defaultPreload: 'intent',
    routeTree,
    scrollRestoration: true
  })
}
