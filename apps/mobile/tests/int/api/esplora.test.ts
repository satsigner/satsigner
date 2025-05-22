import Esplora from '@/api/esplora'

let esplora: Esplora

beforeAll(async () => {
  esplora = new Esplora('https://mempool.space/api')
})

describe('Esplora tests', () => {
  it('get tx status', async () => {
    const txid =
      '591e91f809d716912ca1d4a9295e70c3e78bab077683f79350f101da64588073'
    const resp = await esplora.getTxStatus(txid)
    expect(resp).toHaveProperty('confirmed')
    expect(resp).toHaveProperty('block_height')
  })

  it('get block txids', async () => {
    const blockHash =
      '0000000054487811fc4ff7a95be738aa5ad9320c394c482b27c0da28b227ad5d'
    const resp = await esplora.getBlockTxids(blockHash)
    expect(Array.isArray(resp)).toBe(true)
    expect(resp.length).toBeGreaterThan(0)
    expect(typeof resp[0]).toBe('string')
  })

  it('get tx hex', async () => {
    const txid =
      '591e91f809d716912ca1d4a9295e70c3e78bab077683f79350f101da64588073'
    const resp = await esplora.getTxHex(txid)
    expect(typeof resp).toBe('string')
    expect(resp.length).toBeGreaterThan(0)
  })

  it('get tx raw', async () => {
    const txid =
      '591e91f809d716912ca1d4a9295e70c3e78bab077683f79350f101da64588073'
    const resp: WithImplicitCoercion<ArrayBuffer> = await esplora.getTxRaw(txid)
    const rawHex = Buffer.from(resp).toString('hex')
    expect(rawHex).toBe(
      '0100000001be141eb442fbc446218b708f40caeb7507affe8acff58ed992eb5ddde43c6fa1010000004847304402201f27e51caeb9a0988a1e50799ff0af94a3902403c3ad4068b063e7b4d1b0a76702206713f69bd344058b0dee55a9798759092d0916dbbc3e592fee43060005ddc17401ffffffff0200e1f5050000000043410401518fa1d1e1e3e162852d68d9be1c0abad5e3d6297ec95f1f91b909dc1afe616d6876f92918451ca387c4387609ae1a895007096195a824baf9c38ea98c09c3ac007ddaac0000000043410411db93e1dcdb8a016b49840f8c53bc1eb68a382e97b1482ecad7b148a6909a5cb2e0eaddfb84ccf9744464f82e160bfa9b8b64f9d4c03f999b8643f656b412a3ac00000000'
    )
  })

  it('get tx outspends', async () => {
    const txid =
      '591e91f809d716912ca1d4a9295e70c3e78bab077683f79350f101da64588073'
    const resp = await esplora.getTxOutspends(txid)
    expect(Array.isArray(resp)).toBe(true)
    resp.forEach((outspend) => {
      expect(outspend).toHaveProperty('spent')
      expect(typeof outspend.spent).toBe('boolean')
    })
  })

  it('get address tx', async () => {
    const address = 'bc1qs308e0rcv8aycdq3jcdxxu60ws3a6a5rcnhfyv'
    const resp = await esplora.getAddressTxs(address)
    expect(Array.isArray(resp)).toBe(true)
    expect(resp.length).toBeGreaterThan(0)
    expect(resp[0]).toHaveProperty('txid')
  })

  it('get address tx in mempool', async () => {
    const address = 'bc1qs308e0rcv8aycdq3jcdxxu60ws3a6a5rcnhfyv'
    const resp = await esplora.getAddressTxsInMempool(address)
    expect(Array.isArray(resp)).toBe(true)
    resp.forEach((tx) => {
      expect(tx).toHaveProperty('txid')
      expect(typeof tx.txid).toBe('string')
    })
  })

  it('get address utxos', async () => {
    const address = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
    const resp = await esplora.getAddressUtxos(address)
    expect(Array.isArray(resp)).toBe(true)
    resp.forEach((utxo) => {
      expect(utxo).toHaveProperty('txid')
      expect(utxo).toHaveProperty('value')
    })
  })

  it('get fee estimates', async () => {
    const resp = await esplora.getFeeEstimates()
    expect(typeof resp).toBe('object')
    expect(resp).toHaveProperty('1')
    expect(typeof resp['1']).toBe('number')
  })

  it('get block info', async () => {
    const blockHash =
      '0000000054487811fc4ff7a95be738aa5ad9320c394c482b27c0da28b227ad5d'
    const resp = await esplora.getBlockInfo(blockHash)
    expect(resp).toHaveProperty('id', blockHash)
    expect(resp).toHaveProperty('height')
  })

  it('get block status', async () => {
    const blockHash =
      '0000000054487811fc4ff7a95be738aa5ad9320c394c482b27c0da28b227ad5d'
    const resp = await esplora.getBlockStatus(blockHash)
    expect(resp).toHaveProperty('height')
    expect(resp).toHaveProperty('in_best_chain')
    expect(resp).toHaveProperty('next_best')
  })

  it('get block transactions', async () => {
    const blockHash =
      '0000000054487811fc4ff7a95be738aa5ad9320c394c482b27c0da28b227ad5d'
    const resp = await esplora.getBlockTransactions(blockHash, 0)
    expect(Array.isArray(resp)).toBe(true)
    if (resp.length > 0) {
      expect(resp[0]).toHaveProperty('txid')
    }
  })

  it('get block transaction IDs', async () => {
    const blockHash =
      '0000000054487811fc4ff7a95be738aa5ad9320c394c482b27c0da28b227ad5d'
    const resp = await esplora.getBlockTransactionIds(blockHash)
    expect(Array.isArray(resp)).toBe(true)
    if (resp.length > 0) {
      expect(typeof resp[0]).toBe('string')
    }
  })

  it('get block hash at height', async () => {
    const height = 123456
    const resp = await esplora.getBlockAtHeight(height)
    expect(typeof resp).toBe('string')
  })

  it('get latest block hash', async () => {
    const resp = await esplora.getLatestBlockHash()
    expect(typeof resp).toBe('string')
  })

  it('get latest block height', async () => {
    const resp = await esplora.getLatestBlockHeight()
    expect(!isNaN(resp)).toBe(true)
  })

  it('get blocks starting from a height', async () => {
    const startHeight = 123450
    const resp = await esplora.getBlocks(startHeight)
    expect(Array.isArray(resp)).toBe(true)
    if (resp.length > 0) {
      expect(resp[0]).toHaveProperty('height')
    }
  })

  it('get mempool info', async () => {
    const resp = await esplora.getMempoolInfo()
    expect(resp).toHaveProperty('count')
    expect(resp).toHaveProperty('vsize')
    expect(resp).toHaveProperty('total_fee')
    expect(resp).toHaveProperty('fee_histogram')
  })

  it('get mempool txids', async () => {
    const resp = await esplora.getMempoolTxIds()
    expect(Array.isArray(resp)).toBe(true)
  })

  it('get last 10 mempool txns', async () => {
    const resp = await esplora.getRecentMempool()
    expect(Array.isArray(resp)).toBe(true)
  })
})
