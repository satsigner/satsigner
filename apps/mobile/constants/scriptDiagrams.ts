import type { ScriptVersionType } from '@/types/models/Script'

type ScriptDiagramData =
  | 'emptyElement'
  | 'pubKey'
  | 'pubKeyHash'
  | 'redeemScript'
  | 'scriptHash'
  | 'signature'
  | 'signatures'
  | 'tweakedPubKey'
  | 'witnessProgram'
  | 'witnessScript'

export type ScriptDiagramItem =
  | { kind: 'opcode'; value: string }
  | { kind: 'data'; value: ScriptDiagramData }

export type ScriptDiagramRowLabel = 'scriptPubKey' | 'scriptSig' | 'witness'

export type ScriptDiagramRow = {
  label: ScriptDiagramRowLabel
  items: ScriptDiagramItem[]
}

function op(value: string): ScriptDiagramItem {
  return { kind: 'opcode', value }
}

function data(value: ScriptDiagramData): ScriptDiagramItem {
  return { kind: 'data', value }
}

const P2SH_LOCK: ScriptDiagramRow = {
  items: [op('OP_HASH160'), data('scriptHash'), op('OP_EQUAL')],
  label: 'scriptPubKey'
}

export const SCRIPT_DIAGRAMS: Record<ScriptVersionType, ScriptDiagramRow[]> = {
  P2PKH: [
    {
      items: [
        op('OP_DUP'),
        op('OP_HASH160'),
        data('pubKeyHash'),
        op('OP_EQUALVERIFY'),
        op('OP_CHECKSIG')
      ],
      label: 'scriptPubKey'
    },
    { items: [data('signature'), data('pubKey')], label: 'scriptSig' }
  ],
  P2SH: [
    P2SH_LOCK,
    {
      items: [op('OP_0'), data('signatures'), data('redeemScript')],
      label: 'scriptSig'
    }
  ],
  'P2SH-P2WPKH': [
    P2SH_LOCK,
    { items: [data('witnessProgram')], label: 'scriptSig' },
    { items: [data('signature'), data('pubKey')], label: 'witness' }
  ],
  'P2SH-P2WSH': [
    P2SH_LOCK,
    { items: [data('witnessProgram')], label: 'scriptSig' },
    {
      items: [data('emptyElement'), data('signatures'), data('witnessScript')],
      label: 'witness'
    }
  ],
  P2TR: [
    { items: [op('OP_1'), data('tweakedPubKey')], label: 'scriptPubKey' },
    { items: [data('signature')], label: 'witness' }
  ],
  P2WPKH: [
    { items: [op('OP_0'), data('pubKeyHash')], label: 'scriptPubKey' },
    { items: [data('signature'), data('pubKey')], label: 'witness' }
  ],
  P2WSH: [
    { items: [op('OP_0'), data('scriptHash')], label: 'scriptPubKey' },
    {
      items: [data('emptyElement'), data('signatures'), data('witnessScript')],
      label: 'witness'
    }
  ]
}
