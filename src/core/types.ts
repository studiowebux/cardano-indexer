import type { Filter } from "../core/filters/index.ts";
import type { Hooks } from "../core/hook/index.ts";
import type { LocalBlock, Match } from "../shared/types.ts";

export interface IFilter {
  Enable?(filter: Filter): Hooks;
  Match(
    block: LocalBlock,
  ): Promise<Record<string, Match>> | Record<string, Match>;
}
