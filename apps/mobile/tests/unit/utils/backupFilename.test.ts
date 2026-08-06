import { PACKAGE_ID_DEV, PACKAGE_ID_PROD } from '@/constants/variant'
import { getBackupVariantLabels } from '@/utils/backupFilename'

describe('getBackupVariantLabels', () => {
  it('labels plain and suffixed dev packages', () => {
    expect(getBackupVariantLabels(PACKAGE_ID_DEV)).toStrictEqual({
      suffixLabel: 'plain',
      variantLabel: 'dev'
    })
    expect(
      getBackupVariantLabels(`${PACKAGE_ID_DEV}.feat_privacy_algo`)
    ).toStrictEqual({
      suffixLabel: 'feat_privacy_algo',
      variantLabel: 'dev'
    })
  })

  it('labels plain and suffixed prod packages', () => {
    expect(getBackupVariantLabels(PACKAGE_ID_PROD)).toStrictEqual({
      suffixLabel: 'plain',
      variantLabel: 'prod'
    })
    expect(getBackupVariantLabels(`${PACKAGE_ID_PROD}.pr453`)).toStrictEqual({
      suffixLabel: 'pr453',
      variantLabel: 'prod'
    })
  })

  it('does not treat the longer dev package id as a prod suffix', () => {
    expect(getBackupVariantLabels(PACKAGE_ID_DEV)).toStrictEqual({
      suffixLabel: 'plain',
      variantLabel: 'dev'
    })
    expect(getBackupVariantLabels(`${PACKAGE_ID_DEV}.branch`)).toStrictEqual({
      suffixLabel: 'branch',
      variantLabel: 'dev'
    })
  })
})
