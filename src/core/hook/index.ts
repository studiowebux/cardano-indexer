import type Logger from "@studiowebux/deno-minilog";
import type { LocalBlock, MatchOutput } from "../../shared/types.ts";
import type { IFilter } from "../types.ts";
import type { Filter } from "../filters/index.ts";

export class Hooks implements IFilter {
  protected filters: Filter[];
  protected logger: Logger;

  constructor(logger: Logger, filters: Filter[] = []) {
    this.filters = filters;
    this.logger = logger;
  }

  Enable(filter: Filter): Hooks {
    this.logger.info(`Enabling filter: ${filter.id}`);
    this.filters.push(filter);
    return this;
  }

  async Match(block: LocalBlock): Promise<Record<string, MatchOutput>> {
    try {
      if (!this.HasFilters()) {
        this.logger.error("No filters enabled.");
        return { ["NO_FILTER"]: { matches: false, id: "NO_FILTER" } };
      }

      // Execute all filters in parallel
      const matchPromises = this.filters.map((filter) => filter.Match(block));
      const results = await Promise.all(matchPromises);
      const matches: Record<string, MatchOutput> = {};
      results.map((result) =>
        Object.entries(result).forEach(([_key, item]) => {
          matches[item.id] = item;
        }),
      );
      return matches;
    } catch (e) {
      this.logger.error("An error occured in the Hook");
      this.logger.error(e);
      throw new Error(e);
    }
  }

  HasFilters(): boolean {
    return this.filters.length > 0;
  }
}
