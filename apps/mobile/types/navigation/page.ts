export type PageParams = {
  [key: string]: string | number
}

export type PageRoute = {
  path: string
  params: PageParams
}
