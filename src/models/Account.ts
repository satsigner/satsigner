import { ScriptVersion } from "../enums/ScriptVersion";
import { SeedWords } from "../enums/SeedWords";

export default interface Account {
  name: string;
  seedWords?: SeedWords;
  scriptVersion?: ScriptVersion;
}
