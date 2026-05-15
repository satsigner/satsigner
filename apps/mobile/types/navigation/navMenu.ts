import { type Href } from 'expo-router'

export enum PLATFORM {
  ANDROID = 'android',
  IOS = 'ios',
  HYBRID = 'hybrid'
}

/**
 * SSNavMenuItem renders `<item.icon focused={...} />`. Most icons ignore
 * `focused` because the row wrapper already applies focus chrome.
 */
export type NavMenuItemIconProps = {
  focused?: boolean
  height?: number
  width?: number
}

export type NavMenuItem = {
  title: string
  icon: React.ComponentType<NavMenuItemIconProps>
  url: Href | ''
  isSoon: boolean
  platform: PLATFORM
}

export type NavMenuGroup = {
  title: string
  items: NavMenuItem[]
}
