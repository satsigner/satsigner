import { type OP_CODE, OP_CODE_WORD } from '@/types/logic/opcode'

function isOpPush(word: string) {
  return word.match(/^\d{1,2}$/)
}

function isOpN(word: string) {
  return word.match(/^OP_\d+$/)
}

export function getOpcodeWord(word: string): OP_CODE_WORD {
  if (OP_CODES[word as OP_CODE_WORD]) return word as OP_CODE_WORD
  if (word === 'OP_0') return OP_CODE_WORD.OP_FALSE
  if (word === 'OP_1') return OP_CODE_WORD.OP_TRUE
  if (isOpPush(word)) return OP_CODE_WORD.OP_PUSH
  if (isOpN(word)) return OP_CODE_WORD.OP_N
  return OP_CODE_WORD.DATA
}

export function getOpcodeDetails(word: string): OP_CODE {
  const opcodeWord = getOpcodeWord(word)
  const opcodeDetails = OP_CODES[opcodeWord]
  if (opcodeWord === OP_CODE_WORD.OP_N) {
    opcodeDetails.word = word
  } else {
    opcodeDetails.word = opcodeWord
  }
  return opcodeDetails
}

export function bytesToHex(bytes: number[]) {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const OP_CODES: Record<OP_CODE_WORD, OP_CODE> = {
  DATA: {
    code: '',
    hex: '',
    type: ''
  },
  OP_FALSE: {
    code: '0',
    hex: '0x00',
    type: 'push value'
  },
  OP_PUSH: {
    code: '1-75',
    hex: '0x01-0x4b',
    type: 'push value'
  },
  OP_PUSHDATA1: {
    code: '76',
    hex: '0x4c',
    type: 'push value'
  },
  OP_PUSHDATA2: {
    code: '77',
    hex: '0x4d',
    type: 'push value'
  },
  OP_PUSHDATA4: {
    code: '78',
    hex: '0x4e',
    type: 'push value'
  },
  OP_1NEGATE: {
    code: '79',
    hex: '0x4f',
    type: 'push value'
  },
  OP_RESERVED: {
    code: '80',
    hex: '0x50',
    type: 'push value'
  },
  OP_TRUE: {
    code: '81',
    hex: '0x51',
    type: 'push value'
  },
  OP_N: {
    code: '82-96',
    hex: '0x52-0x60',
    type: 'push value'
  },
  OP_NOP: {
    code: '97',
    hex: '0x61',
    type: 'control'
  },
  OP_VER: {
    code: '98',
    hex: '0x62',
    type: 'control'
  },
  OP_IF: {
    code: '99',
    hex: '0x63',
    type: 'control'
  },
  OP_NOTIF: {
    code: '100',
    hex: '0x64',
    type: 'control'
  },
  OP_VERIF: {
    code: '101',
    hex: '0x65',
    type: 'control'
  },
  OP_VERNOTIF: {
    code: '102',
    hex: '0x66',
    type: 'control'
  },
  OP_ELSE: {
    code: '103',
    hex: '0x67',
    type: 'control'
  },
  OP_ENDIF: {
    code: '104',
    hex: '0x68',
    type: 'control'
  },
  OP_VERIFY: {
    code: '105',
    hex: '0x69',
    type: 'control'
  },
  OP_RETURN: {
    code: '106',
    hex: '0x6a',
    type: 'control'
  },
  OP_TOALTSTACK: {
    code: '107',
    hex: '0x6b',
    type: 'stack ops'
  },
  OP_FROMALTSTACK: {
    code: '108',
    hex: '0x6c',
    type: 'stack ops'
  },
  OP_2DROP: {
    code: '109',
    hex: '0x6d',
    type: 'stack ops'
  },
  OP_2DUP: {
    code: '110',
    hex: '0x6e',
    type: 'stack ops'
  },
  OP_3DUP: {
    code: '111',
    hex: '0x6f',
    type: 'stack ops'
  },
  OP_2OVER: {
    code: '112',
    hex: '0x70',
    type: 'stack ops'
  },
  OP_2ROT: {
    code: '113',
    hex: '0x71',
    type: 'stack ops'
  },
  OP_2SWAP: {
    code: '114',
    hex: '0x72',
    type: 'stack ops'
  },
  OP_IFDUP: {
    code: '115',
    hex: '0x73',
    type: 'stack ops'
  },
  OP_DEPTH: {
    code: '116',
    hex: '0x74',
    type: 'stack ops'
  },
  OP_DROP: {
    code: '117',
    hex: '0x75',
    type: 'stack ops'
  },
  OP_DUP: {
    code: '118',
    hex: '0x76',
    type: 'stack ops'
  },
  OP_NIP: {
    code: '119',
    hex: '0x77',
    type: 'stack ops'
  },
  OP_OVER: {
    code: '120',
    hex: '0x78',
    type: 'stack ops'
  },
  OP_PICK: {
    code: '121',
    hex: '0x79',
    type: 'stack ops'
  },
  OP_ROLL: {
    code: '122',
    hex: '0x7a',
    type: 'stack ops'
  },
  OP_ROT: {
    code: '123',
    hex: '0x7b',
    type: 'stack ops'
  },
  OP_SWAP: {
    code: '124',
    hex: '0x7c',
    type: 'stack ops'
  },
  OP_TUCK: {
    code: '125',
    hex: '0x7d',
    type: 'stack ops'
  },
  OP_CAT: {
    code: '126',
    hex: '0x7e',
    type: 'splice ops'
  },
  OP_SUBSTR: {
    code: '127',
    hex: '0x7f',
    type: 'splice ops'
  },
  OP_LEFT: {
    code: '128',
    hex: '0x80',
    type: 'splice ops'
  },
  OP_RIGHT: {
    code: '129',
    hex: '0x81',
    type: 'splice ops'
  },
  OP_SIZE: {
    code: '130',
    hex: '0x82',
    type: 'splice ops'
  },
  OP_INVERT: {
    code: '131',
    hex: '0x83',
    type: 'bit logic'
  },
  OP_AND: {
    code: '132',
    hex: '0x84',
    type: 'bit logic'
  },
  OP_OR: {
    code: '133',
    hex: '0x85',
    type: 'bit logic'
  },
  OP_XOR: {
    code: '134',
    hex: '0x86',
    type: 'bit logic'
  },
  OP_EQUAL: {
    code: '135',
    hex: '0x87',
    type: 'bit logic'
  },
  OP_EQUALVERIFY: {
    code: '136',
    hex: '0x88',
    type: 'bit logic'
  },
  OP_RESERVED1: {
    code: '137',
    hex: '0x89',
    type: 'bit logic'
  },
  OP_RESERVED2: {
    code: '138',
    hex: '0x8a',
    type: 'bit logic'
  },
  OP_1ADD: {
    code: '139',
    hex: '0x8b',
    type: 'arithmetic'
  },
  OP_1SUB: {
    code: '140',
    hex: '0x8c',
    type: 'arithmetic'
  },
  OP_2MUL: {
    code: '141',
    hex: '0x8d',
    type: 'arithmetic'
  },
  OP_2DIV: {
    code: '142',
    hex: '0x8e',
    type: 'arithmetic'
  },
  OP_NEGATE: {
    code: '143',
    hex: '0x8f',
    type: 'arithmetic'
  },
  OP_ABS: {
    code: '144',
    hex: '0x90',
    type: 'arithmetic'
  },
  OP_NOT: {
    code: '145',
    hex: '0x91',
    type: 'arithmetic'
  },
  OP_0NOTEQUAL: {
    code: '146',
    hex: '0x92',
    type: 'arithmetic'
  },
  OP_ADD: {
    code: '147',
    hex: '0x93',
    type: 'arithmetic'
  },
  OP_SUB: {
    code: '148',
    hex: '0x94',
    type: 'arithmetic'
  },
  OP_MUL: {
    code: '149',
    hex: '0x95',
    type: 'arithmetic'
  },
  OP_DIV: {
    code: '150',
    hex: '0x96',
    type: 'arithmetic'
  },
  OP_MOD: {
    code: '151',
    hex: '0x97',
    type: 'arithmetic'
  },
  OP_LSHIFT: {
    code: '152',
    hex: '0x98',
    type: 'arithmetic'
  },
  OP_RSHIFT: {
    code: '153',
    hex: '0x99',
    type: 'arithmetic'
  },
  OP_BOOLAND: {
    code: '154',
    hex: '0x9a',
    type: 'arithmetic'
  },
  OP_BOOLOR: {
    code: '155',
    hex: '0x9b',
    type: 'arithmetic'
  },
  OP_NUMEQUAL: {
    code: '156',
    hex: '0x9c',
    type: 'arithmetic'
  },
  OP_NUMEQUALVERIFY: {
    code: '157',
    hex: '0x9d',
    type: 'arithmetic'
  },
  OP_NUMNOTEQUAL: {
    code: '158',
    hex: '0x9e',
    type: 'arithmetic'
  },
  OP_LESSTHAN: {
    code: '159',
    hex: '0x9f',
    type: 'arithmetic'
  },
  OP_GREATERTHAN: {
    code: '160',
    hex: '0xa0',
    type: 'arithmetic'
  },
  OP_LESSTHANOREQUAL: {
    code: '161',
    hex: '0xa1',
    type: 'arithmetic'
  },
  OP_GREATERTHANOREQUAL: {
    code: '162',
    hex: '0xa2',
    type: 'arithmetic'
  },
  OP_MIN: {
    code: '163',
    hex: '0xa3',
    type: 'arithmetic'
  },
  OP_MAX: {
    code: '164',
    hex: '0xa4',
    type: 'arithmetic'
  },
  OP_WITHIN: {
    code: '165',
    hex: '0xa5',
    type: 'arithmetic'
  },
  OP_RIPEMD160: {
    code: '166',
    hex: '0xa6',
    type: 'crypto'
  },
  OP_SHA1: {
    code: '167',
    hex: '0xa7',
    type: 'crypto'
  },
  OP_SHA256: {
    code: '168',
    hex: '0xa8',
    type: 'crypto'
  },
  OP_HASH160: {
    code: '169',
    hex: '0xa9',
    type: 'crypto'
  },
  OP_HASH256: {
    code: '170',
    hex: '0xaa',
    type: 'crypto'
  },
  OP_CODESEPARATOR: {
    code: '171',
    hex: '0xab',
    type: 'crypto'
  },
  OP_CHECKSIG: {
    code: '172',
    hex: '0xac',
    type: 'crypto'
  },
  OP_CHECKSIGVERIFY: {
    code: '173',
    hex: '0xad',
    type: 'crypto'
  },
  OP_CHECKMULTISIG: {
    code: '174',
    hex: '0xae',
    type: 'crypto'
  },
  OP_CHECKMULTISIGVERIFY: {
    code: '175',
    hex: '0xaf',
    type: 'crypto'
  },
  OP_NOP1: {
    code: '176',
    hex: '0xb0',
    type: 'expansion'
  },
  OP_CHECKLOCKTIMEVERIFY: {
    code: '177',
    hex: '0xb1',
    type: 'expansion'
  },
  OP_NOP2: {
    code: '177',
    hex: '0xb1',
    type: 'expansion'
  },
  OP_CHECKSEQUENCEVERIFY: {
    code: '178',
    hex: '0xb2',
    type: 'expansion'
  },
  OP_NOP3: {
    code: '178',
    hex: '0xb2',
    type: 'expansion'
  },
  OP_NOP4: {
    code: '179',
    hex: '0xb3',
    type: 'expansion'
  },
  OP_NOP5: {
    code: '180',
    hex: '0xb4',
    type: 'expansion'
  },
  OP_NOP6: {
    code: '181',
    hex: '0xb5',
    type: 'expansion'
  },
  OP_NOP7: {
    code: '182',
    hex: '0xb6',
    type: 'expansion'
  },
  OP_NOP8: {
    code: '183',
    hex: '0xb7',
    type: 'expansion'
  },
  OP_NOP9: {
    code: '184',
    hex: '0xb8',
    type: 'expansion'
  },
  OP_NOP10: {
    code: '185',
    hex: '0xb9',
    type: 'expansion'
  },
  OP_CHECKSIGADD: {
    code: '186',
    hex: '0xba',
    type: ''
  },
  OP_INVALIDOPCODE: {
    code: '255',
    hex: '0xff',
    type: 'invalid code'
  }
}
