import { type SwapTree } from '@/types/models/Swap'

export const BOLTZ_CLEARNET_URL = 'https://api.boltz.exchange'
export const BOLTZ_ONION_URL =
  'http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion'

export type BoltzPairInfo = {
  hash: string
  rate: number
  limits: { maximalZeroConfAmount: number; minimal: number; maximal: number }
  fees: {
    percentage: number
    minerFees: { normal: number; reverse: { claim: number; lockup: number } }
  }
}

export type BoltzPairs = {
  BTC: { BTC: BoltzPairInfo }
}

export type CreateSubmarineSwapParams = {
  invoice: string
  from: 'BTC'
  to: 'BTC'
  refundPublicKey: string
}

export type SubmarineSwapResponse = {
  id: string
  address: string
  expectedAmount: number
  swapTree: SwapTree
  claimPublicKey: string
}

export type CreateReverseSwapParams = {
  invoiceAmount: number
  from: 'BTC'
  to: 'BTC'
  claimPublicKey: string
  preimageHash: string
}

export type ReverseSwapResponse = {
  id: string
  invoice: string
  lockupAddress: string
  onchainAmount: number
  swapTree: SwapTree
  refundPublicKey: string
  timeoutBlockHeight: number
}

export type SwapStatusResponse = {
  status: string
  transaction?: { id: string; hex: string }
}

export class BoltzApi {
  baseUrl = BOLTZ_CLEARNET_URL

  private get wsUrl(): string {
    return (
      this.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://') +
      '/v2/ws'
    )
  }

  async _call<T>(
    path: string,
    method: 'GET' | 'POST' = 'GET',
    body?: object
  ): Promise<T> {
    try {
      const response = await fetch(this.baseUrl + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      })
      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Boltz API ${response.status}: ${errText}`)
      }
      return response.json() as Promise<T>
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Boltz API error')
    }
  }

  async getSubmarinePairs(): Promise<BoltzPairs> {
    return this._call<BoltzPairs>('/v2/swap/submarine')
  }

  async createSubmarineSwap(
    params: CreateSubmarineSwapParams
  ): Promise<SubmarineSwapResponse> {
    return this._call<SubmarineSwapResponse>(
      '/v2/swap/submarine',
      'POST',
      params
    )
  }

  async getSubmarineSwap(id: string): Promise<SwapStatusResponse> {
    return this._call<SwapStatusResponse>(`/v2/swap/submarine/${id}`)
  }

  async getReversePairs(): Promise<BoltzPairs> {
    return this._call<BoltzPairs>('/v2/swap/reverse')
  }

  async createReverseSwap(
    params: CreateReverseSwapParams
  ): Promise<ReverseSwapResponse> {
    return this._call<ReverseSwapResponse>('/v2/swap/reverse', 'POST', params)
  }

  async getReverseSwap(id: string): Promise<SwapStatusResponse> {
    return this._call<SwapStatusResponse>(`/v2/swap/reverse/${id}`)
  }

  subscribeToSwap(id: string, onUpdate: (status: string) => void): () => void {
    const ws = new WebSocket(this.wsUrl)

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          op: 'subscribe',
          channel: 'swap.update',
          args: [id]
        })
      )
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as {
          channel?: string
          args?: { id: string; status: string }[]
        }
        if (data.channel === 'swap.update' && data.args?.[0]?.id === id) {
          onUpdate(data.args[0].status)
        }
      } catch {
        // ignore malformed messages
      }
    }

    return () => ws.close()
  }
}

export default new BoltzApi()
