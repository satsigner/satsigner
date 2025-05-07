import type { SankeyLinkMinimal, SankeyNodeMinimal } from 'd3-sankey'

import type { TxNode } from '@/hooks/useNodesAndLinks'

export interface Link extends SankeyLinkMinimal<object, object> {
  source: string
  target: string
  value: number
}

export interface Node extends SankeyNodeMinimal<object, object> {
  localId?: string
  id: string
  depth?: number
  depthH: number
  address?: string
  type: string
  ioData: TxNode['ioData']
  value?: number
  txId?: string
  nextTx?: string
}

export const BLOCK_WIDTH = 50
