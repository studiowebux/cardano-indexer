import type Logger from "@studiowebux/deno-minilog";
import type { Counter } from "prom-client";

import type { LocalBlock, MatchOutput } from "../../shared/types.ts";
import type { IFilter } from "../types.ts";

import { register_metric } from "../../shared/prometheus/indexer.ts";

export class Filter implements IFilter {
  readonly id: string;
  readonly logger: Logger;

  readonly metric: Counter | null = null;

  constructor(id: string, logger: Logger) {
    this.id = id;
    this.logger = logger;

    this.metric = register_metric(id);
  }

  Match(
    _block: LocalBlock,
  ): Promise<Record<string, MatchOutput>> | Record<string, MatchOutput> {
    throw new Error("Not implemented");
  }
}
