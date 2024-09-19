import type Logger from "@studiowebux/deno-minilog";
import type PromClient from "prom-client";

import type { LocalBlock, MatchOutput } from "../../shared/types.ts";
import type { IFilter } from "../types.ts";
import type { Counter } from "prom-client";

export class Filter implements IFilter {
  readonly id: string;
  readonly logger: Logger;

  readonly metric: Counter | null = null;

  constructor(
    id: string,
    logger: Logger,
    prom_client: typeof PromClient | null = null,
  ) {
    this.id = id;
    this.logger = logger;

    if (prom_client) {
      this.metric = new prom_client.Counter({
        name: id,
        help: `Filter Metric for ${id}`,
      });
    }
  }

  Match(
    _block: LocalBlock,
  ): Promise<Record<string, MatchOutput>> | Record<string, MatchOutput> {
    throw new Error("Not implemented");
  }
}
