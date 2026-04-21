import {
  parseKind1DraftFromJson,
  stripZapTags
} from '@/utils/nostrComposeImport'

describe('nostrComposeImport', () => {
  describe('stripZapTags', () => {
    it('removes zap-related tags', () => {
      expect(
        stripZapTags([
          ['e', 'abc'],
          ['zap-min', '1000'],
          ['zap-max', '2000']
        ])
      ).toStrictEqual([['e', 'abc']])
    })
  })

  describe('parseKind1DraftFromJson', () => {
    it('parses minimal unsigned draft', () => {
      const raw = JSON.stringify({ content: 'hello', kind: 1, tags: [] })
      expect(parseKind1DraftFromJson(raw)).toStrictEqual({
        content: 'hello',
        tags: []
      })
    })

    it('defaults kind to 1 when omitted', () => {
      const raw = JSON.stringify({ content: 'x', tags: [['t', 'y']] })
      expect(parseKind1DraftFromJson(raw)).toStrictEqual({
        content: 'x',
        tags: [['t', 'y']]
      })
    })

    it('accepts signed-shaped payload and ignores extra fields', () => {
      const raw = JSON.stringify({
        content: 'body',
        created_at: 1,
        id: '00'.repeat(32),
        kind: 1,
        pubkey: '11'.repeat(32),
        sig: 'aa'.repeat(64),
        tags: [['p', '22'.repeat(32)]]
      })
      expect(parseKind1DraftFromJson(raw)).toStrictEqual({
        content: 'body',
        tags: [['p', '22'.repeat(32)]]
      })
    })

    it('rejects non-kind-1', () => {
      expect(
        parseKind1DraftFromJson(
          JSON.stringify({ content: 'x', kind: 7, tags: [] })
        )
      ).toBeNull()
    })

    it('rejects invalid tag shape', () => {
      expect(
        parseKind1DraftFromJson(
          JSON.stringify({ content: 'x', kind: 1, tags: [['e', 1]] })
        )
      ).toBeNull()
    })

    it('rejects invalid JSON', () => {
      expect(parseKind1DraftFromJson('not json')).toBeNull()
    })
  })
})
