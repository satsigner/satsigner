export type PageParams = Record<string, string | number>

export interface PageRoute {
  path: string
  params: PageParams
}
