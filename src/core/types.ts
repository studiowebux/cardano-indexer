import { Filter } from "../core/filters/index.ts";
import { Hooks } from "../core/hook/index.ts";
import { LocalBlock, Match } from "../shared/types.ts";

export interface IFilter {
  Enable?(filter: Filter): Hooks;
  Match(block: LocalBlock): Promise<Match[]>;
}
