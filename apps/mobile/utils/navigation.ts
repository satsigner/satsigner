const noNavScreens: string[] = ['settings']

export function showNavigation(path: string = '/', depth: number = 0): boolean {
  if (depth > 4) {
    return false
  }

  const screen = path.replace(/^\/+/, '').split('/')[0]
  if (noNavScreens.includes(screen)) {
    return false
  }

  return true
}
