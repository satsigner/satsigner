export interface PageParams {
  [key: string]: string | number
}

export interface PageRoute {
  path: string
  params: PageParams
}
