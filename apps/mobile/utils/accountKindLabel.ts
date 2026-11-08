import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type ScriptVersionType } from '@/types/models/Script'

const POLICY_LABEL_KEYS: Record<Account['policyType'], string> = {
  multisig: 'account.policy.multiSignature.title',
  singlesig: 'account.policy.singleSignature.title',
  watchonly: 'account.policy.watchOnly.title'
}

function getAccountKindLabel({
  policyType,
  scriptVersion
}: {
  policyType: Account['policyType']
  scriptVersion: ScriptVersionType | undefined
}): string {
  const policy = t(POLICY_LABEL_KEYS[policyType])
  return scriptVersion ? `${scriptVersion} · ${policy}` : policy
}

function getAccountKindLabelFromAccount(
  account: Pick<Account, 'keys' | 'policyType'>
): string {
  return getAccountKindLabel({
    policyType: account.policyType,
    scriptVersion: account.keys[0]?.scriptVersion
  })
}

export { getAccountKindLabel, getAccountKindLabelFromAccount }
