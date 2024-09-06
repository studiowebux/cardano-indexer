import Logger from "@studiowebux/deno-minilog";
import type { LocalBlock, Match } from "../../shared/types.ts";
import type { IFilter } from "../types.ts";
import { Filter } from "../filters/index.ts";

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

  async Match(block: LocalBlock): Promise<Match[]> {
    if (this.filters.length === 0) {
      this.logger.error("No filters enabled.");
      return [{ matches: false }];
    }

    // Execute all filters in parallel
    const matchPromises = this.filters.map((filter) => filter.Match(block));
    const results = await Promise.all(matchPromises);
    const allMatches = results.flat();
    const matches = allMatches.filter((match) => match.matches);
    return matches;
  }

  HasFilters(): boolean {
    return this.filters.length > 0;
  }
}
