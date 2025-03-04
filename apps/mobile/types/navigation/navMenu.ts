export type NavMenuItem = {
  title: string
  icon: React.ComponentType // Represents a React component (for the icon)
  url: string
  isSoon: boolean
}

export type NavMenuGroup = {
  title: string
  items: NavMenuItem[]
}
