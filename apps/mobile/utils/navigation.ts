const noNavScreens = new Set(['settings'])

export function showNavigation(path: string = '/', depth: number = 0): boolean {
  if (depth > 4) {
    return false
  }

  const [screen] = path.replace(/^\/+/, '').split('/')
  if (noNavScreens.has(screen)) {
    return false
  }

  return true
}
