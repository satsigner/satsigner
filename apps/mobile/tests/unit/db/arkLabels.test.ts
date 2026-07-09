import { getDb } from '@/db/connection'
import { deleteArkLabelsByAccount, setArkLabel } from '@/db/mutations/arkLabels'
import { getArkLabelsByAccount } from '@/db/queries/arkLabels'

const execute = jest.mocked(getDb().execute)

describe('ark labels db', () => {
  beforeEach(() => {
    execute.mockClear()
    execute.mockReturnValue({ results: [] })
  })

  describe('setArkLabel', () => {
    it('upserts the label row when the label is not empty', () => {
      setArkLabel('account1', '42', 'tx', 'Coffee purchase #expense')

      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute).toHaveBeenCalledWith(
        expect.stringMatching(
          /INSERT INTO ark_labels[\s\S]*ON CONFLICT\(ref, account_id\)/
        ),
        ['42', 'account1', 'tx', 'Coffee purchase #expense']
      )
    })

    it('deletes the label row when the label is empty', () => {
      setArkLabel('account1', '42', 'tx', '')

      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM ark_labels'),
        ['42', 'account1']
      )
    })

    it('stores vtxo labels under the output type', () => {
      setArkLabel('account1', 'vtxoid:1', 'output', 'Change')

      expect(execute).toHaveBeenCalledWith(expect.any(String), [
        'vtxoid:1',
        'account1',
        'output',
        'Change'
      ])
    })
  })

  describe('deleteArkLabelsByAccount', () => {
    it('deletes every label row of the account', () => {
      deleteArkLabelsByAccount('account1')

      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM ark_labels WHERE account_id = ?'),
        ['account1']
      )
    })
  })

  describe('getArkLabelsByAccount', () => {
    it('maps rows into a record keyed by ref', () => {
      execute.mockReturnValue({
        results: [
          {
            account_id: 'account1',
            label: 'Coffee purchase #expense',
            ref: '42',
            type: 'tx'
          },
          {
            account_id: 'account1',
            label: 'Change',
            ref: 'vtxoid:1',
            type: 'output'
          }
        ]
      })

      const labels = getArkLabelsByAccount('account1')

      expect(labels).toStrictEqual({
        '42': { label: 'Coffee purchase #expense', ref: '42', type: 'tx' },
        'vtxoid:1': { label: 'Change', ref: 'vtxoid:1', type: 'output' }
      })
    })

    it('returns an empty record when the account has no labels', () => {
      expect(getArkLabelsByAccount('account1')).toStrictEqual({})
    })
  })
})
