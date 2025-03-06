export enum PLATFORM {
  ANDROID = 'android',
  IOS = 'ios',
  HYBRID = 'hybrid'
}

export type NavMenuItem = {
  title: string
  icon: React.ComponentType
  url: string
  isSoon: boolean
  platform: PLATFORM
}

export type NavMenuGroup = {
  title: string
  items: NavMenuItem[]
}
