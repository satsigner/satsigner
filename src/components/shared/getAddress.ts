import { Address } from "bdk-rn";
import { LocalUtxo } from "bdk-rn/lib/classes/Bindings";
import { Network } from "bdk-rn/lib/lib/enums";

export default async function getAddress(utxo: LocalUtxo, network: Network): Promise<string> {
  const script = utxo.txout.script;
  const address = await new Address().fromScript(script, network);
  return address.asString();
}
