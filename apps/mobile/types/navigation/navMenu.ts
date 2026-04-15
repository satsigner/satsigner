import { type Href } from 'expo-router'

export enum PLATFORM {
  ANDROID = 'android',
  IOS = 'ios',
  HYBRID = 'hybrid'
}

export type NavMenuItemIconProps = {
  focused?: boolean
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
