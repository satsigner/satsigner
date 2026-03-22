export enum PLATFORM {
  ANDROID = 'android',
  IOS = 'ios',
  HYBRID = 'hybrid'
}

export interface NavMenuItem {
  title: string
  icon: React.ComponentType
  url: string
  isSoon: boolean
  platform: PLATFORM
}

export interface NavMenuGroup {
  title: string
  items: NavMenuItem[]
}
