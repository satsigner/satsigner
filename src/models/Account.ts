import { ScriptVersion } from "../enums/ScriptVersion";
import { SeedWords } from "../enums/SeedWords";

export default class Account {
  name: string;
  seedWords?: SeedWords;
  scriptVersion?: ScriptVersion;
}
