import Logger from "@studiowebux/deno-minilog";
import type { LocalBlock, Match } from "../../shared/types.ts";
import type { IFilter } from "../types.ts";

export class Filter implements IFilter {
  readonly id: string;
  readonly logger: Logger;

  constructor(id: string, logger: Logger) {
    this.id = id;

    this.logger = logger;
  }

  Match(_block: LocalBlock): Match[] {
    throw new Error("Not implemented");
  }
}
